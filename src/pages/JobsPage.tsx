import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Bookmark, BookmarkCheck, ExternalLink, Filter, Loader2, MapPin, RefreshCcw, Search, Sparkles } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  role: string;
  source?: string;
  date?: string;
  liveSource?: boolean;
  matchScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  workMode?: "remote" | "hybrid" | "on-site";
  experienceBand?: "entry" | "mid" | "senior";
  salaryValue?: number | null;
}

interface JobSearchResponse {
  items: Job[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  feedUpdatedAt?: string | null;
  searchSuggestions: string[];
  appliedFilters: {
    type: string;
    workMode: string;
    location: string;
    minSalary: number;
    experienceLevel: string;
    technologies: string[];
    sort: string;
  };
}

const TYPE_FILTERS = ["all", "full-time", "internship", "contract"];
const WORK_MODES = ["all", "remote", "hybrid", "on-site"];
const EXPERIENCE_OPTIONS = ["all", "entry", "mid", "senior"];
const SORT_OPTIONS = [
  { value: "relevant", label: "Most relevant" },
  { value: "newest", label: "Newest" },
  { value: "salary", label: "Highest salary" },
];

export default function JobsPage() {
  usePageMeta({
    title: "Smart Job Search | CareerAI",
    description: "Search, filter, and rank jobs using profile-aware matching, semantic relevance, and skill gap signals.",
  });

  const { toast } = useToast();
  const [searchInput, setSearchInput] = useState("");
  const deferredSearch = useDeferredValue(searchInput);
  const [typeFilter, setTypeFilter] = useState("all");
  const [workMode, setWorkMode] = useState("all");
  const [experienceLevel, setExperienceLevel] = useState("all");
  const [sort, setSort] = useState("relevant");
  const [location, setLocation] = useState("");
  const [minSalary, setMinSalary] = useState("");
  const [selectedTechnologies, setSelectedTechnologies] = useState<string[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [searchSuggestions, setSearchSuggestions] = useState<string[]>([]);
  const [bookmarks, setBookmarks] = useState<Record<string, boolean>>({});
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [feedUpdatedAt, setFeedUpdatedAt] = useState<string | null>(null);

  const loadJobs = useCallback(async (nextPage = 1, append = false, forceRefresh = false) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoadingJobs(true);
    }

    const params = new URLSearchParams({
      search: deferredSearch.trim(),
      type: typeFilter,
      workMode,
      experienceLevel,
      sort,
      page: String(nextPage),
      pageSize: "8",
    });
    if (forceRefresh) params.set("refresh", "true");

    if (location.trim()) params.set("location", location.trim());
    if (selectedTechnologies.length) params.set("technologies", selectedTechnologies.join(","));
    if (minSalary.trim()) params.set("minSalary", minSalary.trim());

    try {
      const response = await apiFetch<JobSearchResponse>(`/jobs?${params.toString()}`);
      setJobs((current) => (append ? [...current, ...response.items] : response.items));
      setSearchSuggestions(response.searchSuggestions);
      setTotal(response.total);
      setHasMore(response.hasMore);
      setPage(response.page);
      setFeedUpdatedAt(response.feedUpdatedAt || null);
    } catch (error) {
      console.error(error);
      toast({
        title: "Jobs unavailable",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingJobs(false);
      setLoadingMore(false);
    }
  }, [deferredSearch, experienceLevel, location, minSalary, selectedTechnologies, sort, toast, typeFilter, workMode]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setPage(1);
      loadJobs(1, false);
    }, 350);
    return () => window.clearTimeout(handle);
  }, [loadJobs]);

  useEffect(() => {
    apiFetch<Job[]>("/bookmarks")
      .then((saved) => {
        const next: Record<string, boolean> = {};
        saved.forEach((job) => {
          next[job.id] = true;
        });
        setBookmarks(next);
      })
      .catch(console.error);
  }, []);

  async function handleBookmark(job: Job) {
    try {
      const currentlySaved = !!bookmarks[job.id];
      if (currentlySaved) {
        await apiFetch(`/bookmarks/${encodeURIComponent(job.id)}`, { method: "DELETE" });
      } else {
        await apiFetch<{ saved: boolean }>(`/bookmarks`, {
          method: "POST",
          body: JSON.stringify({ job }),
        });
      }
      setBookmarks((current) => ({ ...current, [job.id]: !currentlySaved }));
      toast({
        title: currentlySaved ? "Removed from bookmarks" : "Saved to bookmarks",
        description: currentlySaved ? `${job.title} was removed from saved jobs.` : `${job.title} is now stored in MongoDB.`,
      });
    } catch (error) {
      toast({ title: "Bookmark update failed", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    }
  }

  function toggleTechnology(technology: string) {
    setSelectedTechnologies((current) =>
      current.includes(technology) ? current.filter((item) => item !== technology) : [...current, technology],
    );
  }

  const quickTechnologyOptions = useMemo(() => {
    const collected = new Set<string>();
    jobs.forEach((job) => job.tags.forEach((tag) => collected.add(tag)));
    searchSuggestions.forEach((suggestion) => {
      if (suggestion.length < 24) {
        collected.add(suggestion);
      }
    });
    return Array.from(collected).slice(0, 8);
  }, [jobs, searchSuggestions]);

  const activeFilterCount = [typeFilter !== "all", workMode !== "all", experienceLevel !== "all", !!location.trim(), !!minSalary.trim(), selectedTechnologies.length > 0, sort !== "relevant"].filter(Boolean).length;

  return (
    <div className="min-h-screen px-4 pb-12 pt-24">
      <div className="mx-auto max-w-7xl space-y-6">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <h1 className="ai-page-title text-4xl font-bold">Recommended opportunities</h1>
            <p className="mt-2 text-muted-foreground">Live roles ranked for your profile.</p>
          </div>
          <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-800 dark:text-cyan-200">
            <span className="font-semibold">{total}</span> results
            {feedUpdatedAt && <span className="ml-2 opacity-75">Updated {new Date(feedUpdatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
          </div>
        </motion.div>

        <GlassCard className="panel-surface space-y-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-3.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search by role, company, skill, or technology"
                className="h-12 border-border/80 bg-background/70 pl-11 text-foreground"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <select value={sort} onChange={(event) => setSort(event.target.value)} className="app-select h-12 rounded-xl px-4 text-sm">
                {SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <select value={workMode} onChange={(event) => setWorkMode(event.target.value)} className="app-select h-12 rounded-xl px-4 text-sm">
                {WORK_MODES.map((option) => <option key={option} value={option}>{option === "all" ? "Any work mode" : option}</option>)}
              </select>
              <Input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Location" className="h-12 border-border/80 bg-background/70 text-foreground" />
              <Input value={minSalary} onChange={(event) => setMinSalary(event.target.value.replace(/[^\d]/g, ""))} placeholder="Min salary" className="h-12 border-border/80 bg-background/70 text-foreground" />
            </div>
          </div>

          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap gap-2">
              {TYPE_FILTERS.map((filter) => (
                <Button
                  key={filter}
                  size="sm"
                  variant="outline"
                  onClick={() => setTypeFilter(filter)}
                  className={typeFilter === filter ? "rounded-full border-cyan-400/30 bg-cyan-400/10 text-cyan-700 dark:text-cyan-200" : "rounded-full border-border/80 bg-background/70 text-muted-foreground"}
                >
                  {filter === "all" ? "All roles" : filter}
                </Button>
              ))}
              <select value={experienceLevel} onChange={(event) => setExperienceLevel(event.target.value)} className="app-select h-9 rounded-full px-4 text-sm">
                {EXPERIENCE_OPTIONS.map((option) => <option key={option} value={option}>{option === "all" ? "Any level" : option}</option>)}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Filter className="h-4 w-4" />
              <span>{activeFilterCount} active filters</span>
              <Button size="sm" variant="outline" disabled={loadingJobs} onClick={() => loadJobs(1, false, true)} className="min-w-36 rounded-full border-border/80 bg-background/70 text-foreground">
                <RefreshCcw className={`mr-2 h-4 w-4 ${loadingJobs ? "animate-spin" : ""}`} />
                {loadingJobs ? "Refreshing..." : "Refresh jobs"}
              </Button>
            </div>
          </div>

          {!!quickTechnologyOptions.length && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Sparkles className="h-4 w-4 text-cyan-500" />
                Search suggestions
              </div>
              <div className="flex flex-wrap gap-2">
                {quickTechnologyOptions.map((technology) => {
                  const active = selectedTechnologies.includes(technology);
                  return (
                    <button
                      key={technology}
                      onClick={() => toggleTechnology(technology)}
                      className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 ${active ? "border-fuchsia-400/50 bg-fuchsia-400/15 text-fuchsia-700 shadow-sm dark:text-fuchsia-200" : "border-border/80 bg-background/70 text-muted-foreground hover:border-cyan-500/40 hover:bg-cyan-500/10 hover:text-foreground"}`}
                    >
                      {technology}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </GlassCard>

        <div aria-live="polite" className="sr-only">
          {loadingJobs ? "Refreshing job recommendations." : `${total} job recommendations loaded.`}
        </div>

        {loadingJobs ? (
          <div>
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-cyan-500/25 bg-cyan-500/10 px-4 py-3 text-sm font-medium text-cyan-800 dark:text-cyan-200">
              <Loader2 className="h-4 w-4 animate-spin" />
              Refreshing jobs...
            </div>
            <div className="grid gap-5 xl:grid-cols-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <GlassCard key={index} className="panel-surface h-[320px] animate-pulse" />
              ))}
            </div>
          </div>
        ) : jobs.length > 0 ? (
          <>
            <div className="grid gap-5 xl:grid-cols-2">
              {jobs.map((job, index) => (
                <motion.div key={job.id} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }}>
                  <GlassCard className="panel-surface h-full">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
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
                          <Badge className="rounded-full border-cyan-400/30 bg-cyan-400/10 text-cyan-700 dark:text-cyan-200">{job.matchScore}% match</Badge>
                        </div>
                        <p className="mt-1 text-muted-foreground">{job.company}</p>
                        <p className="mt-2 text-xs font-medium text-muted-foreground">Original posting via {job.source || "job provider"}</p>
                      </div>
                      <button
                        onClick={() => handleBookmark(job)}
                        aria-label={bookmarks[job.id] ? `Remove ${job.title} from saved jobs` : `Save ${job.title}`}
                        className="cursor-pointer rounded-full border border-border/80 bg-background/60 p-2 text-foreground transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-500/50 hover:bg-cyan-500/10 hover:shadow-md active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                      >
                        {bookmarks[job.id] ? <BookmarkCheck className="h-4 w-4 text-cyan-500" /> : <Bookmark className="h-4 w-4" />}
                      </button>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{job.location}</span>
                      <Badge variant="outline" className="rounded-full border-border/80 text-foreground">{job.type}</Badge>
                      {job.workMode && <Badge variant="outline" className="rounded-full border-border/80 text-foreground">{job.workMode}</Badge>}
                      {job.salary && <span>{job.salary}</span>}
                    </div>

                    <p className="mt-4 line-clamp-3 text-sm leading-6 text-muted-foreground">{job.description}</p>

                    <div className="mt-5 space-y-3">
                      <div>
                        <div className="mb-2 text-sm text-muted-foreground">Matched skills</div>
                        <div className="flex flex-wrap gap-2">
                          {job.matchedSkills.length > 0 ? (
                            job.matchedSkills.slice(0, 5).map((skill) => (
                              <Badge key={skill} className="rounded-full border-cyan-400/30 bg-cyan-400/10 text-cyan-700 dark:text-cyan-200">
                                {skill}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-sm text-muted-foreground">No direct skill overlap yet.</span>
                          )}
                        </div>
                      </div>

                      <div>
                        <div className="mb-2 text-sm text-muted-foreground">Skill gap</div>
                        <div className="flex flex-wrap gap-2">
                          {job.missingSkills.slice(0, 5).map((skill) => (
                            <Badge key={skill} className="rounded-full border-amber-400/30 bg-amber-400/10 text-amber-700 dark:text-amber-200">
                              {skill}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="mt-6">
                      <Button asChild className="min-h-11 rounded-full bg-gradient-to-r from-sky-400 via-cyan-300 to-fuchsia-400 px-5 text-slate-950 shadow-sm hover:opacity-90 focus-visible:ring-cyan-500">
                        <a href={job.url} target="_blank" rel="noreferrer" aria-label={`Open the original ${job.title} listing`}>
                          View job <ExternalLink className="ml-1 h-4 w-4" />
                        </a>
                      </Button>
                    </div>
                  </GlassCard>
                </motion.div>
              ))}
            </div>

            <div className="flex justify-center pt-2">
              {hasMore ? (
                <Button onClick={() => loadJobs(page + 1, true)} disabled={loadingMore} className="rounded-full bg-gradient-to-r from-sky-400 via-cyan-300 to-fuchsia-400 px-6 text-slate-950 hover:opacity-90">
                  {loadingMore ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {loadingMore ? "Loading more jobs..." : "Load more jobs"}
                </Button>
              ) : (
                <div className="text-sm text-muted-foreground">All results loaded.</div>
              )}
            </div>
          </>
        ) : (
          <GlassCard className="panel-surface text-center">
            <Filter className="mx-auto h-10 w-10 text-muted-foreground" />
            <h2 className="mt-4 text-xl font-semibold text-foreground">
              {activeFilterCount || deferredSearch.trim() ? "No jobs match this filter set" : "Live job providers are temporarily unavailable"}
            </h2>
            <p className="mt-2 text-muted-foreground">
              {activeFilterCount || deferredSearch.trim()
                ? "Try widening the work mode, clearing technologies, or lowering the salary filter."
                : "Refresh shortly to load verified postings."}
            </p>
            {!!searchSuggestions.length && (
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {searchSuggestions.map((suggestion) => (
                  <button key={suggestion} onClick={() => setSearchInput(suggestion)} className="cursor-pointer rounded-full border border-border/80 bg-background/70 px-3 py-1.5 text-sm text-muted-foreground transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-500/40 hover:bg-cyan-500/10 hover:text-foreground hover:shadow-md active:translate-y-0">
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </GlassCard>
        )}
      </div>
    </div>
  );
}
