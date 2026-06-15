from __future__ import annotations

import json
import math
import os
import re
import ssl
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, wait
from datetime import datetime, timedelta, timezone
from html.parser import HTMLParser
from io import BytesIO
from pathlib import Path
from threading import Event, Lock, Thread

import certifi
from bson import ObjectId
from docx import Document
from dotenv import load_dotenv
from pypdf import PdfReader
from pymongo.errors import DuplicateKeyError, PyMongoError

from . import database as database_state
from .data import CAREER_PATHS, JOB_SKILL_REQUIREMENTS, SKILL_ALIASES, TECH_SKILLS
from .database import bookmarks_collection, job_feed_collection, sessions_collection, users_collection, utc_now
from .security import create_token, hash_password, verify_password

load_dotenv()

MOCK_STORE_PATH = Path(__file__).resolve().parent.parent / "mock_store.json"

LANGUAGE_TO_SKILL = {
    "JavaScript": ["JavaScript", "Node.js"],
    "TypeScript": ["TypeScript", "JavaScript"],
    "Python": ["Python"],
    "Java": ["Java"],
    "C++": ["C++"],
    "C#": ["C#", "ASP.NET"],
    "Go": ["Go"],
    "Rust": ["Rust"],
    "Ruby": ["Ruby"],
    "PHP": ["PHP"],
    "Swift": ["Swift"],
    "Kotlin": ["Kotlin"],
    "HTML": ["HTML"],
    "CSS": ["CSS"],
    "SCSS": ["CSS"],
    "Less": ["CSS"],
    "Vue": ["Vue.js", "JavaScript"],
    "Jupyter Notebook": ["Python", "Jupyter Notebook", "Pandas", "NumPy"],
    "Blade": ["PHP", "Laravel"],
    "Shell": ["Linux", "Git"],
    "Dockerfile": ["Docker"],
    "HCL": ["Terraform"],
}

LEARNING_RESOURCES = {
    "React": ["React Docs", "Frontend Masters React Path", "Epic React"],
    "TypeScript": ["TypeScript Handbook", "Total TypeScript", "Type Challenges"],
    "FastAPI": ["FastAPI Docs", "TestDriven.io FastAPI Guides", "SQLModel Tutorials"],
    "MongoDB": ["MongoDB University", "MongoDB Docs", "Practical MongoDB Aggregations"],
    "Docker": ["Docker Docs", "Play with Docker", "Docker Deep Dive"],
    "Python": ["Python Docs", "Real Python", "Exercism Python Track"],
    "Machine Learning": ["Kaggle Learn", "Andrew Ng ML Specialization", "Scikit-learn Tutorials"],
    "Git": ["Pro Git", "Learn Git Branching", "GitHub Skills"],
}

GENERAL_CHAT_GUIDANCE = {
    "greeting": "Hello! I'm CareerAI, and I can help with career planning, technical concepts, interview prep, learning strategy, job search decisions, and profile improvement.",
    "fallback": "I can help with technical explanations, roadmap planning, interview practice, job-fit analysis, learning priorities, and profile feedback. If you want, tell me your goal or the role you're targeting.",
}

GENERAL_CONCEPT_RESPONSES = {
    "react": "React is a component-based UI library. It is useful when you want reusable interface pieces, stateful interactions, and a large frontend ecosystem.",
    "next.js": "Next.js extends React with routing, server rendering, API routes, and production conventions. It is a good choice when SEO, performance, or full-stack React workflows matter.",
    "fastapi": "FastAPI is a Python API framework with strong typing, validation, automatic docs, and async support. It is especially productive for data-driven web backends.",
    "mongodb": "MongoDB is a document database that stores JSON-like records. It works well when your schema evolves quickly or nested data is a natural fit.",
    "docker": "Docker packages an application with its runtime environment so it behaves consistently across machines. It helps a lot with onboarding, deployment, and reproducibility.",
    "jwt": "JWT is a signed token format often used in authentication. It can carry identity claims, but it still needs careful validation, expiry handling, and refresh strategies.",
    "cloud computing": "Cloud computing means using remote servers, storage, databases, networking, and software over the internet instead of owning all infrastructure yourself. It helps teams scale faster, pay for what they use, and deploy globally.",
    "large language model": "A large language model is an AI model trained on large text/code datasets to understand and generate language. It is useful for chatbots, summarization, coding help, tutoring, and knowledge workflows, but it should still be checked for accuracy.",
    "llm": "An LLM, or large language model, is an AI model that predicts and generates text from context. Good apps wrap LLMs with clear prompts, user context, retrieval, safety checks, and fallbacks.",
}

LIVE_JOB_CACHE_TTL = timedelta(minutes=float(os.getenv("JOB_CACHE_MINUTES", "30")))
_LIVE_JOB_CACHE: dict[str, object] = {}
_LIVE_JOB_CACHE_LOCK = Lock()
_LIVE_JOB_REFRESH_LOCK = Lock()
_LIVE_JOB_REFRESHING = False
JOB_FETCH_TIMEOUT_SECONDS = float(os.getenv("JOB_FETCH_TIMEOUT_SECONDS", "18"))
JOB_FETCH_TOTAL_TIMEOUT_SECONDS = float(os.getenv("JOB_FETCH_TOTAL_TIMEOUT_SECONDS", "22"))
JOB_AUTO_REFRESH_MINUTES = max(5.0, float(os.getenv("JOB_AUTO_REFRESH_MINUTES", "30")))
JOBZ_PAKISTAN_URLS = (
    "https://www.jobz.pk/software-engineer-jobs/",
    "https://www.jobz.pk/software-engineer-jobs-in-lahore/",
    "https://www.jobz.pk/software-engineer-jobs-in-islamabad/",
    "https://www.jobz.pk/software-engineer-jobs-in-karachi/",
)
_JOB_SCHEDULER_STOP = Event()
_JOB_SCHEDULER_LOCK = Lock()
_JOB_SCHEDULER_THREAD: Thread | None = None
MAX_RESUME_FILE_BYTES = 5 * 1024 * 1024
ALLOWED_RESUME_SUFFIXES = {".pdf", ".docx"}
RESUME_SECTION_PATTERN = re.compile(
    r"\b(summary|objective|profile|education|academic qualifications|qualifications|experience|work history|employment|skills|technical skills|projects|certifications|achievements|references)\b",
    re.IGNORECASE,
)
GITHUB_FETCH_TIMEOUT_SECONDS = float(os.getenv("GITHUB_FETCH_TIMEOUT_SECONDS", "10"))


def _encode_mock_doc(document: dict) -> dict:
    encoded = dict(document)
    for key in ("_id", "userId"):
        if key in encoded and isinstance(encoded[key], ObjectId):
            encoded[key] = str(encoded[key])
    return encoded


def _decode_mock_doc(document: dict) -> dict:
    decoded = dict(document)
    for key in ("_id", "userId"):
        value = decoded.get(key)
        if isinstance(value, str) and ObjectId.is_valid(value):
            decoded[key] = ObjectId(value)
    return decoded


