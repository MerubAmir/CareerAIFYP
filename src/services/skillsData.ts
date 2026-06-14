export const TECH_SKILLS = [
  "JavaScript",
  "TypeScript",
  "Python",
  "Java",
  "C++",
  "C#",
  "Go",
  "Rust",
  "PHP",
  "Kotlin",
  "Swift",
  "SQL",
  "HTML",
  "CSS",
  "React",
  "Next.js",
  "Vue.js",
  "Angular",
  "Tailwind CSS",
  "Node.js",
  "Express.js",
  "FastAPI",
  "Django",
  "Flask",
  "MongoDB",
  "PostgreSQL",
  "MySQL",
  "Firebase",
  "Docker",
  "Kubernetes",
  "AWS",
  "Azure",
  "Git",
  "GitHub",
  "REST API",
  "GraphQL",
  "Machine Learning",
  "Deep Learning",
  "Scikit-learn",
  "TensorFlow",
  "PyTorch",
  "Pandas",
  "NumPy",
  "Power BI",
  "Tableau",
  "Figma",
  "Linux",
  "CI/CD",
  "Data Structures",
  "Algorithms",
  "NLP",
  "Bootstrap",
  "Material UI",
  "Redux",
  "Zustand",
  "Prisma",
  "Mongoose",
  "JWT",
  "OAuth",
  "Selenium",
  "Playwright",
  "Jest",
  "Vitest",
  "Laravel",
  "WordPress",
  "Jupyter Notebook",
  "MS Office",
  "Excel",
  "Communication",
  "Problem Solving",
];

const SKILL_ALIASES: Record<string, string[]> = {
  JavaScript: ["javascript", "js", "ecmascript"],
  TypeScript: ["typescript", "ts"],
  React: ["react", "reactjs", "react.js"],
  "Next.js": ["next.js", "nextjs"],
  "Node.js": ["node", "nodejs", "node.js"],
  "Express.js": ["express", "expressjs", "express.js"],
  "Tailwind CSS": ["tailwind", "tailwind css"],
  "Machine Learning": ["machine learning", "ml"],
  "Deep Learning": ["deep learning", "dl"],
  "Scikit-learn": ["scikit-learn", "sklearn"],
  PostgreSQL: ["postgresql", "postgres", "psql"],
  MongoDB: ["mongodb", "mongo"],
  GitHub: ["github"],
  Git: ["git", "version control"],
  "CI/CD": ["ci/cd", "cicd", "continuous integration", "continuous deployment"],
  "C#": ["c#", ".net", "dotnet"],
  Bootstrap: ["bootstrap"],
  "Material UI": ["material ui", "mui"],
  Redux: ["redux", "redux toolkit"],
  Zustand: ["zustand"],
  Prisma: ["prisma"],
  Mongoose: ["mongoose"],
  JWT: ["jwt", "json web token", "json web tokens"],
  OAuth: ["oauth", "oauth2"],
  "REST API": ["rest", "rest api", "restful api", "api development", "restful"],
  Selenium: ["selenium"],
  Playwright: ["playwright"],
  Jest: ["jest"],
  Vitest: ["vitest"],
  Laravel: ["laravel"],
  WordPress: ["wordpress"],
  "Jupyter Notebook": ["jupyter", "jupyter notebook", "ipynb"],
  "MS Office": ["ms office", "microsoft office"],
  Excel: ["excel", "microsoft excel"],
  Communication: ["communication", "presentation", "teamwork"],
  "Problem Solving": ["problem solving", "analytical thinking"],
};

export const CAREER_PATHS: Record<
  string,
  {
    title: string;
    description: string;
    skills: string[];
    timeline: string;
    steps: { title: string; description: string; duration: string; resources: string[] }[];
  }
