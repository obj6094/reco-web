"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getDisplayName } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Bell } from "lucide-react";
import { cn, formatDateTime } from "@/lib/utils";

type Notification = {
  id: string;
  type: "challenge_vote" | "nice_reco" | "answer_selected" | "request_answered";
  read_at: string | null;
  created_at: string;
  ref_submission_id: string | null;
  ref_answer_id: string | null;
  ref_request_id: string | null;
  ref_voter_id: string | null;
  ref_rater_id: string | null;
  ref_requester_id: string | null;
  // Enriched
  actorName?: string;
  prompt?: string;
  trackName?: string;
  artistName?: string;
};

export default function NotificationsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Notification[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    async function boot() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) {
        router.replace("/login");
        return;
      }
      setUserId(user.id);

      const { data: rows, error } = await supabase
        .from("notifications")
        .select("id, type, read_at, created_at, ref_submission_id, ref_answer_id, ref_request_id, ref_voter_id, ref_rater_id, ref_requester_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        setLoading(false);
        return;
      }

      const notifs = (rows ?? []) as Notification[];
      const voterIds = [...new Set(notifs.flatMap((n) => [n.ref_voter_id, n.ref_rater_id, n.ref_requester_id]).filter(Boolean))] as string[];
      const profileMap: Record<string, string> = {};
      if (voterIds.length) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, nickname, username")
          .in("id", voterIds);
        (profiles ?? []).forEach((p: any) => {
          profileMap[p.id] = getDisplayName(p.nickname, p.username);
        });
      }

      const requestIds = [...new Set(notifs.map((n) => n.ref_request_id).filter(Boolean))] as string[];
      const promptMap: Record<string, string> = {};
      if (requestIds.length) {
        const { data: reqs } = await supabase
          .from("qna_requests")
          .select("id, prompt")
          .in("id", requestIds);
        (reqs ?? []).forEach((r: any) => {
          promptMap[r.id] = r.prompt ?? "";
        });
      }

      const answerIds = [...new Set(notifs.map((n) => n.ref_answer_id).filter(Boolean))] as string[];
      const trackMap: Record<string, { trackName: string; artistName: string }> = {};
      if (answerIds.length) {
        const { data: ans } = await supabase
          .from("qna_answers")
          .select("id, spotify_track_name, spotify_artist_name")
          .in("id", answerIds);
        (ans ?? []).forEach((a: any) => {
          trackMap[a.id] = {
            trackName: a.spotify_track_name ?? "Unknown",
            artistName: a.spotify_artist_name ?? "Unknown",
          };
        });
      }

      const subIds = [...new Set(notifs.map((n) => n.ref_submission_id).filter(Boolean))] as string[];
      const subTrackMap: Record<string, { trackName: string; artistName: string }> = {};
      if (subIds.length) {
        const { data: subs } = await supabase
          .from("challenge_submissions")
          .select("id, spotify_track_name, spotify_artist_name")
          .in("id", subIds);
        (subs ?? []).forEach((s: any) => {
          subTrackMap[s.id] = {
            trackName: s.spotify_track_name ?? "Unknown",
            artistName: s.spotify_artist_name ?? "Unknown",
          };
        });
      }

      const enriched = notifs.map((n) => {
        const actorId = n.ref_voter_id ?? n.ref_rater_id ?? n.ref_requester_id;
        const actorName = actorId ? profileMap[actorId] : undefined;
        const prompt = n.ref_request_id ? promptMap[n.ref_request_id] : undefined;
        const track = n.ref_answer_id ? trackMap[n.ref_answer_id] : n.ref_submission_id ? subTrackMap[n.ref_submission_id] : undefined;
        return {
          ...n,
          actorName,
          prompt,
          trackName: track?.trackName,
          artistName: track?.artistName,
        };
      });

      setItems(enriched);

      // Mark all as read when user opens the page
      await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .is("read_at", null);

      setLoading(false);
    }
    boot();
  }, [router]);

  if (!userId && !loading) return null;

  return (
    <main className="min-h-[calc(100dvh-120px)] bg-background px-3 py-6 text-foreground sm:px-4 sm:py-8 md:py-10">
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <Button variant="ghost" asChild className="px-0">
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              Notifications
            </CardTitle>
            <CardDescription>Your recent activity alerts.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading…</div>
            ) : items.length === 0 ? (
              <div className="text-sm text-muted-foreground">No notifications yet.</div>
            ) : (
              <ul className="space-y-2">
                {items.map((n) => {
                  const href = n.ref_request_id ? `/requests/${n.ref_request_id}` : n.ref_submission_id ? "/challenge" : "#";
                  const label = (() => {
                    switch (n.type) {
                      case "challenge_vote":
                        return n.actorName
                          ? `@${n.actorName} voted for your challenge submission${n.trackName ? ` "${n.trackName}"` : ""}`
                          : "Someone voted for your challenge submission";
                      case "nice_reco":
                        return n.actorName
                          ? `@${n.actorName} gave Nice Reco to your answer${n.trackName ? ` "${n.trackName}"` : ""}`
                          : "Someone gave Nice Reco to your answer";
                      case "answer_selected":
                        return n.actorName
                          ? `Your answer${n.trackName ? ` "${n.trackName}"` : ""} was selected as Best Reco`
                          : "Your answer was selected as Best Reco";
                      case "request_answered":
                        return n.actorName
                          ? `@${n.actorName} answered your request${n.prompt ? `: "${n.prompt.slice(0, 40)}${n.prompt.length > 40 ? "…" : ""}"` : ""}`
                          : "Someone answered your request";
                      default:
                        return "New notification";
                    }
                  })();
                  return (
                    <li key={n.id}>
                      <Link
                        href={href}
                        className={cn(
                          "block rounded-xl border px-3 py-3 transition-colors hover:bg-accent/30",
                          !n.read_at ? "border-primary/50 bg-primary/5" : "border-border/80 bg-muted/20"
                        )}
                      >
                        <div className="text-sm font-medium">{label}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {formatDateTime(n.created_at)}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