def _persist_mock_store() -> None:
    if not database_state.is_mock_client:
        return
    payload = {
        "users": [_encode_mock_doc(document) for document in users_collection.find()],
        "sessions": [_encode_mock_doc(document) for document in sessions_collection.find()],
        "bookmarks": [_encode_mock_doc(document) for document in bookmarks_collection.find()],
    }
    MOCK_STORE_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def _hydrate_mock_store() -> None:
    if not database_state.is_mock_client or not MOCK_STORE_PATH.exists() or users_collection.count_documents({}) > 0:
        return
    try:
        payload = json.loads(MOCK_STORE_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return

    for collection, key in ((users_collection, "users"), (sessions_collection, "sessions"), (bookmarks_collection, "bookmarks")):
        documents = [_decode_mock_doc(document) for document in payload.get(key, []) if isinstance(document, dict)]
        if documents:
            collection.insert_many(documents)


_hydrate_mock_store()


def normalize_skill(skill: str) -> str:
    return skill.strip().lower()


def canonical_skill(skill: str) -> str:
    normalized = normalize_skill(skill)
    for known in TECH_SKILLS:
        if normalize_skill(known) == normalized:
            return known
    for known, aliases in SKILL_ALIASES.items():
        if normalized in {normalize_skill(alias) for alias in aliases}:
            return known
    return skill.strip()


def normalize_skills(skills: list[str] | None) -> list[str]:
    if not skills:
        return []
    cleaned: dict[str, str] = {}
    for skill in skills:
        if not isinstance(skill, str):
            continue
        canonical = canonical_skill(skill)
        if canonical:
            cleaned[normalize_skill(canonical)] = canonical
    return sorted(cleaned.values())


def serialize_user(document: dict | None) -> dict | None:
    if document is None:
        return None
    return {
        "id": str(document["_id"]),
        "name": document["name"],
        "email": document["email"],
        "skills": document.get("skills", []),
        "githubUsername": document.get("githubUsername"),
        "githubProfile": document.get("githubProfile"),
        "githubLastSyncedAt": document.get("githubLastSyncedAt"),
        "targetRole": document.get("targetRole"),
        "resumeText": document.get("resumeText"),
        "resumeFilename": document.get("resumeFilename"),
        "resumeUploadedAt": document.get("resumeUploadedAt"),
        "education": document.get("education"),
        "summary": document.get("summary"),
        "experienceLevel": document.get("experienceLevel"),
        "lastUpdated": document.get("lastUpdated"),
    }


def extract_skills_from_text(text: str) -> list[str]:
    normalized = text.lower()
    found: set[str] = set()

    for skill in TECH_SKILLS:
        variants = [skill.lower(), *SKILL_ALIASES.get(skill, [])]
        for variant in variants:
            escaped = re.escape(variant)
            if re.search(rf"(^|[^a-z0-9+#]){escaped}([^a-z0-9+#]|$)", normalized, re.IGNORECASE):
                found.add(skill)
                break

    return sorted(found)


def infer_experience_level(text: str) -> str:
    years = [int(match.group(1)) for match in re.finditer(r"(\d+)\+?\s*(?:years|yrs)", text, re.IGNORECASE)]
    highest = max(years) if years else 0
    if highest >= 4:
        return "Advanced"
    if highest >= 2:
        return "Intermediate"
    return "Beginner"


def extract_profile_details_from_text(text: str) -> dict:
    lines = [line.strip(" -•\t") for line in text.splitlines() if line.strip()]
    education_terms = re.compile(r"\b(bs|bsc|b\.s|bachelor|ms|msc|m\.s|master|software engineering|computer science|university|college|iiui)\b", re.IGNORECASE)
    summary_terms = re.compile(r"\b(summary|objective|profile)\b", re.IGNORECASE)

    education_lines = [line for line in lines if education_terms.search(line)][:3]
    summary = ""
    for index, line in enumerate(lines):
        if summary_terms.search(line):
            summary = " ".join(lines[index + 1 : index + 4])[:280]
            break
    if not summary:
        summary = " ".join(lines[:3])[:280]

    return {
        "education": "; ".join(education_lines) if education_lines else None,
        "summary": summary or None,
    }


def tokenize(text: str) -> list[str]:
    return re.findall(r"[a-zA-Z0-9+#.]+", text.lower())


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def cosine_similarity(a_tokens: list[str], b_tokens: list[str]) -> float:
    a_counts = Counter(a_tokens)
    b_counts = Counter(b_tokens)
    intersection = set(a_counts) & set(b_counts)
    numerator = sum(a_counts[token] * b_counts[token] for token in intersection)
    a_norm = math.sqrt(sum(value * value for value in a_counts.values()))
    b_norm = math.sqrt(sum(value * value for value in b_counts.values()))
    if not a_norm or not b_norm:
        return 0.0
    return numerator / (a_norm * b_norm)


def get_skill_gap(user_skills: list[str], target_role: str) -> dict:
    required = JOB_SKILL_REQUIREMENTS.get(target_role, [])
    normalized = {normalize_skill(skill) for skill in user_skills}
    matched = [skill for skill in required if normalize_skill(skill) in normalized]
    missing = [skill for skill in required if normalize_skill(skill) not in normalized]
    return {"matched": matched, "missing": missing}


def get_match_percent(user_skills: list[str], target_role: str) -> int:
    gap = get_skill_gap(user_skills, target_role)
    total = len(gap["matched"]) + len(gap["missing"])
    return round((len(gap["matched"]) / total) * 100) if total else 0


def recommend_career_path(user_skills: list[str]) -> str:
    normalized = {normalize_skill(skill) for skill in user_skills}
    best_key = "fullstack"
    best_score = -1

    for key, path in CAREER_PATHS.items():
        score = len([skill for skill in path["skills"] if normalize_skill(skill) in normalized])
        if score > best_score:
            best_key = key
            best_score = score
    return best_key


def career_key_for_role(role: str | None, user_skills: list[str]) -> str:
    if role:
        for key, path in CAREER_PATHS.items():
            if path["title"].lower() == role.lower():
                return key
    return recommend_career_path(user_skills)


def get_profile_completion(user: dict) -> int:
    score = 0
    if user.get("name"):
        score += 15
    if user.get("email"):
        score += 10
    if user.get("resumeText"):
        score += 20
    if user.get("githubUsername"):
        score += 15
    if user.get("skills"):
        score += 20
    if user.get("targetRole"):
        score += 10
    if user.get("summary") or user.get("education"):
        score += 10
    return score


def _fetch_json(url: str, headers: dict | None = None, timeout: float | None = None) -> dict | list:
    request_headers = {
        "Accept": "application/json",
        "User-Agent": "CareerAI-FYP-App/1.0",
        **(headers or {}),
    }
    request = urllib.request.Request(url, headers=request_headers)
    ssl_context = ssl.create_default_context(cafile=certifi.where())
    with urllib.request.urlopen(request, timeout=timeout or JOB_FETCH_TIMEOUT_SECONDS, context=ssl_context) as response:
        return json.load(response)


def _fetch_html(url: str, headers: dict | None = None, timeout: float | None = None) -> str:
    request_headers = {
        "Accept": "text/html,application/xhtml+xml",
        "User-Agent": "CareerAI-FYP-App/1.0",
        **(headers or {}),
    }
    request = urllib.request.Request(url, headers=request_headers)
    ssl_context = ssl.create_default_context(cafile=certifi.where())
    with urllib.request.urlopen(request, timeout=timeout or JOB_FETCH_TIMEOUT_SECONDS, context=ssl_context) as response:
        encoding = response.headers.get_content_charset() or "utf-8"
        return response.read().decode(encoding, errors="replace")


def _clean_html(value: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", value or "")).strip()


def _parse_salary_value(salary: str | None) -> int | None:
    if not salary:
        return None
    matches = re.findall(r"(\d+(?:\.\d+)?)\s*([kKmM]?)", salary.replace(",", ""))
    if not matches:
        return None
    values = []
    for number, suffix in matches:
        value = float(number)
        if suffix.lower() == "k":
            value *= 1_000
        elif suffix.lower() == "m":
            value *= 1_000_000
        values.append(int(value))
    return max(values) if values else None


def _parse_date_score(date_value: str | None) -> float:
    if not date_value:
        return 0.0
    cleaned = str(date_value).replace("Z", "+00:00")
    for parser in (
        lambda: datetime.fromisoformat(cleaned),
        lambda: datetime.fromtimestamp(int(cleaned), tz=timezone.utc),
    ):
        try:
            parsed = parser()
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            age_days = max((_now_utc() - parsed).days, 0)
            return max(0.0, 10 - min(age_days, 10))
        except (ValueError, OSError, TypeError):
            continue
    return 0.0


def _infer_work_mode(location: str) -> str:
    lowered = (location or "").lower()
    if "remote" in lowered:
        return "remote"
    if "hybrid" in lowered:
        return "hybrid"
    return "on-site"


def _infer_experience_from_job(job: dict) -> str:
    text = " ".join(
        [
            job.get("title", ""),
            job.get("description", ""),
            job.get("type", ""),
        ]
    ).lower()
    if any(term in text for term in ("intern", "internship", "trainee", "junior", "entry")):
        return "entry"
    if any(term in text for term in ("senior", "lead", "staff", "principal")):
        return "senior"
    return "mid"


def _normalize_job_type(value: str | None) -> str:
    normalized = re.sub(r"[\s_]+", "-", (value or "").strip().lower())
    if any(term in normalized for term in ("intern", "trainee")):
        return "internship"
    if any(term in normalized for term in ("contract", "freelance")):
        return "contract"
    if normalized in {"full-time", "fulltime", "permanent"}:
        return "full-time"
    if normalized in {"part-time", "parttime"}:
        return "part-time"
    return normalized or "full-time"


def _job_matches_filters(
    job: dict,
    *,
    type_filter: str = "all",
    work_mode: str = "all",
    location: str = "",
    min_salary: int = 0,
    experience_level: str = "all",
    technologies: list[str] | None = None,
) -> bool:
    technologies = technologies or []
    if type_filter and type_filter.lower() != "all" and _normalize_job_type(job.get("type")) != _normalize_job_type(type_filter):
        return False
    if work_mode and work_mode != "all" and _infer_work_mode(job.get("location", "")) != work_mode:
        return False
    if location and location.lower() not in f"{job.get('location', '')} {job.get('company', '')}".lower():
        return False
    salary_value = _parse_salary_value(job.get("salary"))
    if min_salary and salary_value is not None and salary_value < min_salary:
        return False
    if min_salary and salary_value is None:
        return False
    if experience_level and experience_level != "all" and _infer_experience_from_job(job) != experience_level:
        return False
    if technologies:
        tags = {normalize_skill(tag) for tag in job.get("tags", [])}
        searchable = f"{job.get('title', '')} {job.get('description', '')} {' '.join(job.get('tags', []))}".lower()
        if not any(normalize_skill(item) in tags or normalize_skill(item) in searchable for item in technologies):
            return False
    return True


def _role_search_terms(target_role: str | None, user_skills: list[str], search: str = "") -> list[str]:
    terms: list[str] = []
    if search:
        terms.append(search)
    if target_role:
        terms.append(target_role)
        terms.append(target_role.replace("Developer", "").replace("Engineer", "").strip())
    terms.extend(user_skills[:4])
    return [term for term in dict.fromkeys(term.strip() for term in terms) if term]


def _job_skill_tags(*values: str, raw_tags: list[str] | None = None) -> list[str]:
    text = " ".join(values)
    detected = extract_skills_from_text(text)
    normalized_detected = {normalize_skill(skill) for skill in detected}
    cleaned_raw = []
    for tag in raw_tags or []:
        tag = str(tag).strip()
        if not tag or len(tag) > 30:
            continue
        if normalize_skill(tag) in {normalize_skill(skill) for skill in TECH_SKILLS}:
            cleaned_raw.append(next((skill for skill in TECH_SKILLS if normalize_skill(skill) == normalize_skill(tag)), tag))
    combined = detected + [tag for tag in cleaned_raw if normalize_skill(tag) not in normalized_detected]
    return sorted(dict.fromkeys(combined))[:10]


def _fetch_remotive_jobs(search: str = "") -> list[dict]:
    params = {}
    if search:
        params["search"] = search
    query = urllib.parse.urlencode(params)
    url = "https://remotive.com/api/remote-jobs"
    if query:
        url = f"{url}?{query}"
    data = _fetch_json(url, headers={"User-Agent": "CareerAI-FYP-App"})
    jobs = []
    for item in data.get("jobs", [])[:25]:
        category = item.get("category") or ""
        description = _clean_html(item.get("description", ""))
        raw_tags = item.get("tags", [])
        if isinstance(raw_tags, str):
            raw_tags = re.split(r"[,/|]+", raw_tags)
        tags = _job_skill_tags(item.get("title", ""), description, raw_tags=raw_tags)
        jobs.append(
            {
                "id": f"remotive-{item['id']}",
                "title": item.get("title", "Untitled Role"),
                "company": item.get("company_name", "Unknown Company"),
                "location": item.get("candidate_required_location", "Remote"),
                "type": item.get("job_type", "Full-time"),
                "salary": item.get("salary"),
                "url": item.get("url"),
                "tags": tags,
                "description": description[:420],
                "date": item.get("publication_date", ""),
                "source": "Remotive",
                "role": category or "General",
                "liveSource": True,
            }
        )
    return jobs


def _fetch_arbeitnow_jobs(search: str = "") -> list[dict]:
    params = {"remote": "true"}
    if search:
        params["search"] = search
    url = f"https://www.arbeitnow.com/api/job-board-api?{urllib.parse.urlencode(params)}"
    data = _fetch_json(url, headers={"User-Agent": "CareerAI-FYP-App"})
    jobs = []
    for item in data.get("data", [])[:25]:
        description = _clean_html(item.get("description", ""))
        tags = _job_skill_tags(item.get("title", ""), description, raw_tags=item.get("tags") or [])
        jobs.append(
            {
                "id": f"arbeitnow-{item.get('slug') or item.get('title', '').replace(' ', '-').lower()}",
                "title": item.get("title", "Untitled Role"),
                "company": item.get("company_name", "Unknown Company"),
                "location": item.get("location", "Remote"),
                "type": "Full-time",
                "salary": None,
                "url": item.get("url"),
                "tags": tags[:8],
                "description": description[:420],
                "date": item.get("created_at", ""),
                "source": "Arbeitnow",
                "role": item.get("title", "General"),
                "liveSource": True,
            }
        )
    return jobs


def _fetch_jobicy_jobs() -> list[dict]:
    data = _fetch_json("https://jobicy.com/api/v2/remote-jobs?count=50")
    jobs = []
    for item in data.get("jobs", [])[:50]:
        description = _clean_html(item.get("jobDescription") or item.get("jobExcerpt", ""))
        raw_type = item.get("jobType") or []
        if isinstance(raw_type, list):
            raw_type = raw_type[0] if raw_type else "Full-time"
        raw_tags = item.get("jobIndustry") or []
        tags = _job_skill_tags(item.get("jobTitle", ""), description, raw_tags=raw_tags)
        jobs.append(
            {
                "id": f"jobicy-{item.get('id')}",
                "title": item.get("jobTitle", "Untitled Role"),
                "company": item.get("companyName", "Unknown Company"),
                "location": item.get("jobGeo", "Remote"),
                "type": raw_type,
                "salary": None,
                "url": item.get("url"),
                "tags": tags,
                "description": description[:420],
                "date": item.get("pubDate", ""),
                "source": "Jobicy",
                "role": item.get("jobTitle", "General"),
                "liveSource": True,
            }
        )
    return jobs


def _fetch_remoteok_jobs() -> list[dict]:
    data = _fetch_json("https://remoteok.com/api")
    jobs = []
    for item in data:
        if not isinstance(item, dict) or not item.get("id"):
            continue
        description = _clean_html(item.get("description", ""))
        tags = _job_skill_tags(item.get("position", ""), description, raw_tags=item.get("tags") or [])
        salary_min = int(item.get("salary_min") or 0)
        salary_max = int(item.get("salary_max") or 0)
        salary = f"${salary_min:,} - ${salary_max:,}" if salary_min and salary_max else None
        jobs.append(
            {
                "id": f"remoteok-{item.get('id')}",
                "title": item.get("position", "Untitled Role"),
                "company": item.get("company", "Unknown Company"),
                "location": item.get("location") or "Remote",
                "type": "Full-time",
                "salary": salary,
                "url": item.get("apply_url") or item.get("url"),
                "tags": tags,
                "description": description[:420],
                "date": item.get("date", ""),
                "source": "Remote OK",
                "role": item.get("position", "General"),
                "liveSource": True,
            }
        )
        if len(jobs) >= 50:
            break
    return jobs


class _JobzPakistanParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.rows: list[dict[str, list[str] | str]] = []
        self._div_stack: list[str] = []
        self._row: dict[str, list[str] | str] | None = None
        self._cell_class: str | None = None
        self._cell_parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag != "div":
            if tag == "a" and self._row is not None and self._cell_class == "cell1":
                href = dict(attrs).get("href") or ""
                if re.search(r"_jobs-\d+\.html$", href):
                    self._row.setdefault("url", href)
            return

        class_name = dict(attrs).get("class") or ""
        self._div_stack.append(class_name)
        if "row_container" in class_name.split():
            self._row = {"cell1": [], "cell2": [], "cell3": [], "cell4": []}
            return
        if self._row is not None:
            cell_class = next((name for name in class_name.split() if name in {"cell1", "cell2", "cell3", "cell4"}), None)
            if cell_class:
                self._cell_class = cell_class
                self._cell_parts = []

    def handle_data(self, data: str) -> None:
        if self._row is not None and self._cell_class:
            self._cell_parts.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag != "div" or not self._div_stack:
            return
        class_name = self._div_stack.pop()
        if self._row is not None and self._cell_class and self._cell_class in class_name.split():
            value = re.sub(r"\s+", " ", " ".join(self._cell_parts)).strip()
            if value:
                values = self._row.get(self._cell_class)
                if isinstance(values, list):
                    values.append(value)
            self._cell_class = None
            self._cell_parts = []
        if "row_container" in class_name.split() and self._row is not None:
            if self._row.get("url"):
                self.rows.append(self._row)
            self._row = None


def _parse_jobz_pakistan_jobs(html: str) -> list[dict]:
    parser = _JobzPakistanParser()
    parser.feed(html)
    jobs = []
    for row in parser.rows[:40]:
        titles = row.get("cell1") or []
        companies = row.get("cell2") or []
        cities = row.get("cell3") or []
        dates = row.get("cell4") or []
        if not isinstance(titles, list) or not titles:
            continue
        title = titles[0]
        description = titles[1] if len(titles) > 1 else title
        company = companies[0] if isinstance(companies, list) and companies else "Pakistan employer"
        city = cities[0] if isinstance(cities, list) and cities else "Pakistan"
        date = dates[0].replace("/", "-") if isinstance(dates, list) and dates else ""
        url = str(row.get("url") or "").replace("http://", "https://", 1)
        job_id_match = re.search(r"_jobs-(\d+)\.html$", url)
        jobs.append(
            {
                "id": f"jobzpk-{job_id_match.group(1) if job_id_match else urllib.parse.quote(title.lower())}",
                "title": title,
                "company": company,
                "location": city if "pakistan" in city.lower() else f"{city}, Pakistan",
                "type": "Full-time",
                "salary": None,
                "url": url,
                "tags": _job_skill_tags(title, description),
                "description": description[:420],
                "date": date,
                "source": "Jobz.pk",
                "role": title,
                "liveSource": True,
            }
        )
    return jobs


def _fetch_jobz_pakistan_jobs() -> list[dict]:
    jobs: list[dict] = []
    executor = ThreadPoolExecutor(max_workers=len(JOBZ_PAKISTAN_URLS))
    tasks = {executor.submit(_fetch_html, url): url for url in JOBZ_PAKISTAN_URLS}
    completed, pending = wait(tasks, timeout=JOB_FETCH_TIMEOUT_SECONDS)
    for task in completed:
        try:
            jobs.extend(_parse_jobz_pakistan_jobs(task.result()))
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, ValueError, OSError) as exc:
            print(f"[jobs] Jobz.pk page unavailable ({tasks[task]}): {exc}")
    for task in pending:
        print(f"[jobs] Jobz.pk page exceeded the {JOB_FETCH_TIMEOUT_SECONDS:g}s timeout ({tasks[task]}).")
        task.cancel()
    executor.shutdown(wait=False, cancel_futures=True)
    return _dedupe_jobs(jobs)


def _parse_cached_datetime(value: object) -> datetime | None:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
        except ValueError:
            return None
    return None


def _load_persisted_jobs() -> tuple[list[dict], datetime | None]:
    try:
        document = job_feed_collection.find_one({"_id": "live"})
    except PyMongoError:
        return [], None
    if not document:
        return [], None
    jobs = document.get("jobs")
    return (jobs if isinstance(jobs, list) else []), _parse_cached_datetime(document.get("storedAt"))


def _store_persisted_jobs(jobs: list[dict]) -> None:
    if not jobs:
        return
    try:
        job_feed_collection.update_one(
            {"_id": "live"},
            {"$set": {"jobs": jobs, "storedAt": utc_now(), "sourceCount": len(jobs)}},
            upsert=True,
        )
    except PyMongoError:
        pass


def _dedupe_jobs(jobs: list[dict]) -> list[dict]:
    deduped: dict[str, dict] = {}
    for job in jobs:
        if not job.get("url"):
            continue
        key = f"{job['source']}::{job['title'].strip().lower()}::{job['company'].strip().lower()}"
        job["role"] = _infer_role_from_job(job)
        job["type"] = _normalize_job_type(job.get("type")).title().replace("-", "-")
        if not job.get("tags"):
            job["tags"] = _job_skill_tags(job.get("title", ""), job.get("description", ""))
        deduped[key] = job
    return list(deduped.values())


def _fetch_live_job_feed() -> list[dict]:
    jobs: list[dict] = []
    executor = ThreadPoolExecutor(max_workers=4)
    tasks = {
        executor.submit(provider): provider.__name__
        for provider in (_fetch_jobicy_jobs, _fetch_arbeitnow_jobs, _fetch_remoteok_jobs, _fetch_jobz_pakistan_jobs)
    }
    completed, pending = wait(tasks, timeout=JOB_FETCH_TOTAL_TIMEOUT_SECONDS)
    for task in completed:
        try:
            jobs.extend(task.result())
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, ValueError, OSError) as exc:
            print(f"[jobs] {tasks[task]} unavailable: {exc}")
    for task in pending:
        print(f"[jobs] {tasks[task]} exceeded the {JOB_FETCH_TOTAL_TIMEOUT_SECONDS:g}s refresh window.")
        task.cancel()
    executor.shutdown(wait=False, cancel_futures=True)
    return _dedupe_jobs(jobs)


