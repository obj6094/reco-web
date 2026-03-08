"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { EmptyState } from "@/components/EmptyState";
import { ArrowRight, MessageCirclePlus, Send, Inbox, CheckCircle, Music2, Play } from "lucide-react";

type QueueRequest = {
  id: string;
  prompt: string;
  created_at: string;
  answersCount: number;
};

type MyRequest = {
  id: string;
  prompt: string;
  created_at: string;
  answersCount: number;
  best_answer_id: string | null;
};

type MyAnswerEntry = {
  request_id: string;
  prompt: string;
  created_at: string;
  trackName: string;
  artistName: string;
  mode: "answer" | "nice_reco";
};

type PublicBestReco = {
  id: string;
  prompt: string;
  created_at: string;
  trackId: string;
  trackName: string;
  artistName: string;
  albumImage: string | null;
  comment: string | null;
};

export default function RequestsPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [prompt, setPrompt] = useState("");
  const [creating, setCreating] = useState(false);

  const [queueForYou, setQueueForYou] = useState<QueueRequest[]>([]);
  const [myRequests, setMyRequests] = useState<MyRequest[]>([]);
  const [myAnswers, setMyAnswers] = useState<MyAnswerEntry[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [loadingMine, setLoadingMine] = useState(false);
  const [publicBestRecos, setPublicBestRecos] = useState<PublicBestReco[]>([]);
  const [loadingPublicBestRecos, setLoadingPublicBestRecos] = useState(false);
  const [expandedPublicBestRecoId, setExpandedPublicBestRecoId] = useState<string | null>(null);
  const [myRequestFilter, setMyRequestFilter] = useState<"all" | "pending" | "selected">("all");
  const [status, setStatus] = useState("");

  const loadQueue = useCallback(async (uid: string) => {
    setLoadingQueue(true);
    setStatus("");
    const { data: answeredRows } = await supabase
      .from("qna_answers")
      .select("request_id")
      .eq("responder_id", uid);
    const answeredIds = new Set((answeredRows ?? []).map((r: any) => r.request_id));
    const { data: myRatings } = await supabase
      .from("qna_ratings")
      .select("answer_id")
      .eq("rater_id", uid)
      .eq("score", 1);
    const ratedAnswerIds = (myRatings ?? []).map((r: any) => r.answer_id).filter(Boolean);
    const niceRecoHandledRequestIds = new Set<string>();
    if (ratedAnswerIds.length) {
      const { data: ratedAnswers } = await supabase
        .from("qna_answers")
        .select("id, request_id")
        .in("id", ratedAnswerIds);
      (ratedAnswers ?? []).forEach((row: any) => {
        if (row.request_id) niceRecoHandledRequestIds.add(row.request_id);
      });
    }
    const { data: reqData, error } = await supabase
      .from("qna_requests")
      .select("id, prompt, created_at")
      .is("best_answer_id", null)
      .neq("requester_id", uid)
      .order("created_at", { ascending: true })
      .limit(50);
    if (error) {
      setStatus("Failed to load requests: " + error.message);
      setLoadingQueue(false);
      return;
    }
    const reqs = reqData ?? [];
    const unanswered = reqs.filter(
      (r: any) => !answeredIds.has(r.id) && !niceRecoHandledRequestIds.has(r.id)
    );
    const ids = unanswered.slice(0, 3).map((r: any) => r.id);
    let countByRequest: Record<string, number> = {};
    if (ids.length > 0) {
      const { data: ansData } = await supabase
        .from("qna_answers")
        .select("request_id")
        .in("request_id", ids);
      (ansData ?? []).forEach((r: any) => {
        countByRequest[r.request_id] = (countByRequest[r.request_id] ?? 0) + 1;
      });
    }
    const filtered = unanswered.slice(0, 3).map((r: any) => ({
      id: r.id,
      prompt: r.prompt,
      created_at: r.created_at,
      answersCount: countByRequest[r.id] ?? 0,
    }));
    setQueueForYou(filtered);
    setLoadingQueue(false);
  }, []);

  const loadMyRequests = useCallback(async (uid: string) => {
    const { data: reqData, error } = await supabase
      .from("qna_requests")
      .select("id, prompt, created_at, best_answer_id")
      .eq("requester_id", uid)
      .order("created_at", { ascending: false });
    if (error) {
      setStatus("Failed to load my requests: " + error.message);
      return;
    }
    const reqs = reqData ?? [];
    const ids = reqs.map((r: any) => r.id);
    let countByRequest: Record<string, number> = {};
    if (ids.length > 0) {
      const { data: ansData } = await supabase
        .from("qna_answers")
        .select("request_id")
        .in("request_id", ids);
      (ansData ?? []).forEach((r: any) => {
        countByRequest[r.request_id] = (countByRequest[r.request_id] ?? 0) + 1;
      });
    }
    setMyRequests(
      reqs.map((row: any) => ({
        id: row.id,
        prompt: row.prompt,
        created_at: row.created_at,
        answersCount: countByRequest[row.id] ?? 0,
        best_answer_id: row.best_answer_id ?? null,
      }))
    );
  }, []);

  const loadMyAnswers = useCallback(async (uid: string) => {
    const { data: ansRows, error: ansError } = await supabase
      .from("qna_answers")
      .select("request_id, created_at, spotify_track_name, spotify_artist_name")
      .eq("responder_id", uid)
      .order("created_at", { ascending: false });

    const { data: ratingRows } = await supabase
      .from("qna_ratings")
      .select("answer_id, created_at")
      .eq("rater_id", uid)
      .eq("score", 1)
      .order("created_at", { ascending: false });

    const ratedAnswerIds = [...new Set((ratingRows ?? []).map((r: any) => r.answer_id).filter(Boolean))] as string[];
    let ratedAnswerMap: Record<string, { request_id: string; trackName: string; artistName: string }> = {};
    if (ratedAnswerIds.length) {
      const { data: ratedAnswers } = await supabase
        .from("qna_answers")
        .select("id, request_id, spotify_track_name, spotify_artist_name")
        .in("id", ratedAnswerIds);
      (ratedAnswers ?? []).forEach((row: any) => {
        ratedAnswerMap[row.id as string] = {
          request_id: row.request_id,
          trackName: row.spotify_track_name ?? "Unknown track",
          artistName: row.spotify_artist_name ?? "Unknown artist",
        };
      });
    }

    const mergedRows: MyAnswerEntry[] = [];
    (ansRows ?? []).forEach((row: any) => {
      mergedRows.push({
        request_id: row.request_id,
        prompt: "",
        created_at: row.created_at,
        trackName: row.spotify_track_name ?? "Unknown track",
        artistName: row.spotify_artist_name ?? "Unknown artist",
        mode: "answer",
      });
    });
    (ratingRows ?? []).forEach((row: any) => {
      const rated = ratedAnswerMap[row.answer_id];
      if (!rated) return;
      mergedRows.push({
        request_id: rated.request_id,
        prompt: "",
        created_at: row.created_at,
        trackName: rated.trackName,
        artistName: rated.artistName,
        mode: "nice_reco",
      });
    });

    if (!mergedRows.length || ansError) {
      setMyAnswers([]);
      return;
    }

    const reqIds = [...new Set(mergedRows.map((r) => r.request_id))];
    const { data: reqData } = await supabase
      .from("qna_requests")
      .select("id, prompt, created_at")
      .in("id", reqIds);
    const byId: Record<string, { prompt: string; created_at: string }> = {};
    (reqData ?? []).forEach((r: any) => {
      byId[r.id] = { prompt: r.prompt, created_at: r.created_at };
    });
    const seen = new Set<string>();
    setMyAnswers(
      mergedRows
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .filter((row) => {
          if (seen.has(row.request_id)) return false;
          seen.add(row.request_id);
          return true;
        })
        .map((row) => ({
          request_id: row.request_id,
          prompt: byId[row.request_id]?.prompt ?? "",
          created_at: row.created_at,
          trackName: row.trackName,
          artistName: row.artistName,
          mode: row.mode,
        }))
    );
  }, []);

  const loadPublicBestRecos = useCallback(async () => {
    setLoadingPublicBestRecos(true);

    const { data: reqs, error: reqError } = await supabase
      .from("qna_requests")
      .select("id, prompt, best_answer_id, created_at")
      .not("best_answer_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(10);

    if (reqError) {
      setPublicBestRecos([]);
      setLoadingPublicBestRecos(false);
      return;
    }

    const answerIds = (reqs ?? [])
      .map((r: any) => r.best_answer_id)
      .filter((id: string | null) => !!id);

    if (!answerIds.length) {
      setPublicBestRecos([]);
      setLoadingPublicBestRecos(false);
      return;
    }

    const { data: answers, error: ansError } = await supabase
      .from("qna_answers")
      .select("id, spotify_track_id, spotify_track_name, spotify_artist_name, spotify_album_image_url, comment")
      .in("id", answerIds);

    if (ansError) {
      setPublicBestRecos([]);
      setLoadingPublicBestRecos(false);
      return;
    }

    const answerById: Record<string, any> = {};
    for (const a of answers ?? []) {
      answerById[a.id as string] = a;
    }

    const merged: PublicBestReco[] =
      reqs?.map((r: any) => {
        const a = answerById[r.best_answer_id as string];
        if (!a) return null;
        return {
          id: r.id as string,
          prompt: r.prompt as string,
          created_at: r.created_at as string,
          trackId: a.spotify_track_id as string,
          trackName: a.spotify_track_name as string,
          artistName: a.spotify_artist_name as string,
          albumImage: (a.spotify_album_image_url as string) ?? null,
          comment: (a.comment as string | null) ?? null,
        };
      }).filter(Boolean) as PublicBestReco[] ?? [];

    setPublicBestRecos(merged);
    setLoadingPublicBestRecos(false);
  }, []);

  useEffect(() => {
    async function boot() {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;
      setUserId(uid);
      setAuthChecked(true);
      if (!uid) {
        await loadPublicBestRecos();
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", uid)
        .maybeSingle();
      if (!profile?.username) {
        router.replace("/setup-account");
        return;
      }
      setLoadingMine(true);
      await loadQueue(uid);
      await loadMyRequests(uid);
      await loadMyAnswers(uid);
      setLoadingMine(false);
    }
    boot();
  }, [router, loadQueue, loadMyRequests, loadMyAnswers, loadPublicBestRecos]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setStatus("");
    if (!userId) {
      setStatus("You must be logged in to create a request.");
      return;
    }
    if (!prompt.trim()) {
      setStatus("Please enter a prompt.");
      return;
    }
    setCreating(true);
    const { error } = await supabase.from("qna_requests").insert({
      prompt: prompt.trim(),
      requester_id: userId,
    });
    if (error) {
      setStatus("Failed to create request: " + error.message);
      setCreating(false);
      return;
    }
    setPrompt("");
    setStatus("Request created.");
    setCreating(false);
    await loadMyRequests(userId);
  }

  function myRequestStatus(req: MyRequest): { label: string; variant: "secondary" | "default" | "success" } {
    if (req.best_answer_id) return { label: "Best selected", variant: "success" };
    if (req.answersCount > 0) return { label: "Choose best", variant: "default" };
    return { label: "Awaiting answers", variant: "secondary" };
  }
  const previewBestRecos = publicBestRecos.slice(0, 6);
  const filteredMyRequests = useMemo(() => {
    if (myRequestFilter === "selected") return myRequests.filter((r) => !!r.best_answer_id);
    if (myRequestFilter === "pending") return myRequests.filter((r) => !r.best_answer_id);
    return myRequests;
  }, [myRequests, myRequestFilter]);
  const previewMyRequests = filteredMyRequests.slice(0, 5);
  const previewMyAnswers = myAnswers.slice(0, 5);

  return (
    <main className="min-h-[calc(100dvh-120px)] bg-background px-3 py-6 text-foreground sm:px-4 sm:py-8 md:py-10">
      <div className="mx-auto w-full max-w-5xl space-y-5 sm:space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-extrabold tracking-tight">Requests</h1>
          <p className="text-sm text-muted-foreground">
            Ask for a Reco or answer others&apos; requests. Your requests and answers appear below.
          </p>
        </div>

        {!authChecked ? (
          <Card>
            <CardHeader>
              <CardTitle>Loading</CardTitle>
              <CardDescription>Checking your session…</CardDescription>
            </CardHeader>
          </Card>
        ) : !userId ? (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Want to request or answer?</CardTitle>
                <CardDescription>
                  Log in or sign up to create requests and answer other users.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex gap-2">
                <Button asChild>
                  <Link href="/login?mode=login">Log in</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/login?mode=signup">Sign up</Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Best Recos</CardTitle>
                <CardDescription>Selected best recommendations from recent requests.</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingPublicBestRecos ? (
                  <div className="text-sm text-muted-foreground">Loading best recos...</div>
                ) : publicBestRecos.length === 0 ? (
                  <EmptyState
                    icon={Music2}
                    title="No best recos yet"
                    description="Best picks will appear here."
                  />
                ) : (
                  <motion.div
                    initial="hidden"
                    animate="show"
                    variants={{
                      hidden: { opacity: 0, y: 10 },
                      show: { opacity: 1, y: 0, transition: { staggerChildren: 0.05 } },
                    }}
                    className="grid grid-cols-1 gap-3 sm:grid-cols-2"
                  >
                    {previewBestRecos.map((item) => (
                      <motion.div
                        key={item.id}
                        variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
                        whileHover={{ scale: 1.01 }}
                        transition={{ duration: 0.15 }}
                      >
                        <Card>
                          <CardHeader className="space-y-2">
                            <CardTitle className="line-clamp-2 text-sm">{item.prompt}</CardTitle>
                            <CardDescription>{new Date(item.created_at).toLocaleDateString()}</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="flex items-center gap-3">
                              <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-xl border border-border bg-card">
                                {item.albumImage ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={item.albumImage} alt={item.trackName} className="h-full w-full object-cover" />
                                ) : null}
                              </div>
                              <div className="min-w-0">
                                <div className="truncate text-sm font-semibold">{item.trackName}</div>
                                <div className="truncate text-xs text-muted-foreground">{item.artistName}</div>
                              </div>
                            </div>
                            {item.comment ? (
                              <div className="rounded-2xl border border-border bg-accent/40 px-3 py-2 text-sm">
                                “{item.comment}”
                              </div>
                            ) : null}
                            {item.trackId ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setExpandedPublicBestRecoId((prev) => (prev === item.id ? null : item.id))
                                }
                              >
                                <Play className="h-4 w-4" />
                                {expandedPublicBestRecoId === item.id ? "Hide" : "Play"}
                              </Button>
                            ) : null}
                            {item.trackId && expandedPublicBestRecoId === item.id ? (
                              <iframe
                                className="mt-1 w-full rounded-2xl border border-border"
                                src={`https://open.spotify.com/embed/track/${item.trackId}`}
                                width="100%"
                                height="80"
                                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                                loading="lazy"
                                title={`Play ${item.trackName}`}
                              />
                            ) : null}
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
                {publicBestRecos.length > previewBestRecos.length ? (
                  <div className="mt-4">
                    <Button variant="outline" asChild>
                      <Link href="/requests/best-recos">View more</Link>
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageCirclePlus className="h-4 w-4 text-primary" />
                    Ask for a Reco
                  </CardTitle>
                  <CardDescription>
                    Describe your mood or situation and others can recommend a track.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <form onSubmit={handleCreate} className="space-y-3">
                    <label className="block text-sm font-medium text-foreground/90" htmlFor="request-prompt">
                      What kind of song are you looking for?
                    </label>
                    <Textarea
                      id="request-prompt"
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="e.g. A song for late-night coding."
                      className="min-h-[120px] rounded-2xl border-border/70 bg-accent/20 px-4 py-3 text-[15px] leading-7 tracking-[0.01em] placeholder:text-muted-foreground/75"
                    />
                    <Button type="submit" disabled={creating}>
                      {creating ? "Creating…" : "Create request"}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </form>
                  {status ? (
                    <div className="rounded-2xl border border-border bg-accent px-4 py-3 text-sm">{status}</div>
                  ) : null}
                </CardContent>
              </Card>
            </motion.div>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="flex items-center gap-2">
                    <Inbox className="h-4 w-4 text-primary" />
                    Requests for you
                  </CardTitle>
                  <Badge variant="secondary">
                    {loadingQueue ? "…" : `${queueForYou.length} of 3`}
                  </Badge>
                </div>
                <CardDescription>
                  Up to 3 open requests you haven&apos;t answered yet (oldest first). Answer from the detail page.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingQueue && !queueForYou.length ? (
                  <div className="text-sm text-muted-foreground">Loading…</div>
                ) : queueForYou.length === 0 ? (
                  <EmptyState
                    icon={Inbox}
                    title="No requests for you right now"
                    description="Check back later or ask for a Reco above."
                  />
                ) : (
                  <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                    {queueForYou.map((req) => (
                      <li key={req.id}>
                        <Link href={`/requests/${req.id}`} className="block h-full">
                          <motion.div
                            className="h-full"
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.15 }}
                          whileHover={{ scale: 1.01 }}
                          >
                            <Card className="h-full cursor-pointer transition-colors hover:bg-accent/40">
                            <CardHeader className="space-y-2">
                              <CardTitle className="text-sm font-medium leading-snug line-clamp-2">
                                {req.prompt}
                              </CardTitle>
                              <CardDescription className="text-xs">
                                {new Date(req.created_at).toLocaleString()}
                              </CardDescription>
                            </CardHeader>
                            <CardContent className="pt-0">
                              <p className="text-xs text-muted-foreground">{req.answersCount} answer(s)</p>
                            </CardContent>
                            </Card>
                          </motion.div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="flex items-center gap-2">
                    <Send className="h-4 w-4 text-primary" />
                    My Requests
                  </CardTitle>
                  <Badge variant="secondary">{filteredMyRequests.length}</Badge>
                </div>
                <CardDescription>Requests you created. Open one to choose a Best Reco.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-3 flex flex-wrap gap-2 [&>button]:min-h-[44px]">
                  <Button
                    size="sm"
                    variant={myRequestFilter === "all" ? "default" : "outline"}
                    onClick={() => setMyRequestFilter("all")}
                  >
                    All
                  </Button>
                  <Button
                    size="sm"
                    variant={myRequestFilter === "pending" ? "default" : "outline"}
                    onClick={() => setMyRequestFilter("pending")}
                  >
                    Pending selection
                  </Button>
                  <Button
                    size="sm"
                    variant={myRequestFilter === "selected" ? "default" : "outline"}
                    onClick={() => setMyRequestFilter("selected")}
                  >
                    Selected
                  </Button>
                </div>
                {loadingMine && !myRequests.length ? (
                  <div className="text-sm text-muted-foreground">Loading…</div>
                ) : filteredMyRequests.length === 0 ? (
                  <EmptyState
                    icon={Send}
                    title="No requests yet"
                    description="Create a request above to get recommendations."
                  />
                ) : (
                  <ul className="space-y-2">
                    {previewMyRequests.map((req) => {
                      const { label, variant } = myRequestStatus(req);
                      return (
                        <li key={req.id}>
                          <Link href={`/requests/${req.id}`} className="block">
                            <Card className="cursor-pointer transition-colors hover:bg-accent/40">
                              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                                <div className="min-w-0 flex-1">
                                  <p className="font-semibold leading-relaxed tracking-tight">{req.prompt}</p>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {new Date(req.created_at).toLocaleString()} · {req.answersCount} answer(s)
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge variant={variant}>{label}</Badge>
                                </div>
                              </CardContent>
                            </Card>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {filteredMyRequests.length > previewMyRequests.length ? (
                  <div className="mt-4">
                    <Button variant="outline" asChild>
                      <Link href="/requests/my-requests">View more</Link>
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    My Answers
                  </CardTitle>
                  <Badge variant="secondary">{myAnswers.length}</Badge>
                </div>
                <CardDescription>Requests you answered. Open to see if your Reco was chosen.</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingMine && !myAnswers.length ? (
                  <div className="text-sm text-muted-foreground">Loading…</div>
                ) : myAnswers.length === 0 ? (
                  <EmptyState
                    icon={CheckCircle}
                    title="No answers yet"
                    description="Answer a request from &quot;Requests for you&quot; and it will appear here."
                  />
                ) : (
                  <ul className="space-y-2">
                    {previewMyAnswers.map((entry) => (
                      <li key={entry.request_id}>
                        <Link href={`/requests/${entry.request_id}`} className="block">
                          <Card className="cursor-pointer transition-colors hover:bg-accent/40">
                            <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                              <div className="min-w-0 flex-1">
                                <p className="line-clamp-2 font-semibold leading-relaxed tracking-tight">{entry.prompt}</p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {entry.mode === "answer" ? "My Reco" : "My Nice Reco"}: {entry.trackName} - {entry.artistName}
                                </p>
                              </div>
                            </CardContent>
                          </Card>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                {myAnswers.length > previewMyAnswers.length ? (
                  <div className="mt-4">
                    <Button variant="outline" asChild>
                      <Link href="/requests/my-answers">View more</Link>
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </main>
  );
}
