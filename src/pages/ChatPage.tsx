import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, CheckCircle2, Clock3, Loader2, MessageSquareMore, RefreshCcw, Send, Sparkles, Trash2, UserRound } from "lucide-react";
import { motion } from "framer-motion";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { MarkdownContent } from "@/components/MarkdownContent";
import { usePageMeta } from "@/hooks/use-page-meta";

type ChatResponse = {
  reply: string;
  detectedSkills: string[];
  targetRole: string;
  matchPercent: number;
  skillGap: {
    matched: string[];
    missing: string[];
  };
  suggestions: string[];
  relatedResources?: string[];
  category?: string;
  aiPowered?: boolean;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  data?: ChatResponse;
};

const STARTERS = [
  "Explain the difference between React and Next.js for beginners.",
  "I know React, FastAPI, and MongoDB. What should I learn next?",
  "Give me interview preparation tips for a junior full-stack role.",
  "Suggest learning resources for my current skill gap.",
];

const HISTORY_KEY = "careerai_chat_history";

function TypingMarkdown({ content }: { content: string }) {
  const [visibleLength, setVisibleLength] = useState(0);

  useEffect(() => {
    setVisibleLength(0);
    const interval = window.setInterval(() => {
      setVisibleLength((current) => {
        if (current >= content.length) {
          window.clearInterval(interval);
          return current;
        }
        return current + Math.max(2, Math.floor(content.length / 45));
      });
    }, 18);
    return () => window.clearInterval(interval);
  }, [content]);

  return <MarkdownContent content={content.slice(0, visibleLength || 1)} />;
}