def _refresh_job_cache() -> None:
    global _LIVE_JOB_REFRESHING
    try:
        result = _fetch_live_job_feed()
        if result:
            previous, _ = _load_persisted_jobs()
            merged = _dedupe_jobs([*previous, *result])[-200:]
            _LIVE_JOB_CACHE.update({"storedAt": _now_utc(), "jobs": merged})
            _store_persisted_jobs(merged)
    finally:
        with _LIVE_JOB_REFRESH_LOCK:
            _LIVE_JOB_REFRESHING = False


def _start_job_cache_refresh() -> None:
    global _LIVE_JOB_REFRESHING
    with _LIVE_JOB_REFRESH_LOCK:
        if _LIVE_JOB_REFRESHING:
            return
        _LIVE_JOB_REFRESHING = True
    Thread(target=_refresh_job_cache, name="careerai-job-feed-refresh", daemon=True).start()


def _job_refresh_scheduler() -> None:
    while not _JOB_SCHEDULER_STOP.wait(JOB_AUTO_REFRESH_MINUTES * 60):
        _start_job_cache_refresh()


def start_job_refresh_scheduler() -> None:
    global _JOB_SCHEDULER_THREAD
    with _JOB_SCHEDULER_LOCK:
        if _JOB_SCHEDULER_THREAD and _JOB_SCHEDULER_THREAD.is_alive():
            return
        _JOB_SCHEDULER_STOP.clear()
        _JOB_SCHEDULER_THREAD = Thread(
            target=_job_refresh_scheduler,
            name="careerai-job-refresh-scheduler",
            daemon=True,
        )
        _JOB_SCHEDULER_THREAD.start()

    _, stored_at = _load_persisted_jobs()
    if not stored_at or _now_utc() - stored_at >= LIVE_JOB_CACHE_TTL:
        _start_job_cache_refresh()


