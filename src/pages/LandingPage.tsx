import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, BarChart3, Briefcase, Brain, Github, Map, Sparkles, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/GlassCard";
import { usePageMeta } from "@/hooks/use-page-meta";

const FEATURES = [
  {
    icon: Sparkles,
    title: "Resume Intelligence",
    description: "Extract skills and role readiness from your resume.",
    action: "Analyze resume",
    to: "/resume",
  },
  {
    icon: Github,
    title: "GitHub Profile Insights",
    description: "Use repositories and languages as verified skill signals.",
    action: "Connect GitHub",
    to: "/resume",
  },
  {
    icon: Briefcase,
    title: "Smart Job Matching",
    description: "Rank live roles against your profile and target.",
    action: "View jobs",
    to: "/jobs",
  },
  {
    icon: Target,
    title: "Skill Gap Analysis",
    description: "See matched skills and your next priorities.",
    action: "Compare skills",
    to: "/skills",
  },
  {
    icon: Map,
    title: "Career Roadmap Planner",
    description: "Follow a practical, role-based learning plan.",
    action: "Open roadmap",
    to: "/roadmap",
  },
  {
    icon: BarChart3,
    title: "Decision Dashboard",
    description: "Track readiness, strengths, and saved jobs.",
    action: "See dashboard",
    to: "/dashboard",
  },
];

export default function LandingPage() {
  usePageMeta({
    title: "CareerAI | AI Career Intelligence for Students and Early Talent",
    description: "Analyze resumes, connect GitHub, find relevant jobs, track skill gaps, and get AI-guided roadmaps with CareerAI.",
  });

  return (
    <div className="min-h-screen overflow-hidden">
      <section className="relative px-4 pb-20 pt-28">
        <div className="hero-grid absolute inset-0 opacity-70" />

        <div className="relative mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div>
            <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-background/70 px-4 py-2 text-sm text-muted-foreground shadow-lg shadow-cyan-950/20">
                <Brain className="h-4 w-4 text-teal-600" />
                AI career guidance for early talent
              </div>
              <h1 className="ai-page-title mt-6 max-w-4xl font-heading text-5xl font-bold leading-tight sm:text-6xl">
                From resume to roadmap,
                <span className="block">
                  build your next move with AI.
                </span>
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-8 text-muted-foreground">
                Analyze your profile, find relevant jobs, and follow a focused roadmap.
              </p>
              <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                <Link to="/auth">
                  <Button size="lg" className="rounded-full bg-gradient-to-r from-sky-300 via-cyan-200 to-teal-200 px-8 text-slate-950 hover:opacity-90">
                    Launch Platform <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              </div>
            </motion.div>
          </div>

          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}>
            <GlassCard className="panel-surface space-y-5 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Career snapshot</p>
                  <h2 className="mt-1 text-2xl font-semibold text-foreground">One connected profile</h2>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-border/80 bg-background/75 p-4">
                  <p className="text-sm text-muted-foreground">Recommended role</p>
                  <p className="mt-2 text-xl font-semibold text-foreground">Full-Stack Developer</p>
                </div>
                <div className="rounded-lg border border-border/80 bg-background/75 p-4">
                  <p className="text-sm text-muted-foreground">Immediate skill gaps</p>
                  <p className="mt-2 text-xl font-semibold text-foreground">Docker, SQL, testing</p>
                </div>
              </div>

              <div className="rounded-lg border border-amber-200/15 bg-gradient-to-r from-white/5 via-white/[0.03] to-amber-200/10 p-5">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Roadmap horizon</p>
                    <p className="mt-2 text-3xl font-bold text-foreground">1-3 years</p>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">Skills, projects, proof</div>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        </div>
      </section>

      <section className="px-4 pb-20">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-700 dark:text-cyan-300">Explore CareerAI</p>
              <h2 className="mt-3 font-heading text-3xl font-bold text-foreground sm:text-4xl">Everything you need to move forward</h2>
              <p className="mt-3 text-muted-foreground">Click any feature to start that workflow. New users will be guided to create an account first.</p>
            </div>
            <Link to="/auth" className="hidden text-sm font-medium text-cyan-700 underline-offset-4 transition hover:text-cyan-900 hover:underline dark:text-cyan-300 dark:hover:text-cyan-100 lg:block">
              Start with your profile
            </Link>
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {FEATURES.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.06 }}
              >
                <Link
                  to={feature.to}
                  aria-label={`${feature.action}: ${feature.description}`}
                  className="group block h-full rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <GlassCard hover className="panel-surface relative h-full overflow-hidden transition-all duration-300 group-hover:-translate-y-1 group-hover:border-cyan-400/40 group-hover:shadow-2xl group-hover:shadow-cyan-950/10">
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-400 via-cyan-300 to-fuchsia-400 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                    <div className="mb-5 flex items-start justify-between gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-sky-300/30 via-cyan-200/30 to-fuchsia-300/30 text-teal-600 transition duration-300 group-hover:scale-105 group-hover:text-cyan-700 dark:group-hover:text-cyan-200">
                        <feature.icon className="h-6 w-6" />
                      </div>
                      <span className="rounded-full border border-border/70 bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground transition group-hover:border-cyan-400/50 group-hover:text-cyan-700 dark:group-hover:text-cyan-200">
                        Clickable
                      </span>
                    </div>
                    <h3 className="text-xl font-semibold text-foreground transition group-hover:text-cyan-800 dark:group-hover:text-cyan-200">{feature.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{feature.description}</p>
                    <div className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-cyan-700 transition group-hover:gap-3 dark:text-cyan-300">
                      {feature.action}
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  </GlassCard>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