export default function ChatPage() {
  usePageMeta({
    title: "Aira Career Coach | CareerAI",
    description: "Chat with Aira about roadmaps, technologies, interviews, learning resources, job fit, and profile improvement.",
  });

  const { user } = useAuth();
  const { toast } = useToast();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [llmConfigured, setLlmConfigured] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const stored = localStorage.getItem(HISTORY_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as ChatMessage[];
        if (parsed.length) return parsed;
      } catch {
        // Ignore malformed local state.
      }
    }
    return [
      {
        id: "welcome",
        role: "assistant",
        createdAt: new Date().toISOString(),
        content:
          "### Hi, I’m Aira\nI’m your CareerAI coach. I can help with careers, technologies, learning paths, job fit, interview prep, portfolio advice, and roadmap questions.",
      },
    ];
  });
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    apiFetch<{ llmConfigured: boolean }>("/health")
      .then((health) => setLlmConfigured(health.llmConfigured))
      .catch(() => setLlmConfigured(false));
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [messages, loading]);

  const profileSummary = useMemo(() => {
    const skills = user?.skills?.length ? user.skills.slice(0, 6).join(", ") : "No skills saved yet";
    return {
      role: user?.targetRole || "Target role not selected",
      skills,
      level: user?.experienceLevel || "Beginner",
      missing: user?.skills?.length ? "Profile-aware answers enabled" : "Add resume or GitHub context for deeper answers",
    };
  }, [user]);

  async function sendMessage(messageText = input) {
    const cleanMessage = messageText.trim();
    if (!cleanMessage || loading) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: cleanMessage,
      createdAt: new Date().toISOString(),
    };
    setMessages((current) => [...current, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const history = messages.slice(-8).map((message) => ({ role: message.role, content: message.content }));
      const response = await apiFetch<ChatResponse>("/chat", {
        method: "POST",
        body: JSON.stringify({ message: cleanMessage, history }),
      });
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: response.reply,
          createdAt: new Date().toISOString(),
          data: response,
        },
      ]);
    } catch (error) {
      toast({
        title: "Chat failed",
        description: error instanceof Error ? error.message : "Aira could not answer right now.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  function clearConversation() {
    const next = [
      {
        id: "welcome",
        role: "assistant" as const,
        createdAt: new Date().toISOString(),
        content: "### Hi, I’m Aira\nAsk me about skills, jobs, technologies, interview prep, or your next learning step.",
      },
    ];
    setMessages(next);
  }

  const recentPrompts = messages.filter((message) => message.role === "user").slice(-5).reverse();

  return (
    <main className="min-h-screen px-4 pb-10 pt-24 sm:px-6">
      <div className="mx-auto grid max-w-7xl gap-6 xl:grid-cols-[280px_minmax(0,1fr)_340px]">
        <aside className="space-y-6">
          <GlassCard className="panel-surface p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Conversation</h2>
              </div>
              <Button variant="outline" size="icon" onClick={clearConversation} className="rounded-full border-border/80 bg-background/70">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <div className="mt-5 space-y-3">
              {recentPrompts.length ? recentPrompts.map((message) => (
                <button key={message.id} onClick={() => setInput(message.content)} className="w-full rounded-2xl border border-border/80 bg-background/70 p-3 text-left transition hover:bg-muted">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    <Clock3 className="h-3.5 w-3.5" />
                    {new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-foreground/90">{message.content}</p>
                </button>
              )) : (
                <p className="text-sm text-muted-foreground">Your last prompts will appear here for quick reuse.</p>
              )}
            </div>
          </GlassCard>

          <GlassCard className="panel-surface p-6">
            <h2 className="text-lg font-semibold text-foreground">Try asking</h2>
            <div className="mt-4 space-y-3">
              {STARTERS.map((starter) => (
                <button
                  key={starter}
                  onClick={() => sendMessage(starter)}
                  disabled={loading}
                  className="w-full rounded-2xl border border-border/80 bg-background/70 p-3 text-left text-sm leading-6 text-muted-foreground transition hover:border-cyan-400/30 hover:bg-cyan-400/10 hover:text-foreground"
                >
                  {starter}
                </button>
              ))}
            </div>
          </GlassCard>
        </aside>

        <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <GlassCard className="panel-surface flex min-h-[calc(100vh-8rem)] flex-col overflow-hidden p-0">
            <div className="border-b border-border/70 bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-950 p-6 text-white">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-cyan-300 shadow-[0_0_30px_rgba(34,211,238,0.2)]">
                    <Bot className="h-5 w-5" />
                  </div>
                  <div>
                    <h1 className="ai-page-title-on-dark text-2xl font-bold">Aira</h1>
                    <p className="text-sm text-slate-300">Career guidance, skills, interviews, and jobs.</p>
                  </div>
                </div>
                <Button variant="outline" disabled={loading} onClick={() => sendMessage("Summarize my current readiness and next steps.")} className="min-w-40 rounded-full border-white/20 bg-white/10 text-white hover:bg-white/20">
                  <RefreshCcw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                  {loading ? "Updating..." : "Refresh advice"}
                </Button>
              </div>
              {llmConfigured === false && (
                <p className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
                  AI provider is not configured. Career-specific built-in guidance works, but open-domain questions require `GEMINI_API_KEY` in `.env`.
                </p>
              )}
            </div>

            <div ref={scrollContainerRef} className="flex-1 space-y-5 overflow-y-auto p-5 sm:p-6">
              {messages.map((message, index) => (
                <div key={message.id} className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  {message.role === "assistant" && (
                    <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-500">
                      <Sparkles className="h-4 w-4" />
                    </div>
                  )}
                  <div className={`max-w-3xl rounded-3xl border p-4 ${message.role === "user" ? "border-cyan-400/20 bg-cyan-400/10 text-foreground" : "border-border/80 bg-background/85 text-foreground"}`}>
                    {message.role === "assistant" && index === messages.length - 1 && !loading ? (
                      <TypingMarkdown content={message.content} />
                    ) : message.role === "assistant" ? (
                      <MarkdownContent content={message.content} />
                    ) : (
                      <p className="whitespace-pre-wrap leading-7">{message.content}</p>
                    )}

                    {message.data && (
                      <div className="mt-4 grid gap-3 rounded-2xl bg-muted/50 p-4 sm:grid-cols-3">
                        <div>
                          <p className="text-xs font-medium uppercase text-muted-foreground">Target role</p>
                          <p className="mt-1 font-semibold text-foreground">{message.data.targetRole}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase text-muted-foreground">Match</p>
                          <p className="mt-1 font-semibold text-cyan-600 dark:text-cyan-300">{message.data.matchPercent}%</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase text-muted-foreground">Priority gap</p>
                          <p className="mt-1 font-semibold text-foreground">{message.data.skillGap.missing.slice(0, 2).join(", ") || "Ready"}</p>
                        </div>
                      </div>
                    )}

                    {!!message.data?.suggestions.length && (
                      <div className="mt-4 space-y-2">
                        {message.data.suggestions.map((suggestion) => (
                          <div key={suggestion} className="flex gap-2 text-sm text-muted-foreground">
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-500" />
                            <span>{suggestion}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {message.role === "user" && (
                    <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-fuchsia-400/10 text-fuchsia-500">
                      <UserRound className="h-4 w-4" />
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="flex items-center gap-3 rounded-2xl border border-border/80 bg-background/80 px-4 py-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Aira is thinking...
                </div>
              )}
            </div>

            <div className="border-t border-border/70 bg-background/85 p-4">
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  sendMessage();
                }}
                className="flex gap-3"
              >
                <Textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Ask Aira anything about your career..."
                  className="min-h-12 resize-none rounded-2xl border-border/80 bg-background text-foreground"
                />
                <Button type="submit" disabled={loading || !input.trim()} className="h-12 rounded-full bg-gradient-to-r from-sky-400 via-cyan-300 to-fuchsia-400 px-5 text-slate-950 hover:opacity-90">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </form>
            </div>
          </GlassCard>
        </motion.section>

        <aside className="space-y-6">
          <GlassCard className="panel-surface p-6">
            <div className="flex items-center gap-2">
              <MessageSquareMore className="h-5 w-5 text-cyan-500" />
              <h2 className="text-lg font-semibold text-foreground">Profile context</h2>
            </div>
            <div className="mt-5 space-y-4">
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">Target role</p>
                <p className="mt-1 text-foreground">{profileSummary.role}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">Skills</p>
                <p className="mt-1 leading-7 text-foreground">{profileSummary.skills}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">Experience</p>
                <p className="mt-1 text-foreground">{profileSummary.level}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">Status</p>
                <p className="mt-1 text-foreground">{profileSummary.missing}</p>
              </div>
            </div>
          </GlassCard>

        </aside>
      </div>
    </main>
  );
}
