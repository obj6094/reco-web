 "use client";

 import Link from "next/link";
 import { useState } from "react";
 import { motion } from "framer-motion";
 import { Play, ThumbsUp } from "lucide-react";
 import { Card, CardContent } from "@/components/ui/card";
 import { Badge } from "@/components/ui/badge";
 import { Button } from "@/components/ui/button";
 import { getDisplayName } from "@/lib/auth";
 import { ExpandableText } from "@/components/ExpandableText";
 import { cn } from "@/lib/utils";

 export type SubmissionCardData = {
   id: string;
   trackName: string;
   artistName: string;
   albumImage: string | null;
   comment: string | null;
   voteCount: number;
   spotify_track_id: string | null;
   submitterNickname: string | null;
   submitterUsername: string | null;
   isMine?: boolean;
   viewerVoted?: boolean;
 };

 type SubmissionCardProps = {
   submission: SubmissionCardData;
   /** Enable vote button when handler is provided */
   canVote?: boolean;
   onVote?: () => void;
   /** Whether a vote request is in-flight for this card */
   voting?: boolean;
   /** Compact variant used in tighter grids */
   variant?: "default" | "compact";
   /** Optional extra className for the outer Card */
   className?: string;
   /** Optional rank to show at top of card (e.g. 1 for #1) */
   rank?: number;
 };

 export function SubmissionCard({
   submission,
   canVote = false,
   onVote,
   voting = false,
   variant = "default",
   className,
   rank,
 }: SubmissionCardProps) {
   const [showPlayer, setShowPlayer] = useState(false);

   const {
     id,
     trackName,
     artistName,
     albumImage,
     comment,
     voteCount,
     spotify_track_id,
     submitterNickname,
     submitterUsername,
     isMine,
     viewerVoted,
   } = submission;

   const authorSlug =
     (submitterNickname ?? submitterUsername ?? "user")?.toString().trim() || "user";

   const canShowVote = canVote && !!onVote;

   return (
     <Card
       className={cn(
        "w-full border-border/80 bg-muted/40",
         isMine && "border-primary/60 bg-primary/5",
         className,
       )}
     >
       <CardContent
         className={cn(
          "space-y-2.5 p-3 sm:p-4",
          variant === "compact" && "p-3",
         )}
       >
        {rank != null ? (
          <div className="mb-2 flex items-center">
            <Badge variant="secondary" className="shrink-0">
              #{rank}
            </Badge>
          </div>
        ) : null}
        <div className="space-y-2.5">
          {/* Top row: cover + title/artist */}
          <div className="flex min-w-0 items-center gap-3">
            <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-2xl border border-border bg-card sm:h-16 sm:w-16">
              {albumImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={albumImage}
                  alt={trackName}
                  className="h-full w-full object-cover"
                />
              ) : null}
            </div>
            <div className="min-w-0 flex-1 space-y-0.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <div className="truncate text-sm font-semibold">{trackName}</div>
                {isMine ? <Badge variant="secondary">Yours</Badge> : null}
              </div>
              <div className="truncate text-xs text-muted-foreground">{artistName}</div>
            </div>
          </div>

          {/* Second row: metadata */}
          <div className="text-xs text-muted-foreground">
            <span className="font-medium">{voteCount}</span>{" "}
            {voteCount === 1 ? "vote" : "votes"}
            {submitterNickname || submitterUsername ? (
              <>
                {" "}
                •{" "}
                <Link
                  href={`/u/${encodeURIComponent(authorSlug)}`}
                  className="font-medium text-primary hover:underline"
                >
                  {getDisplayName(submitterNickname, submitterUsername)}
                </Link>
              </>
            ) : (
              " • by user"
            )}
          </div>

          {/* Third row: comment - fixed min-height when collapsed, expands when long */}
          <div className="min-h-[2.5rem]">
            {comment ? (
              <ExpandableText
                text={comment}
                maxChars={160}
                variant="compact-card"
                toggleAriaLabel="Toggle comment expansion"
                className="mt-0.5"
              />
            ) : null}
          </div>

          {/* Bottom row: actions */}
          <div className="flex flex-row flex-wrap items-center gap-2 pt-0.5">
            {canShowVote ? (
              <motion.div
                whileTap={{ scale: 0.98 }}
                animate={viewerVoted ? { scale: 1.02 } : { scale: 1 }}
                transition={{ duration: 0.12 }}
              >
                <Button
                  size="sm"
                  variant={viewerVoted ? "default" : "outline"}
                  onClick={onVote}
                  disabled={isMine || voting}
                  className={cn(
                    "px-3 py-1.5 text-xs",
                    isMine && "cursor-not-allowed opacity-90",
                  )}
                >
                  <ThumbsUp className="mr-1 h-3.5 w-3.5" />
                  {isMine
                    ? "Mine"
                    : voting
                      ? "…"
                      : viewerVoted
                        ? "Voted"
                        : "Vote"}
                </Button>
              </motion.div>
            ) : null}
            {spotify_track_id ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowPlayer((prev) => !prev)}
                className="px-3 py-1.5 text-xs"
              >
                <Play className="mr-1 h-3.5 w-3.5" />
                {showPlayer ? "Hide" : "Play"}
              </Button>
            ) : null}
          </div>
        </div>

         {showPlayer && spotify_track_id ? (
          <div className="mt-1.5 overflow-hidden rounded-2xl border border-border">
             <iframe
               className="w-full"
               src={`https://open.spotify.com/embed/track/${spotify_track_id}`}
               width="100%"
               height="80"
               allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
               loading="lazy"
               title={`Play ${trackName}`}
             />
           </div>
         ) : null}
       </CardContent>
     </Card>
   );
 }

