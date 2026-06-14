export interface GitHubProfile {
  username: string;
  avatar: string;
  name: string;
  bio: string;
  repos: number;
  followers: number;
  languages: Record<string, number>;
  topRepos: { name: string; description: string; stars: number; language: string; url: string }[];
  limited?: boolean;
}

interface GitHubUserResponse {
  login: string;
  avatar_url: string;
  name: string | null;
  bio: string | null;
  public_repos: number;
  followers: number;
}

interface GitHubRepoResponse {
  name: string;
  description: string | null;
  stargazers_count: number;
  language: string | null;
  html_url: string;
}

const LANGUAGE_TO_SKILL: Record<string, string[]> = {
  JavaScript: ["JavaScript", "Node.js"],
  TypeScript: ["TypeScript", "JavaScript"],
  Python: ["Python"],
  Java: ["Java"],
  "C++": ["C++"],
  "C#": ["C#", "ASP.NET"],
  Go: ["Go"],
  Rust: ["Rust"],
  Ruby: ["Ruby", "Ruby on Rails"],
  PHP: ["PHP", "Laravel"],
  Swift: ["Swift"],
  Kotlin: ["Kotlin"],
  Dart: ["Dart"],
  HTML: ["HTML"],
  CSS: ["CSS"],
  SCSS: ["CSS"],
  Less: ["CSS"],
  Vue: ["Vue.js", "JavaScript"],
  "Jupyter Notebook": ["Python", "Jupyter Notebook", "Pandas", "NumPy"],
  Blade: ["PHP", "Laravel"],
  Shell: ["Linux", "Git"],
  Dockerfile: ["Docker"],
  HCL: ["Terraform"],
};

const repoSkillWords: Record<string, string[]> = {
  react: ["React"],
  vite: ["React", "JavaScript"],
  next: ["Next.js", "React"],
  node: ["Node.js"],
  express: ["Express.js", "Node.js"],
  fastapi: ["FastAPI", "Python"],
  django: ["Django", "Python"],
  flask: ["Flask", "Python"],
  mongo: ["MongoDB"],
  mongodb: ["MongoDB"],
  mysql: ["MySQL"],
  postgres: ["PostgreSQL"],
  postgresql: ["PostgreSQL"],
  docker: ["Docker"],
  tailwind: ["Tailwind CSS"],
  api: ["REST API"],
  machine: ["Machine Learning"],
  ml: ["Machine Learning"],
  pandas: ["Pandas"],
  numpy: ["NumPy"],
  tensorflow: ["TensorFlow"],
  pytorch: ["PyTorch"],
};

export async function fetchGitHubProfile(username: string): Promise<GitHubProfile> {
  try {
    const [userRes, reposRes] = await Promise.all([
      fetch(`https://api.github.com/users/${username}`),
      fetch(`https://api.github.com/users/${username}/repos?sort=stars&per_page=10`),
    ]);

    if (userRes.status === 404) throw new Error("GitHub user not found.");
    if (!userRes.ok) {
      return {
        username,
        avatar: "",
        name: username,
        bio: "GitHub API limit or network issue; CareerAI saved the username and added baseline GitHub context.",
        repos: 0,
        followers: 0,
        languages: {},
        topRepos: [],
        limited: true,
      };
    }

    const userData = (await userRes.json()) as GitHubUserResponse;
    const reposData = (await reposRes.json()) as GitHubRepoResponse[];

    const languages: Record<string, number> = {};
    const topRepos = reposData.map((r) => {
      if (r.language) languages[r.language] = (languages[r.language] || 0) + 1;
      return { name: r.name, description: r.description || "", stars: r.stargazers_count, language: r.language || "N/A", url: r.html_url };
    });

    return {
      username: userData.login,
      avatar: userData.avatar_url,
      name: userData.name || userData.login,
      bio: userData.bio || "",
      repos: userData.public_repos,
      followers: userData.followers,
      languages,
      topRepos,
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes("not found")) {
      throw error;
    }
    return {
      username,
      avatar: "",
      name: username,
      bio: "GitHub API is temporarily unreachable; CareerAI saved the username and added baseline GitHub context.",
      repos: 0,
      followers: 0,
      languages: {},
      topRepos: [],
      limited: true,
    };
  }
}

export function deriveSkillsFromGitHub(profile: GitHubProfile): string[] {
  const skills = new Set<string>();
  skills.add("Git");
  skills.add("GitHub");

  for (const lang of Object.keys(profile.languages)) {
    const mapped = LANGUAGE_TO_SKILL[lang];
    if (mapped) mapped.forEach(s => skills.add(s));
  }

  profile.topRepos.forEach((repo) => {
    const text = `${repo.name} ${repo.description} ${repo.language}`.toLowerCase();
    Object.entries(repoSkillWords).forEach(([needle, mapped]) => {
      if (text.includes(needle)) mapped.forEach((skill) => skills.add(skill));
    });
  });

  return Array.from(skills);
}
