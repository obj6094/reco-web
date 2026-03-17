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
import { BestRecosSection } from "@/components/BestRecosSection";
import { cn } from "@/lib/utils";
import { ArrowRight, MessageCirclePlus, Send, Inbox, CheckCircle, Music2 } from "lucide-react";

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
  isSelected?: boolean;
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
  const [myRequestFilter, setMyRequestFilter] = useState<"all" | "pending" | "selected">("all");
  const [status, setStatus] = useState("");

  const loadQueue = useCallback(async (uid: string) => {
    setLoadingQueue(true);
    setStatus("");
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

    const { data: answeredRows } = await supabase
      .from("qna_answers")
      .select("request_id, created_at")
      .eq("responder_id", uid);
    const answeredIds = new Set((answeredRows ?? []).map((r: any) => r.request_id));
    const answeredToday = (answeredRows ?? []).filter((r: any) => r.created_at >= startOfToday).length;

    const { data: myRatings } = await supabase
      .from("qna_ratings")
      .select("answer_id, created_at")
      .eq("rater_id", uid)
      .eq("score", 1);
    const ratedAnswerIds = (myRatings ?? []).map((r: any) => r.answer_id).filter(Boolean);
    const niceRecosToday = (myRatings ?? []).filter((r: any) => r.created_at >= startOfToday).length;
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

    const usedToday = answeredToday + niceRecosToday;
    const slotsRemaining = Math.max(0, 3 - usedToday);

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
    const toShow = unanswered.slice(0, slotsRemaining);
    const ids = toShow.map((r: any) => r.id);
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
    const filtered = toShow.map((r: any) => ({
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
      .select("id, request_id, created_at, spotify_track_name, spotify_artist_name")
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

    const mergedRows: { request_id: string; prompt: string; created_at: string; trackName: string; artistName: string; mode: "answer" | "nice_reco"; answer_id?: string }[] = [];
    (ansRows ?? []).forEach((row: any) => {
      mergedRows.push({
        request_id: row.request_id,
        prompt: "",
        created_at: row.created_at,
        trackName: row.spotify_track_name ?? "Unknown track",
        artistName: row.spotify_artist_name ?? "Unknown artist",
        mode: "answer",
        answer_id: row.id,
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
      .select("id, prompt, created_at, best_answer_id")
      .in("id", reqIds);
    const byId: Record<string, { prompt: string; created_at: string; best_answer_id: string | null }> = {};
    (reqData ?? []).forEach((r: any) => {
      byId[r.id] = { prompt: r.prompt, created_at: r.created_at, best_answer_id: r.best_answer_id ?? null };
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
        .map((row) => {
          const req = byId[row.request_id];
          const isSelected = row.mode === "answer" && row.answer_id && req?.best_answer_id === row.answer_id;
          return {
            request_id: row.request_id,
            prompt: req?.prompt ?? "",
            created_at: row.created_at,
            trackName: row.trackName,
            artistName: row.artistName,
            mode: row.mode,
            isSelected: !!isSelected,
          };
        })
    );
  }, []);

  useEffect(() => {
    async function boot() {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;
      setUserId(uid);
      setAuthChecked(true);
      if (!uid) return;
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
  }, [router, loadQueue, loadMyRequests, loadMyAnswers]);

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
  const filteredMyRequests = useMemo(() => {
    if (myRequestFilter === "selected") return myRequests.filter((r) => !!r.best_answer_id);
    if (myRequestFilter === "pending") return myRequests.filter((r) => !r.best_answer_id);
    return myRequests;
  }, [myRequests, myRequestFilter]);
  const previewMyRequests = filteredMyRequests.slice(0, 4);
  const previewMyAnswers = myAnswers.slice(0, 4);

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

            <BestRecosSection />
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
                  {loadingQueue ? "Loading…" : queueForYou.length === 0
                    ? "No requests right now. You can answer up to 3 per day. New ones arrive tomorrow."
                    : `${queueForYou.length} ${queueForYou.length === 1 ? "person is" : "people are"} waiting for your reco`}
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
                            <Card className="h-full cursor-pointer transition-colors border-border/80 bg-muted/40 hover:bg-muted/60">
                            <CardHeader className="space-y-2">
                              <CardTitle className="text-sm font-medium leading-snug line-clamp-1 truncate break-words">
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
                            <Card className="cursor-pointer transition-colors border-border/80 bg-muted/40 hover:bg-muted/60">
                              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                                <div className="min-w-0 flex-1">
                                  <p className="line-clamp-1 truncate font-semibold leading-relaxed tracking-tight break-words">{req.prompt}</p>
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
                      <Link href="/requests/my-requests">View all</Link>
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
                          <Card
                            className={cn(
                              "cursor-pointer transition-colors hover:bg-muted/60",
                              entry.isSelected
                                ? "border-primary/60 bg-primary/5"
                                : "border-border/80 bg-muted/40"
                            )}
                          >
                            <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                              <div className="min-w-0 flex-1">
                                <p className="line-clamp-1 truncate font-semibold leading-relaxed tracking-tight break-words">{entry.prompt}</p>
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
                      <Link href="/requests/my-answers">View all</Link>
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <BestRecosSection />
          </>
        )}
      </div>
    </main>
  );
}
