import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { AlertCircle, BarChart3, Briefcase, CheckCircle2, Compass, Github, Loader2, RefreshCcw, Sparkles, Target } from "lucide-react";
import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, BarChart, Bar } from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { GlassCard } from "@/components/GlassCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { apiFetch } from "@/services/api";
import { usePageMeta } from "@/hooks/use-page-meta";

interface DashboardPayload {
  profileCompletion: number;
  recommendedKey: string;
  recommendedRole: string;
  targetRole: string;
  targetGap: { matched: string[]; missing: string[] };
  targetScore: number;
  jobs: Array<{ id: string; title: string; company: string; location: string; matchScore: number; matchedSkills: string[] }>;
  strengths: string[];
}

interface ComparisonItem {
  role: string;
  score: number;
}

export default function Dashboard() {
  usePageMeta({
    title: "Dashboard | CareerAI",
    description: "Track readiness, profile completion, skill gaps, and ranked job matches from your CareerAI dashboard.",
  });
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [comparison, setComparison] = useState<ComparisonItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(() => {
    setLoading(true);
    setError("");
    Promise.all([apiFetch<DashboardPayload>("/dashboard"), apiFetch<ComparisonItem[]>("/skills/compare")])
      .then(([dashboardPayload, comparisonPayload]) => {
        setDashboard(dashboardPayload);
        setComparison(comparisonPayload);
      })
      .catch((err) => {
        console.error(err);
        setError(err instanceof Error ? err.message : "Unable to load dashboard.");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard, user?.lastUpdated]);

  const radarData = comparison.slice(0, 5).map((item) => ({
    role: item.role.replace(" Developer", ""),
    score: item.score,
  }));

  const actionCards = [
    { icon: Sparkles, label: "Analyze resume", path: "/resume", note: "Update profile signals" },
    { icon: Github, label: "Connect GitHub", path: "/resume", note: "Derive coding context" },
    { icon: Briefcase, label: "Review matches", path: "/jobs", note: "See ranked opportunities" },
    { icon: Compass, label: "Plan growth", path: "/roadmap", note: "Follow a role roadmap" },
  ];

  if (loading) {
    return (
      <div className="min-h-screen px-4 pb-12 pt-24">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin text-teal-600" />
            Loading dashboard...
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-36 animate-pulse rounded-lg border border-border bg-background/70" />
            ))}
          </div>
          <div className="h-80 animate-pulse rounded-lg border border-border bg-background/70" />
        </div>
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 pt-24">
        <GlassCard className="panel-surface max-w-lg text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-amber-600" />
          <h1 className="ai-page-title mt-4 text-2xl font-semibold">Dashboard could not load</h1>
          <p className="mt-2 text-muted-foreground">{error || "Please try again."}</p>
          <Button onClick={loadDashboard} className="mt-6 rounded-full bg-gradient-to-r from-sky-300 via-cyan-200 to-teal-200 text-slate-950">
            <RefreshCcw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 pb-12 pt-24">
      <div className="mx-auto max-w-7xl space-y-6">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <GlassCard className="panel-surface">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Overview</p>
                <h1 className="ai-page-title mt-2 text-4xl font-bold">
                  {user?.name ? `${user.name}'s career dashboard` : "Career dashboard"}
                </h1>
              </div>
              <div className="rounded-xl border border-cyan-500/35 bg-cyan-500/10 px-4 py-3 text-right shadow-sm dark:bg-cyan-400/10">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-200">Target Role</div>
                <div className="mt-1 text-xl font-bold text-slate-950 dark:text-white">{dashboard.targetRole}</div>
              </div>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border border-border/80 bg-background/75 p-4">
                <div className="text-sm text-muted-foreground">Profile completion</div>
                <div className="mt-3 text-3xl font-bold text-foreground">{dashboard.profileCompletion}%</div>
                <Progress value={dashboard.profileCompletion} className="mt-4 h-2" />
              </div>
              <div className="rounded-lg border border-border/80 bg-background/75 p-4">
                <div className="text-sm text-muted-foreground">Readiness score</div>
                <div className="mt-3 text-3xl font-bold text-foreground">{dashboard.targetScore}%</div>
                <p className="mt-2 text-sm text-muted-foreground">{dashboard.targetGap.matched.length} skills matched</p>
              </div>
              <div className="rounded-lg border border-border/80 bg-background/75 p-4">
                <div className="text-sm text-muted-foreground">Top recommendation</div>
                <div className="mt-3 text-2xl font-bold text-foreground">{dashboard.recommendedRole}</div>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="panel-surface">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-cyan-600 dark:text-cyan-300" />
              <h2 className="text-xl font-semibold text-foreground">Skill priorities</h2>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {dashboard.targetGap.missing.length > 0 ? (
                dashboard.targetGap.missing.map((skill) => (
                  <Badge key={skill} className="rounded-full border-amber-400/35 bg-amber-400/10 px-3 py-1 text-amber-800 dark:text-amber-200">
                    {skill}
                  </Badge>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">You currently cover all tracked skills for this target role.</p>
              )}
            </div>
            <div className="mt-6 rounded-lg border border-border/80 bg-background/75 p-4">
              <div className="text-sm text-muted-foreground">Strongest detected skills</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {dashboard.strengths.length > 0 ? dashboard.strengths.map((skill) => (
                  <Badge key={skill} className="rounded-full border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-cyan-800 dark:text-cyan-200">
                    {skill}
                  </Badge>
                )) : <p className="text-sm text-muted-foreground">Add your resume or GitHub details to populate strengths.</p>}
              </div>
            </div>
          </GlassCard>
        </motion.div>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-foreground">Next actions</h2>
            <Button onClick={loadDashboard} disabled={loading} variant="outline" className="min-w-40 rounded-full border-border bg-background/70 text-foreground">
              <RefreshCcw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Refreshing..." : "Refresh dashboard"}
            </Button>
          </div>
          <div className="grid gap-6 lg:grid-cols-4">
          {actionCards.map((card, index) => (
            <motion.div key={card.label} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.06 }}>
              <Link to={card.path}>
                <GlassCard hover className="panel-surface h-full">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-sky-400/20 to-cyan-300/25 text-cyan-700 dark:text-cyan-200">
                    <card.icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-foreground">{card.label}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{card.note}</p>
                </GlassCard>
              </Link>
            </motion.div>
          ))}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <GlassCard className="panel-surface">
            <div className="mb-4 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-teal-600" />
              <h2 className="text-xl font-semibold text-foreground">Role fit</h2>
            </div>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="role" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                  <Radar dataKey="score" stroke="#2dd4bf" fill="#99f6e4" fillOpacity={0.45} />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>

          <GlassCard className="panel-surface">
            <div className="mb-4 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-teal-600" />
              <h2 className="text-xl font-semibold text-foreground">Recommended jobs</h2>
            </div>
            <div className="space-y-3">
              {dashboard.jobs.slice(0, 4).map((job) => (
                <div key={job.id} className="rounded-lg border border-border/80 bg-background/75 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-lg font-semibold text-foreground">{job.title}</div>
                      <div className="text-sm text-muted-foreground">{job.company} - {job.location}</div>
                    </div>
                    <Badge className="rounded-full border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-cyan-800 dark:text-cyan-200">
                      {job.matchScore}% match
                    </Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {job.matchedSkills.slice(0, 4).map((skill) => (
                      <Badge key={skill} className="rounded-full border-cyan-500/30 bg-cyan-500/10 text-cyan-800 dark:text-cyan-200">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
              <Link to="/jobs">
                <Button variant="outline" className="mt-2 rounded-full border-border bg-background/70 text-foreground hover:bg-muted">
                  View all matches
                </Button>
              </Link>
            </div>
          </GlassCard>
        </section>

        <GlassCard className="panel-surface">
          <div className="mb-4 flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-teal-600" />
            <h2 className="text-xl font-semibold text-foreground">Readiness by role</h2>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparison}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="role" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="score" fill="#38bdf8" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