def stop_job_refresh_scheduler() -> None:
    global _JOB_SCHEDULER_THREAD
    with _JOB_SCHEDULER_LOCK:
        thread = _JOB_SCHEDULER_THREAD
        _JOB_SCHEDULER_THREAD = None
        _JOB_SCHEDULER_STOP.set()
    if thread and thread.is_alive():
        thread.join(timeout=2)


def get_job_refresh_status() -> dict:
    thread = _JOB_SCHEDULER_THREAD
    cached_at = _LIVE_JOB_CACHE.get("storedAt")
    if not isinstance(cached_at, datetime) and database_state.get_database_status()["databaseReady"]:
        _, cached_at = _load_persisted_jobs()
    return {
        "enabled": True,
        "running": bool(thread and thread.is_alive()),
        "refreshing": _LIVE_JOB_REFRESHING,
        "intervalMinutes": JOB_AUTO_REFRESH_MINUTES,
        "lastUpdatedAt": cached_at.isoformat() if isinstance(cached_at, datetime) else None,
    }


def _infer_role_from_job(job: dict) -> str:
    title = job.get("title", "").lower()
    mapping = {
        "frontend": "Frontend Developer",
        "front-end": "Frontend Developer",
        "backend": "Backend Developer",
        "back-end": "Backend Developer",
        "full stack": "Full-Stack Developer",
        "full-stack": "Full-Stack Developer",
        "data": "Data Scientist",
        "machine learning": "ML Engineer",
        "devops": "DevOps Engineer",
    }
    for keyword, role in mapping.items():
        if keyword in title:
            return role
    return "Full-Stack Developer"


