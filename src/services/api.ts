import { deriveSkillsFromGitHub, fetchGitHubProfile } from "@/services/githubService";
import { getRecommendedJobs, searchRecommendedJobs } from "@/services/jobService";
import {
  CAREER_PATHS,
  extractSkillsFromText,
  getMatchPercent,
  getSkillGap,
  inferExperienceLevel,
  JOB_SKILL_REQUIREMENTS,
  recommendCareerPath,
} from "@/services/skillsData";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api";

const TOKEN_KEY = "careerai_token";
const LOCAL_USERS_KEY = "careerai_local_users";
const LOCAL_SESSIONS_KEY = "careerai_local_sessions";
const LOCAL_FALLBACK_NOTICE_KEY = "careerai_local_fallback_notice";
const USER_CACHE_KEY = "careerai_cached_user";
const LOCAL_BOOKMARKS_KEY = "careerai_bookmarks";

type LocalUser = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  skills: string[];
  githubUsername?: string | null;
  targetRole?: string | null;
  resumeText?: string | null;
  education?: string | null;
  summary?: string | null;
  experienceLevel?: "Beginner" | "Intermediate" | "Advanced" | null;
  lastUpdated?: string | null;
};

function getApiBaseCandidates() {
  const strictRemoteApi = import.meta.env.PROD || import.meta.env.VITE_DISABLE_LOCAL_API_FALLBACK === "true";
  if (strictRemoteApi) {
    return [API_BASE_URL];
  }

  const defaultBase = "http://127.0.0.1:8000/api";
  const localPreferred = ["http://127.0.0.1:8012/api", "http://localhost:8012/api", "http://127.0.0.1:8011/api", "http://localhost:8011/api"];
  const legacy = ["http://127.0.0.1:8000/api", "http://localhost:8000/api"];
  return Array.from(new Set(API_BASE_URL === defaultBase ? [...localPreferred, ...legacy] : [API_BASE_URL, ...localPreferred, ...legacy]));
}

async function parseErrorMessage(response: Response) {
  try {
    const data = await response.json();
    if (typeof data.detail === "string") return data.detail;
    if (Array.isArray(data.detail)) {
      return data.detail.map((item) => item.msg || item.message || "Validation error").join(", ");
    }
  } catch {
    // Fall through to the response status text.
  }
  return response.statusText || "Request failed";
}

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function readLocalUsers(): LocalUser[] {
  return JSON.parse(localStorage.getItem(LOCAL_USERS_KEY) || "[]") as LocalUser[];
}

function writeLocalUsers(users: LocalUser[]) {
  localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
}

function readLocalSessions(): Record<string, string> {
  return JSON.parse(localStorage.getItem(LOCAL_SESSIONS_KEY) || "{}") as Record<string, string>;
}

function writeLocalSessions(sessions: Record<string, string>) {
  localStorage.setItem(LOCAL_SESSIONS_KEY, JSON.stringify(sessions));
}

export function cacheUserProfile(user: object | null) {
  if (!user) {
    localStorage.removeItem(USER_CACHE_KEY);
    return;
  }
  localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
}