> = {
  frontend: {
    title: "Frontend Developer",
    description: "Create responsive, accessible, and polished product experiences for the web.",
    timeline: "1-2 years",
    skills: ["HTML", "CSS", "JavaScript", "TypeScript", "React", "Next.js", "Tailwind CSS", "Git"],
    steps: [
      { title: "Web Foundations", description: "Master semantic HTML, responsive CSS, and accessibility basics.", duration: "3 weeks", resources: ["MDN", "freeCodeCamp", "A11y Project"] },
      { title: "Modern JavaScript", description: "Build confidence with DOM APIs, async flows, and array/object patterns.", duration: "4 weeks", resources: ["JavaScript.info", "Frontend Masters"] },
      { title: "React + TypeScript", description: "Ship reusable components, stateful flows, and typed UI logic.", duration: "5 weeks", resources: ["React Docs", "TypeScript Handbook"] },
      { title: "Production Frontend", description: "Add testing, performance tuning, forms, and deployment workflows.", duration: "4 weeks", resources: ["Vite Docs", "Vitest", "Vercel"] },
    ],
  },
  backend: {
    title: "Backend Developer",
    description: "Build APIs, databases, and secure services that power modern applications.",
    timeline: "1-2 years",
    skills: ["Python", "Node.js", "FastAPI", "PostgreSQL", "MongoDB", "Docker", "REST API", "Git"],
    steps: [
      { title: "Programming Core", description: "Strengthen one backend language and write clean service logic.", duration: "4 weeks", resources: ["Python Docs", "Node Docs"] },
      { title: "API Engineering", description: "Build REST APIs, request validation, and auth-ready endpoints.", duration: "4 weeks", resources: ["FastAPI Docs", "Postman"] },
      { title: "Database Design", description: "Model structured and document-based data for real products.", duration: "4 weeks", resources: ["MongoDB University", "SQLBolt"] },
      { title: "Deployment Readiness", description: "Containerize, log, and deploy backend services with confidence.", duration: "4 weeks", resources: ["Docker Docs", "Render", "Railway"] },
    ],
  },
  fullstack: {
    title: "Full-Stack Developer",
    description: "Own user-facing features from UI through API and deployment.",
    timeline: "1-3 years",
    skills: ["JavaScript", "TypeScript", "React", "Node.js", "PostgreSQL", "MongoDB", "Docker", "Git", "REST API"],
    steps: [
      { title: "Frontend Fluency", description: "Build interfaces, forms, dashboards, and responsive layouts.", duration: "5 weeks", resources: ["React Docs", "Tailwind Docs"] },
      { title: "Backend Integration", description: "Create APIs, connect databases, and manage application state.", duration: "6 weeks", resources: ["FastAPI Docs", "TanStack Query"] },
      { title: "Feature Delivery", description: "Ship complete modules such as auth, analytics, and recommendation flows.", duration: "4 weeks", resources: ["System Design Primer", "Playwright"] },
      { title: "Cloud Delivery", description: "Deploy, monitor, and iterate on user-facing products.", duration: "3 weeks", resources: ["Vercel", "Railway", "GitHub Actions"] },
    ],
  },
  datascience: {
    title: "Data Scientist",
    description: "Turn datasets into decisions with analytics, experimentation, and machine learning.",
    timeline: "1-3 years",
    skills: ["Python", "SQL", "Pandas", "NumPy", "Scikit-learn", "Machine Learning", "Power BI", "Tableau"],
    steps: [
      { title: "Data Foundations", description: "Clean, transform, and explore data using Python and SQL.", duration: "5 weeks", resources: ["Kaggle Learn", "Pandas Docs"] },
      { title: "Analytics Storytelling", description: "Build dashboards and communicate insights clearly.", duration: "3 weeks", resources: ["Power BI Learn", "Tableau Public"] },
      { title: "Machine Learning", description: "Train, evaluate, and interpret practical models.", duration: "6 weeks", resources: ["Scikit-learn Docs", "Andrew Ng ML"] },
      { title: "Portfolio Projects", description: "Publish case studies that prove business impact and rigor.", duration: "4 weeks", resources: ["GitHub", "Medium"] },
    ],
  },
  ml: {
    title: "ML Engineer",
    description: "Build practical machine-learning systems, evaluate models, and prepare them for production use.",
    timeline: "1-3 years",
    skills: ["Python", "Machine Learning", "Scikit-learn", "TensorFlow", "PyTorch", "Docker", "AWS", "Git"],
    steps: [
      { title: "Programming and Math Base", description: "Strengthen Python, linear algebra basics, statistics, and clean notebook workflows.", duration: "3-4 months", resources: ["Python Docs", "Kaggle Learn", "StatQuest"] },
      { title: "Applied ML Projects", description: "Train, validate, and explain classification, regression, and recommendation models.", duration: "4-6 months", resources: ["Scikit-learn Docs", "Kaggle", "Papers with Code"] },
      { title: "Deep Learning and NLP", description: "Build small neural-network and text-analysis projects relevant to employability systems.", duration: "4-6 months", resources: ["PyTorch Tutorials", "TensorFlow Guides", "Hugging Face Course"] },
      { title: "Deployment Portfolio", description: "Package models behind APIs, document metrics, and publish a portfolio-ready project.", duration: "4-8 months", resources: ["FastAPI Docs", "Docker Docs", "AWS Skill Builder"] },
    ],
  },
  devops: {
    title: "DevOps Engineer",
    description: "Automate delivery pipelines, cloud infrastructure, and operational excellence.",
    timeline: "1-3 years",
    skills: ["Linux", "Docker", "Kubernetes", "AWS", "Git", "CI/CD"],
    steps: [
      { title: "Linux + Networking", description: "Learn shell workflows, permissions, networking, and process management.", duration: "4 weeks", resources: ["Linux Journey", "DigitalOcean Guides"] },
      { title: "Containers", description: "Package apps with Docker and orchestrate services cleanly.", duration: "4 weeks", resources: ["Docker Docs", "Play with Docker"] },
      { title: "Cloud + Pipelines", description: "Set up CI/CD, observability, and deployment strategies.", duration: "5 weeks", resources: ["GitHub Actions", "AWS Skill Builder"] },
      { title: "Infrastructure Automation", description: "Move toward reproducible environments and IaC workflows.", duration: "4 weeks", resources: ["Terraform Learn", "Ansible Docs"] },
    ],
  },
};