def get_live_jobs(
    search: str = "",
    target_role: str | None = None,
    user_skills: list[str] | None = None,
    force_refresh: bool = False,
) -> list[dict]:
    del search, target_role, user_skills
    cached_jobs = _LIVE_JOB_CACHE.get("jobs")
    cached_at = _LIVE_JOB_CACHE.get("storedAt")
    if not force_refresh and isinstance(cached_jobs, list) and isinstance(cached_at, datetime) and _now_utc() - cached_at < LIVE_JOB_CACHE_TTL:
        return cached_jobs

    persisted_jobs, persisted_at = _load_persisted_jobs()
    if persisted_jobs and not force_refresh:
        _LIVE_JOB_CACHE.update({"storedAt": persisted_at or _now_utc(), "jobs": persisted_jobs})
        if not persisted_at or _now_utc() - persisted_at >= LIVE_JOB_CACHE_TTL:
            _start_job_cache_refresh()
        return persisted_jobs

    with _LIVE_JOB_CACHE_LOCK:
        cached_jobs = _LIVE_JOB_CACHE.get("jobs")
        cached_at = _LIVE_JOB_CACHE.get("storedAt")
        if not force_refresh and isinstance(cached_jobs, list) and isinstance(cached_at, datetime) and _now_utc() - cached_at < LIVE_JOB_CACHE_TTL:
            return cached_jobs

        result = _fetch_live_job_feed()
        if result:
            previous, _ = _load_persisted_jobs()
            merged = _dedupe_jobs([*previous, *result])[-200:]
            _LIVE_JOB_CACHE.update({"storedAt": _now_utc(), "jobs": merged})
            _store_persisted_jobs(merged)
            return merged

        persisted_jobs, _ = _load_persisted_jobs()
        return persisted_jobs if persisted_jobs else []


def score_job(job: dict, user_skills: list[str], target_role: str | None) -> dict:
    user_skills = normalize_skills(user_skills)
    user_normalized = {normalize_skill(skill) for skill in user_skills}
    job_skills = _job_skill_tags(job.get("title", ""), job.get("description", ""), " ".join(job.get("tags", [])), raw_tags=job.get("tags", []))
    required = JOB_SKILL_REQUIREMENTS.get(target_role or job.get("role", ""), [])
    required_normalized = {normalize_skill(skill) for skill in required}
    matched_skills = [skill for skill in job_skills if normalize_skill(skill) in user_normalized]
    stretch_skills = [
        skill
        for skill in sorted(dict.fromkeys(job_skills + required))
        if normalize_skill(skill) not in user_normalized and (normalize_skill(skill) in required_normalized or skill in job_skills)
    ][:8]

    profile_text = " ".join(user_skills + required + ([target_role] if target_role else []))
    job_text = " ".join([job.get("title", ""), job.get("company", ""), job.get("role", ""), job.get("description", ""), *job_skills])
    similarity = cosine_similarity(tokenize(profile_text), tokenize(job_text))
    skill_score = (len(matched_skills) / len(job_skills)) * 55 if job_skills else 0
    requirement_score = (len([skill for skill in required if normalize_skill(skill) in user_normalized]) / len(required)) * 25 if required else 0
    semantic_score = similarity * 15
    role_boost = 5 if target_role and job.get("role") == target_role else 0
    recency_score = _parse_date_score(job.get("date"))
    remote_boost = 4 if _infer_work_mode(job.get("location", "")) == "remote" else 0
    salary_value = _parse_salary_value(job.get("salary"))
    salary_score = min((salary_value or 0) / 50_000, 8) if salary_value else 0
    final_score = min(100, round(skill_score + requirement_score + semantic_score + role_boost + recency_score + remote_boost + salary_score))
    return {
        **job,
        "tags": job_skills,
        "matchScore": final_score,
        "matchedSkills": matched_skills,
        "missingSkills": stretch_skills,
        "workMode": _infer_work_mode(job.get("location", "")),
        "experienceBand": _infer_experience_from_job(job),
        "salaryValue": salary_value,
        "semanticScore": round(similarity, 3),
    }


def get_recommended_jobs(
    user_skills: list[str],
    target_role: str | None = None,
    search: str = "",
    force_refresh: bool = False,
) -> list[dict]:
    user_skills = normalize_skills(user_skills)
    jobs = get_live_jobs(search, target_role, user_skills, force_refresh=force_refresh)
    scored = [score_job(job, user_skills, target_role) for job in jobs]
    relevant = [
        job
        for job in scored
        if not user_skills or job["matchedSkills"] or (target_role and job.get("role") == target_role) or search
    ]
    return sorted(relevant or scored, key=lambda job: job["matchScore"], reverse=True)


def search_jobs(
    user_skills: list[str],
    *,
    target_role: str | None = None,
    search: str = "",
    type_filter: str = "all",
    work_mode: str = "all",
    location: str = "",
    min_salary: int = 0,
    experience_level: str = "all",
    technologies: list[str] | None = None,
    sort: str = "relevant",
    page: int = 1,
    page_size: int = 8,
    force_refresh: bool = False,
) -> dict:
    technologies = normalize_skills(technologies or [])
    scored = get_recommended_jobs(user_skills, target_role, search, force_refresh=force_refresh)
    search_tokens = tokenize(search)
    boosted = []

    for job in scored:
        searchable = " ".join(
            [
                job.get("title", ""),
                job.get("company", ""),
                job.get("description", ""),
                job.get("role", ""),
                " ".join(job.get("tags", [])),
            ]
        ).lower()
        keyword_hits = sum(1 for token in search_tokens if token in searchable)
        title_hits = sum(1 for token in search_tokens if token in job.get("title", "").lower())
        if not search_tokens or keyword_hits:
            job_with_boost = {**job, "searchBoost": keyword_hits * 4 + title_hits * 5}
            boosted.append(job_with_boost)

    filtered = [
        job
        for job in boosted
        if _job_matches_filters(
            job,
            type_filter=type_filter,
            work_mode=work_mode,
            location=location,
            min_salary=min_salary,
            experience_level=experience_level,
            technologies=technologies,
        )
    ]

    if sort == "newest":
        filtered.sort(key=lambda job: (_parse_date_score(job.get("date")), job["matchScore"]), reverse=True)
    elif sort == "salary":
        filtered.sort(key=lambda job: (job.get("salaryValue") or 0, job["matchScore"]), reverse=True)
    else:
        filtered.sort(key=lambda job: (job["matchScore"] + job.get("searchBoost", 0), _parse_date_score(job.get("date"))), reverse=True)

    page = max(page, 1)
    page_size = max(1, min(page_size, 20))
    start = (page - 1) * page_size
    items = filtered[start : start + page_size]
    suggestions = []
    seen = set()
    for item in filtered[:12]:
        for value in [item.get("title", ""), item.get("role", ""), *item.get("tags", [])]:
            cleaned = str(value).strip()
            lowered = cleaned.lower()
            if cleaned and lowered not in seen and (not search or search.lower() in lowered or len(suggestions) < 3):
                suggestions.append(cleaned)
                seen.add(lowered)
            if len(suggestions) >= 8:
                break
        if len(suggestions) >= 8:
            break

    return {
        "items": items,
        "total": len(filtered),
        "page": page,
        "pageSize": page_size,
        "hasMore": start + page_size < len(filtered),
        "searchSuggestions": suggestions,
        "feedUpdatedAt": (
            _LIVE_JOB_CACHE.get("storedAt").isoformat()
            if isinstance(_LIVE_JOB_CACHE.get("storedAt"), datetime)
            else None
        ),
        "appliedFilters": {
            "type": type_filter,
            "workMode": work_mode,
            "location": location,
            "minSalary": min_salary,
            "experienceLevel": experience_level,
            "technologies": technologies,
            "sort": sort,
        },
    }


def _validate_resume_text(text: str) -> str:
    cleaned = re.sub(r"\x00", "", text or "").strip()
    if len(cleaned) < 150:
        raise ValueError("This file does not contain enough readable text to be a resume.")

    section_matches = {match.group(1).lower() for match in RESUME_SECTION_PATTERN.finditer(cleaned)}
    has_contact_signal = bool(
        re.search(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}", cleaned)
        or re.search(r"\b(?:linkedin\.com|github\.com|portfolio)\b", cleaned, re.IGNORECASE)
        or re.search(r"\+?\d[\d\s()-]{7,}\d", cleaned)
    )
    if len(section_matches) < 2 and not (has_contact_signal and section_matches):
        raise ValueError(
            "The uploaded document does not look like a CV/resume. "
            "Include sections such as Education, Experience, Skills, or Projects."
        )
    return cleaned


