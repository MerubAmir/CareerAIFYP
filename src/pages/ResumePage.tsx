import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, FileCheck2, FileText, Github, Loader2, Sparkles, Target, Upload } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { GlassCard } from "@/components/GlassCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/services/api";
import { JOB_SKILL_REQUIREMENTS } from "@/services/skillsData";
import { usePageMeta } from "@/hooks/use-page-meta";

interface GitHubProfile {
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

export default function ResumePage() {
  usePageMeta({
    title: "Profile Intelligence | CareerAI",
    description: "Upload your resume, connect GitHub, and enrich your CareerAI profile with stronger skill signals.",
  });
  const { user, setUserFromApi } = useAuth();
  const { toast } = useToast();
  const [resumeText, setResumeText] = useState(user?.resumeText || "");
  const [githubUsername, setGithubUsername] = useState(user?.githubUsername || "");
  const [education, setEducation] = useState(user?.education || "");
  const [summary, setSummary] = useState(user?.summary || "");
  const [targetRole, setTargetRole] = useState(user?.targetRole || "Full-Stack Developer");
  const [manualSkills, setManualSkills] = useState((user?.skills || []).join(", "));
  const [profile, setProfile] = useState<GitHubProfile | null>((user?.githubProfile as GitHubProfile | null | undefined) || null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loadingResume, setLoadingResume] = useState(false);
  const [loadingGitHub, setLoadingGitHub] = useState(false);
  const [analysisMessage, setAnalysisMessage] = useState("");
  const [uploadStatus, setUploadStatus] = useState<"idle" | "selected" | "uploading" | "complete">("idle");

  function handleResumeFile(file: File | null) {
    if (!file) {
      setSelectedFile(null);
      setUploadStatus("idle");
      return;
    }
    const suffix = file.name.split(".").pop()?.toLowerCase();
    if (!suffix || !["pdf", "docx"].includes(suffix)) {
      setSelectedFile(null);
      setUploadStatus("idle");
      toast({
        title: "Resume file required",
        description: "Upload a PDF or DOCX CV/resume. Other document types are not accepted.",
        variant: "destructive",
      });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setSelectedFile(null);
      setUploadStatus("idle");
      toast({ title: "File too large", description: "Upload a resume smaller than 5 MB.", variant: "destructive" });
      return;
    }
    setSelectedFile(file);
    setUploadStatus("selected");
    setAnalysisMessage("");
  }

  async function handleAnalyzeResume() {
    if (!resumeText.trim() && !manualSkills.trim() && !selectedFile) {
      toast({ title: "Resume input required", description: "Paste resume text, add manual skills, or upload a file first.", variant: "destructive" });
      return;
    }

    setLoadingResume(true);
    if (selectedFile) setUploadStatus("uploading");
    setAnalysisMessage("");
    try {
      if (selectedFile) {
        const form = new FormData();
        form.append("file", selectedFile);
        form.append("targetRole", targetRole);
        form.append("manualSkills", JSON.stringify(manualSkills.split(",").map((skill) => skill.trim()).filter(Boolean)));
        const result = await apiFetch<{ profile: typeof user; analysis: { resumeText: string; allSkills: string[] } }>("/analysis/resume-file", {
          method: "POST",
          body: form,
        });
        setUserFromApi(result.profile!);
        setResumeText(result.analysis.resumeText);
        setManualSkills(result.analysis.allSkills.join(", "));
        setEducation(result.profile?.education || education);
        setSummary(result.profile?.summary || summary);
        setAnalysisMessage(`Extracted ${result.analysis.allSkills.length} skills from ${selectedFile.name}.`);
        setSelectedFile(null);
        setUploadStatus("complete");
        toast({ title: "Resume file analyzed", description: `Detected ${result.analysis.allSkills.length} total skills from your profile.` });
      } else {
        const typedSkills = manualSkills.split(",").map((skill) => skill.trim()).filter(Boolean);
        const result = await apiFetch<{ profile: typeof user; analysis: { allSkills: string[] } }>("/analysis/resume-text", {
          method: "POST",
          body: JSON.stringify({
            resumeText,
            manualSkills: typedSkills,
            education,
            summary,
            targetRole,
          }),
        });
        setUserFromApi(result.profile!);
        setManualSkills(result.analysis.allSkills.join(", "));
        setEducation(result.profile?.education || education);
        setSummary(result.profile?.summary || summary);
        setAnalysisMessage(`Updated profile with ${result.analysis.allSkills.length} detected/manual skills.`);
        toast({ title: "Profile analyzed", description: `Detected ${result.analysis.allSkills.length} total skills from your profile.` });
      }
    } catch (error) {
      if (selectedFile) setUploadStatus("selected");
      toast({ title: "Analysis failed", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setLoadingResume(false);
    }
  }

  async function handleGitHubFetch() {
    if (!githubUsername.trim()) {
      toast({ title: "GitHub username required", description: "Enter a username to analyze repositories.", variant: "destructive" });
      return;
    }

    setLoadingGitHub(true);
    try {
      const result = await apiFetch<{ githubProfile: GitHubProfile; derivedSkills: string[]; profile: typeof user }>("/integrations/github", {
        method: "POST",
        body: JSON.stringify({ username: githubUsername.trim() }),
      });
      setProfile(result.githubProfile);
      setUserFromApi(result.profile!);
        setManualSkills((result.profile?.skills || []).join(", "));
      toast({
        title: result.githubProfile.limited ? "GitHub saved with limited data" : "GitHub context added",
        description: result.githubProfile.limited
          ? "GitHub API was limited, but your username and baseline Git/GitHub skills were saved."
          : `Detected ${result.derivedSkills.length} skill hints from repositories and languages.`,
      });
    } catch (error) {
      toast({ title: "GitHub fetch failed", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setLoadingGitHub(false);
    }
  }

  return (
    <div className="min-h-screen px-4 pb-12 pt-24">
      <div className="mx-auto max-w-7xl space-y-6">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="ai-page-title text-4xl font-bold">Build your profile</h1>
          <p className="mt-2 text-muted-foreground">Add your resume, target role, and GitHub profile.</p>
        </motion.div>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <GlassCard className="panel-surface">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-cyan-500" />
              <h2 className="text-xl font-semibold text-foreground">Resume</h2>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="target-role" className="mb-2 block text-sm font-medium text-foreground">Target role</label>
                <select id="target-role" value={targetRole} onChange={(event) => setTargetRole(event.target.value)} className="app-select h-12 w-full rounded-lg px-4">
                  {Object.keys(JOB_SKILL_REQUIREMENTS).map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">Resume file upload</label>
                <label className={`flex min-h-12 cursor-pointer items-center justify-center rounded-lg border border-dashed px-4 text-sm font-medium transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-within:ring-2 focus-within:ring-cyan-500/40 ${selectedFile ? "border-cyan-500/60 bg-cyan-500/10 text-cyan-800 dark:text-cyan-200" : "border-border bg-background/80 text-foreground hover:border-cyan-500/50 hover:bg-cyan-500/5"}`}>
                  {selectedFile ? <FileCheck2 className="mr-2 h-4 w-4 text-cyan-600 dark:text-cyan-300" /> : <Upload className="mr-2 h-4 w-4" />}
                  {selectedFile ? selectedFile.name : "Choose PDF or DOCX resume"}
                  <input type="file" className="hidden" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => handleResumeFile(event.target.files?.[0] || null)} />
                </label>
                <div aria-live="polite" className="mt-2 min-h-5 text-xs">
                  {uploadStatus === "selected" && <span className="text-cyan-700 dark:text-cyan-200">File selected and ready to upload.</span>}
                  {uploadStatus === "uploading" && <span className="inline-flex items-center gap-1.5 text-cyan-700 dark:text-cyan-200"><Loader2 className="h-3.5 w-3.5 animate-spin" />Uploading and validating resume...</span>}
                  {uploadStatus === "complete" && <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="h-3.5 w-3.5" />Resume uploaded, validated, and saved.</span>}
                  {uploadStatus === "idle" && <span className="text-muted-foreground">PDF or DOCX, up to 5 MB.</span>}
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm text-muted-foreground">Education</label>
                <Input value={education} onChange={(event) => setEducation(event.target.value)} placeholder="BS Software Engineering, IIUI" className="h-12 border-border/80 bg-background/80 text-foreground" />
              </div>
              <div>
                <label className="mb-2 block text-sm text-muted-foreground">Professional summary</label>
                <Input value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="Student focused on MERN and AI-assisted products" className="h-12 border-border/80 bg-background/80 text-foreground" />
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-sm text-muted-foreground">Resume text</label>
              <Textarea
                value={resumeText}
                onChange={(event) => setResumeText(event.target.value)}
                placeholder="Paste resume text, projects, skills, and experience."
                rows={7}
                className="resize-none border-border/80 bg-background/80 text-foreground"
              />
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-sm text-muted-foreground">Skills</label>
              <Textarea
                value={manualSkills}
                onChange={(event) => setManualSkills(event.target.value)}
                placeholder="React, TypeScript, FastAPI, MongoDB"
                rows={2}
                className="resize-none border-border/80 bg-background/80 text-foreground"
              />
            </div>

            <Button onClick={handleAnalyzeResume} disabled={loadingResume} className="mt-5 min-w-44 rounded-full bg-gradient-to-r from-sky-300 via-cyan-200 to-teal-200 px-6 text-slate-950 hover:opacity-90">
              {loadingResume ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              {loadingResume ? (selectedFile ? "Uploading resume..." : "Analyzing profile...") : "Analyze profile"}
            </Button>
            {analysisMessage && (
              <p className="mt-3 rounded-lg border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-sm text-cyan-800 dark:text-cyan-200">
                {analysisMessage}
              </p>
            )}
          </GlassCard>

          <div className="space-y-6">
            <GlassCard className="panel-surface">
              <div className="flex items-center gap-2">
                <Github className="h-5 w-5 text-cyan-500" />
                <h2 className="text-xl font-semibold text-foreground">GitHub</h2>
              </div>
              <div className="mt-4 flex gap-3">
                <Input value={githubUsername} onChange={(event) => setGithubUsername(event.target.value)} placeholder="GitHub username" className="h-12 border-border/80 bg-background/80 text-foreground" />
                <Button onClick={handleGitHubFetch} disabled={loadingGitHub} className="min-w-32 rounded-full bg-muted px-5 text-foreground hover:bg-cyan-500/10">
                  {loadingGitHub ? <><Loader2 className="h-4 w-4 animate-spin" />Fetching...</> : "Fetch GitHub"}
                </Button>
              </div>

              {profile && (
                <div className="mt-5 rounded-lg border border-border/80 bg-background/75 p-4">
                  <div className="flex items-center gap-3">
                    {profile.avatar ? (
                      <img src={profile.avatar} alt={profile.name} className="h-14 w-14 rounded-full border border-border/80" />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-cyan-500/30 bg-cyan-500/10 font-semibold text-cyan-800 dark:text-cyan-200">
                        {profile.username.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="text-lg font-semibold text-foreground">{profile.name}</div>
                      <div className="text-sm text-muted-foreground">@{profile.username} - {profile.repos} repos - {profile.followers} followers</div>
                    </div>
                  </div>
                  {profile.limited && (
                    <p className="mt-3 rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-200">
                      GitHub was temporarily unreachable, so CareerAI saved your username and added baseline Git/GitHub context.
                    </p>
                  )}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {Object.entries(profile.languages).map(([language, count]) => (
                      <Badge key={language} className="rounded-full border-cyan-500/30 bg-cyan-500/10 text-cyan-800 dark:text-cyan-200">
                        {language} ({count})
                      </Badge>
                    ))}
                  </div>
                  {!!profile.topRepos.length && (
                    <div className="mt-4 space-y-2">
                      <div className="text-sm font-medium text-foreground">Saved repositories</div>
                      {profile.topRepos.slice(0, 5).map((repo) => (
                        <a key={repo.url} href={repo.url} target="_blank" rel="noreferrer" className="block rounded-lg border border-border/80 bg-background/70 px-3 py-2 text-sm text-foreground hover:bg-muted">
                          <span className="font-medium">{repo.name}</span>
                          <span className="ml-2 text-muted-foreground">{repo.language} · {repo.stars} stars</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </GlassCard>

            <GlassCard className="panel-surface">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-cyan-500" />
                <h2 className="text-xl font-semibold text-foreground">Profile summary</h2>
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-border/80 bg-background/75 p-4">
                  <div className="text-sm text-muted-foreground">Detected skills</div>
                  <div className="mt-2 text-3xl font-bold text-foreground">{user?.skills.length || 0}</div>
                </div>
                <div className="rounded-lg border border-border/80 bg-background/75 p-4">
                  <div className="text-sm text-muted-foreground">Experience level</div>
                  <div className="mt-2 text-xl font-semibold text-foreground">{user?.experienceLevel || "Pending"}</div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {(user?.skills || []).map((skill) => (
                  <Badge key={skill} className="rounded-full border-amber-400/20 bg-amber-400/10 text-amber-700 dark:text-amber-200">
                    {skill}
                  </Badge>
                ))}
              </div>
            </GlassCard>
          </div>
        </div>
      </div>
    </div>
  );
}
