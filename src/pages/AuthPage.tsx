import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Brain, Lock, Mail, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { usePageMeta } from "@/hooks/use-page-meta";

export default function AuthPage() {
  usePageMeta({
    title: "Sign In | CareerAI",
    description: "Access your CareerAI workspace to manage your profile, jobs, roadmap, and AI guidance.",
  });
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!email.trim() || !password.trim() || (!isLogin && !name.trim())) {
      toast({ title: "Missing details", description: "Please complete all required fields.", variant: "destructive" });
      return;
    }

    setLoading(true);

    try {
      if (isLogin) {
        await login(email.trim(), password);
      } else {
        await register(name.trim(), email.trim(), password);
      }

      toast({
        title: isLogin ? "Welcome back" : "Account ready",
        description: isLogin ? "Your career workspace is ready." : "Your CareerAI profile has been created.",
      });
      navigate("/dashboard");
    } catch (error) {
      toast({ title: "Authentication failed", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 pt-24">
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="relative w-full max-w-md">
        <GlassCard className="panel-surface p-8">
          <div className="mb-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-gradient-to-br from-sky-400/25 via-cyan-300/25 to-fuchsia-400/20 text-cyan-500">
              <Brain className="h-7 w-7" />
            </div>
            <h1 className="ai-page-title mt-4 text-3xl font-bold">{isLogin ? "Enter your workspace" : "Create your profile"}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {isLogin
                ? "Continue from your saved CareerAI analysis."
                : "Start with a profile, then add your resume, GitHub, and target role."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="relative">
                <User className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Full name" className="h-12 border-border/80 bg-background/80 pl-10 text-foreground" />
              </div>
            )}

            <div className="relative">
              <Mail className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
              <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email address" className="h-12 border-border/80 bg-background/80 pl-10 text-foreground" />
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
              <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" className="h-12 border-border/80 bg-background/80 pl-10 text-foreground" />
            </div>

            <Button type="submit" disabled={loading} className="h-12 w-full rounded-full bg-gradient-to-r from-sky-400 via-cyan-300 to-fuchsia-400 text-slate-950 hover:opacity-90">
              {loading ? "Preparing..." : isLogin ? "Sign in" : "Create account"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </form>

          <button onClick={() => setIsLogin((current) => !current)} className="mt-6 w-full text-center text-sm text-muted-foreground transition hover:text-foreground">
            {isLogin ? "Need a new account? Register here." : "Already registered? Sign in instead."}
          </button>
        </GlassCard>
      </motion.div>
    </div>
  );
}
