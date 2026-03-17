"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/EmptyState";
import { formatDateTime } from "@/lib/utils";
import { ArrowLeft, Trophy } from "lucide-react";

type MySubmission = {
  id: string;
  challengeId: string;
  challengePrompt: string;
  trackName: string;
  artistName: string;
  albumImage: string | null;
  comment: string | null;
  created_at: string;
  voteCount: number;
};

export default function ProfileChallengesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<MySubmission[]>([]);

  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) {
        router.replace("/login");
        return;
      }

      const { data: rows } = await supabase
        .from("challenge_submissions")
        .select(
          "id, challenge_id, spotify_track_name, spotify_artist_name, spotify_album_image_url, comment, created_at, challenge_votes(id)"
        )
        .eq("user_id", uid)
        .order("created_at", { ascending: false });

      const challengeIds = [...new Set((rows ?? []).map((row: any) => row.challenge_id).filter(Boolean))] as string[];
      const challengePromptMap: Record<string, string> = {};
      if (challengeIds.length) {
        const { data: challenges } = await supabase
          .from("weekly_challenges")
          .select("id, prompt")
          .in("id", challengeIds);
        (challenges ?? []).forEach((ch: any) => {
          challengePromptMap[ch.id as string] = ch.prompt ?? "Weekly Challenge";
        });
      }

      const mapped: MySubmission[] =
        (rows ?? []).map((row: any) => ({
          id: row.id,
          challengeId: row.challenge_id,
          challengePrompt: challengePromptMap[row.challenge_id] ?? "Weekly Challenge",
          trackName: row.spotify_track_name,
          artistName: row.spotify_artist_name,
          albumImage: row.spotify_album_image_url,
          comment: row.comment,
          created_at: row.created_at,
          voteCount: (row.challenge_votes ?? []).length,
        })) ?? [];
      setItems(mapped);
      setLoading(false);
    }
    load();
  }, [router]);

  return (
    <main className="min-h-[calc(100dvh-120px)] bg-background px-3 py-6 text-foreground sm:px-4 sm:py-8 md:py-10">
      <div className="mx-auto w-full max-w-4xl space-y-4">
        <Button variant="ghost" asChild className="px-0">
          <Link href="/profile">
            <ArrowLeft className="h-4 w-4" />
            Back to profile
          </Link>
        </Button>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-primary" />
                My challenge history
              </CardTitle>
              <Badge variant="secondary">{items.length}</Badge>
            </div>
            <CardDescription>Your challenge entries and votes received.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading...</div>
            ) : items.length === 0 ? (
              <EmptyState
                icon={Trophy}
                title="No submissions yet"
                description="Join this week's challenge and submit your first Reco."
              />
            ) : (
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {items.map((s) => (
                  <li key={s.id}>
                    <Card>
                      <CardContent className="space-y-4 p-4 sm:p-5">
                        <div className="rounded-xl border border-primary/30 bg-primary/10 px-3 py-3">
                          <p className="break-words text-base font-bold leading-snug tracking-tight text-primary">
                            {s.challengePrompt}
                          </p>
                        </div>

                        <div className="flex items-start justify-between gap-4">
                          <div className="flex min-w-0 items-start gap-3">
                            <div className="h-14 w-14 overflow-hidden rounded-xl border border-border bg-card">
                              {s.albumImage ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={s.albumImage} alt={s.trackName} className="h-full w-full object-cover" />
                              ) : null}
                            </div>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold">{s.trackName}</div>
                              <div className="truncate text-xs text-muted-foreground">{s.artistName}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-muted-foreground">Votes</div>
                            <div className="text-xl font-extrabold text-primary">{s.voteCount}</div>
                          </div>
                        </div>

                        {s.comment ? (
                          <div className="rounded-lg border border-border bg-accent/40 px-3 py-2 text-xs text-foreground/90">
                            "{s.comment}"
                          </div>
                        ) : null}

                        <div className="text-xs text-muted-foreground">
                          {formatDateTime(s.created_at)}
                        </div>
                      </CardContent>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

