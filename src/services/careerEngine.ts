import type { UserProfile } from "@/contexts/AuthContext";
import { CAREER_PATHS, getMatchPercent, getSkillGap, JOB_SKILL_REQUIREMENTS, recommendCareerPath } from "@/services/skillsData";
import { getRecommendedJobs } from "@/services/jobService";

export function getProfileCompletion(user: UserProfile | null) {
  if (!user) return 0;

  let score = 0;
  if (user.name) score += 15;
  if (user.email) score += 10;
  if (user.resumeText) score += 20;
  if (user.githubUsername) score += 15;
  if (user.skills.length) score += 20;
  if (user.targetRole) score += 10;
  if (user.summary || user.education) score += 10;

  return score;
}

export function getCareerInsights(user: UserProfile | null) {
  if (!user) {
    return {
      profileCompletion: 0,
      recommendedKey: "fullstack",
      recommendedRole: CAREER_PATHS.fullstack.title,
      targetRole: CAREER_PATHS.fullstack.title,
      targetGap: { matched: [], missing: [] },
      targetScore: 0,
      jobs: [],
      strengths: [],
    };
  }

  const recommendedKey = recommendCareerPath(user.skills);
  const recommendedRole = CAREER_PATHS[recommendedKey].title;
  const targetRole = user.targetRole || recommendedRole;
  const targetGap = getSkillGap(user.skills, targetRole);
  const jobs = getRecommendedJobs(user.skills, targetRole);
  const strengths = user.skills.slice(0, 6);

  return {
    profileCompletion: getProfileCompletion(user),
    recommendedKey,
    recommendedRole,
    targetRole,
    targetGap,
    targetScore: getMatchPercent(user.skills, targetRole),
    jobs,
    strengths,
  };
}

export function getRoleComparison(skills: string[]) {
  return Object.keys(JOB_SKILL_REQUIREMENTS).map((role) => ({
    role,
    score: getMatchPercent(skills, role),
    gap: getSkillGap(skills, role),
  }));
}
