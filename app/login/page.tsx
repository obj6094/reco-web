"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { Eye, EyeOff, KeyRound, Mail, UserRound } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    // Control login/signup mode via URL query (/login?mode=signup)
    const modeParam = new URLSearchParams(window.location.search).get("mode");
    if (modeParam === "signup") {
      setMode("signup");
    } else if (modeParam === "login") {
      setMode("login");
    }
  }, []);

  useEffect(() => {
    async function checkSession() {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) {
        setCheckingSession(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.username) {
        router.replace("/");
        return;
      }

      router.replace("/setup-account");
    }

    checkSession();
  }, [router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    setSubmitting(true);

    try {
      if (mode === "signup") {
        if (!email) {
          setMessage("Please enter your email.");
          return;
        }

        const { error } = await supabase.auth.signInWithOtp({
          email: email.trim(),
          options: {
            shouldCreateUser: true,
            emailRedirectTo: `${window.location.origin}/setup-account`,
          },
        });

        if (error) {
          setMessage(error.message);
          return;
        }
        setMessage("Check your inbox to verify your email.");
      } else {
        if (!identifier || !password) {
          setMessage("Please enter your login ID and password.");
          return;
        }

        const loginId = identifier.trim();
        const { data: profile, error: lookupError } = await supabase
          .from("profiles")
          .select("email")
          .eq("username", loginId)
          .maybeSingle();

        if (lookupError) {
          setMessage("Could not look up login ID. Please try again.");
          return;
        }
        if (!profile?.email) {
          setMessage("User not found");
          return;
        }

        const { error } = await supabase.auth.signInWithPassword({
          email: profile.email,
          password,
        });

        if (error) {
          setMessage(error.message);
        } else {
          const { data: userData } = await supabase.auth.getUser();
          const user = userData.user;

          if (!user) {
            setMessage("Login failed. Please try again.");
            return;
          }

          const { data: profile } = await supabase
            .from("profiles")
            .select("username")
            .eq("id", user.id)
            .maybeSingle();

          if (profile?.username) {
            router.replace("/");
          } else {
            router.replace("/setup-account");
          }
        }
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (checkingSession) {
    return (
      <main className="min-h-[calc(100vh-56px)] bg-background px-4 py-16 text-foreground">
        <div className="mx-auto max-w-md">
          <Card>
            <CardHeader>
              <CardTitle>Reco</CardTitle>
              <CardDescription>Checking your session…</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-56px)] bg-background px-4 py-16 text-foreground">
      <div className="mx-auto grid max-w-5xl gap-10 md:grid-cols-2 md:items-center">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_20px_hsl(var(--primary)/0.65)]" />
            <span className="text-sm font-semibold text-muted-foreground">Reco</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
            Discover music through real people.
          </h1>
          <p className="text-sm leading-6 text-muted-foreground">
            Recommend songs, vote together, and find your next favorite track.
          </p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">Weekly Challenge</Badge>
            <Badge variant="secondary">QnA Requests</Badge>
            <Badge variant="secondary">Voting</Badge>
          </div>
        </div>

        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
        >
          <Card className="shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
            <CardHeader>
              <CardTitle>{mode === "login" ? "Log in" : "Sign up"}</CardTitle>
              <CardDescription>
                {mode === "login"
                  ? "Log in to continue with Reco."
                  : "Create an account and verify your email to get started."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <form onSubmit={handleSubmit} className="space-y-3">
                {mode === "login" ? (
                  <div className="relative">
                    <UserRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Login ID"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      className="pl-11"
                      autoComplete="username"
                    />
                  </div>
                ) : (
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="email"
                      placeholder="Email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-11"
                      autoComplete="email"
                    />
                  </div>
                )}

                {mode === "login" ? (
                  <div className="relative">
                    <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-11 pr-10"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                ) : null}

                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting
                    ? mode === "login"
                      ? "Logging in…"
                      : "Sending..."
                    : mode === "login"
                    ? "Log in"
                    : "Send verification email"}
                </Button>
              </form>

              <Button
                variant="ghost"
                className="w-full"
                onClick={() => setMode(mode === "login" ? "signup" : "login")}
              >
                {mode === "login" ? "Need an account? Sign up" : "Already have an account? Log in"}
              </Button>

              {message ? (
                <div className="rounded-2xl border border-border bg-accent px-4 py-3 text-sm text-foreground/90">
                  {message}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </main>
  );
}