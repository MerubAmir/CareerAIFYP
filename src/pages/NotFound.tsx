import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { GlassCard } from "@/components/GlassCard";
import { usePageMeta } from "@/hooks/use-page-meta";

const NotFound = () => {
  usePageMeta({
    title: "Not Found | CareerAI",
    description: "The requested CareerAI route could not be found.",
  });
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4 pt-24">
      <GlassCard className="panel-surface max-w-lg text-center">
        <h1 className="ai-page-title text-5xl font-bold">404</h1>
        <p className="mt-4 text-xl text-muted-foreground">This route does not exist in the current CareerAI flow.</p>
        <Link to="/" className="mt-6 inline-block rounded-full border border-border/80 bg-background/70 px-5 py-3 text-sm text-foreground transition hover:bg-muted">
          Return home
        </Link>
      </GlassCard>
    </div>
  );
};

export default NotFound;
