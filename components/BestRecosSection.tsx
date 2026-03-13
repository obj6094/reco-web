"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Music2, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getDisplayName } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { BestRecoCard, type BestRecoItem } from "@/components/BestRecoCard";

const MOTION_VARIANTS = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
};

export function BestRecosSection() {
  const [items, setItems] = useState<BestRecoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [mobileExpanded, setMobileExpanded] = useState(false);

  const loadBestRecos = useCallback(async () => {
    setLoading(true);

    const { data: reqs, error: reqError } = await supabase
      .from("qna_requests")
      .select("id, prompt, best_answer_id, created_at, requester_id")
      .not("best_answer_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(4);

    if (reqError) {
      setItems([]);
      setLoading(false);
      return;
    }

    const answerIds = (reqs ?? [])
      .map((r: any) => r.best_answer_id)
      .filter((id: string | null) => !!id);

    if (!answerIds.length) {
      setItems([]);
      setLoading(false);
      return;
    }

    const { data: answers, error: ansError } = await supabase
      .from("qna_answers")
      .select(
        "id, responder_id, spotify_track_id, spotify_track_name, spotify_artist_name, spotify_album_image_url, comment"
      )
      .in("id", answerIds);

    if (ansError) {
      setItems([]);
      setLoading(false);
      return;
    }

    const answerById: Record<string, any> = {};
    for (const a of answers ?? []) {
      answerById[a.id as string] = a;
    }

    const profileIds = Array.from(
      new Set(
        (reqs ?? [])
          .map((r: any) => r.requester_id as string)
          .concat((answers ?? []).map((a: any) => a.responder_id as string))
          .filter(Boolean)
      )
    );
    const profileMap: Record<string, { nickname: string | null; username: string | null }> = {};
    if (profileIds.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, nickname, username")
        .in("id", profileIds);
      (profiles ?? []).forEach((p: any) => {
        profileMap[p.id as string] = {
          nickname: p.nickname ?? null,
          username: p.username ?? null,
        };
      });
    }

    const merged: BestRecoItem[] =
      reqs
        ?.map((r: any) => {
          const a = answerById[r.best_answer_id as string];
          if (!a) return null;
          const reqProfile = profileMap[r.requester_id as string];
          const resProfile = profileMap[a.responder_id as string];
          return {
            id: r.id as string,
            prompt: r.prompt as string,
            created_at: r.created_at as string,
            requesterName: getDisplayName(reqProfile?.nickname, reqProfile?.username),
            responderName: getDisplayName(resProfile?.nickname, resProfile?.username),
            requesterSlug: (reqProfile?.nickname ?? reqProfile?.username ?? "user").trim(),
            responderSlug: (resProfile?.nickname ?? resProfile?.username ?? "user").trim(),
            comment: (a.comment as string | null) ?? null,
            trackId: (a.spotify_track_id as string | null) ?? null,
            trackName: (a.spotify_track_name as string) ?? "Unknown track",
            artistName: (a.spotify_artist_name as string) ?? "Unknown artist",
            albumImage: (a.spotify_album_image_url as string | null) ?? null,
          };
        })
        .filter(Boolean) as BestRecoItem[] ?? [];

    setItems(merged);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadBestRecos();
  }, [loadBestRecos]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Best Recos from Requests</CardTitle>
        <CardDescription>Best Recos selected from QnA requests.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={Music2}
            title="No best recos yet"
            description="No best recos yet. Be the first to ask and choose one."
          />
        ) : (
          <>
            <motion.div
              initial="hidden"
              animate="show"
              variants={{
                hidden: { opacity: 0, y: 10 },
                show: { opacity: 1, y: 0, transition: { staggerChildren: 0.05 } },
              }}
              className="grid grid-cols-1 gap-3 sm:grid-cols-2"
            >
              {items.map((item, index) => (
                <div
                  key={item.id}
                  className={cn(
                    index >= 1 && !mobileExpanded && "hidden sm:block",
                  )}
                >
                  <BestRecoCard
                    item={item}
                    expandedId={expandedId}
                    onExpandToggle={setExpandedId}
                    variants={MOTION_VARIANTS}
                  />
                </div>
              ))}
            </motion.div>
            {/* Mobile: expand/collapse button - only show when there are 2+ items */}
            {/* Mobile only: expand/collapse in place (no navigation) */}
            {items.length > 1 ? (
              <div className="mt-4 flex justify-center sm:hidden">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setMobileExpanded((prev) => !prev)}
                  className="gap-2"
                >
                  {mobileExpanded ? (
                    <>
                      <ChevronUp className="h-4 w-4" />
                      Show less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4" />
                      Show more ({items.length} total)
                    </>
                  )}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
