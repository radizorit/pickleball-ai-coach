"use client";

import { useMemo } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ShotEventDTO } from "@pickleball/shared";
import {
  COACHING_MIN_TAGS_FOR_FULL_FEEDBACK,
  computeCoachingFeedback,
} from "@pickleball/shared";

export function VideoCoachingFeedbackPanel({
  events,
  isLoading,
}: {
  events: ShotEventDTO[] | undefined;
  isLoading: boolean;
}) {
  const report = useMemo(() => computeCoachingFeedback(events ?? []), [events]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Coaching feedback</CardTitle>
          <CardDescription>Loading tags…</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-muted h-28 animate-pulse rounded-md" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Coaching feedback</CardTitle>
        <CardDescription>
          Rule-based preview from your tags (not AI).{" "}
          {report.lowSample ? (
            <span className="text-amber-600 dark:text-amber-500">
              Fewer than {COACHING_MIN_TAGS_FOR_FULL_FEEDBACK} tags — add more for stronger guidance.
            </span>
          ) : (
            "Patterns update as you add or edit shots in Review."
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="text-muted-foreground space-y-5 text-sm">
        <section>
          <h3 className="text-foreground mb-1 text-xs font-semibold uppercase tracking-wide">Overall</h3>
          <p>{report.overallSummary}</p>
        </section>
        <div className="grid gap-4 sm:grid-cols-2">
          <section>
            <h3 className="text-foreground mb-1 text-xs font-semibold uppercase tracking-wide">
              Biggest strength
            </h3>
            <p>{report.biggestStrength}</p>
          </section>
          <section>
            <h3 className="text-foreground mb-1 text-xs font-semibold uppercase tracking-wide">
              Biggest weakness
            </h3>
            <p>{report.biggestWeakness}</p>
          </section>
        </div>
        <section>
          <h3 className="text-foreground mb-1 text-xs font-semibold uppercase tracking-wide">
            Most common mistake
          </h3>
          <p>{report.mostCommonMistakeLine}</p>
        </section>
        <section>
          <h3 className="text-foreground mb-1 text-xs font-semibold uppercase tracking-wide">
            Recommended drills
          </h3>
          <ul className="list-inside list-disc space-y-1">
            {report.recommendedDrills.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
        <section className="border-border bg-muted/30 rounded-lg border p-3">
          <h3 className="text-foreground mb-1 text-xs font-semibold uppercase tracking-wide">
            Suggested next focus
          </h3>
          <p className="text-foreground font-medium">{report.suggestedNextFocus}</p>
        </section>
      </CardContent>
    </Card>
  );
}
