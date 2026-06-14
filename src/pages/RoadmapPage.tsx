import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { BookOpen, BrainCircuit, CheckCircle2, Clock3, Compass, ExternalLink, Flag, FolderGit2, Loader2, Save, Sparkles, Target } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { GlassCard } from "@/components/GlassCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/services/api";
import { getResourceUrl } from "@/services/resourceLinks";
import { getRoadmapDetail } from "@/services/roadmapDetails";
import { useToast } from "@/hooks/use-toast";
import { usePageMeta } from "@/hooks/use-page-meta";

interface RoadmapPath {
  title: string;
  description: string;
  timeline: string;
  skills: string[];
  steps: { title: string; description: string; duration: string; resources: string[] }[];
}

interface RoadmapPayload {
  key: string;
  path: RoadmapPath;
  gap: { matched: string[]; missing: string[] };
  nextActions?: { title: string; description: string }[];
}

export default function RoadmapPage() {
  usePageMeta({
    title: "Career Roadmap | CareerAI",
    description: "Explore timeline-based roadmaps, missing skills, and next actions for your target career path.",
  });
  const { user, updateUser } = useAuth();
  const { toast } = useToast();
  const [paths, setPaths] = useState<Record<string, RoadmapPath>>({});
  const [selectedPath, setSelectedPath] = useState("");
  const [roadmap, setRoadmap] = useState<RoadmapPayload | null>(null);
  const [loadingRoadmap, setLoadingRoadmap] = useState(false);
  const [savingRole, setSavingRole] = useState(false);

  useEffect(() => {
    apiFetch<{ paths: Record<string, RoadmapPath> }>("/roadmaps")
      .then((result) => {
        setPaths(result.paths);
        if (!selectedPath) {
          const targetKey = Object.entries(result.paths).find(([, path]) => path.title === user?.targetRole)?.[0];
          setSelectedPath(targetKey || Object.keys(result.paths)[0]);
        }
      })
      .catch(console.error);
  }, [selectedPath, user?.targetRole]);

  useEffect(() => {
    if (!selectedPath) return;
    setLoadingRoadmap(true);
    apiFetch<RoadmapPayload>(`/roadmap?key=${encodeURIComponent(selectedPath)}`)
      .then(setRoadmap)
      .catch(console.error)
      .finally(() => setLoadingRoadmap(false));
  }, [selectedPath]);

  async function selectTargetRole(key: string) {
    const path = paths[key];
    if (!path || (key === selectedPath && user?.targetRole === path.title)) return;
    setSelectedPath(key);
    setSavingRole(true);
    try {
      await updateUser({ targetRole: path.title });
      toast({
        title: "Target role updated",
        description: `${path.title} now drives your roadmap, skill gap, jobs, dashboard, and Aira responses.`,
      });
    } catch (error) {
      toast({
        title: "Unable to save target role",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSavingRole(false);
    }
  }

  if (!roadmap) {
    return <div className="flex min-h-screen items-center justify-center gap-3 pt-24 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin text-cyan-500" />Loading roadmap...</div>;
  }

  const detail = getRoadmapDetail(roadmap.path.title);
  const completedSkills = roadmap.gap.matched.length;
  const totalSkills = roadmap.path.skills.length;
  const readiness = totalSkills ? Math.round((completedSkills / totalSkills) * 100) : 0;

  return (
    <div className="min-h-screen px-4 pb-12 pt-24">
      <div className="mx-auto max-w-7xl space-y-6">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-3xl border border-cyan-500/20 bg-gradient-to-br from-sky-500/10 via-indigo-500/10 to-fuchsia-500/10 p-6 sm:p-8">
          <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-fuchsia-500/10 blur-3xl" />
          <div className="absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-cyan-500/10 blur-3xl" />
          <div className="relative">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-500/25 bg-background/70 px-3 py-1.5 text-xs font-semibold text-cyan-700 dark:text-cyan-200">
              <BrainCircuit className="h-4 w-4" />
              AI-guided growth plan
            </div>
            <h1 className="ai-page-title text-4xl font-bold sm:text-5xl">Your personalized career roadmap</h1>
          <p className="mt-2 text-muted-foreground">A focused plan for your selected role.</p>
          </div>
        </motion.div>

        <GlassCard className="ai-surface">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-cyan-500" />
                <h2 className="text-xl font-semibold text-foreground">Choose your target role</h2>
              </div>
            </div>
            <div aria-live="polite" className="flex min-h-9 items-center gap-2 text-sm font-medium text-cyan-700 dark:text-cyan-200">
              {savingRole ? <><Loader2 className="h-4 w-4 animate-spin" />Saving target...</> : <><Save className="h-4 w-4" />Saved target: {user?.targetRole || roadmap.path.title}</>}
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(paths).map(([key, item]) => {
              const active = selectedPath === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => selectTargetRole(key)}
                  disabled={savingRole}
                  aria-pressed={active}
                  className={`group min-h-24 cursor-pointer rounded-2xl border p-4 text-left transition-all duration-200 hover:-translate-y-1 hover:scale-[1.01] hover:shadow-xl active:translate-y-0 active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-60 ${
                    active
                      ? "border-cyan-400/60 bg-gradient-to-br from-cyan-500/20 via-indigo-500/15 to-fuchsia-500/15 shadow-[0_12px_40px_rgba(34,211,238,0.12)]"
                      : "border-border/80 bg-background/70 hover:border-cyan-500/40 hover:bg-cyan-500/5"
                  }`}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-foreground">{item.title}</span>
                    {active && <CheckCircle2 className="h-5 w-5 shrink-0 text-cyan-500" />}
                  </span>
                  <span className="mt-2 block text-xs leading-5 text-muted-foreground">{item.timeline} path · {item.skills.length} core skills</span>
                </button>
              );
            })}
          </div>
        </GlassCard>

        {!user?.skills.length && (
          <GlassCard className="border border-amber-400/30 bg-amber-400/10">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold text-foreground">This roadmap is ready to explore</h2>
                <p className="mt-1 text-sm text-muted-foreground">Select a target now. Uploading your CV or connecting GitHub later will personalize readiness, gaps, and next actions.</p>
              </div>
              <Button asChild variant="outline" className="rounded-full border-amber-500/40 bg-background/70 text-foreground">
                <Link to="/resume">Add profile signals</Link>
              </Button>
            </div>
          </GlassCard>
        )}

        <GlassCard className="ai-surface relative overflow-hidden">
          {loadingRoadmap && <div className="absolute inset-x-0 top-0 h-1 overflow-hidden bg-cyan-500/10"><div className="h-full w-1/3 animate-pulse bg-gradient-to-r from-cyan-400 via-indigo-400 to-fuchsia-400" /></div>}
          <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
            <div>
              <div className="flex items-center gap-2">
                <Compass className="h-5 w-5 text-cyan-500" />
                <h2 className="text-3xl font-semibold text-foreground">{roadmap.path.title}</h2>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{roadmap.path.description}</p>
              <p className="mt-4 rounded-xl border border-indigo-500/20 bg-indigo-500/10 px-4 py-3 text-sm leading-6 text-foreground">
                <span className="font-semibold">Target outcome:</span> {detail.outcome}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {roadmap.path.skills.map((skill) => {
                  const hasSkill = user.skills.some((item) => item.toLowerCase() === skill.toLowerCase());
                  return (
                    <Badge key={skill} className={hasSkill ? "rounded-full border-cyan-500/30 bg-cyan-500/10 text-cyan-800 dark:text-cyan-200" : "rounded-full border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-800 dark:text-fuchsia-200"}>
                      {skill}
                    </Badge>
                  );
                })}
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-border/80 bg-background/75 p-5">
                <div className="text-sm text-muted-foreground">Suggested timeline</div>
                <div className="mt-3 text-3xl font-bold text-foreground">{roadmap.path.timeline}</div>
              </div>
              <div className="rounded-lg border border-border/80 bg-background/75 p-5">
                <div className="text-sm text-muted-foreground">Current readiness</div>
                <div className="mt-3 text-3xl font-bold ai-text-gradient">{readiness}%</div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-indigo-400 to-fuchsia-400 transition-all" style={{ width: `${readiness}%` }} />
                </div>
              </div>
            </div>
          </div>
        </GlassCard>

        <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <GlassCard className="ai-surface">
          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-cyan-500" />
            <h2 className="text-2xl font-semibold text-foreground">Next steps</h2>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {(roadmap.nextActions || []).map((action) => (
              <div key={action.title} className="rounded-lg border border-cyan-400/20 bg-cyan-400/10 p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-cyan-500" />
                  <div>
                    <h3 className="font-semibold text-foreground">{action.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{action.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="panel-surface">
          <div className="flex items-center gap-2">
            <Clock3 className="h-5 w-5 text-indigo-500" />
            <h2 className="text-xl font-semibold text-foreground">Recommended weekly rhythm</h2>
          </div>
          <div className="mt-4 space-y-3">
            {detail.weeklyRhythm.map((item, index) => (
              <div key={item} className="flex items-center gap-3 rounded-xl border border-border/80 bg-background/75 px-4 py-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400/20 to-fuchsia-400/20 text-xs font-bold text-foreground">{index + 1}</span>
                <span className="text-sm text-foreground">{item}</span>
              </div>
            ))}
          </div>
        </GlassCard>
        </div>

        <div className="relative">
          <div className="absolute left-6 top-0 hidden h-full w-px bg-gradient-to-b from-cyan-300/60 via-sky-300/40 to-amber-200/40 md:block" />
          <div className="space-y-5">
            {roadmap.path.steps.map((step, index) => {
              const phase = detail.phases[index] || detail.phases[detail.phases.length - 1];
              return (
              <motion.div key={step.title} initial={{ opacity: 0, x: -18 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.06 }} className="relative md:pl-16">
                <div className="absolute left-[7px] top-6 hidden h-9 w-9 items-center justify-center rounded-full border border-cyan-400/40 bg-gradient-to-br from-cyan-400/20 to-fuchsia-400/20 font-bold text-foreground shadow-md md:flex">
                  {index + 1}
                </div>
                <GlassCard className="panel-surface interactive-card">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">Phase {index + 1}</div>
                      <h3 className="text-2xl font-semibold text-foreground">{step.title}</h3>
                      <p className="mt-2 max-w-3xl leading-7 text-muted-foreground">{step.description}</p>
                    </div>
                    <div className="rounded-full border border-border/80 bg-background/70 px-3 py-2 text-sm text-foreground">
                      <Clock3 className="mr-2 inline h-4 w-4" />
                      {step.duration}
                    </div>
                  </div>
                  <div className="mt-6 grid gap-4 lg:grid-cols-3">
                    <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
                      <div className="flex items-center gap-2 font-semibold text-foreground"><Flag className="h-4 w-4 text-cyan-500" />Learning objectives</div>
                      <ul className="mt-3 space-y-2">
                        {phase.objectives.map((objective) => (
                          <li key={objective} className="flex gap-2 text-sm leading-6 text-muted-foreground"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-cyan-500" />{objective}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4">
                      <div className="flex items-center gap-2 font-semibold text-foreground"><FolderGit2 className="h-4 w-4 text-indigo-500" />Portfolio deliverable</div>
                      <p className="mt-3 text-sm leading-6 text-muted-foreground">{phase.project}</p>
                    </div>
                    <div className="rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/5 p-4">
                      <div className="flex items-center gap-2 font-semibold text-foreground"><Sparkles className="h-4 w-4 text-fuchsia-500" />Evidence of completion</div>
                      <p className="mt-3 text-sm leading-6 text-muted-foreground">{phase.evidence}</p>
                    </div>
                  </div>
                  <div className="mt-5">
                    <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
                      <BookOpen className="h-4 w-4" />
                      Official learning resources
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {step.resources.map((resource) => (
                        <a
                          key={resource}
                          href={getResourceUrl(resource)}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Open ${resource} official documentation in a new tab`}
                          className="group flex min-h-12 items-center justify-between gap-3 rounded-xl border border-cyan-500/30 bg-background/90 px-4 py-3 text-sm font-semibold text-foreground shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-500/60 hover:bg-cyan-500/10 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2"
                        >
                          <span className="leading-5">{resource}</span>
                          <ExternalLink className="h-4 w-4 shrink-0 text-cyan-600 transition group-hover:scale-110 dark:text-cyan-300" />
                        </a>
                      ))}
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
