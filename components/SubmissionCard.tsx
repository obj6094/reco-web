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
 };

 export function SubmissionCard({
   submission,
   canVote = false,
   onVote,
   voting = false,
   variant = "default",
   className,
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
           "space-y-3 p-4",
           variant === "compact" && "p-3",
         )}
       >
         <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
           <div className="flex min-w-0 items-start gap-3">
             <div className="flex flex-col items-start gap-2">
               <div className="h-14 w-14 overflow-hidden rounded-2xl border border-border bg-card sm:h-16 sm:w-16">
                 {albumImage ? (
                   // eslint-disable-next-line @next/next/no-img-element
                   <img
                     src={albumImage}
                     alt={trackName}
                     className="h-full w-full object-cover"
                   />
                 ) : null}
               </div>
               <div className="flex flex-wrap items-center gap-2 text-xs">
                 <Badge variant="secondary" className="w-fit">
                   {voteCount} votes
                 </Badge>
                 {submitterNickname || submitterUsername ? (
                   <Link
                     href={`/u/${encodeURIComponent(authorSlug)}`}
                     className="w-fit text-xs text-primary hover:underline"
                   >
                     by {getDisplayName(submitterNickname, submitterUsername)}
                   </Link>
                 ) : (
                   <span className="text-xs text-muted-foreground">by user</span>
                 )}
               </div>
             </div>

             <div className="min-w-0 flex-1 space-y-1">
               <div className="flex flex-wrap items-center gap-2">
                 <div className="truncate text-sm font-semibold">{trackName}</div>
                 {isMine ? <Badge variant="secondary">Yours</Badge> : null}
               </div>
               <div className="truncate text-xs text-muted-foreground">{artistName}</div>
               {comment ? (
                 <div className="mt-2 rounded-lg border border-border/70 bg-background/50 px-3 py-2">
                   <ExpandableText
                     text={comment}
                     maxChars={140}
                     toggleAriaLabel="Toggle comment expansion"
                   />
                 </div>
               ) : null}
             </div>
           </div>

           <div className="flex flex-row flex-wrap items-center gap-2 sm:flex-col sm:items-end [&>button]:min-h-[40px]">
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
                   className={cn(isMine && "cursor-not-allowed opacity-90")}
                 >
                   <ThumbsUp className="mr-1 h-4 w-4" />
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
                 variant="ghost"
                 onClick={() => setShowPlayer((prev) => !prev)}
               >
                 <Play className="mr-1 h-4 w-4" />
                 {showPlayer ? "Hide" : "Play"}
               </Button>
             ) : null}
           </div>
         </div>

         {showPlayer && spotify_track_id ? (
           <div className="mt-1 overflow-hidden rounded-2xl border border-border">
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

