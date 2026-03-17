"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, type Variants } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
  variants?: Variants;
};

export function BestRecoCard({ item, variants }: BestRecoCardProps) {
  const router = useRouter();
  return (
    <motion.div
      key={item.id}
      variants={variants}
      whileHover={{ scale: 1.01 }}
      transition={{ duration: 0.15 }}
    >
      <Card
        role="button"
        tabIndex={0}
        className="w-full cursor-pointer overflow-hidden border-border/80 bg-gradient-to-br from-card to-accent/20 transition-colors hover:bg-accent/10"
        onClick={() => router.push(`/requests/${encodeURIComponent(item.id)}`)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            router.push(`/requests/${encodeURIComponent(item.id)}`);
          }
        }}
      >
          <CardHeader className="space-y-2 p-4 sm:p-6">
            <CardTitle className="line-clamp-1 truncate break-words text-sm">
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
            <div
              className="space-y-1 rounded-xl border border-border/70 bg-muted/30 px-3 py-2 text-xs text-muted-foreground"
              onClick={(e) => e.stopPropagation()}
            >
              <p>
                Request by{" "}
                <Link href={`/u/${encodeURIComponent(item.requesterSlug)}`} className="font-medium text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                  @{item.requesterName}
                </Link>
              </p>
              <p>
                Best Reco by{" "}
                <Link href={`/u/${encodeURIComponent(item.responderSlug)}`} className="font-medium text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                  @{item.responderName}
                </Link>
              </p>
            </div>
            {item.comment ? (
              <div className="line-clamp-1 truncate rounded-2xl border border-border bg-accent/40 px-3 py-2 text-sm">
                {item.comment}
              </div>
            ) : null}
          </CardContent>
        </Card>
    </motion.div>
  );
}
