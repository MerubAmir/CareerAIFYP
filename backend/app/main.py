from __future__ import annotations

import json
import os
from typing import Annotated

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .data import CAREER_PATHS, JOB_SKILL_REQUIREMENTS
from .database import init_db, is_mock_client, utc_now
from .services import (
    create_user,
    derive_skills_from_github,
    extract_skills_from_text,
    fetch_github_profile,
    get_bookmarks,
    career_key_for_role,
    extract_profile_details_from_text,
    generate_career_chat_reply,
    generate_next_actions,
    get_dashboard_payload,
    get_match_percent,
    get_skill_gap,
    get_user_by_token,
    get_user_document_by_token,
    infer_experience_level,
    is_llm_configured,
    login_user,
    logout_token,
    parse_resume_file,
    recommend_career_path,
    remove_bookmark,
    search_jobs,
    toggle_bookmark,
    update_user_profile,
)

app = FastAPI(title="CareerAI API", version="2.0.0")
init_db()

default_cors_origins = [
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
]
configured_cors_origins = [
    origin.strip().rstrip("/")
    for origin in os.getenv("CORS_ORIGINS", "").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(dict.fromkeys([*default_cors_origins, *configured_cors_origins])),
    allow_origin_regex=os.getenv("CORS_ORIGIN_REGEX") or None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class RegisterRequest(BaseModel):
    name: str = Field(min_length=2)
    email: str
    password: str = Field(min_length=6)


class LoginRequest(BaseModel):
    email: str
    password: str


class ResumeTextRequest(BaseModel):
    resumeText: str = ""
    manualSkills: list[str] = Field(default_factory=list)
    education: str | None = None
    summary: str | None = None
    targetRole: str | None = None


class GitHubRequest(BaseModel):
    username: str


class ProfileUpdateRequest(BaseModel):
    name: str | None = None
    skills: list[str] | None = None
    githubUsername: str | None = None
    targetRole: str | None = None
    resumeText: str | None = None
    education: str | None = None
    summary: str | None = None
    experienceLevel: str | None = None


class BookmarkRequest(BaseModel):
    job: dict


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=1200)
    history: list[dict] = Field(default_factory=list)


def get_bearer_token(authorization: Annotated[str | None, Header()] = None) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization token.")
    return authorization.split(" ", 1)[1].strip()


def get_current_user(token: Annotated[str, Depends(get_bearer_token)]) -> dict:
    user = get_user_by_token(token)
    if user is None:
        raise HTTPException(status_code=401, detail="Session expired or invalid.")
    return user


@app.on_event("startup")
def on_startup() -> None:
    init_db()


@app.get("/api/health")
def health() -> dict:
    return {
        "status": "ok",
        "database": "mongomock" if is_mock_client else "mongodb",
        "llmConfigured": is_llm_configured(),
        "backendBuild": os.getenv("CAREERAI_BACKEND_BUILD", "direct"),
    }


@app.post("/api/auth/register")
def register(payload: RegisterRequest) -> dict:
    try:
        token, user = create_user(payload.name, payload.email, payload.password)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return {"token": token, "user": user}


@app.post("/api/auth/login")
def login(payload: LoginRequest) -> dict:
    result = login_user(payload.email, payload.password)
    if result is None:
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    token, user = result
    return {"token": token, "user": user}


@app.post("/api/auth/logout")
def logout(token: Annotated[str, Depends(get_bearer_token)]) -> dict:
    logout_token(token)
    return {"success": True}


@app.get("/api/profile")
def profile(user: Annotated[dict, Depends(get_current_user)]) -> dict:
    return user


@app.put("/api/profile")
def update_profile(payload: ProfileUpdateRequest, user: Annotated[dict, Depends(get_current_user)]) -> dict:
    return update_user_profile(user["id"], payload.model_dump(exclude_none=True))


@app.post("/api/analysis/resume-text")
def analyze_resume_text(payload: ResumeTextRequest, user: Annotated[dict, Depends(get_current_user)]) -> dict:
    extracted = extract_skills_from_text(payload.resumeText)
    merged = sorted(set(payload.manualSkills + extracted))
    target_role = payload.targetRole or user.get("targetRole") or CAREER_PATHS[recommend_career_path(merged)]["title"]
    profile_details = extract_profile_details_from_text(payload.resumeText)
    updated = update_user_profile(
        user["id"],
        {
            "skills": merged,
            "resumeText": payload.resumeText,
            "education": payload.education or profile_details.get("education") or user.get("education"),
            "summary": payload.summary or profile_details.get("summary") or user.get("summary"),
            "targetRole": target_role,
            "experienceLevel": infer_experience_level(payload.resumeText),
        },
    )
    return {
        "profile": updated,
        "analysis": {
            "extractedSkills": extracted,
            "allSkills": merged,
            "recommendedRole": CAREER_PATHS[recommend_career_path(merged)]["title"],
            "targetRole": target_role,
        },
    }