def parse_resume_file(filename: str, content: bytes, content_type: str | None = None) -> str:
    suffix = Path(filename).suffix.lower()
    if suffix not in ALLOWED_RESUME_SUFFIXES:
        raise ValueError("Only PDF and DOCX resume files are accepted.")
    if not content:
        raise ValueError("The uploaded resume file is empty.")
    if len(content) > MAX_RESUME_FILE_BYTES:
        raise ValueError("Resume file is too large. Upload a PDF or DOCX smaller than 5 MB.")

    if suffix == ".pdf":
        if not content.startswith(b"%PDF"):
            raise ValueError("The uploaded file is not a valid PDF.")
        if content_type and content_type not in {"application/pdf", "application/octet-stream"}:
            raise ValueError("The uploaded file type does not match a PDF resume.")
        try:
            reader = PdfReader(BytesIO(content))
            text = "\n".join(page.extract_text() or "" for page in reader.pages)
        except Exception as exc:
            raise ValueError("The PDF is damaged or cannot be read.") from exc
        if not text.strip():
            raise ValueError("Could not extract text from this PDF. If it is scanned/image-based, paste the resume text manually.")
        return _validate_resume_text(text)
    if suffix == ".docx":
        if not content.startswith(b"PK"):
            raise ValueError("The uploaded file is not a valid DOCX document.")
        if content_type and content_type not in {
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/octet-stream",
        }:
            raise ValueError("The uploaded file type does not match a DOCX resume.")
        try:
            document = Document(BytesIO(content))
            text = "\n".join(paragraph.text for paragraph in document.paragraphs)
        except Exception as exc:
            raise ValueError("The DOCX file is damaged or cannot be read.") from exc
        if not text.strip():
            raise ValueError("Could not extract text from this DOCX file. Please check the file or paste resume text manually.")
        return _validate_resume_text(text)
    raise ValueError("Only PDF and DOCX resume files are accepted.")


def fetch_github_profile(username: str) -> dict:
    clean_username = username.strip()
    if not re.fullmatch(r"[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?", clean_username):
        raise ValueError("Enter a valid GitHub username.")

    headers = {
        "User-Agent": "CareerAI-FYP-App",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": os.getenv("GITHUB_API_VERSION", "2022-11-28"),
    }
    token = os.getenv("GITHUB_TOKEN", "").strip()
    if token:
        headers["Authorization"] = f"Bearer {token}"

    try:
        user_data = _fetch_json(
            f"https://api.github.com/users/{clean_username}",
            headers=headers,
            timeout=GITHUB_FETCH_TIMEOUT_SECONDS,
        )
        repos_data = _fetch_json(
            f"https://api.github.com/users/{clean_username}/repos?sort=updated&direction=desc&per_page=30&type=owner",
            headers=headers,
            timeout=GITHUB_FETCH_TIMEOUT_SECONDS,
        )
    except urllib.error.HTTPError as exc:
        if exc.code == 404:
            raise ValueError("GitHub user not found.") from exc
        if exc.code in {401, 403, 429}:
            raise ValueError("GitHub API rate limit reached. Add GITHUB_TOKEN to .env and try again.") from exc
        raise ValueError("GitHub could not return this profile right now.") from exc
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        raise ValueError("GitHub is temporarily unreachable. Please try again.") from exc

    if not isinstance(user_data, dict) or not isinstance(repos_data, list):
        raise ValueError("GitHub returned an unexpected response.")

    languages: dict[str, int] = {}
    top_repos = []
    for repo in repos_data:
        if repo.get("fork") or repo.get("archived"):
            continue
        language = repo.get("language") or "N/A"
        if language != "N/A":
            languages[language] = languages.get(language, 0) + 1
        top_repos.append(
            {
                "name": repo["name"],
                "description": repo.get("description") or "",
                "stars": repo.get("stargazers_count", 0),
                "language": language,
                "url": repo["html_url"],
            }
        )

    top_repos.sort(key=lambda repo: (repo["stars"], repo["name"].lower()), reverse=True)
    return {
        "username": user_data["login"],
        "avatar": user_data["avatar_url"],
        "name": user_data.get("name") or user_data["login"],
        "bio": user_data.get("bio") or "",
        "repos": user_data.get("public_repos", 0),
        "followers": user_data.get("followers", 0),
        "languages": languages,
        "topRepos": top_repos[:10],
    }


def derive_skills_from_github(profile: dict) -> list[str]:
    skills = {"Git", "GitHub"}
    for language in profile.get("languages", {}):
        for skill in LANGUAGE_TO_SKILL.get(language, []):
            skills.add(skill)
    repo_text = " ".join(
        f"{repo.get('name', '')} {repo.get('description', '')} {repo.get('language', '')}"
        for repo in profile.get("topRepos", [])
    )
    skills.update(extract_skills_from_text(repo_text))
    return sorted(skills)


def generate_next_actions(user_skills: list[str], target_role: str, gap: dict) -> list[dict]:
    missing = gap.get("missing", [])
    matched = gap.get("matched", [])
    actions: list[dict] = []

    if missing:
        priority = missing[:3]
        actions.append(
            {
                "title": "Focus on the highest-impact missing skills",
                "description": f"Start with {', '.join(priority)} because these are required for {target_role} and missing from your current profile.",
            }
        )
        actions.append(
            {
                "title": "Build one proof project",
                "description": f"Create a small {target_role} portfolio project that uses {', '.join(priority[:2])}. Add it to GitHub so CareerAI can detect the improvement.",
            }
        )
    else:
        actions.append(
            {
                "title": "Move from learning to applications",
                "description": f"Your tracked skills already match {target_role}. Start applying to internships and keep your GitHub projects updated.",
            }
        )

    if matched:
        actions.append(
            {
                "title": "Show your strongest skills clearly",
                "description": f"Highlight {', '.join(matched[:3])} in your resume summary, project descriptions, and GitHub README files.",
            }
        )

    actions.append(
        {
            "title": "Review progress every week",
            "description": "Re-upload your CV or reconnect GitHub after new projects so the dashboard, skill gap, jobs, and roadmap update together.",
        }
    )
    return actions


def create_user(name: str, email: str, password: str) -> tuple[str, dict]:
    clean_email = email.strip().lower()
    document = {
        "name": name.strip(),
        "email": clean_email,
        "passwordHash": hash_password(password),
        "skills": [],
        "githubUsername": None,
        "targetRole": None,
        "resumeText": None,
        "education": None,
        "summary": None,
        "experienceLevel": "Beginner",
        "lastUpdated": utc_now(),
        "createdAt": utc_now(),
    }
    try:
        inserted = users_collection.insert_one(document)
    except DuplicateKeyError as exc:
        raise ValueError("An account with this email already exists.") from exc
    token = create_token()
    sessions_collection.insert_one({"token": token, "userId": inserted.inserted_id, "createdAt": utc_now()})
    document["_id"] = inserted.inserted_id
    _persist_mock_store()
    return token, serialize_user(document)


def login_user(email: str, password: str) -> tuple[str, dict] | None:
    document = users_collection.find_one({"email": email.strip().lower()})
    if document is None or not verify_password(password, document["passwordHash"]):
        return None
    token = create_token()
    sessions_collection.insert_one({"token": token, "userId": document["_id"], "createdAt": utc_now()})
    _persist_mock_store()
    return token, serialize_user(document)


def get_user_by_token(token: str) -> dict | None:
    session = sessions_collection.find_one({"token": token})
    if session is None:
        return None
    document = users_collection.find_one({"_id": session["userId"]})
    return serialize_user(document)


def get_user_document_by_token(token: str) -> dict | None:
    session = sessions_collection.find_one({"token": token})
    if session is None:
        return None
    return users_collection.find_one({"_id": session["userId"]})


def logout_token(token: str) -> None:
    sessions_collection.delete_one({"token": token})
    _persist_mock_store()


def update_user_profile(user_id: str, updates: dict) -> dict:
    object_id = ObjectId(user_id)
    payload = {**updates, "lastUpdated": utc_now()}
    if "skills" in payload:
        payload["skills"] = normalize_skills(payload.get("skills"))

    users_collection.update_one({"_id": object_id}, {"$set": payload})
    after = users_collection.find_one({"_id": object_id})
    _persist_mock_store()
    return serialize_user(after)


