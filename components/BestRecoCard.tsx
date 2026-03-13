"use client";

import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import { Play } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExpandableText } from "@/components/ExpandableText";

export type BestRecoItem = {
  id: string;
  prompt: string;
  created_at: string;
  requesterName: string;
  responderName: string;
  requesterSlug: string;
  responderSlug: string;
  comment: string | null;
  trackId: string | null;
  trackName: string;
  artistName: string;
  albumImage: string | null;
};

type BestRecoCardProps = {
  item: BestRecoItem;
  expandedId: string | null;
  onExpandToggle: (id: string | null) => void;
  variants?: Variants;
};

export function BestRecoCard({ item, expandedId, onExpandToggle, variants }: BestRecoCardProps) {
  return (
    <motion.div
      key={item.id}
      variants={variants}
      whileHover={{ scale: 1.01 }}
      transition={{ duration: 0.15 }}
    >
      <Card className="w-full overflow-hidden border-border/80 bg-gradient-to-br from-card to-accent/20">
        <CardHeader className="space-y-2 p-4 sm:p-6">
          <CardTitle className="line-clamp-2 break-words text-sm">
            {item.prompt}
          </CardTitle>
          <CardDescription>
            {new Date(item.created_at).toLocaleDateString()}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-xl border border-border bg-card">
              {item.albumImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.albumImage}
                  alt={item.trackName}
                  className="h-full w-full object-cover"
                />
              ) : null}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{item.trackName}</div>
              <div className="truncate text-xs text-muted-foreground">{item.artistName}</div>
            </div>
          </div>
          <div className="space-y-1 rounded-xl border border-border/70 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <p>
              Request by{" "}
              <Link href={`/u/${encodeURIComponent(item.requesterSlug)}`} className="font-medium text-primary hover:underline">
                @{item.requesterName}
              </Link>
            </p>
            <p>
              Best Reco by{" "}
              <Link href={`/u/${encodeURIComponent(item.responderSlug)}`} className="font-medium text-primary hover:underline">
                @{item.responderName}
              </Link>
            </p>
          </div>
          {item.comment ? (
            <div className="rounded-2xl border border-border bg-accent/40 px-3 py-2">
              <ExpandableText
                text={item.comment}
                maxChars={160}
                variant="compact-card"
                toggleAriaLabel="Toggle best reco comment expansion"
              />
            </div>
          ) : null}
          {item.trackId ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onExpandToggle(expandedId === item.id ? null : item.id)}
            >
              <Play className="h-4 w-4" />
              {expandedId === item.id ? "Hide" : "Play"}
            </Button>
          ) : null}
          {item.trackId && expandedId === item.id ? (
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
  );
}
