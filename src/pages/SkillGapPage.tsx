import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, Target, XCircle } from "lucide-react";
import { BarChart, Bar, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { GlassCard } from "@/components/GlassCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/services/api";
import { usePageMeta } from "@/hooks/use-page-meta";

interface GapPayload {
  role: string;
  gap: { matched: string[]; missing: string[] };
  score: number;
}

interface ComparePayload {
  role: string;
  score: number;
}

export default function SkillGapPage() {
  usePageMeta({
    title: "Skill Gap Analysis | CareerAI",
    description: "Compare your profile against role expectations and see the strongest matched and missing skills.",
  });
  const { user } = useAuth();
  const [roles, setRoles] = useState<string[]>([]);
  const [selectedRole, setSelectedRole] = useState(user?.targetRole || "");
  const [gapData, setGapData] = useState<GapPayload | null>(null);
  const [comparison, setComparison] = useState<ComparePayload[]>([]);

  useEffect(() => {
    apiFetch<ComparePayload[]>("/skills/compare")
      .then((items) => {
        setComparison(items);
        setRoles(items.map((item) => item.role));
        if (!selectedRole && items[0]) {
          setSelectedRole(items[0].role);
        }
      })
      .catch(console.error);
  }, [selectedRole]);

  useEffect(() => {
    if (!selectedRole) return;
    apiFetch<GapPayload>(`/skills/gap?role=${encodeURIComponent(selectedRole)}`).then(setGapData).catch(console.error);
  }, [selectedRole]);

  if (!user?.skills.length) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 pt-24">
        <GlassCard className="panel-surface max-w-lg text-center">
          <Target className="mx-auto h-12 w-12 text-teal-600" />
          <h1 className="ai-page-title mt-4 text-2xl font-semibold">No skill profile available yet</h1>
          <p className="mt-3 text-muted-foreground">Add resume text or GitHub context first so CareerAI can compare you against job requirements.</p>
          <Link to="/resume">
            <Button className="mt-6 rounded-full bg-gradient-to-r from-sky-300 via-cyan-200 to-teal-200 text-slate-950 hover:opacity-90">
              Go to profile input
            </Button>
          </Link>
        </GlassCard>
      </div>
    );
  }

  if (!gapData) {
    return <div className="flex min-h-screen items-center justify-center pt-24 text-muted-foreground">Loading skill analysis...</div>;
  }

  return (
    <div className="min-h-screen px-4 pb-12 pt-24">
      <div className="mx-auto max-w-7xl space-y-6">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="ai-page-title text-4xl font-bold">Skill gap analysis</h1>
          <p className="mt-3 max-w-3xl text-muted-foreground">
            Compare your current profile against role expectations and identify the exact capabilities to learn next.
          </p>
        </motion.div>

        <div className="flex flex-wrap gap-2">
          {roles.map((role) => (
            <Button
              key={role}
              variant="outline"
              size="sm"
              onClick={() => setSelectedRole(role)}
              className={selectedRole === role ? "rounded-full border-cyan-400/30 bg-cyan-400/10 text-cyan-700 dark:text-cyan-200" : "rounded-full border-border/80 bg-background/70 text-muted-foreground"}
            >
              {role}
            </Button>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <GlassCard className="panel-surface">
            <h2 className="text-2xl font-semibold text-foreground">{gapData.role}</h2>
            <div className="mt-6 rounded-lg border border-border/80 bg-background/75 p-5">
              <div className="text-sm text-muted-foreground">Match score</div>
              <div className="mt-3 text-5xl font-bold text-foreground">{gapData.score}%</div>
              <div className="mt-3 text-sm text-muted-foreground">
                {gapData.gap.matched.length} matched skills and {gapData.gap.missing.length} growth opportunities.
              </div>
            </div>

            <div className="mt-6">
              <div className="mb-2 text-sm text-muted-foreground">Tracked strengths</div>
              <div className="flex flex-wrap gap-2">
                {gapData.gap.matched.map((skill) => (
                  <Badge key={skill} className="rounded-full border-teal-200 bg-teal-50 text-teal-700">
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
          </GlassCard>

          <div className="grid gap-6 md:grid-cols-2">
            <GlassCard className="panel-surface">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-cyan-500" />
                <h2 className="text-xl font-semibold text-foreground">Skills you already have</h2>
              </div>
              <div className="mt-5 space-y-3">
                {gapData.gap.matched.map((skill) => (
                  <div key={skill} className="flex items-center gap-3 rounded-lg border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-cyan-700 dark:text-cyan-200">
                    <CheckCircle2 className="h-4 w-4" />
                    {skill}
                  </div>
                ))}
              </div>
            </GlassCard>

            <GlassCard className="panel-surface">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-amber-500" />
                <h2 className="text-xl font-semibold text-foreground">Skills to learn next</h2>
              </div>
              <div className="mt-5 space-y-3">
                {gapData.gap.missing.length > 0 ? gapData.gap.missing.map((skill) => (
                  <div key={skill} className="flex items-center gap-3 rounded-lg border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-amber-700 dark:text-amber-200">
                    <XCircle className="h-4 w-4" />
                    {skill}
                  </div>
                )) : <p className="text-sm text-muted-foreground">You already satisfy the tracked skills for this role.</p>}
              </div>
            </GlassCard>
          </div>
        </div>

        <GlassCard className="panel-surface">
          <h2 className="text-xl font-semibold text-foreground">Comparison across all supported roles</h2>
          <div className="mt-5 h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparison}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="role" tick={{ fill: "#cbd5e1", fontSize: 12 }} />
                <YAxis tick={{ fill: "#cbd5e1", fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="score" fill="#67e8f9" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
