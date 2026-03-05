"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { EmptyState } from "@/components/EmptyState";
import { ArrowLeft, ArrowRight, Crown, Lock, Search, Sparkles, Tag } from "lucide-react";

type RequestDetail = {
  id: string;
  prompt: string;
  requester_id: string;
  created_at: string;
  best_answer_id: string | null;
};

type Claim = {
  id: string;
  claimer_id: string;
};

type Track = {
  id: string;
  name: string;
  artists: string;
  albumImage: string | null;
};

type Answer = {
  id: string;
  responder_id: string;
  trackName: string;
  artistName: string;
  albumImage: string | null;
  comment: string | null;
  created_at: string;
};

export default function RequestDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const requestId = params?.id as string;

  const [userId, setUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [request, setRequest] = useState<RequestDetail | null>(null);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");

  const [claiming, setClaiming] = useState(false);

  // Answer submission state
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [selected, setSelected] = useState<Track | null>(null);
  const [comment, setComment] = useState("");
  const [submittingAnswer, setSubmittingAnswer] = useState(false);

  const loadAll = useCallback(async () => {
    if (!requestId) return;
      setLoading(true);
      setStatus("");

      const { data: reqData, error: reqError } = await supabase
        .from("qna_requests")
        .select("id, prompt, requester_id, created_at, best_answer_id")
        .eq("id", requestId)
        .single();

      if (reqError || !reqData) {
        setStatus("Failed to load request: " + (reqError?.message ?? "Not found"));
        setRequest(null);
        setClaims([]);
        setAnswers([]);
        setLoading(false);
        return;
      }

      setRequest({
        id: reqData.id,
        prompt: reqData.prompt,
        requester_id: reqData.requester_id,
        created_at: reqData.created_at,
        best_answer_id: reqData.best_answer_id ?? null,
      });

      const { data: claimsData } = await supabase
        .from("qna_claims")
        .select("id, claimer_id")
        .eq("request_id", requestId);
      setClaims(
        (claimsData ?? []).map((c: any) => ({ id: c.id, claimer_id: c.claimer_id }))
      );

      const { data: answersData } = await supabase
        .from("qna_answers")
        .select("id, responder_id, spotify_track_name, spotify_artist_name, spotify_album_image_url, comment, created_at")
        .eq("request_id", requestId)
        .order("created_at", { ascending: false });
      setAnswers(
        (answersData ?? []).map((a: any) => ({
          id: a.id,
          responder_id: a.responder_id,
          trackName: a.spotify_track_name,
          artistName: a.spotify_artist_name,
          albumImage: a.spotify_album_image_url,
          comment: a.comment,
          created_at: a.created_at,
        }))
      );

      setLoading(false);
  }, [requestId]);

  useEffect(() => {
    async function boot() {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id ?? null;
      setUserId(uid);
      setAuthChecked(true);
      if (!uid) {
        router.replace("/login");
        return;
      }
      if (!requestId) return;
      await loadAll();
    }
    boot();
  }, [requestId, router, loadAll]);

  const claimsCount = claims.length;
  const alreadyClaimed = useMemo(
    () => !!userId && claims.some((c) => c.claimer_id === userId),
    [claims, userId]
  );
  const canClaim =
    !!userId &&
    !!request &&
    !alreadyClaimed &&
    claimsCount < 3 &&
    userId !== request.requester_id;

  async function handleClaim() {
    setStatus("");
    if (!userId || !request) {
      setStatus("You must be logged in to claim.");
      return;
    }
    if (!canClaim) {
      setStatus("You can no longer claim this request.");
      return;
    }

    setClaiming(true);
    const { error } = await supabase.from("qna_claims").insert({
      request_id: request.id,
      claimer_id: userId,
    });

    if (error) {
      setStatus("Failed to claim: " + error.message);
      setClaiming(false);
      return;
    }

    setClaiming(false);
    await loadAll();
  }

  async function searchTracks() {
    setStatus("");
    if (!query.trim()) return;
    setSearching(true);
    setTracks([]);
    setSelected(null);

    try {
      // Spotify 검색은 기존 /api 라우트 사용 (env 키는 라우트 내부에서만 사용)
      const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setTracks(data.tracks ?? []);
      if (!data.tracks?.length) setStatus("No results found.");
    } catch (e: any) {
      setStatus("Search error: " + e.message);
    } finally {
      setSearching(false);
    }
  }

  async function handleSubmitAnswer(e: FormEvent) {
    e.preventDefault();
    setStatus("");

    if (!userId || !request) {
      setStatus("You must be logged in to answer.");
      return;
    }
    if (!alreadyClaimed) {
      // 서버 RLS 로도 제한되겠지만, 클라이언트에서 한 번 더 막아준다
      setStatus("You must claim this request before answering.");
      return;
    }
    if (!selected) {
      setStatus("Please select a track first.");
      return;
    }

    setSubmittingAnswer(true);

    const { error } = await supabase.from("qna_answers").insert({
      request_id: request.id,
      responder_id: userId,
      spotify_track_id: selected.id,
      spotify_track_name: selected.name,
      spotify_artist_name: selected.artists,
      spotify_album_image_url: selected.albumImage,
      comment: comment || null,
    });

    if (error) {
      setStatus("Failed to save answer: " + error.message);
      setSubmittingAnswer(false);
      return;
    }

    setSubmittingAnswer(false);
    setComment("");
    setSelected(null);
    setQuery("");
    setTracks([]);

    await loadAll();
  }

  async function markBest(answerId: string) {
    setStatus("");

    if (!userId || !request) return;
    if (userId !== request.requester_id) {
      // 요청자만 베스트 Reco 를 지정할 수 있다
      setStatus("Only the requester can choose Best Reco.");
      return;
    }

    const { error } = await supabase
      .from("qna_requests")
      .update({ best_answer_id: answerId })
      .eq("id", request.id);

    if (error) {
      setStatus("Failed to set Best Reco: " + error.message);
      return;
    }

    await loadAll();
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
      <div className="mx-auto max-w-3xl space-y-6">
        <Button variant="ghost" asChild className="px-0">
          <Link href="/requests">
            <ArrowLeft className="h-4 w-4" />
            Back to requests
          </Link>
        </Button>

        <Card>
          <CardHeader>
            {loading && !request ? (
              <>
                <CardTitle>Loading</CardTitle>
                <CardDescription>Loading request…</CardDescription>
              </>
            ) : !request ? (
              <>
                <CardTitle>Not found</CardTitle>
                <CardDescription>Request not found.</CardDescription>
              </>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      QnA request
                    </CardTitle>
                    <CardDescription className="text-base text-foreground/90">
                      {request.prompt}
                    </CardDescription>
                    <div className="text-xs text-muted-foreground">
                      {new Date(request.created_at).toLocaleString()}
                    </div>
                  </div>
                  <Badge variant="secondary" className="mt-1">
                    Claims {claimsCount}/3
                  </Badge>
                </div>
              </>
            )}
          </CardHeader>

          {request ? (
            <CardContent className="flex flex-wrap items-center gap-2">
              {canClaim ? (
                <Button onClick={handleClaim} disabled={claiming}>
                  <Tag className="h-4 w-4" />
                  {claiming ? "Claiming..." : "Claim this request"}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ) : alreadyClaimed ? (
                <Badge variant="success">You claimed this request</Badge>
              ) : (
                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Lock className="mt-0.5 h-4 w-4" />
                  This request can no longer be claimed.
                </div>
              )}
            </CardContent>
          ) : null}
        </Card>

        {/* Answer submission */}
        {request && alreadyClaimed ? (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
            <Card>
              <CardHeader>
                <CardTitle>Leave your Reco</CardTitle>
                <CardDescription>
                  Pick a track that fits this request and add a short comment.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search a song"
                  />
                  <Button onClick={searchTracks} disabled={searching || !query.trim()}>
                    <Search className="h-4 w-4" />
                    {searching ? "Searching..." : "Search"}
                  </Button>
                </div>

                {tracks.length ? (
                  <motion.div
                    initial="hidden"
                    animate="show"
                    variants={{
                      hidden: { opacity: 0, y: 8 },
                      show: { opacity: 1, y: 0, transition: { staggerChildren: 0.04 } },
                    }}
                    className="grid gap-2"
                  >
                    {tracks.map((t) => (
                      <motion.button
                        key={t.id}
                        variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => setSelected(t)}
                        className={`text-left rounded-2xl border px-4 py-3 transition-colors ${
                          selected?.id === t.id
                            ? "border-primary bg-primary/10"
                            : "border-border bg-accent/30 hover:bg-accent/50"
                        }`}
                      >
                        <div className="text-sm font-semibold">{t.name}</div>
                        <div className="text-xs text-muted-foreground">{t.artists}</div>
                      </motion.button>
                    ))}
                  </motion.div>
                ) : null}

                {selected ? (
                  <form onSubmit={handleSubmitAnswer} className="space-y-3">
                    <div className="rounded-2xl border border-border bg-accent/30 px-4 py-3">
                      <div className="text-xs text-muted-foreground">Selected</div>
                      <div className="text-sm font-semibold">
                        {selected.name} — {selected.artists}
                      </div>
                    </div>
                    <Textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="One line: why this song?"
                    />
                    <Button type="submit" disabled={submittingAnswer}>
                      {submittingAnswer ? "Submitting..." : "Submit answer"}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </form>
                ) : null}
              </CardContent>
            </Card>
          </motion.div>
        ) : null}

        {/* Answers list */}
        {request ? (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>Answers</CardTitle>
                <Badge variant="secondary">{answers.length}</Badge>
              </div>
              <CardDescription>
                The requester can choose one answer as Best Reco.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!answers.length ? (
                <EmptyState
                  icon={Search}
                  title="No answers yet"
                  description="No answers yet for this request."
                />
              ) : (
                <motion.div
                  initial="hidden"
                  animate="show"
                  variants={{
                    hidden: { opacity: 0, y: 10 },
                    show: { opacity: 1, y: 0, transition: { staggerChildren: 0.05 } },
                  }}
                  className="grid gap-3"
                >
                  {answers.map((ans) => {
                    const isBest = request.best_answer_id === ans.id;
                    const isMine = ans.responder_id === userId;
                    return (
                      <motion.div
                        key={ans.id}
                        variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
                        whileHover={{ scale: 1.01 }}
                        transition={{ duration: 0.15 }}
                      >
                        <Card className={isBest ? "border-primary/70 bg-primary/5" : ""}>
                          <CardContent className="flex items-start justify-between gap-4 p-5">
                            <div className="min-w-0 space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="truncate text-sm font-semibold">{ans.trackName}</div>
                                {isBest ? (
                                  <Badge className="gap-1">
                                    <Crown className="h-3.5 w-3.5" />
                                    Best Reco
                                  </Badge>
                                ) : null}
                                {isMine && !isBest ? (
                                  <Badge variant="secondary">My answer</Badge>
                                ) : null}
                              </div>
                              <div className="truncate text-xs text-muted-foreground">{ans.artistName}</div>
                              {ans.comment ? (
                                <div className="text-sm text-foreground/90">“{ans.comment}”</div>
                              ) : null}
                              <div className="text-xs text-muted-foreground">
                                {new Date(ans.created_at).toLocaleString()}
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-2">
                              {userId === request.requester_id && !isBest ? (
                                <Button variant="outline" size="sm" onClick={() => markBest(ans.id)}>
                                  <Crown className="h-4 w-4" />
                                  Mark Best
                                </Button>
                              ) : null}
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </motion.div>
              )}
            </CardContent>
          </Card>
        ) : null}

        {status ? (
          <div className="rounded-2xl border border-border bg-accent px-4 py-3 text-sm">
            {status}
          </div>
        ) : null}
      </div>
    </main>
  );
}

