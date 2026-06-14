import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { BookmarkX, ExternalLink, MapPin, Trash2 } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/services/api";
import { usePageMeta } from "@/hooks/use-page-meta";

interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  type: string;
  salary?: string;
  url: string;
  tags: string[];
  description: string;
  liveSource?: boolean;
  source?: string;
}

export default function BookmarksPage() {
  usePageMeta({
    title: "Saved Jobs | CareerAI",
    description: "Review and manage your saved job opportunities inside CareerAI.",
  });
  const [bookmarks, setBookmarks] = useState<Job[]>([]);
  const { toast } = useToast();

  function refreshBookmarks() {
    apiFetch<Job[]>("/bookmarks").then(setBookmarks).catch(console.error);
  }

  useEffect(() => {
    refreshBookmarks();
  }, []);

  async function removeBookmark(job: Job) {
    try {
      await apiFetch(`/bookmarks/${encodeURIComponent(job.id)}`, { method: "DELETE" });
      setBookmarks((current) => current.filter((item) => item.id !== job.id));
      toast({ title: "Bookmark removed", description: `${job.title} was removed from your saved opportunities.` });
    } catch (error) {
      toast({ title: "Unable to remove bookmark", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    }
  }

  return (
    <div className="min-h-screen px-4 pb-12 pt-24">
      <div className="mx-auto max-w-6xl space-y-6">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="ai-page-title text-4xl font-bold">Saved opportunities</h1>
          <p className="mt-2 text-muted-foreground">Jobs saved for later.</p>
        </motion.div>

        {bookmarks.length === 0 ? (
          <GlassCard className="panel-surface text-center">
            <BookmarkX className="mx-auto h-12 w-12 text-muted-foreground" />
            <h2 className="mt-4 text-2xl font-semibold text-foreground">No saved jobs yet</h2>
            <p className="mt-2 text-muted-foreground">Browse the ranked opportunities page and bookmark the roles you want to revisit.</p>
            <Link to="/jobs">
              <Button className="mt-6 rounded-full bg-gradient-to-r from-sky-300 via-cyan-200 to-teal-200 text-slate-950 hover:opacity-90">
                Explore jobs
              </Button>
            </Link>
          </GlassCard>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {bookmarks.map((job, index) => (
              <motion.div key={job.id} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
                <GlassCard className="panel-surface h-full">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-2xl font-semibold">
                        <a
                          href={job.url}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Open ${job.title} at ${job.company} in a new tab`}
                          className="group inline-flex items-center gap-2 text-foreground underline-offset-4 transition hover:text-cyan-700 hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:hover:text-cyan-300"
                        >
                          {job.title}
                          <ExternalLink className="h-4 w-4 shrink-0 opacity-70 transition group-hover:opacity-100" />
                        </a>
                      </h2>
                      <p className="mt-1 text-muted-foreground">{job.company}</p>
                      <p className="mt-2 text-xs font-medium text-muted-foreground">Original posting via {job.source || "job provider"}</p>
                    </div>
                    <button
                      onClick={() => removeBookmark(job)}
                      aria-label={`Remove ${job.title} from saved jobs`}
                      className="rounded-full border border-border/80 bg-background/70 p-2 text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{job.location}</span>
                    <Badge variant="outline" className="rounded-full border-border/80 text-foreground">{job.type}</Badge>
                    {job.salary && <span>{job.salary}</span>}
                  </div>
                  <p className="mt-4 line-clamp-3 text-sm leading-6 text-muted-foreground">{job.description}</p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {job.tags.slice(0, 5).map((tag) => (
                      <Badge key={tag} className="rounded-full border-cyan-500/30 bg-cyan-500/10 text-cyan-800 dark:text-cyan-200">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <Button asChild variant="outline" className="mt-6 min-h-11 rounded-full border-cyan-500/30 bg-background/80 text-foreground hover:border-cyan-500/60 hover:bg-cyan-500/10">
                    <a href={job.url} target="_blank" rel="noreferrer" aria-label={`Open the original ${job.title} listing`}>
                      View job <ExternalLink className="ml-1 h-4 w-4" />
                    </a>
                  </Button>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
