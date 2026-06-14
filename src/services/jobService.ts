import { extractSkillsFromText, getMatchPercent, JOB_SKILL_REQUIREMENTS, normalizeSkill } from "@/services/skillsData";

export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  type: string;
  salary?: string;
  url: string;
  tags: string[];
  description: string;
  date: string;
  source: string;
  role: string;
  liveSource?: boolean;
}

export interface ScoredJob extends Job {
  matchScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  workMode?: "remote" | "hybrid" | "on-site";
  experienceBand?: "entry" | "mid" | "senior";
  salaryValue?: number | null;
}

export interface JobSearchFilters {
  search?: string;
  type?: string;
  workMode?: string;
  location?: string;
  minSalary?: number;
  experienceLevel?: string;
  technologies?: string[];
  sort?: "relevant" | "newest" | "salary";
  page?: number;
  pageSize?: number;
}

export interface JobSearchResult {
  items: ScoredJob[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  searchSuggestions: string[];
  appliedFilters: {
    type: string;
    workMode: string;
    location: string;
    minSalary: number;
    experienceLevel: string;
    technologies: string[];
    sort: string;
  };
}

const SAMPLE_JOBS: Job[] = [
  {
    id: "job-1",
    title: "Frontend Developer Intern",
    company: "PixelForge",
    location: "Remote",
    type: "Internship",
    salary: "PKR 45k - 60k",
    url: "https://remotive.com/remote-jobs?search=frontend%20developer%20intern",
    tags: ["HTML", "CSS", "JavaScript", "React", "Figma"],
    description: "Support the product team by shipping dashboard components, landing pages, and accessible UI improvements.",
    date: "2026-04-21",
    source: "Remotive",
    role: "Frontend Developer",
  },
  {
    id: "job-2",
    title: "Junior Full-Stack Engineer",
    company: "LaunchLayer",
    location: "Islamabad, PK",
    type: "Full-time",
    salary: "PKR 120k - 180k",
    url: "https://www.arbeitnow.com/jobs?search=junior%20full-stack%20engineer",
    tags: ["React", "TypeScript", "Node.js", "MongoDB", "REST API"],
    description: "Own small end-to-end features across the web app, API layer, and QA workflow.",
    date: "2026-04-24",
    source: "Arbeitnow",
    role: "Full-Stack Developer",
  },
  {
    id: "job-3",
    title: "Backend Engineer",
    company: "DataArc",
    location: "Remote",
    type: "Full-time",
    salary: "PKR 180k - 250k",
    url: "https://www.arbeitnow.com/jobs?search=backend%20engineer",
    tags: ["Python", "FastAPI", "PostgreSQL", "Docker", "Git"],
    description: "Design scalable service endpoints, handle data modeling, and improve deployment quality.",
    date: "2026-04-23",
    source: "Arbeitnow",
    role: "Backend Developer",
  },
  {
    id: "job-4",
    title: "Data Analyst Trainee",
    company: "InsightMint",
    location: "Lahore, PK",
    type: "Internship",
    salary: "PKR 50k - 70k",
    url: "https://pk.jooble.org/SearchResult?ukw=data%20analyst%20trainee",
    tags: ["Python", "SQL", "Pandas", "Power BI", "Tableau"],
    description: "Prepare reports, automate simple data pipelines, and build dashboards for business teams.",
    date: "2026-04-20",
    source: "Jooble",
    role: "Data Scientist",
  },
  {
    id: "job-5",
    title: "DevOps Associate",
    company: "InfraNest",
    location: "Remote",
    type: "Full-time",
    salary: "PKR 170k - 240k",
    url: "https://remotive.com/remote-jobs?search=devops%20associate",
    tags: ["Linux", "Docker", "AWS", "CI/CD", "Git"],
    description: "Automate releases, monitor cloud services, and support infrastructure upgrades.",
    date: "2026-04-19",
    source: "Remotive",
    role: "DevOps Engineer",
  },
  {
    id: "job-6",
    title: "Machine Learning Engineer Intern",
    company: "NeuronStack",
    location: "Remote",
    type: "Internship",
    salary: "PKR 65k - 90k",
    url: "https://remotive.com/remote-jobs?search=machine%20learning%20engineer%20intern",
    tags: ["Python", "Scikit-learn", "TensorFlow", "PyTorch", "Machine Learning"],
    description: "Prototype recommendation and classification models with experiment tracking and model evaluation.",
    date: "2026-04-17",
    source: "Remotive",
    role: "ML Engineer",
  },
  {
    id: "job-7",
    title: "UI Engineer",
    company: "Northstar Labs",
    location: "Hybrid - Islamabad",
    type: "Contract",
    salary: "PKR 140k - 190k",
    url: "https://pk.jooble.org/SearchResult?ukw=ui%20engineer",
    tags: ["React", "TypeScript", "Tailwind CSS", "Next.js", "REST API"],
    description: "Deliver rich interfaces for product analytics and customer onboarding experiences.",
    date: "2026-04-26",
    source: "Jooble",
    role: "Frontend Developer",
  },
  {
    id: "job-8",
    title: "Junior API Developer",
    company: "CorePilot",
    location: "Remote",
    type: "Full-time",
    salary: "PKR 130k - 175k",
    url: "https://www.arbeitnow.com/jobs?search=junior%20api%20developer",
    tags: ["Node.js", "Express.js", "MongoDB", "REST API", "Docker"],
    description: "Build integrations, maintain APIs, and collaborate with product teams on backend reliability.",
    date: "2026-04-22",
    source: "Arbeitnow",
    role: "Backend Developer",
  },
];

export function getAllJobs() {
  return SAMPLE_JOBS;
}

export function scoreJob(job: Job, userSkills: string[], targetRole?: string): ScoredJob {
  const userSet = new Set(userSkills.map(normalizeSkill));
  const derivedTags = Array.from(new Set([...job.tags, ...extractSkillsFromText(`${job.title} ${job.description}`)]));
  const required = targetRole ? JOB_SKILL_REQUIREMENTS[targetRole] || [] : [];
  const matchedSkills = derivedTags.filter((skill) => userSet.has(normalizeSkill(skill)));
  const missingSkills = Array.from(new Set([...derivedTags, ...required])).filter((skill) => !userSet.has(normalizeSkill(skill))).slice(0, 8);
  const skillScore = derivedTags.length ? (matchedSkills.length / derivedTags.length) * 55 : 0;
  const requirementScore = required.length ? (required.filter((skill) => userSet.has(normalizeSkill(skill))).length / required.length) * 30 : 0;
  const roleBoost = targetRole && job.role === targetRole ? 15 : 0;
  const finalScore = Math.min(100, Math.round(skillScore + requirementScore + roleBoost));

  return {
    ...job,
    tags: derivedTags.slice(0, 10),
    matchScore: finalScore,
    matchedSkills,
    missingSkills,
  };
}

export function getRecommendedJobs(userSkills: string[], targetRole?: string): ScoredJob[] {
  void userSkills;
  void targetRole;
  return [];
}

function parseSalaryValue(salary?: string) {
  if (!salary) return null;
  const matches = [...salary.matchAll(/(\d+(?:\.\d+)?)\s*([kKmM]?)/g)];
  if (!matches.length) return null;
  const values = matches.map(([, numeric, suffix]) => {
    const value = Number(numeric);
    if (suffix?.toLowerCase() === "k") return value * 1_000;
    if (suffix?.toLowerCase() === "m") return value * 1_000_000;
    return value;
  });
  return Math.max(...values);
}

function inferWorkMode(location: string): "remote" | "hybrid" | "on-site" {
  const normalized = location.toLowerCase();
  if (normalized.includes("remote")) return "remote";
  if (normalized.includes("hybrid")) return "hybrid";
  return "on-site";
}

function inferExperienceBand(job: Job): "entry" | "mid" | "senior" {
  const text = `${job.title} ${job.description} ${job.type}`.toLowerCase();
  if (/(intern|internship|trainee|junior|entry)/.test(text)) return "entry";
  if (/(senior|lead|principal|staff)/.test(text)) return "senior";
  return "mid";
}

function normalizeJobType(value: string) {
  const normalized = value.trim().toLowerCase().replace(/[\s_]+/g, "-");
  if (normalized.includes("intern") || normalized.includes("trainee")) return "internship";
  if (normalized.includes("contract") || normalized.includes("freelance")) return "contract";
  if (normalized === "fulltime" || normalized === "permanent") return "full-time";
  return normalized;
}

function estimateRecencyScore(date: string) {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return 0;
  const ageDays = Math.max(0, Math.floor((Date.now() - parsed.getTime()) / 86_400_000));
  return Math.max(0, 10 - Math.min(ageDays, 10));
}

function tokenize(text: string) {
  return text.toLowerCase().match(/[a-z0-9+#.]+/g) || [];
}

function boostJobsForSearch(jobs: ScoredJob[], search: string) {
  const tokens = tokenize(search);
  if (!tokens.length) return jobs;
  return jobs
    .map((job) => {
      const searchable = `${job.title} ${job.company} ${job.description} ${job.role} ${job.tags.join(" ")}`.toLowerCase();
      const keywordHits = tokens.filter((token) => searchable.includes(token)).length;
      const titleHits = tokens.filter((token) => job.title.toLowerCase().includes(token)).length;
      return { ...job, matchScore: Math.min(100, job.matchScore + keywordHits * 4 + titleHits * 5) };
    })
    .sort((a, b) => b.matchScore - a.matchScore);
}

export function searchRecommendedJobs(userSkills: string[], targetRole?: string, filters: JobSearchFilters = {}): JobSearchResult {
  const {
    search = "",
    type = "all",
    workMode = "all",
    location = "",
    minSalary = 0,
    experienceLevel = "all",
    technologies = [],
    sort = "relevant",
    page = 1,
    pageSize = 8,
  } = filters;

  let jobs = boostJobsForSearch(getRecommendedJobs(userSkills, targetRole), search).map((job) => ({
    ...job,
    salaryValue: parseSalaryValue(job.salary),
    workMode: inferWorkMode(job.location),
    experienceBand: inferExperienceBand(job),
  }));

  if (search.trim()) {
    const tokens = tokenize(search);
    jobs = jobs.filter((job) => {
      const searchable = `${job.title} ${job.company} ${job.role} ${job.tags.join(" ")} ${job.description}`.toLowerCase();
      return tokens.some((token) => searchable.includes(token));
    });
  }
  if (type !== "all") jobs = jobs.filter((job) => normalizeJobType(job.type) === normalizeJobType(type));
  if (workMode !== "all") jobs = jobs.filter((job) => job.workMode === workMode);
  if (location.trim()) jobs = jobs.filter((job) => job.location.toLowerCase().includes(location.toLowerCase()));
  if (minSalary > 0) jobs = jobs.filter((job) => (job.salaryValue || 0) >= minSalary);
  if (experienceLevel !== "all") jobs = jobs.filter((job) => job.experienceBand === experienceLevel);
  if (technologies.length) {
    const selected = new Set(technologies.map((item) => normalizeSkill(item)));
    jobs = jobs.filter((job) => {
      const searchable = `${job.title} ${job.description} ${job.tags.join(" ")}`.toLowerCase();
      return job.tags.some((tag) => selected.has(normalizeSkill(tag))) || [...selected].some((technology) => searchable.includes(technology));
    });
  }

  if (sort === "newest") {
    jobs.sort((a, b) => estimateRecencyScore(b.date) - estimateRecencyScore(a.date) || b.matchScore - a.matchScore);
  } else if (sort === "salary") {
    jobs.sort((a, b) => (b.salaryValue || 0) - (a.salaryValue || 0) || b.matchScore - a.matchScore);
  } else {
    jobs.sort((a, b) => b.matchScore - a.matchScore);
  }

  const suggestions = Array.from(
    new Set(
      jobs.flatMap((job) => [job.title, job.role, ...job.tags]).filter((item) => !search || item.toLowerCase().includes(search.toLowerCase()) || item.length < 20),
    ),
  ).slice(0, 8);

  const normalizedPage = Math.max(1, page);
  const safePageSize = Math.max(1, Math.min(pageSize, 20));
  const start = (normalizedPage - 1) * safePageSize;

  return {
    items: jobs.slice(start, start + safePageSize),
    total: jobs.length,
    page: normalizedPage,
    pageSize: safePageSize,
    hasMore: start + safePageSize < jobs.length,
    searchSuggestions: suggestions,
    appliedFilters: {
      type,
      workMode,
      location,
      minSalary,
      experienceLevel,
      technologies,
      sort,
    },
  };
}

export function getBookmarks(): Job[] {
  const saved = localStorage.getItem("careerai_bookmarks");
  return saved ? JSON.parse(saved) : [];
}

export function toggleBookmark(job: Job): boolean {
  const bookmarks = getBookmarks();
  const idx = bookmarks.findIndex((item) => item.id === job.id);

  if (idx >= 0) {
    bookmarks.splice(idx, 1);
    localStorage.setItem("careerai_bookmarks", JSON.stringify(bookmarks));
    return false;
  }

  bookmarks.push(job);
  localStorage.setItem("careerai_bookmarks", JSON.stringify(bookmarks));
  return true;
}

export function isBookmarked(jobId: string) {
  return getBookmarks().some((job) => job.id === jobId);
}
