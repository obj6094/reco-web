"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft } from "lucide-react";

export default function NicknamePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
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
        .select("username, nickname")
        .eq("id", user.id)
        .maybeSingle();

      if (!profile?.username) {
        router.replace("/setup-account");
        return;
      }

      setUserId(user.id);
      setNickname(profile.nickname ?? profile.username);
      setLoading(false);
    }

    boot();
  }, [router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!userId) return;

    const nextNickname = nickname.trim();
    setError("");
    setMessage("");

    if (!nextNickname) {
      setError("Please enter a nickname.");
      return;
    }

    setSaving(true);
    try {
      const { data: duplicate, error: duplicateCheckError } = await supabase
        .from("profiles")
        .select("id")
        .eq("nickname", nextNickname)
        .neq("id", userId)
        .maybeSingle();

      if (duplicateCheckError) {
        setError("Could not validate nickname. Please try again.");
        return;
      }

      if (duplicate) {
        setError("Nickname is already taken.");
        return;
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ nickname: nextNickname })
        .eq("id", userId);

      if (updateError) {
        const low = updateError.message.toLowerCase();
        if (low.includes("nickname")) {
          setError("Nickname is already taken.");
        } else {
          setError("Failed to update nickname. Please try again.");
        }
        return;
      }

      setMessage("Nickname updated.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-[calc(100vh-56px)] bg-background px-4 py-16 text-foreground">
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
    <main className="min-h-[calc(100vh-56px)] bg-background px-4 py-16 text-foreground">
      <div className="mx-auto max-w-md space-y-4">
        <Button variant="ghost" asChild className="px-0">
          <Link href="/profile">
            <ArrowLeft className="h-4 w-4" />
            Back to profile
          </Link>
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Change nickname</CardTitle>
            <CardDescription>
              Nickname is public. Your login ID stays the same after nickname changes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <form onSubmit={handleSubmit} className="space-y-3">
              <Input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="New nickname"
                autoComplete="nickname"
              />
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? "Saving..." : "Save nickname"}
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
