"use client";

import { useParams, useRouter } from "next/navigation";
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
import { ArrowLeft, MessageCircle, Play } from "lucide-react";

type PublicAnswer = {
  id: string;
  request_id: string;
  trackName: string;
  artistName: string;
  comment: string | null;
  requestPrompt: string;
  created_at: string;
  albumImage: string | null;
  spotify_track_id: string | null;
  requesterName: string;
  requesterSlug: string;
};

export default function PublicAnswersPage() {
  const params = useParams<{ username: string }>();
  const usernameParam = params?.username;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [nickname, setNickname] = useState<string | null>(null);
  const [answers, setAnswers] = useState<PublicAnswer[]>([]);
  const [expandedPlayAnswerId, setExpandedPlayAnswerId] = useState<string | null>(null);
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

      const { data: ansRows, error: ansError } = await supabase
        .from("qna_answers")
        .select("id, request_id, spotify_track_name, spotify_artist_name, spotify_album_image_url, spotify_track_id, comment, created_at")
        .eq("responder_id", uid)
        .order("created_at", { ascending: false });

      if (ansError) {
        setStatus("Failed to load answers.");
        setLoading(false);
        return;
      }

      const requestIds = [...new Set((ansRows ?? []).map((r: any) => r.request_id).filter(Boolean))];
      const reqMap: Record<string, { prompt: string; requester_id: string }> = {};
      if (requestIds.length) {
        const { data: reqRows } = await supabase
          .from("qna_requests")
          .select("id, prompt, requester_id")
          .in("id", requestIds);
        (reqRows ?? []).forEach((r: any) => {
          reqMap[r.id] = { prompt: r.prompt ?? "", requester_id: r.requester_id };

        });
      }

      const requesterIds = [...new Set(Object.values(reqMap).map((r) => r.requester_id).filter(Boolean))];
      const profileMap: Record<string, { name: string; slug: string }> = {};
      if (requesterIds.length) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, nickname, username")
          .in("id", requesterIds);
        (profiles ?? []).forEach((p: any) => {
          const slug = ((p.nickname ?? p.username ?? "user") as string).trim() || "user";
          profileMap[p.id] = {
            name: getDisplayName(p.nickname, p.username),
            slug,
          };
        });
      }

      const mapped: PublicAnswer[] = (ansRows ?? []).map((row: any) => {
        const req = reqMap[row.request_id as string];
        const requester = req ? profileMap[req.requester_id] : null;
        return {
          id: row.id,
          request_id: row.request_id,
          trackName: row.spotify_track_name ?? "Unknown",
          artistName: row.spotify_artist_name ?? "Unknown",
          comment: row.comment ?? null,
          requestPrompt: req?.prompt ?? "",
          created_at: row.created_at,
          albumImage: row.spotify_album_image_url ?? null,
          spotify_track_id: row.spotify_track_id ?? null,
          requesterName: requester?.name ?? "user",
          requesterSlug: requester?.slug ?? "user",
        };
      });

      setAnswers(mapped);
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
              <CardDescription>Loading QnA answers…</CardDescription>
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
              <MessageCircle className="h-5 w-5 text-primary" />
              All QnA answers by {nickname ?? "user"}
            </CardTitle>
            <CardDescription>
              {answers.length} {answers.length === 1 ? "answer" : "answers"} in total.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {answers.length === 0 ? (
              <EmptyState
                icon={MessageCircle}
                title="No answers yet"
                description="This curator has not answered any requests yet."
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {answers.map((a) => (
                  <Card
                    key={a.id}
                    role="button"
                    tabIndex={0}
                    className="h-full cursor-pointer overflow-hidden border-border/80 bg-gradient-to-br from-card to-accent/20 transition-colors hover:bg-accent/10"
                    onClick={() => router.push(`/requests/${a.request_id}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        router.push(`/requests/${a.request_id}`);
                      }
                    }}
                  >
                      <CardHeader className="space-y-2 p-4 sm:p-6">
                        <CardTitle className="line-clamp-1 truncate break-words text-sm">
                          {a.requestPrompt}
                        </CardTitle>
                        <CardDescription>
                          {new Date(a.created_at).toLocaleDateString()}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-xl border border-border bg-card">
                            {a.albumImage ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={a.albumImage}
                                alt={a.trackName}
                                className="h-full w-full object-cover"
                              />
                            ) : null}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold">{a.trackName}</div>
                            <div className="truncate text-xs text-muted-foreground">{a.artistName}</div>
                          </div>
                        </div>
                        <div
                          className="space-y-1 rounded-xl border border-border/70 bg-muted/30 px-3 py-2 text-xs text-muted-foreground"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <p>
                            Request by{" "}
                            <Link
                              href={`/u/${encodeURIComponent(a.requesterSlug)}`}
                              className="font-medium text-primary hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              @{a.requesterName}
                            </Link>
                          </p>
                          <p>
                            Reco by{" "}
                            <Link
                              href={`/u/${encodeURIComponent(usernameParam ?? "")}`}
                              className="font-medium text-primary hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              @{nickname ?? "user"}
                            </Link>
                          </p>
                        </div>
                        {a.comment ? (
                          <div className="rounded-2xl border border-border bg-accent/40 px-3 py-2">
                            <ExpandableText
                              text={a.comment}
                              maxChars={160}
                              variant="compact-card"
                              toggleAriaLabel="Toggle comment expansion"
                            />
                          </div>
                        ) : null}
                        {a.spotify_track_id ? (
                          <div
                            className="pt-1"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                          >
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setExpandedPlayAnswerId((prev) => (prev === a.id ? null : a.id));
                              }}
                            >
                              <Play className="h-4 w-4" />
                              {expandedPlayAnswerId === a.id ? "Hide" : "Play"}
                            </Button>
                          </div>
                        ) : null}
                        {expandedPlayAnswerId === a.id && a.spotify_track_id ? (
                          <div
                            className="overflow-hidden rounded-xl border border-border"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <iframe
                              className="w-full"
                              src={`https://open.spotify.com/embed/track/${a.spotify_track_id}`}
                              width="100%"
                              height="80"
                              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                              loading="lazy"
                              title={`Play ${a.trackName}`}
                            />
                          </div>
                        ) : null}
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
