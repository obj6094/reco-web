"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

type ExpandableTextProps = {
  text: string | null | undefined;
  /** Rough clamp length before truncation */
  maxChars?: number;
  className?: string;
  /** Optional aria-label for the expand/collapse button */
  toggleAriaLabel?: string;
  /** Visual density / layout preset */
  variant?: "default" | "compact-card";
};

export function ExpandableText({
  text,
  maxChars = 140,
  className,
  toggleAriaLabel,
  variant = "default",
}: ExpandableTextProps) {
  const [expanded, setExpanded] = useState(false);

  const content = text?.trim() ?? "";
  const isLong = content.length > maxChars;

  const displayed = useMemo(() => {
    if (!isLong || expanded) return content;
    return content.slice(0, maxChars) + "…";
  }, [content, expanded, isLong, maxChars]);

  if (!content) return null;

  const isCompact = variant === "compact-card";

  return (
    <div
      className={cn(
        "space-y-1 text-sm text-foreground/90",
        isCompact && "space-y-0.5",
        className,
      )}
    >
      <AnimatePresence initial={false}>
        <motion.p
          key={expanded ? "expanded" : "collapsed"}
          layout
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18 }}
          className={cn(
            "break-words",
            isCompact &&
              !expanded &&
              // Mobile: keep very compact (2 lines), allow a bit more on larger screens
              "text-xs text-muted-foreground line-clamp-2 sm:line-clamp-3",
            isCompact && expanded && "text-xs text-muted-foreground",
          )}
          style={
            isCompact
              ? {
                  wordBreak: "break-word",
                  overflowWrap: "anywhere",
                }
              : undefined
          }
        >
          {displayed}
        </motion.p>
      </AnimatePresence>
      {isLong ? (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className={cn(
            "inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline",
            isCompact && "text-[11px]",
          )}
          aria-label={toggleAriaLabel}
          aria-expanded={expanded}
        >
          {isCompact ? (
            <>
              <span className="sr-only">{expanded ? "Collapse" : "Expand"}</span>
              {expanded ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </>
          ) : (
            <span>{expanded ? "Collapse" : "Expand"}</span>
          )}
        </button>
      ) : null}
    </div>
  );
}