export const JOB_SKILL_REQUIREMENTS: Record<string, string[]> = {
  "Frontend Developer": ["HTML", "CSS", "JavaScript", "TypeScript", "React", "Tailwind CSS", "Git", "REST API"],
  "Backend Developer": ["Python", "Node.js", "FastAPI", "PostgreSQL", "MongoDB", "Docker", "REST API", "Git"],
  "Full-Stack Developer": ["JavaScript", "TypeScript", "React", "Node.js", "PostgreSQL", "MongoDB", "Docker", "Git"],
  "Data Scientist": ["Python", "SQL", "Pandas", "Scikit-learn", "Machine Learning", "Power BI"],
  "DevOps Engineer": ["Linux", "Docker", "Kubernetes", "AWS", "CI/CD", "Git"],
  "ML Engineer": ["Python", "TensorFlow", "PyTorch", "Machine Learning", "Docker", "AWS"],
};

export function normalizeSkill(skill: string) {
  return skill.trim().toLowerCase();
}

export function extractSkillsFromText(text: string): string[] {
  const normalized = text.toLowerCase();
  const found = new Set<string>();

  TECH_SKILLS.forEach((skill) => {
    const variants = [skill.toLowerCase(), ...(SKILL_ALIASES[skill] || [])];
    const hasMatch = variants.some((variant) => {
      const escaped = variant.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`(^|[^a-z0-9+#])${escaped}([^a-z0-9+#]|$)`, "i").test(normalized);
    });

    if (hasMatch) found.add(skill);
  });

  return Array.from(found).sort();
}

export function getSkillGap(userSkills: string[], targetRole: string) {
  const required = JOB_SKILL_REQUIREMENTS[targetRole] || [];
  const userSet = new Set(userSkills.map(normalizeSkill));
  const matched = required.filter((skill) => userSet.has(normalizeSkill(skill)));
  const missing = required.filter((skill) => !userSet.has(normalizeSkill(skill)));
  return { matched, missing };
}

export function getMatchPercent(userSkills: string[], targetRole: string) {
  const gap = getSkillGap(userSkills, targetRole);
  const total = gap.matched.length + gap.missing.length;
  return total ? Math.round((gap.matched.length / total) * 100) : 0;
}

export function recommendCareerPath(userSkills: string[]) {
  const userSet = new Set(userSkills.map(normalizeSkill));
  let bestKey = "fullstack";
  let bestScore = -1;

  Object.entries(CAREER_PATHS).forEach(([key, path]) => {
    const score = path.skills.filter((skill) => userSet.has(normalizeSkill(skill))).length;
    if (score > bestScore) {
      bestKey = key;
      bestScore = score;
    }
  });

  return bestKey;
}

export function inferExperienceLevel(text: string): "Beginner" | "Intermediate" | "Advanced" {
  const years = Array.from(text.matchAll(/(\d+)\+?\s*(?:years|yrs)/gi)).map((match) => Number(match[1]));
  const highest = years.length ? Math.max(...years) : 0;
  if (highest >= 4) return "Advanced";
  if (highest >= 2) return "Intermediate";
  return "Beginner";
}
