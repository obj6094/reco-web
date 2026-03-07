"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { EmptyState } from "@/components/EmptyState";
import { ArrowRight, LogOut, MessageCircle, Star, Trophy, User } from "lucide-react";

type MySubmission = {
  id: string;
  challenge_id: string;
  trackName: string;
  artistName: string;
  albumImage: string | null;
  comment: string | null;
  created_at: string;
  voteCount: number;
};

type MyAnswer = {
  id: string;
  request_id: string;
  trackName: string;
  artistName: string;
  albumImage: string | null;
  comment: string | null;
  created_at: string;
};

export default function ProfilePage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [nickname, setNickname] = useState<string>("");
  const [authChecked, setAuthChecked] = useState(false);

  const [recoScore, setRecoScore] = useState<number | null>(null);
  const [submissions, setSubmissions] = useState<MySubmission[]>([]);
  const [answers, setAnswers] = useState<MyAnswer[]>([]);

  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function boot() {
      // Profile is only for the logged-in user, check session first
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      setUserId(user?.id ?? null);
      setAuthChecked(true);

      if (!user?.id) {
        // Protected page: redirect to /login if not signed in
        router.replace("/login");
        setLoading(false);
        return;
      }

      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .maybeSingle();

      if (!existingProfile?.username) {
        router.replace("/setup-account");
        setLoading(false);
        return;
      }

      await loadProfile(user.id);
    }

    async function loadProfile(uid: string) {
      setLoading(true);
      setStatus("");

      // My challenge submissions + votes
      const { data: subRows, error: subError } = await supabase
        .from("challenge_submissions")
        .select(
          "id, challenge_id, spotify_track_name, spotify_artist_name, spotify_album_image_url, comment, created_at, challenge_votes(id)"
        )
        .eq("user_id", uid)
        .order("created_at", { ascending: false });

      if (subError) {
        setStatus("Failed to load your challenge submissions: " + subError.message);
      }

      const mappedSubs: MySubmission[] =
        subRows?.map((row: any) => ({
          id: row.id,
          challenge_id: row.challenge_id,
          trackName: row.spotify_track_name,
          artistName: row.spotify_artist_name,
          albumImage: row.spotify_album_image_url,
          comment: row.comment,
          created_at: row.created_at,
          voteCount: (row.challenge_votes ?? []).length,
        })) ?? [];

      setSubmissions(mappedSubs);

      // My QnA answers
      const { data: ansRows, error: ansError } = await supabase
        .from("qna_answers")
        .select("id, request_id, spotify_track_name, spotify_artist_name, spotify_album_image_url, comment, created_at")
        .eq("responder_id", uid)
        .order("created_at", { ascending: false });

      if (ansError) {
        setStatus("Failed to load your QnA answers: " + ansError.message);
      }

      const mappedAns: MyAnswer[] =
        ansRows?.map((row: any) => ({
          id: row.id,
          request_id: row.request_id,
          trackName: row.spotify_track_name,
          artistName: row.spotify_artist_name,
          albumImage: row.spotify_album_image_url,
          comment: row.comment,
          created_at: row.created_at,
        })) ?? [];

      setAnswers(mappedAns);

      // Calculate Reco Score
      let bestRecoCount = 0;
      let voteCountTotal = 0;

      if (mappedAns.length) {
        const answerIds = mappedAns.map((a) => a.id);
        const { data: bestReqRows, error: bestReqError } = await supabase
          .from("qna_requests")
          .select("best_answer_id")
          .in("best_answer_id", answerIds);

        if (bestReqError) {
          setStatus("Failed to load Best Reco data: " + bestReqError.message);
        } else {
          const bestAnswerIds = new Set(
            (bestReqRows ?? [])
              .map((r: any) => r.best_answer_id)
              .filter((id: string | null) => !!id)
          );
          bestRecoCount = bestAnswerIds.size;
        }
      }

      if (mappedSubs.length) {
        const submissionIds = mappedSubs.map((s) => s.id);
        const { count, error: voteError } = await supabase
          .from("challenge_votes")
          .select("id", { count: "exact", head: true })
          .in("submission_id", submissionIds);

        if (voteError) {
          setStatus("Failed to load vote counts on your submissions: " + voteError.message);
        } else {
          voteCountTotal = count ?? 0;
        }
      }

      setRecoScore(bestRecoCount + voteCountTotal);

      // Load basic profile info (username, nickname) for settings
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("username, nickname")
        .eq("id", uid)
        .maybeSingle();

      if (!profileError && profile) {
        setUsername(profile.username ?? null);
        setNickname(profile.nickname ?? profile.username ?? "");
      }
      setLoading(false);
    }

    boot();
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (!authChecked) {
    return (
      <main className="min-h-[calc(100vh-56px)] bg-background px-4 py-16 text-foreground">
        <div className="mx-auto max-w-md">
          <Card>
            <CardHeader>
              <CardTitle>Loading</CardTitle>
              <CardDescription>Checking your session…</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </main>
    );
  }

  if (!userId) {
    return (
      <main className="min-h-[calc(100vh-56px)] bg-background px-4 py-16 text-foreground">
        <div className="mx-auto max-w-md">
          <Card>
            <CardHeader>
              <CardTitle>Redirecting</CardTitle>
              <CardDescription>Sending you to the login page…</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-56px)] bg-background px-4 py-10 text-foreground">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-extrabold tracking-tight">Profile</h1>
          <p className="text-sm text-muted-foreground">
            Manage your profile and see your Reco Score.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  Account
                </CardTitle>
                <CardDescription>Your profile. Nickname is your display name.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Nickname</label>
                  <p className="text-lg font-semibold">{getDisplayName(nickname, username)}</p>
                  <p className="text-xs text-muted-foreground">{`@${getDisplayName(nickname, username)}`}</p>
                </div>
                <div className="space-y-2">
                  <Button type="button" variant="outline" size="sm" asChild>
                    <Link href="/profile/nickname">Change nickname</Link>
                  </Button>
                  <Button type="button" variant="outline" size="sm" asChild>
                    <Link href="/profile/password">Change password</Link>
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Your login ID stays the same even if you change your nickname.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={handleLogout}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.03 }}
            className="md:col-span-2"
          >
            <Card className="h-full border-primary/40 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-primary" />
                  Reco Score
                </CardTitle>
                <CardDescription>
                    Reco Score = (# times your answers were chosen as best) + (total votes on your challenge submissions)
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-end justify-between gap-4">
                <div className="text-4xl font-extrabold tracking-tight text-primary">
                  {recoScore ?? (loading ? "…" : "0")}
                </div>
                <Button variant="outline" asChild>
                  <Link href="/challenge">
                    Go to Challenge <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-primary" />
                My challenge submissions
              </CardTitle>
              <Badge variant="secondary">{submissions.length}</Badge>
            </div>
            <CardDescription>Your challenge entries and votes received.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading && !submissions.length ? (
              <div className="text-sm text-muted-foreground">Loading…</div>
            ) : submissions.length === 0 ? (
              <EmptyState
                icon={Trophy}
                title="No submissions yet"
                description="Join this week's challenge and submit your first Reco."
              />
            ) : (
              <motion.div
                initial="hidden"
                animate="show"
                variants={{
                  hidden: { opacity: 0, y: 10 },
                  show: { opacity: 1, y: 0, transition: { staggerChildren: 0.05 } },
                }}
                className="grid gap-3 md:grid-cols-2"
              >
                {submissions.map((s) => (
                  <motion.div
                    key={s.id}
                    variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
                    whileHover={{ scale: 1.01 }}
                    transition={{ duration: 0.15 }}
                  >
                    <Card>
                      <CardContent className="flex items-start justify-between gap-4 p-5">
                        <div className="min-w-0 space-y-1">
                          <div className="truncate text-sm font-semibold">{s.trackName}</div>
                          <div className="truncate text-xs text-muted-foreground">{s.artistName}</div>
                          {s.comment ? (
                            <div className="text-sm text-foreground/90">“{s.comment}”</div>
                          ) : null}
                          <div className="text-xs text-muted-foreground">
                            {new Date(s.created_at).toLocaleString()}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground">Votes</div>
                          <div className="text-xl font-extrabold text-primary">{s.voteCount}</div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-primary" />
                My QnA answers
              </CardTitle>
              <Badge variant="secondary">{answers.length}</Badge>
            </div>
            <CardDescription>Your QnA answers.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading && !answers.length ? (
              <div className="text-sm text-muted-foreground">Loading…</div>
            ) : answers.length === 0 ? (
              <EmptyState
                icon={MessageCircle}
                title="No answers yet"
                description="Answer a request and your Recos will appear here."
              />
            ) : (
              <motion.div
                initial="hidden"
                animate="show"
                variants={{
                  hidden: { opacity: 0, y: 10 },
                  show: { opacity: 1, y: 0, transition: { staggerChildren: 0.05 } },
                }}
                className="grid gap-3 md:grid-cols-2"
              >
                {answers.map((a) => (
                  <motion.div
                    key={a.id}
                    variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
                    whileHover={{ scale: 1.01 }}
                    transition={{ duration: 0.15 }}
                  >
                    <Card>
                      <CardContent className="flex items-start justify-between gap-4 p-5">
                        <div className="min-w-0 space-y-1">
                          <div className="truncate text-sm font-semibold">{a.trackName}</div>
                          <div className="truncate text-xs text-muted-foreground">{a.artistName}</div>
                          {a.comment ? (
                            <div className="text-sm text-foreground/90">“{a.comment}”</div>
                          ) : null}
                          <div className="text-xs text-muted-foreground">
                            {new Date(a.created_at).toLocaleString()}
                          </div>
                        </div>
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/requests/${a.request_id}`}>
                            View <ArrowRight className="h-4 w-4" />
                          </Link>
                        </Button>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </motion.div>
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

