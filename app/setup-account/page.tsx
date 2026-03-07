"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { isValidPassword, isValidUsername } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type FieldErrors = {
  username?: string;
  password?: string;
  confirmPassword?: string;
  general?: string;
};

export default function SetupAccountPage() {
  const router = useRouter();

  const [loadingSession, setLoadingSession] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function boot() {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) {
        router.replace("/login");
        return;
      }

      setEmail(user.email ?? null);

      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.username) {
        router.replace("/");
        return;
      }

      setLoadingSession(false);
    }

    boot();
  }, [router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors({});

    const nextErrors: FieldErrors = {};
    const normalizedUsername = username.trim();

    if (!isValidUsername(normalizedUsername)) {
      nextErrors.username = "Username must be 3-20 characters (letters, numbers, underscore).";
    }
    if (!isValidPassword(password)) {
      nextErrors.password = "Password must be at least 8 characters and include letters and numbers.";
    }
    if (password !== confirmPassword) {
      nextErrors.confirmPassword = "Passwords do not match.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setSubmitting(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) {
        setErrors({ general: "Your session expired. Please log in again." });
        return;
      }

      const { data: duplicateByUsername, error: usernameLookupError } = await supabase
        .from("profiles")
        .select("id")
        .or(`username.eq.${normalizedUsername},nickname.eq.${normalizedUsername}`)
        .neq("id", user.id)
        .maybeSingle();

      if (usernameLookupError) {
        setErrors({ general: "Could not validate username. Please try again." });
        return;
      }

      if (duplicateByUsername) {
        setErrors({ username: "Username is already taken." });
        return;
      }

      const { error: passwordError } = await supabase.auth.updateUser({ password });
      if (passwordError) {
        setErrors({ general: passwordError.message });
        return;
      }

      const { error: profileError } = await supabase.from("profiles").upsert(
        {
          id: user.id,
          email: user.email ?? "",
          username: normalizedUsername,
          nickname: normalizedUsername,
        },
        { onConflict: "id" }
      );

      if (profileError) {
        const duplicateError = `${profileError.message}`.toLowerCase();
        if (duplicateError.includes("username") || duplicateError.includes("nickname")) {
          setErrors({ username: "Username is already taken." });
        } else {
          setErrors({ general: "Failed to save profile. Please try again." });
        }
        return;
      }

      router.replace("/");
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingSession) {
    return (
      <main className="min-h-[calc(100vh-56px)] bg-background px-4 py-16 text-foreground">
        <div className="mx-auto max-w-md">
          <Card>
            <CardHeader>
              <CardTitle>Setting up account</CardTitle>
              <CardDescription>Checking your verified session...</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-56px)] bg-background px-4 py-16 text-foreground">
      <div className="mx-auto max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Complete your account</CardTitle>
            <CardDescription>
              Complete your account to start using Reco.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {email ? <p className="text-sm text-muted-foreground">Verified email: {email}</p> : null}
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1">
                <Input
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                />
                {errors.username ? <p className="text-sm text-destructive">{errors.username}</p> : null}
              </div>
              <div className="space-y-1">
                <Input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
                {errors.password ? <p className="text-sm text-destructive">{errors.password}</p> : null}
              </div>
              <div className="space-y-1">
                <Input
                  type="password"
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                />
                {errors.confirmPassword ? (
                  <p className="text-sm text-destructive">{errors.confirmPassword}</p>
                ) : null}
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Saving..." : "Finish setup"}
              </Button>
            </form>
            {errors.general ? (
              <div className="rounded-2xl border border-border bg-accent px-4 py-3 text-sm text-foreground/90">
                {errors.general}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
