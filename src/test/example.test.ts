import { describe, expect, it } from "vitest";
import {
  extractSkillsFromText,
  getMatchPercent,
  getSkillGap,
  recommendCareerPath,
} from "@/services/skillsData";

describe("career matching", () => {
  it("extracts canonical skills from resume text", () => {
    expect(extractSkillsFromText("Built React and FastAPI apps with MongoDB.")).toEqual(
      expect.arrayContaining(["React", "FastAPI", "MongoDB"]),
    );
  });

  it("calculates a consistent skill gap and match percentage", () => {
    const skills = ["React", "JavaScript", "HTML", "CSS"];
    const role = "Frontend Developer";
    const gap = getSkillGap(skills, role);

    expect(gap.matched).toEqual(expect.arrayContaining(skills));
    expect(gap.missing.length).toBeGreaterThan(0);
    expect(getMatchPercent(skills, role)).toBeGreaterThan(0);
    expect(getMatchPercent(skills, role)).toBeLessThan(100);
  });

  it("recommends a career path from relevant skills", () => {
    expect(recommendCareerPath(["Python", "Pandas", "NumPy", "Machine Learning"])).toBe("datascience");
  });
});
