 "use client";

 import { useState, useMemo } from "react";
 import { motion, AnimatePresence } from "framer-motion";
 import { cn } from "@/lib/utils";

 type ExpandableTextProps = {
   text: string | null | undefined;
   /** Rough clamp length before truncation */
   maxChars?: number;
   className?: string;
   /** Optional aria-label for the expand/collapse button */
   toggleAriaLabel?: string;
 };

 export function ExpandableText({
   text,
   maxChars = 140,
   className,
   toggleAriaLabel,
 }: ExpandableTextProps) {
   const [expanded, setExpanded] = useState(false);

   const content = text?.trim() ?? "";
   const isLong = content.length > maxChars;

   const displayed = useMemo(() => {
     if (!isLong || expanded) return content;
     return content.slice(0, maxChars) + "…";
   }, [content, expanded, isLong, maxChars]);

   if (!content) return null;

   return (
     <div className={cn("space-y-1 text-sm text-foreground/90", className)}>
       <AnimatePresence initial={false}>
         <motion.p
           key={expanded ? "expanded" : "collapsed"}
           layout
           initial={{ opacity: 0, y: 4 }}
           animate={{ opacity: 1, y: 0 }}
           exit={{ opacity: 0, y: -4 }}
           transition={{ duration: 0.18 }}
           className="break-words"
         >
           {displayed}
         </motion.p>
       </AnimatePresence>
       {isLong ? (
         <button
           type="button"
           onClick={() => setExpanded((prev) => !prev)}
           className="text-xs font-medium text-primary hover:underline"
           aria-label={toggleAriaLabel}
         >
           {expanded ? "Collapse" : "Expand"}
         </button>
       ) : null}
     </div>
   );
 }

