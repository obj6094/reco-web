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
import { ArrowRight, LogOut, Pencil, Star, Trophy, User } from "lucide-react";

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

export default function ProfilePage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [nickname, setNickname] = useState<string>("");
  const [authChecked, setAuthChecked] = useState(false);

  const [recoScore, setRecoScore] = useState<number | null>(null);
  const [submissions, setSubmissions] = useState<MySubmission[]>([]);

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

      // Calculate Reco Score
      let bestRecoCount = 0;
      let voteCountTotal = 0;

      const { data: answerRows, error: answerRowsError } = await supabase
        .from("qna_answers")
        .select("id")
        .eq("responder_id", uid);
      if (answerRowsError) {
        setStatus("Failed to load your QnA data: " + answerRowsError.message);
      }
      const answerIds = (answerRows ?? []).map((a: any) => a.id);
      if (answerIds.length) {
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
    <main className="min-h-[calc(100dvh-120px)] bg-background px-3 py-6 text-foreground sm:px-4 sm:py-8 md:py-10">
      <div className="mx-auto w-full max-w-5xl space-y-5 sm:space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-extrabold tracking-tight">Profile</h1>
          <p className="text-sm text-muted-foreground">
            Manage your profile and see your Reco Score.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-semibold">{getDisplayName(nickname, username)}</p>
                    <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                      <Link href="/profile/nickname" aria-label="Change nickname">
                        <Pencil className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">{`@${getDisplayName(nickname, username)}`}</p>
                </div>
                <div className="space-y-2">
                  <Button type="button" variant="outline" size="sm" asChild>
                    <Link href="/profile/username">Change login ID</Link>
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
              <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
                <div className="text-4xl font-extrabold tracking-tight text-primary">
                  {recoScore ?? (loading ? "…" : "0")}
                </div>
                <Button variant="outline" asChild className="min-h-[44px]">
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
                My challenge history
              </CardTitle>
              <Badge variant="secondary">{submissions.length}</Badge>
            </div>
            <CardDescription>Open your full challenge records in a dedicated page.</CardDescription>
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
              <Button variant="outline" asChild>
                <Link href="/profile/challenges">
                  Open my challenge history <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
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