def get_bookmarks(user_id: str) -> list[dict]:
    documents = bookmarks_collection.find({"userId": ObjectId(user_id)}).sort("createdAt", -1)
    return [document["job"] for document in documents]


def toggle_bookmark(user_id: str, job: dict) -> dict:
    job_id = str(job.get("id", "")).strip()
    if not job_id:
        raise ValueError("Job information is missing, so the bookmark could not be saved.")
    normalized_job = {**job, "id": job_id}
    bookmarks_collection.update_one(
        {"userId": ObjectId(user_id), "job.id": job_id},
        {
            "$set": {"job": normalized_job, "updatedAt": utc_now()},
            "$setOnInsert": {"userId": ObjectId(user_id), "createdAt": utc_now()},
        },
        upsert=True,
    )
    _persist_mock_store()
    return {"saved": True}


def remove_bookmark(user_id: str, job_id: str) -> dict:
    clean_job_id = str(job_id or "").strip()
    if not clean_job_id:
        raise ValueError("Bookmark id is missing.")
    result = bookmarks_collection.delete_one({"userId": ObjectId(user_id), "job.id": clean_job_id})
    _persist_mock_store()
    return {"removed": result.deleted_count > 0}


def get_dashboard_payload(user: dict) -> dict:
    recommended_key = recommend_career_path(user["skills"])
    recommended_role = CAREER_PATHS[recommended_key]["title"]
    target_role = user.get("targetRole") or recommended_role
    target_gap = get_skill_gap(user["skills"], target_role)
    jobs = get_recommended_jobs(user["skills"], target_role)
    return {
        "profileCompletion": get_profile_completion(user),
        "recommendedKey": recommended_key,
        "recommendedRole": recommended_role,
        "targetRole": target_role,
        "targetGap": target_gap,
        "targetScore": get_match_percent(user["skills"], target_role),
        "jobs": jobs,
        "strengths": user["skills"][:6],
    }


def _detect_chat_intents(message: str) -> set[str]:
    lowered = message.lower()
    intents = set()
    if any(word in lowered for word in ("hello", "hi", "hey", "good morning", "good evening")):
        intents.add("greeting")
    if any(word in lowered for word in ("job", "jobs", "apply", "internship", "hiring", "resume shortlist")):
        intents.add("jobs")
    if any(word in lowered for word in ("roadmap", "path", "learn", "next", "step", "improve", "gap")):
        intents.add("roadmap")
    if any(word in lowered for word in ("github", "repo", "repository", "portfolio", "project")):
        intents.add("portfolio")
    if any(word in lowered for word in ("cv", "resume", "profile", "linkedin")):
        intents.add("profile")
    if any(word in lowered for word in ("interview", "question", "behavioral", "technical interview")):
        intents.add("interview")
    if any(word in lowered for word in ("resource", "course", "book", "tutorial", "learn from")):
        intents.add("resources")
    if any(word in lowered for word in ("what is", "explain", "difference", "how does", "why use")):
        intents.add("concept")
    return intents


def _resource_suggestions(skills: list[str], missing_skills: list[str]) -> list[str]:
    resources = []
    for skill in [*missing_skills, *skills]:
        if skill in LEARNING_RESOURCES:
            resources.append(f"{skill}: {', '.join(LEARNING_RESOURCES[skill][:2])}")
        if len(resources) >= 4:
            break
    return resources


def _general_chat_answer(message: str) -> dict:
    lowered = message.lower()

    if any(phrase in lowered for phrase in ("how are you", "who are you", "what can you do")):
        return {
            "reply": "### About me\nI'm Aira, your CareerAI coach. I can help with career planning, interview prep, learning strategy, technical concepts, and profile improvement. If your question is broader than careers, I'll still try to answer in a practical way.",
            "suggestions": ["Ask me to explain a technology.", "Ask me to compare two tools.", "Ask me for a one-week study plan."],
        }

    if re.search(r"\b(what is|explain|difference between|how does|why use)\b", lowered):
        for key, answer in GENERAL_CONCEPT_RESPONSES.items():
            if key in lowered:
                return {
                    "reply": f"### Explanation\n{answer}\n\n### Practical tip\nIf you want, ask when to choose it, how it compares with an alternative, or how to use it in a real project.",
                    "suggestions": ["Compare it with an alternative.", "Give me a beginner roadmap for it.", "Suggest a project using it."],
                }

    if any(phrase in lowered for phrase in ("motivate", "stuck", "confused", "overwhelmed")):
        return {
            "reply": "### Quick reset\nIf you're stuck, shrink the problem. Pick one skill, one project, or one job-search task for today. Progress usually restarts once the next step is small enough to finish.",
            "suggestions": ["Help me choose one next step.", "Make me a one-week plan.", "Prioritize my skill gaps."],
        }

    topic = re.sub(r"^(please\s+)?(tell me about|explain|what is|how do i|how to|why)\s+", "", message, flags=re.IGNORECASE).strip(" ?.")
    if not topic:
        topic = "that question"
    return {
        "reply": (
            "### Direct answer\n"
            f"Here is a practical way to think about **{topic}**: start by identifying the goal, the constraints, and the smallest useful next step. "
            "If it is a technical topic, learn what problem it solves, the core concepts, common mistakes, and one small project where you can apply it.\n\n"
            "### CareerAI angle\n"
            "I can connect this to your profile by turning it into a learning plan, interview explanation, resume bullet, or job-search keyword."
        ),
        "suggestions": ["Ask for examples.", "Ask for a step-by-step plan.", "Ask how this helps your career."],
    }


def _build_llm_prompt(user: dict, message: str, history: list[dict] | None = None) -> list[dict]:
    profile = {
        "name": user.get("name"),
        "targetRole": user.get("targetRole"),
        "skills": user.get("skills", []),
        "experienceLevel": user.get("experienceLevel"),
        "summary": user.get("summary"),
    }
    recent_history = [
        {"role": item.get("role"), "content": str(item.get("content", ""))[:800]}
        for item in (history or [])[-6:]
        if item.get("role") in {"user", "assistant"} and item.get("content")
    ]
    return [
        {
            "role": "system",
            "content": (
                "You are Aira, the CareerAI career coach. Answer every user question helpfully and accurately. "
                "Prefer concise markdown with clear sections. When the question is about careers, jobs, internships, resumes, interviews, "
                "skills, projects, or software engineering, use the user's profile context. If the question is general, answer it directly, "
                "then optionally add a practical career or learning angle. Do not pretend to browse live web pages."
            ),
        },
        {"role": "system", "content": f"User profile context: {json.dumps(profile, ensure_ascii=False)}"},
        *recent_history,
        {"role": "user", "content": message},
    ]


def _call_configured_llm(user: dict, message: str, history: list[dict] | None = None) -> str | None:
    gemini_key = (os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or "").strip()
    if gemini_key:
        return _call_gemini(user, message, history, gemini_key)

    api_key = os.getenv("LLM_API_KEY") or os.getenv("OPENAI_API_KEY")
    if not api_key:
        return None
    api_url = os.getenv("LLM_API_URL", "https://api.openai.com/v1/chat/completions")
    model = os.getenv("LLM_MODEL", "gpt-4o-mini")
    payload = {
        "model": model,
        "messages": _build_llm_prompt(user, message, history),
        "temperature": 0.35,
        "max_tokens": 700,
    }
    request = urllib.request.Request(
        api_url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "User-Agent": "CareerAI-FYP-App",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=float(os.getenv("LLM_TIMEOUT_SECONDS", "12"))) as response:
            data = json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, OSError, json.JSONDecodeError):
        return None
    choices = data.get("choices") or []
    if not choices:
        return None
    content = choices[0].get("message", {}).get("content")
    return content.strip() if isinstance(content, str) and content.strip() else None


