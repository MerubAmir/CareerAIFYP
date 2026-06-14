import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Brain, LogOut, Menu, X } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";

const NAV_ITEMS = [
  { path: "/dashboard", label: "Dashboard" },
  { path: "/resume", label: "Profile Input" },
  { path: "/jobs", label: "Jobs" },
  { path: "/skills", label: "Skill Gap" },
  { path: "/roadmap", label: "Roadmap" },
  { path: "/bookmarks", label: "Bookmarks" },
  { path: "/chat", label: "Ask Aira" },
];

export function Navbar() {
  const { isAuthenticated, user, logout } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed left-0 right-0 top-0 z-50 border-b border-border/70 bg-background/80 backdrop-blur-2xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-sky-400/25 via-cyan-300/25 to-fuchsia-400/20 text-cyan-500 dark:shadow-[0_0_30px_rgba(34,211,238,0.18)]">
            <Brain className="h-5 w-5" />
          </div>
          <div>
            <div className="font-heading text-lg font-semibold text-foreground">CareerAI</div>
            <div className="hidden text-xs text-muted-foreground sm:block">Context-aware career intelligence</div>
          </div>
        </Link>

        {isAuthenticated && (
          <div className="hidden items-center gap-1 lg:flex">
            {NAV_ITEMS.map((item) => {
              const active = location.pathname === item.path;
              return (
                <Link key={item.path} to={item.path} className="relative cursor-pointer rounded-full px-4 py-2 text-sm text-muted-foreground transition-all duration-200 hover:-translate-y-0.5 hover:bg-muted/70 hover:text-foreground active:translate-y-0">
                  {active && <motion.div layoutId="nav-active" className="absolute inset-0 rounded-full bg-muted" transition={{ duration: 0.25 }} />}
                  <span className="relative z-10">{item.label}</span>
                </Link>
              );
            })}
          </div>
        )}

        <div className="flex items-center gap-3">
          <ThemeToggle />
          {isAuthenticated ? (
            <>
              <div className="hidden rounded-full border border-border/70 bg-background/70 px-3 py-1.5 text-sm text-muted-foreground md:block">
                {user?.name}
              </div>
              <Button variant="ghost" size="sm" onClick={logout} className="rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Link to="/auth">
              <Button className="rounded-full bg-gradient-to-r from-sky-400 via-cyan-300 to-fuchsia-400 text-slate-950 hover:opacity-90">
                Open App
              </Button>
            </Link>
          )}

          <button onClick={() => setMobileOpen((current) => !current)} className="cursor-pointer rounded-full p-2 text-foreground transition-all duration-200 hover:-translate-y-0.5 hover:bg-muted hover:shadow-md active:translate-y-0 lg:hidden">
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && isAuthenticated && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="border-t border-border/70 bg-background/95 px-4 py-4 lg:hidden">
          <div className="flex flex-col gap-2">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                className={`rounded-lg px-4 py-3 text-sm ${location.pathname === item.path ? "bg-muted text-foreground" : "text-muted-foreground"}`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </motion.div>
      )}
    </nav>
  );
}
