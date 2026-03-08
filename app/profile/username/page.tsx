"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { isValidUsername } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft } from "lucide-react";

export default function UsernamePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [currentUsername, setCurrentUsername] = useState("");
  const [nextUsername, setNextUsername] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function boot() {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .maybeSingle();

      if (!profile?.username) {
        router.replace("/setup-account");
        return;
      }

      setUserId(user.id);
      setCurrentUsername(profile.username);
      setNextUsername(profile.username);
      setLoading(false);
    }

    boot();
  }, [router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!userId) return;

    const next = nextUsername.trim();
    setError("");
    setMessage("");

    if (!isValidUsername(next)) {
      setError("Username must be 3-20 characters (letters, numbers, underscore).");
      return;
    }

    setSaving(true);
    try {
      const { data: duplicate, error: duplicateCheckError } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", next)
        .neq("id", userId)
        .maybeSingle();

      if (duplicateCheckError) {
        setError("Could not validate username. Please try again.");
        return;
      }

      if (duplicate) {
        setError("Username is already taken.");
        return;
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ username: next })
        .eq("id", userId);

      if (updateError) {
        const low = updateError.message.toLowerCase();
        if (low.includes("username")) {
          setError("Username is already taken.");
        } else {
          setError("Failed to update username. Please try again.");
        }
        return;
      }

      setCurrentUsername(next);
      setMessage("Login ID updated.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-[calc(100dvh-120px)] bg-background px-3 py-8 text-foreground sm:px-4 sm:py-16">
        <div className="mx-auto max-w-md">
          <Card>
            <CardHeader>
              <CardTitle>Loading</CardTitle>
              <CardDescription>Checking your account...</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100dvh-120px)] bg-background px-3 py-8 text-foreground sm:px-4 sm:py-16">
      <div className="mx-auto max-w-md space-y-4">
        <Button variant="ghost" asChild className="px-0">
          <Link href="/profile">
            <ArrowLeft className="h-4 w-4" />
            Back to profile
          </Link>
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Change login ID</CardTitle>
            <CardDescription>Your current login ID is @{currentUsername}. Nickname does not change automatically.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <form onSubmit={handleSubmit} className="space-y-3">
              <Input
                value={nextUsername}
                onChange={(e) => setNextUsername(e.target.value)}
                placeholder="New login ID"
                autoComplete="username"
              />
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? "Saving..." : "Save login ID"}
              </Button>
            </form>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