def _call_gemini(user: dict, message: str, history: list[dict] | None, api_key: str) -> str | None:
    model = os.getenv("GEMINI_MODEL", "gemini-3.5-flash").strip()
    prompt_messages = _build_llm_prompt(user, message, history)
    system_text = "\n\n".join(item["content"] for item in prompt_messages if item["role"] == "system")
    contents = []
    for item in prompt_messages:
        if item["role"] == "system":
            continue
        contents.append(
            {
                "role": "model" if item["role"] == "assistant" else "user",
                "parts": [{"text": item["content"]}],
            }
        )
    payload = {
        "systemInstruction": {"parts": [{"text": system_text}]},
        "contents": contents,
        "generationConfig": {"temperature": 0.35, "maxOutputTokens": 900},
    }
    encoded_model = urllib.parse.quote(model, safe="-_.")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{encoded_model}:generateContent?key={urllib.parse.quote(api_key)}"
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "User-Agent": "CareerAI-FYP-App"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=float(os.getenv("LLM_TIMEOUT_SECONDS", "20"))) as response:
            data = json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, OSError, json.JSONDecodeError):
        return None
    candidates = data.get("candidates") or []
    if not candidates:
        return None
    parts = candidates[0].get("content", {}).get("parts") or []
    text = "\n".join(str(part.get("text", "")).strip() for part in parts if part.get("text"))
    return text.strip() or None


def is_llm_configured() -> bool:
    return bool(
        (
            os.getenv("GEMINI_API_KEY")
            or os.getenv("GOOGLE_API_KEY")
            or os.getenv("LLM_API_KEY")
            or os.getenv("OPENAI_API_KEY")
            or ""
        ).strip()
    )


def _history_summary(history: list[dict] | None) -> str:
    if not history:
        return ""
    recent_user_messages = [item.get("content", "").strip() for item in history if item.get("role") == "user" and item.get("content")]
    if not recent_user_messages:
        return ""
    return " Earlier in this conversation, the user also asked about: " + "; ".join(recent_user_messages[-3:]) + "."


def generate_career_chat_reply(user: dict, message: str, history: list[dict] | None = None) -> dict:
    clean_message = re.sub(r"\s+", " ", message or "").strip()
    if not clean_message:
        raise ValueError("Please write a question for CareerAI.")

    saved_skills = normalize_skills(user.get("skills", []))
    mentioned_skills = normalize_skills(extract_skills_from_text(clean_message))
    combined_skills = normalize_skills([*saved_skills, *mentioned_skills])
    target_role = user.get("targetRole") or CAREER_PATHS[recommend_career_path(combined_skills)]["title"]
    gap = get_skill_gap(combined_skills, target_role)
    match_percent = get_match_percent(combined_skills, target_role)
    intents = _detect_chat_intents(clean_message)
    lower_message = clean_message.lower()
    recent_history = _history_summary(history)
    career_intent_words = (
        "job",
        "jobs",
        "apply",
        "internship",
        "hiring",
        "roadmap",
        "path",
        "learn",
        "next",
        "step",
        "improve",
        "gap",
        "github",
        "repo",
        "repository",
        "portfolio",
        "project",
        "cv",
        "resume",
        "profile",
        "interview",
        "resource",
        "course",
        "tutorial",
        "book",
    )
    has_career_intent = any(word in lower_message for word in career_intent_words)

    suggestions: list[str] = []
    reply_sections: list[str] = []
    related_resources: list[str] = []

    llm_reply = _call_configured_llm(user, clean_message, history)
    if llm_reply:
        return {
            "reply": llm_reply,
            "detectedSkills": mentioned_skills,
            "targetRole": target_role,
            "matchPercent": match_percent,
            "skillGap": gap,
            "suggestions": [
                "Ask a follow-up to make this more specific.",
                "Turn the answer into a project, resume bullet, or interview script.",
                "Update your profile so recommendations stay aligned.",
            ],
            "relatedResources": _resource_suggestions(combined_skills, gap["missing"])[:4],
            "category": next(iter(intents), "general"),
            "aiPowered": True,
        }

    if mentioned_skills:
        new_skills = [skill for skill in mentioned_skills if normalize_skill(skill) not in {normalize_skill(saved) for saved in saved_skills}]
        if new_skills:
            reply_sections.append(f"### Skill signals\nI detected these skills in your message: **{', '.join(new_skills)}**.")
        else:
            reply_sections.append(f"### Skill signals\nYour message reinforces skills already in your profile: **{', '.join(mentioned_skills)}**.")

    if "greeting" in intents:
        reply_sections.append(f"### Hello\n{GENERAL_CHAT_GUIDANCE['greeting']}")

    if "jobs" in intents:
        jobs = get_recommended_jobs(combined_skills, target_role)[:3]
        if jobs:
            job_lines = "\n".join(f"- **{job['title']}** at {job['company']} ({job['matchScore']}% match)" for job in jobs)
            reply_sections.append(f"### Best-fit roles\nFor **{target_role}**, these look strongest right now:\n{job_lines}")
        suggestions.extend(
            [
                "Filter jobs by work mode and salary to narrow the best applications first.",
                "Tailor your resume headline to the role you want before applying.",
            ]
        )

    if "roadmap" in intents or (not reply_sections and has_career_intent):
        if gap["missing"]:
            priority = gap["missing"][:3]
            reply_sections.append(
                "### Next learning priority\n"
                f"Your current readiness for **{target_role}** is about **{match_percent}%**. "
                f"The highest-impact skills to build next are **{', '.join(priority)}**."
            )
            suggestions.extend(
                [
                    f"Build one portfolio project centered on {priority[0]}.",
                    "Document each project with a short problem, approach, stack, and result format.",
                    "Re-upload your resume after every meaningful project update so recommendations stay current.",
                ]
            )
        else:
            reply_sections.append(
                "### Readiness snapshot\n"
                f"You already cover the tracked requirements for **{target_role}**. "
                "Your biggest lever now is stronger proof: resume bullets, project quality, interview stories, and targeted applications."
            )
            suggestions.extend(["Prepare a role-specific resume version.", "Bookmark 5 matching jobs and compare their missing skills."])

    if "portfolio" in intents:
        reply_sections.append(
            "### Portfolio advice\n"
            "Pin your strongest repositories, keep README files outcome-focused, and make the stack visible in repo descriptions so your profile signals stay accurate."
        )
        suggestions.append("Reconnect GitHub after improving repo descriptions, languages, or pinned projects.")

    if "profile" in intents:
        reply_sections.append(
            "### Resume and profile\n"
            "Place your target role near the top, group skills by domain, and make project bullets measurable with impact, tools, and ownership."
        )
        suggestions.append("Refresh your profile after updating your resume so dashboard, jobs, and roadmap stay aligned.")

    if "interview" in intents:
        focus_skills = gap["missing"][:2] or combined_skills[:2]
        reply_sections.append(
            "### Interview prep\n"
            "Prepare concise stories for problem solving, teamwork, and tradeoffs. For technical interviews, practice explaining one project end to end and be ready to justify design decisions around "
            f"**{', '.join(focus_skills) if focus_skills else 'your strongest skills'}**."
        )
        suggestions.extend(
            [
                "Practice a 60-second introduction linking your background to your target role.",
                "Write 5 STAR-format stories from projects, coursework, or internships.",
            ]
        )

    if "concept" in intents:
        mentioned_or_missing = mentioned_skills[:2] or gap["missing"][:2]
        if mentioned_skills:
            reply_sections.append(
                "### Concept guidance\n"
                f"If you're learning **{', '.join(mentioned_or_missing)}**, focus on what problem each tool solves, when to choose it, and one project where you would apply it."
            )

    if "resources" in intents or ("roadmap" in intents and gap["missing"]) or mentioned_skills:
        related_resources = _resource_suggestions(combined_skills, gap["missing"])
        if related_resources:
            resource_lines = "\n".join(f"- {item}" for item in related_resources)
            reply_sections.append(f"### Learning resources\n{resource_lines}")
            suggestions.append("Pick one missing skill and study it deeply for one focused week.")

    if not reply_sections or not has_career_intent:
        general = _general_chat_answer(clean_message)
        reply_sections.append(general["reply"])
        suggestions.extend(general["suggestions"])

    suggestions = list(dict.fromkeys(suggestions))[:5]
    if not suggestions:
        suggestions = generate_next_actions(combined_skills, target_role, gap)
        suggestions = [item["description"] for item in suggestions]

    return {
        "reply": "\n\n".join(reply_sections) + recent_history if reply_sections else GENERAL_CHAT_GUIDANCE["fallback"],
        "detectedSkills": mentioned_skills,
        "targetRole": target_role,
        "matchPercent": match_percent,
        "skillGap": gap,
        "suggestions": suggestions,
        "relatedResources": related_resources[:4],
        "category": next(iter(intents), "career"),
        "aiPowered": False,
    }
