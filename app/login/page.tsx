"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { KeyRound, Mail } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [nickname, setNickname] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
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
      // If already logged in, redirect away from /login
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        router.replace("/");
      } else {
        setCheckingSession(false);
      }
    }

    checkSession();
  }, [router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    setSubmitting(true);

    try {
      if (mode === "signup") {
        // Basic client-side validation for signup
        if (!email || !password || !username || !nickname) {
          setMessage("Please fill in email, username, nickname, and password.");
          return;
        }
        if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) {
          setMessage("Username must be 3–20 characters (letters, numbers, underscore).");
          return;
        }
        if (nickname.length < 2 || nickname.length > 20) {
          setMessage("Nickname must be between 2 and 20 characters.");
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) {
          setMessage(error.message);
          return;
        }

        const user = data.user;
        if (user) {
          // After sign up, make sure we store profile info for username-based login
          const { error: profileError } = await supabase
            .from("profiles")
            .upsert(
              {
                id: user.id,
                username,
                nickname,
                email,
              },
              { onConflict: "id" }
            );

          if (profileError) {
            setMessage(
              "Signed up, but failed to save profile. You can try again later from the profile page."
            );
            return;
          }
        }

        setMode("login");
        setIdentifier(email);
        setPassword("");
        setMessage("Check your inbox to verify your email, then log in.");
      } else {
        if (!identifier || !password) {
          setMessage("Please enter your email or username and password.");
          return;
        }

        let loginEmail = identifier;

        // If identifier does not look like an email, treat it as username
        if (!identifier.includes("@")) {
          const { data: profile, error: lookupError } = await supabase
            .from("profiles")
            .select("email")
            .eq("username", identifier)
            .maybeSingle();

          if (lookupError) {
            setMessage("Could not look up username. Please try email login.");
            return;
          }
          if (!profile?.email) {
            setMessage("Username not found. Please check your username or use your email.");
            return;
          }
          loginEmail = profile.email;
        }

        const { error } = await supabase.auth.signInWithPassword({
          email: loginEmail,
          password,
        });

        if (error) {
          setMessage(error.message);
        } else {
          router.replace("/");
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
                    <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Email or username"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      className="pl-11"
                      autoComplete="username"
                    />
                  </div>
                ) : (
                  <>
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
                    <Input
                      type="text"
                      placeholder="Username (3–20 chars, letters/numbers/underscore)"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      autoComplete="username"
                    />
                    <Input
                      type="text"
                      placeholder="Nickname (display name)"
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      autoComplete="name"
                    />
                  </>
                )}

                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-11"
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting
                    ? mode === "login"
                      ? "Logging in…"
                      : "Signing up…"
                    : mode === "login"
                    ? "Log in"
                    : "Sign up"}
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