@app.post("/api/analysis/resume-file")
async def analyze_resume_file(
    file: UploadFile = File(...),
    targetRole: str | None = Form(default=None),
    manualSkills: str = Form(default=""),
    user: dict = Depends(get_current_user),
) -> dict:
    try:
        content = await file.read()
        text = parse_resume_file(file.filename or "resume", content, file.content_type)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    extracted = extract_skills_from_text(text)
    try:
        manual_skills = json.loads(manualSkills) if manualSkills else []
    except json.JSONDecodeError:
        manual_skills = [skill.strip() for skill in manualSkills.split(",") if skill.strip()]
    merged = sorted(set(extracted + manual_skills))
    target_role = targetRole or user.get("targetRole") or CAREER_PATHS[recommend_career_path(merged)]["title"]
    profile_details = extract_profile_details_from_text(text)
    updated = update_user_profile(
        user["id"],
        {
            "skills": merged,
            "resumeText": text,
            "resumeFilename": file.filename or "resume",
            "resumeUploadedAt": utc_now(),
            "targetRole": target_role,
            "education": profile_details.get("education") or user.get("education"),
            "summary": profile_details.get("summary") or user.get("summary"),
            "experienceLevel": infer_experience_level(text),
        },
    )
    return {
        "profile": updated,
        "analysis": {
            "resumeText": text,
            "extractedSkills": extracted,
            "allSkills": merged,
            "recommendedRole": CAREER_PATHS[recommend_career_path(merged)]["title"],
            "targetRole": target_role,
        },
    }


@app.post("/api/integrations/github")
def github_integration(payload: GitHubRequest, user: Annotated[dict, Depends(get_current_user)]) -> dict:
    try:
        profile = fetch_github_profile(payload.username)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    derived_skills = derive_skills_from_github(profile)
    merged = sorted(set(user["skills"] + derived_skills))
    synced_at = utc_now()
    updated = update_user_profile(
        user["id"],
        {
            "githubUsername": profile["username"],
            "githubProfile": profile,
            "githubLastSyncedAt": synced_at,
            "skills": merged,
        },
    )
    return {"githubProfile": profile, "derivedSkills": derived_skills, "profile": updated}


@app.get("/api/dashboard")
def dashboard(token: Annotated[str, Depends(get_bearer_token)]) -> dict:
    user_document = get_user_document_by_token(token)
    if user_document is None:
        raise HTTPException(status_code=401, detail="Session expired or invalid.")
    user = get_user_by_token(token)
    return get_dashboard_payload(user)


@app.get("/api/jobs")
def jobs(
    user: Annotated[dict, Depends(get_current_user)],
    search: str = "",
    type: str = "all",
    targetRole: str | None = None,
    workMode: str = "all",
    location: str = "",
    minSalary: int = 0,
    experienceLevel: str = "all",
    technologies: str = "",
    sort: str = "relevant",
    page: int = 1,
    pageSize: int = 8,
) -> dict:
    selected_role = targetRole or user.get("targetRole")
    technology_filters = [item.strip() for item in technologies.split(",") if item.strip()]

    return search_jobs(
        user["skills"],
        target_role=selected_role,
        search=search,
        type_filter=type,
        work_mode=workMode,
        location=location,
        min_salary=minSalary,
        experience_level=experienceLevel,
        technologies=technology_filters,
        sort=sort,
        page=page,
        page_size=pageSize,
    )


@app.get("/api/skills/gap")
def skill_gap(user: Annotated[dict, Depends(get_current_user)], role: str) -> dict:
    return {"role": role, "gap": get_skill_gap(user["skills"], role), "score": get_match_percent(user["skills"], role)}


@app.get("/api/skills/compare")
def skill_compare(user: Annotated[dict, Depends(get_current_user)]) -> list[dict]:
    return [{"role": role, "score": get_match_percent(user["skills"], role), "gap": get_skill_gap(user["skills"], role)} for role in JOB_SKILL_REQUIREMENTS]


@app.get("/api/roadmap")
def roadmap(user: Annotated[dict, Depends(get_current_user)], key: str | None = None) -> dict:
    selected_key = key or career_key_for_role(user.get("targetRole"), user["skills"])
    path = CAREER_PATHS[selected_key]
    gap = get_skill_gap(user["skills"], path["title"])
    return {"key": selected_key, "path": path, "gap": gap, "nextActions": generate_next_actions(user["skills"], path["title"], gap)}


@app.get("/api/roadmaps")
def roadmaps() -> dict:
    return {"paths": CAREER_PATHS}


@app.get("/api/bookmarks")
def bookmarks(user: Annotated[dict, Depends(get_current_user)]) -> list[dict]:
    return get_bookmarks(user["id"])


@app.post("/api/bookmarks")
def bookmark(payload: BookmarkRequest, user: Annotated[dict, Depends(get_current_user)]) -> dict:
    try:
        return toggle_bookmark(user["id"], payload.job)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.delete("/api/bookmarks/{job_id}")
def delete_bookmark(job_id: str, user: Annotated[dict, Depends(get_current_user)]) -> dict:
    try:
        return remove_bookmark(user["id"], job_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/chat")
def career_chat(payload: ChatRequest, user: Annotated[dict, Depends(get_current_user)]) -> dict:
    try:
        return generate_career_chat_reply(user, payload.message, payload.history)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