function readCachedUser(): LocalUser | null {
  try {
    const raw = localStorage.getItem(USER_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LocalUser>;
    if (!parsed || typeof parsed !== "object" || !parsed.id || !parsed.email) return null;
    return {
      id: String(parsed.id),
      name: String(parsed.name || ""),
      email: String(parsed.email || ""),
      passwordHash: "",
      skills: normalizeLocalSkills(Array.isArray(parsed.skills) ? parsed.skills : []),
      githubUsername: parsed.githubUsername || null,
      targetRole: parsed.targetRole || null,
      resumeText: parsed.resumeText || null,
      education: parsed.education || null,
      summary: parsed.summary || null,
      experienceLevel: parsed.experienceLevel || "Beginner",
      lastUpdated: parsed.lastUpdated || new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function serializeLocalUser(user: LocalUser) {
  const { passwordHash: _passwordHash, ...profile } = user;
  return profile;
}

async function hashLocalPassword(password: string) {
  const bytes = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function getLocalUserByToken(token?: string | null) {
  const authToken = token ?? getStoredToken();
  if (!authToken) throw new Error("Missing authorization token.");
  const userId = readLocalSessions()[authToken];
  const user = readLocalUsers().find((item) => item.id === userId);
  if (user) return user;

  const cachedUser = readCachedUser();
  if (cachedUser) {
    const users = readLocalUsers();
    if (!users.some((item) => item.id === cachedUser.id)) {
      users.push(cachedUser);
      writeLocalUsers(users);
    }
    writeLocalSessions({ ...readLocalSessions(), [authToken]: cachedUser.id });
    return cachedUser;
  }

  throw new Error("Session expired or invalid.");
}

function updateLocalUser(userId: string, updates: Partial<LocalUser>) {
  const users = readLocalUsers();
  const index = users.findIndex((item) => item.id === userId);
  if (index < 0) throw new Error("User not found.");
  const payload = { ...updates };
  if (payload.skills) {
    payload.skills = normalizeLocalSkills(payload.skills);
  }
  users[index] = { ...users[index], ...payload, lastUpdated: new Date().toISOString() };
  writeLocalUsers(users);
  return users[index];
}

function normalizeLocalSkills(skills: string[]) {
  const cleaned = new Map<string, string>();
  skills.forEach((skill) => {
    const value = String(skill || "").trim();
    if (value) cleaned.set(value.toLowerCase(), value);
  });
  return Array.from(cleaned.values()).sort();
}

function getLocalDashboard(user: LocalUser) {
  const recommendedKey = recommendCareerPath(user.skills);
  const recommendedRole = CAREER_PATHS[recommendedKey].title;
  const targetRole = user.targetRole || recommendedRole;
  const targetGap = getSkillGap(user.skills, targetRole);
  let profileCompletion = 0;
  if (user.name) profileCompletion += 15;
  if (user.email) profileCompletion += 10;
  if (user.resumeText) profileCompletion += 20;
  if (user.githubUsername) profileCompletion += 15;
  if (user.skills.length) profileCompletion += 20;
  if (user.targetRole) profileCompletion += 10;
  if (user.summary || user.education) profileCompletion += 10;

  return {
    profileCompletion,
    recommendedKey,
    recommendedRole,
    targetRole,
    targetGap,
    targetScore: getMatchPercent(user.skills, targetRole),
    jobs: getRecommendedJobs(user.skills, targetRole),
    strengths: user.skills.slice(0, 6),
  };
}

function buildLocalNextActions(skills: string[], role: string, gap: { matched: string[]; missing: string[] }) {
  const actions = [];
  if (gap.missing.length) {
    const priority = gap.missing.slice(0, 3);
    actions.push({
      title: "Start with missing core skills",
      description: `Focus on ${priority.join(", ")} first because these are required for ${role}.`,
    });
    actions.push({
      title: "Build one proof project",
      description: `Create a small ${role} project using ${priority.slice(0, 2).join(" and ")} and push it to GitHub.`,
    });
  } else {
    actions.push({
      title: "Move toward applications",
      description: `Your profile already covers the tracked ${role} skills. Start applying and keep your projects fresh.`,
    });
  }
  if (skills.length) {
    actions.push({
      title: "Highlight existing strengths",
      description: `Mention ${skills.slice(0, 3).join(", ")} clearly in your CV and GitHub README files.`,
    });
  }
  return actions;
}

function getLocalBookmarksKey(userId: string) {
  return `${LOCAL_BOOKMARKS_KEY}:${userId}`;
}

function readLocalBookmarks(userId: string) {
  const userScoped = localStorage.getItem(getLocalBookmarksKey(userId));
  if (userScoped) return JSON.parse(userScoped);

  const legacy = localStorage.getItem(LOCAL_BOOKMARKS_KEY);
  if (!legacy) return [];
  localStorage.setItem(getLocalBookmarksKey(userId), legacy);
  return JSON.parse(legacy);
}

function writeLocalBookmarks(userId: string, jobs: unknown[]) {
  localStorage.setItem(getLocalBookmarksKey(userId), JSON.stringify(jobs));
}

function toggleLocalBookmark(userId: string, job: Record<string, unknown>) {
  const jobId = String(job?.id || "").trim();
  if (!jobId) throw new Error("Job information is missing, so the bookmark could not be saved.");
  const bookmarks = readLocalBookmarks(userId);
  const index = bookmarks.findIndex((item: Record<string, unknown>) => String(item.id) === jobId);

  if (index >= 0) {
    bookmarks[index] = { ...job, id: jobId };
  } else {
    bookmarks.unshift({ ...job, id: jobId });
  }

  writeLocalBookmarks(userId, bookmarks);
  return true;
}

function removeLocalBookmark(userId: string, jobId: string) {
  const bookmarks = readLocalBookmarks(userId);
  const next = bookmarks.filter((item: Record<string, unknown>) => String(item.id) !== jobId);
  writeLocalBookmarks(userId, next);
  return { removed: next.length !== bookmarks.length };
}

function getLocalGeneralAnswer(message: string) {
  const lower = message.toLowerCase();

  if (["how are you", "who are you", "what can you do"].some((phrase) => lower.includes(phrase))) {
    return {
      reply:
        "### About me\nI'm Aira, your CareerAI coach. I can help with career strategy, interview prep, resume feedback, roadmaps, and common tech-learning questions. If you ask something outside that scope, I'll still try to be helpful and practical.",
      suggestions: ["Ask me to explain a technology.", "Ask for interview prep help.", "Ask for a study plan."],
    };
  }

  if (/what is |explain |difference between |how does |why use /.test(lower)) {
    const conceptHints = [
      { key: "react", answer: "React is a UI library for building component-based interfaces. It helps when you want reusable pieces, predictable state updates, and a strong ecosystem." },
      { key: "next.js", answer: "Next.js builds on React by adding routing, server rendering, API routes, and production conventions. It's useful when you need SEO, faster first loads, or full-stack React workflows." },
      { key: "fastapi", answer: "FastAPI is a Python web framework for APIs. It gives you request validation, OpenAPI docs, async support, and clean typing out of the box." },
      { key: "mongodb", answer: "MongoDB is a document database. It works well when your data shape evolves quickly or when nested JSON-like records are a natural fit." },
      { key: "docker", answer: "Docker packages an app with its environment so it runs consistently across machines. It's especially helpful for deployment, onboarding, and avoiding local setup drift." },
      { key: "jwt", answer: "JWT is a token format commonly used for authentication. It lets the client carry signed identity claims, but it still needs careful expiry, validation, and refresh handling." },
    ];
    const match = conceptHints.find((item) => lower.includes(item.key));
    if (match) {
      return {
        reply: `### Explanation\n${match.answer}\n\n### Practical tip\nIf you want, ask me when to choose it, how it compares with an alternative, or how to use it in a project.`,
        suggestions: ["Ask for a comparison.", "Ask for a beginner roadmap.", "Ask for a project idea using it."],
      };
    }
  }

  if (["motivate", "stuck", "confused", "overwhelmed"].some((phrase) => lower.includes(phrase))) {
    return {
      reply:
        "### Quick reset\nIf you're stuck, shrink the problem. Pick one skill, one project, or one job-search task for today. Momentum usually comes back once the next step is small enough to finish.",
      suggestions: ["Ask me for a one-week plan.", "Ask me what to learn next.", "Ask me to prioritize your gaps."],
    };
  }

  return {
    reply:
      `### Direct answer\nHere is a practical way to approach **${message.trim() || "that question"}**: identify the goal, the constraints, and the smallest useful next step. If it is technical, learn what problem it solves, its core concepts, common mistakes, and one small project where you can apply it.\n\n### CareerAI angle\nI can turn this into a learning plan, interview explanation, resume bullet, or job-search keyword if you want.`,
    suggestions: ["Ask for examples.", "Ask for a step-by-step plan.", "Ask how this helps my career."],
  };
}

function buildLocalChatReply(user: LocalUser, message: string) {
  const cleanMessage = message.trim();
  if (!cleanMessage) throw new Error("Please write a question for CareerAI.");
  const detectedSkills = extractSkillsFromText(cleanMessage);
  const skills = normalizeLocalSkills([...user.skills, ...detectedSkills]);
  const targetRole = user.targetRole || CAREER_PATHS[recommendCareerPath(skills)].title;
  const skillGap = getSkillGap(skills, targetRole);
  const matchPercent = getMatchPercent(skills, targetRole);
  const lower = cleanMessage.toLowerCase();
  const replyParts: string[] = [];
  const suggestions: string[] = [];
  const relatedResources: string[] = [];
  const careerIntentWords = ["job", "jobs", "apply", "internship", "hiring", "roadmap", "path", "learn", "next", "step", "improve", "gap", "github", "repo", "repository", "portfolio", "project", "cv", "resume", "profile", "interview", "behavioral", "technical interview", "resource", "course", "tutorial", "book"];
  const hasCareerIntent = careerIntentWords.some((word) => lower.includes(word));

  if (detectedSkills.length) {
    const newSkills = detectedSkills.filter((skill) => !user.skills.map((saved) => saved.toLowerCase()).includes(skill.toLowerCase()));
    replyParts.push(
      newSkills.length
        ? `### Skill signals\nI detected these skills in your message: **${newSkills.join(", ")}**.`
        : `### Skill signals\nYour message reinforces skills already in your profile: **${detectedSkills.join(", ")}**.`,
    );
  }

  if (["hello", "hi", "hey", "good morning", "good evening"].some((word) => lower.includes(word))) {
    replyParts.push("### Hello\nI can help with career planning, technical explanations, interview prep, learning priorities, job fit, and roadmap questions.");
  }

  if (["job", "jobs", "apply", "internship", "hiring"].some((word) => lower.includes(word))) {
    const jobs = getRecommendedJobs(skills, targetRole).slice(0, 3);
    if (jobs.length) {
      replyParts.push(`### Best-fit roles\n${jobs.map((job) => `- **${job.title}** at ${job.company} (${job.matchScore}% match)`).join("\n")}`);
    }
    suggestions.push("Filter jobs by work mode and salary to shortlist the best applications.", "Tailor your resume headline to the role you want before applying.");
  }

  if (["roadmap", "path", "learn", "next", "step", "improve", "gap"].some((word) => lower.includes(word)) || (!replyParts.length && hasCareerIntent)) {
    if (skillGap.missing.length) {
      const priority = skillGap.missing.slice(0, 3);
      replyParts.push(`### Next learning priority\nYour readiness for **${targetRole}** is about **${matchPercent}%**. The highest-impact skills to build next are **${priority.join(", ")}**.`);
      suggestions.push(`Build one portfolio project centered on ${priority[0]}.`, "Document each project with the problem, stack, approach, and result.", "Refresh your profile after each meaningful project update.");
    } else {
      replyParts.push(`### Readiness snapshot\nYou already cover the tracked requirements for **${targetRole}**. Your biggest lever now is stronger proof through resume bullets, project quality, and targeted applications.`);
      suggestions.push("Prepare a role-specific CV version.", "Bookmark 5 matching jobs and compare their required skills.");
    }
  }

  if (["github", "repo", "repository", "portfolio", "project"].some((word) => lower.includes(word))) {
    replyParts.push("### Portfolio advice\nKeep your best projects pinned, add clear README files, and make sure the stack appears in the repo description so CareerAI can detect it.");
    suggestions.push("Connect GitHub again after updating repo descriptions or languages.");
  }

  if (["cv", "resume", "profile"].some((word) => lower.includes(word))) {
    replyParts.push("### Resume and profile\nPlace your target role near the top, then group skills by frontend, backend, data, and tools. Make project bullets measurable.");
    suggestions.push("Upload or paste the updated CV on the Profile Input page so skills refresh across Dashboard, Jobs, and Roadmap.");
  }

  if (["interview", "behavioral", "technical interview"].some((word) => lower.includes(word))) {
    const focusSkills = skillGap.missing.slice(0, 2).length ? skillGap.missing.slice(0, 2) : skills.slice(0, 2);
    replyParts.push(`### Interview prep\nPrepare a concise introduction, 5 STAR stories, and one end-to-end explanation of a project using **${focusSkills.join(", ") || "your strongest skills"}**.`);
    suggestions.push("Practice a 60-second introduction tied to your target role.", "Write 5 STAR-format stories from projects or coursework.");
  }

  if (["resource", "course", "tutorial", "book"].some((word) => lower.includes(word)) || skillGap.missing.length) {
    const learningMap: Record<string, string[]> = {
      React: ["React Docs", "Frontend Masters React Path"],
      TypeScript: ["TypeScript Handbook", "Total TypeScript"],
      FastAPI: ["FastAPI Docs", "TestDriven.io FastAPI Guides"],
      MongoDB: ["MongoDB University", "MongoDB Docs"],
      Docker: ["Docker Docs", "Play with Docker"],
      Python: ["Python Docs", "Real Python"],
    };
    skillGap.missing.concat(skills).forEach((skill) => {
      if (learningMap[skill] && relatedResources.length < 4) {
        relatedResources.push(`${skill}: ${learningMap[skill].join(", ")}`);
      }
    });
    if (relatedResources.length) {
      replyParts.push(`### Learning resources\n${relatedResources.map((item) => `- ${item}`).join("\n")}`);
      suggestions.push("Pick one missing skill and study it deeply for one focused week.");
    }
  }

  if (!replyParts.length || !hasCareerIntent) {
    const general = getLocalGeneralAnswer(cleanMessage);
    replyParts.push(general.reply);
    suggestions.push(...general.suggestions);
  }

  return {
    reply: replyParts.join("\n\n"),
    detectedSkills,
    targetRole,
    matchPercent,
    skillGap,
    suggestions: Array.from(new Set(suggestions)).slice(0, 5),
    relatedResources,
    category: "career",
  };
}

function careerKeyForRole(role: string | null | undefined, skills: string[]) {
  if (role) {
    const match = Object.entries(CAREER_PATHS).find(([, path]) => path.title.toLowerCase() === role.toLowerCase());
    if (match) return match[0];
  }
  return recommendCareerPath(skills);
}

async function readUploadAsText(file: File) {
  const suffix = file.name.split(".").pop()?.toLowerCase();
  if (suffix === "txt" || suffix === "md") return file.text();
  throw new Error("PDF/DOCX parsing needs the FastAPI backend. Paste resume text or start the backend for file parsing.");
}

async function localApiFetch<T>(path: string, init: RequestInit = {}, token?: string | null): Promise<T> {
  if (!localStorage.getItem(LOCAL_FALLBACK_NOTICE_KEY)) {
    console.info("CareerAI backend is unavailable; using local browser storage fallback for development.");
    localStorage.setItem(LOCAL_FALLBACK_NOTICE_KEY, "shown");
  }

  const url = new URL(path, "http://local.careerai");
  const method = (init.method || "GET").toUpperCase();
  const jsonBody = init.body && typeof init.body === "string" ? JSON.parse(init.body) : {};

  if (url.pathname === "/auth/register" && method === "POST") {
    const email = String(jsonBody.email || "").trim().toLowerCase();
    const name = String(jsonBody.name || "").trim();
    const password = String(jsonBody.password || "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Please enter a valid email address.");
    if (name.length < 2) throw new Error("Name must contain at least 2 characters.");
    if (password.length < 6) throw new Error("Password must contain at least 6 characters.");

    const users = readLocalUsers();
    if (users.some((user) => user.email === email)) throw new Error("An account with this email already exists.");
    const user: LocalUser = {
      id: crypto.randomUUID(),
      name,
      email,
      passwordHash: await hashLocalPassword(password),
      skills: [],
      githubUsername: null,
      targetRole: null,
      resumeText: null,
      education: null,
      summary: null,
      experienceLevel: "Beginner",
      lastUpdated: new Date().toISOString(),
    };
    users.push(user);
    writeLocalUsers(users);
    const sessionToken = crypto.randomUUID();
    writeLocalSessions({ ...readLocalSessions(), [sessionToken]: user.id });
    return { token: sessionToken, user: serializeLocalUser(user) } as T;
  }

  if (url.pathname === "/auth/login" && method === "POST") {
    const email = String(jsonBody.email || "").trim().toLowerCase();
    const passwordHash = await hashLocalPassword(String(jsonBody.password || ""));
    const user = readLocalUsers().find((item) => item.email === email && item.passwordHash === passwordHash);
    if (!user) throw new Error("Invalid email or password.");
    const sessionToken = crypto.randomUUID();
    writeLocalSessions({ ...readLocalSessions(), [sessionToken]: user.id });
    return { token: sessionToken, user: serializeLocalUser(user) } as T;
  }

  if (url.pathname === "/auth/logout" && method === "POST") {
    const authToken = token ?? getStoredToken();
    const sessions = readLocalSessions();
    if (authToken) delete sessions[authToken];
    writeLocalSessions(sessions);
    return { success: true } as T;
  }

  const user = getLocalUserByToken(token);

  if (url.pathname === "/profile" && method === "GET") return serializeLocalUser(user) as T;
  if (url.pathname === "/profile" && method === "PUT") return serializeLocalUser(updateLocalUser(user.id, jsonBody)) as T;
  if (url.pathname === "/dashboard" && method === "GET") return getLocalDashboard(user) as T;
  if (url.pathname === "/skills/compare" && method === "GET") {
    return Object.keys(JOB_SKILL_REQUIREMENTS).map((role) => ({ role, score: getMatchPercent(user.skills, role), gap: getSkillGap(user.skills, role) })) as T;
  }
  if (url.pathname === "/skills/gap" && method === "GET") {
    const role = url.searchParams.get("role") || user.targetRole || "Full-Stack Developer";
    return { role, gap: getSkillGap(user.skills, role), score: getMatchPercent(user.skills, role) } as T;
  }
  if (url.pathname === "/jobs" && method === "GET") {
    return searchRecommendedJobs(user.skills, user.targetRole || undefined, {
      search: url.searchParams.get("search") || "",
      type: url.searchParams.get("type") || "all",
      workMode: url.searchParams.get("workMode") || "all",
      location: url.searchParams.get("location") || "",
      minSalary: Number(url.searchParams.get("minSalary") || "0"),
      experienceLevel: url.searchParams.get("experienceLevel") || "all",
      technologies: (url.searchParams.get("technologies") || "").split(",").map((item) => item.trim()).filter(Boolean),
      sort: (url.searchParams.get("sort") as "relevant" | "newest" | "salary") || "relevant",
      page: Number(url.searchParams.get("page") || "1"),
      pageSize: Number(url.searchParams.get("pageSize") || "8"),
    }) as T;
  }
  if (url.pathname === "/bookmarks" && method === "GET") return readLocalBookmarks(user.id) as T;
  if (url.pathname === "/bookmarks" && method === "POST") {
    if (!jsonBody.job?.id) throw new Error("Job information is missing, so the bookmark could not be saved.");
    return { saved: toggleLocalBookmark(user.id, jsonBody.job) } as T;
  }
  if (url.pathname.startsWith("/bookmarks/") && method === "DELETE") {
    const jobId = decodeURIComponent(url.pathname.replace("/bookmarks/", ""));
    return removeLocalBookmark(user.id, jobId) as T;
  }
  if (url.pathname === "/roadmaps" && method === "GET") return { paths: CAREER_PATHS } as T;
  if (url.pathname === "/roadmap" && method === "GET") {
    const key = url.searchParams.get("key") || careerKeyForRole(user.targetRole, user.skills);
    const pathItem = CAREER_PATHS[key] || CAREER_PATHS.fullstack;
    const gap = getSkillGap(user.skills, pathItem.title);
    return { key, path: pathItem, gap, nextActions: buildLocalNextActions(user.skills, pathItem.title, gap) } as T;
  }
  if (url.pathname === "/analysis/resume-text" && method === "POST") {
    const manualSkills = Array.isArray(jsonBody.manualSkills) ? jsonBody.manualSkills : [];
    const extracted = extractSkillsFromText(jsonBody.resumeText || "");
    const skills = normalizeLocalSkills([...manualSkills, ...extracted]);
    const targetRole = jsonBody.targetRole || user.targetRole || CAREER_PATHS[recommendCareerPath(skills)].title;
    const profile = updateLocalUser(user.id, {
      skills,
      resumeText: jsonBody.resumeText || "",
      education: jsonBody.education || user.education,
      summary: jsonBody.summary || user.summary,
      targetRole,
      experienceLevel: inferExperienceLevel(jsonBody.resumeText || ""),
    });
    return { profile: serializeLocalUser(profile), analysis: { extractedSkills: extracted, allSkills: skills, recommendedRole: CAREER_PATHS[recommendCareerPath(skills)].title, targetRole } } as T;
  }
  if (url.pathname === "/analysis/resume-file" && method === "POST" && init.body instanceof FormData) {
    const file = init.body.get("file");
    if (!(file instanceof File)) throw new Error("Resume file is required.");
    const resumeText = await readUploadAsText(file);
    const rawManualSkills = init.body.get("manualSkills");
    let manualSkills: string[] = [];
    if (typeof rawManualSkills === "string" && rawManualSkills) {
      try {
        manualSkills = JSON.parse(rawManualSkills) as string[];
      } catch {
        manualSkills = rawManualSkills.split(",").map((skill) => skill.trim()).filter(Boolean);
      }
    }
    return localApiFetch("/analysis/resume-text", {
      method: "POST",
      body: JSON.stringify({ resumeText, manualSkills, targetRole: init.body.get("targetRole") }),
    }, token);
  }
  if (url.pathname === "/integrations/github" && method === "POST") {
    const githubProfile = await fetchGitHubProfile(jsonBody.username);
    const derivedSkills = deriveSkillsFromGitHub(githubProfile);
    const profile = updateLocalUser(user.id, {
      githubUsername: githubProfile.username,
      skills: Array.from(new Set([...user.skills, ...derivedSkills])).sort(),
    });
    return { githubProfile, derivedSkills, profile: serializeLocalUser(profile) } as T;
  }
  if (url.pathname === "/chat" && method === "POST") return buildLocalChatReply(user, String(jsonBody.message || "")) as T;

  throw new Error(`Unsupported local API route: ${method} ${url.pathname}`);
}

export async function apiFetch<T>(path: string, init: RequestInit = {}, token?: string | null): Promise<T> {
  const headers = new Headers(init.headers || {});
  const authToken = token ?? getStoredToken();

  if (authToken) {
    headers.set("Authorization", `Bearer ${authToken}`);
  }

  const isFormData = init.body instanceof FormData;
  if (!isFormData && !headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }

  let lastError: Error | null = null;

  for (const baseUrl of getApiBaseCandidates()) {
    let response: Response;
    try {
      response = await fetch(`${baseUrl}${path}`, {
        ...init,
        headers,
      });
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unable to reach the backend.");
      continue;
    }

    if (!response.ok) {
      const message = await parseErrorMessage(response);
      lastError = new Error(message);

      const shouldTryNextBackend =
        response.status >= 500 ||
        response.status === 404 ||
        response.status === 405 ||
        (path.startsWith("/auth/") && ![409, 422].includes(response.status));

      if (shouldTryNextBackend) {
        continue;
      }

      throw lastError;
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }

  if (import.meta.env.VITE_DISABLE_LOCAL_API_FALLBACK === "true") {
    throw lastError || new Error("Unable to reach the backend.");
  }

  if (path === "/analysis/resume-file" && init.body instanceof FormData) {
    const file = init.body.get("file");
    const filename = file instanceof File ? file.name.toLowerCase() : "";
    if (filename.endsWith(".pdf") || filename.endsWith(".docx")) {
      throw new Error(
        "FastAPI backend is not reachable for PDF/DOCX parsing. Start it with `npm run backend` or `npm run dev:fullstack`, and ensure VITE_API_BASE_URL points to http://127.0.0.1:8012/api.",
      );
    }
  }

  return localApiFetch<T>(path, init, token);
}
