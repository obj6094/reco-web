"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getDisplayName } from "@/lib/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { ExpandableText } from "@/components/ExpandableText";
import { ArrowLeft, Play, Trophy } from "lucide-react";

type PublicSubmission = {
  id: string;
  challenge_id: string;
  challengePrompt: string;
  trackName: string;
  artistName: string;
  albumImage: string | null;
  comment: string | null;
  created_at: string;
  voteCount: number;
  spotify_track_id: string | null;
};

export default function PublicSubmissionsPage() {
  const params = useParams<{ username: string }>();
  const usernameParam = params?.username;

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [nickname, setNickname] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<PublicSubmission[]>([]);
  const [expandedPlayId, setExpandedPlayId] = useState<string | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    async function load() {
      if (!usernameParam) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setLoading(true);
      const slug = decodeURIComponent(usernameParam).trim();
      let profile: { id: string; username: string | null; nickname: string | null } | null = null;
      const { data: byNickname } = await supabase
        .from("profiles")
        .select("id, username, nickname")
        .eq("nickname", slug)
        .maybeSingle();
      if (byNickname) {
        profile = byNickname;
      } else {
        const { data: byUsername } = await supabase
          .from("profiles")
          .select("id, username, nickname")
          .eq("username", slug)
          .maybeSingle();
        if (byUsername) profile = byUsername;
      }

      if (!profile) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const uid = profile.id as string;
      setUserId(uid);
      setNickname(getDisplayName(profile.nickname as string | null, profile.username as string | null));

      const { data: subRows, error: subError } = await supabase
        .from("challenge_submissions")
        .select(
          "id, challenge_id, spotify_track_id, spotify_track_name, spotify_artist_name, spotify_album_image_url, comment, created_at, challenge_votes(id)"
        )
        .eq("user_id", uid)
        .order("created_at", { ascending: false });

      if (subError) {
        setStatus("Failed to load submissions.");
        setLoading(false);
        return;
      }

      const challengeIds = [...new Set((subRows ?? []).map((r: any) => r.challenge_id).filter(Boolean))];
      const promptByChallengeId: Record<string, string> = {};
      if (challengeIds.length) {
        const { data: chalRows } = await supabase
          .from("weekly_challenges")
          .select("id, prompt")
          .in("id", challengeIds);
        (chalRows ?? []).forEach((r: any) => {
          promptByChallengeId[r.id as string] = (r.prompt as string) ?? "";
        });
      }

      const mapped: PublicSubmission[] = (subRows ?? []).map((row: any) => ({
        id: row.id,
        challenge_id: row.challenge_id ?? "",
        challengePrompt: promptByChallengeId[row.challenge_id as string] ?? "",
        trackName: row.spotify_track_name ?? "Unknown",
        artistName: row.spotify_artist_name ?? "Unknown",
        albumImage: row.spotify_album_image_url ?? null,
        comment: row.comment ?? null,
        created_at: row.created_at,
        voteCount: (row.challenge_votes ?? []).length,
        spotify_track_id: row.spotify_track_id ?? null,
      }));

      setSubmissions(mapped);
      setLoading(false);
    }
    load();
  }, [usernameParam]);

  if (loading) {
    return (
      <main className="min-h-[calc(100vh-56px)] bg-background px-4 py-16 text-foreground">
        <div className="mx-auto max-w-md">
          <Card>
            <CardHeader>
              <CardTitle>Loading</CardTitle>
              <CardDescription>Loading challenge submissions…</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </main>
    );
  }

  if (notFound || !userId) {
    return (
      <main className="min-h-[calc(100vh-56px)] bg-background px-4 py-16 text-foreground">
        <div className="mx-auto max-w-2xl space-y-4">
          <Button variant="ghost" asChild className="px-0">
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to home
            </Link>
          </Button>
          <Card>
            <CardHeader>
              <CardTitle>Profile not found</CardTitle>
              <CardDescription>We couldn&apos;t find this curator.</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-56px)] bg-background px-4 py-10 text-foreground">
      <div className="mx-auto max-w-2xl space-y-6">
        <Button variant="ghost" asChild className="px-0">
          <Link href={`/u/${encodeURIComponent(usernameParam ?? "")}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to {nickname ?? "profile"}
          </Link>
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              All challenge submissions by {nickname ?? "user"}
            </CardTitle>
            <CardDescription>
              {submissions.length} {submissions.length === 1 ? "submission" : "submissions"} in total.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {submissions.length === 0 ? (
              <EmptyState
                icon={Trophy}
                title="No submissions yet"
                description="This curator has not submitted to challenges yet."
              />
            ) : (
              <div className="space-y-3">
                {submissions.map((s) => (
                  <Card key={s.id} className="border-border/80 bg-muted/40">
                    <CardContent className="space-y-2.5 p-3 sm:p-4">
                      {s.challengePrompt ? (
                        <div className="line-clamp-2 break-words text-sm font-bold text-primary">
                          {s.challengePrompt}
                        </div>
                      ) : null}
                      <div className="flex min-w-0 items-start justify-between gap-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-2xl border border-border bg-card sm:h-16 sm:w-16">
                            {s.albumImage ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={s.albumImage}
                                alt={s.trackName}
                                className="h-full w-full object-cover"
                              />
                            ) : null}
                          </div>
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="truncate text-sm font-semibold">{s.trackName}</div>
                            <div className="truncate text-xs text-muted-foreground">{s.artistName}</div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-xs text-muted-foreground">Votes</div>
                          <div className="text-lg font-extrabold text-primary">{s.voteCount}</div>
                        </div>
                      </div>
                      {s.comment ? (
                        <div className="rounded-2xl border border-border bg-accent/40 px-3 py-2">
                          <ExpandableText
                            text={s.comment}
                            maxChars={160}
                            variant="compact-card"
                            toggleAriaLabel="Toggle comment expansion"
                          />
                        </div>
                      ) : null}
                      <div className="flex flex-wrap items-center gap-2 pt-0.5">
                        {s.spotify_track_id ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setExpandedPlayId((prev) => (prev === s.id ? null : s.id))}
                            className="px-3 py-1.5 text-xs"
                          >
                            <Play className="mr-1 h-3.5 w-3.5" />
                            {expandedPlayId === s.id ? "Hide" : "Play"}
                          </Button>
                        ) : null}
                      </div>
                      {expandedPlayId === s.id && s.spotify_track_id ? (
                        <div className="mt-1.5 overflow-hidden rounded-2xl border border-border">
                          <iframe
                            className="w-full"
                            src={`https://open.spotify.com/embed/track/${s.spotify_track_id}`}
                            width="100%"
                            height="80"
                            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                            loading="lazy"
                            title={`Play ${s.trackName}`}
                          />
                        </div>
                      ) : null}
                      <div className="text-xs text-muted-foreground">
                        {new Date(s.created_at).toLocaleString()}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {status ? (
          <div className="rounded-2xl border border-border bg-accent px-4 py-3 text-sm">
            {status}
          </div>
        ) : null}
      </div>
    </main>
  );
}
