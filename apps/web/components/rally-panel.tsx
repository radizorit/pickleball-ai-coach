"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiClientError } from "@/lib/api/client";
import { useAuthedApiClient } from "@/lib/api/use-authed-api-client";
import type { VideoPlayerDTO, VideoRallyDTO } from "@pickleball/shared";
import type { VideoPlayerSlot } from "@pickleball/shared/constants";
import { DEFAULT_VIDEO_PLAYER_SLOTS } from "@pickleball/shared";

function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function slotShort(slot: VideoPlayerSlot): string {
  if (slot === "player_1") return "P1";
  if (slot === "player_2") return "P2";
  return slot;
}

function playerLabel(slot: VideoPlayerSlot, players: VideoPlayerDTO[]): string {
  const name = players.find((p) => p.slot === slot)?.displayName?.trim();
  return name ? `${slotShort(slot)} (${name})` : slotShort(slot);
}

function endReasonBadge(reason: VideoRallyDTO["endReason"]): string {
  if (!reason) return "";
  return reason;
}

export function RallyPanel({
  videoId,
  activeClock,
  activeRallyId,
  onActiveRallyChange,
}: {
  videoId: string;
  activeClock: number;
  activeRallyId: string | null;
  onActiveRallyChange: (id: string | null) => void;
}) {
  const client = useAuthedApiClient();
  const qc = useQueryClient();

  const playersQ = useQuery({
    queryKey: ["videos", videoId, "players"],
    queryFn: () => client.videosPlayersList(videoId),
  });

  const ralliesQ = useQuery({
    queryKey: ["videos", videoId, "rallies"],
    queryFn: () => client.videosRalliesList(videoId),
  });

  const players = playersQ.data ?? [];
  const rallies = ralliesQ.data ?? [];

  const [name1, setName1] = useState("");
  const [name2, setName2] = useState("");

  useEffect(() => {
    const p1 = players.find((p) => p.slot === "player_1");
    const p2 = players.find((p) => p.slot === "player_2");
    setName1(p1?.displayName ?? "");
    setName2(p2?.displayName ?? "");
  }, [players]);

  const openRallies = useMemo(
    () => rallies.filter((r) => r.endTimeSeconds == null),
    [rallies],
  );

  const invalidateRallyQueries = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ["videos", videoId, "rallies"] });
    void qc.invalidateQueries({ queryKey: ["videos", videoId, "rally-consistency"] });
    void qc.invalidateQueries({ queryKey: ["videos", videoId, "shot-events"] });
  }, [qc, videoId]);

  const upsertPlayersMut = useMutation({
    mutationFn: () =>
      client.videosPlayersUpsert(videoId, {
        players: DEFAULT_VIDEO_PLAYER_SLOTS.map((slot) => ({
          slot,
          displayName:
            slot === "player_1"
              ? name1.trim() === ""
                ? null
                : name1.trim()
              : name2.trim() === ""
                ? null
                : name2.trim(),
        })),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["videos", videoId, "players"] });
    },
  });

  const createRallyMut = useMutation({
    mutationFn: () =>
      client.videosRalliesCreate(videoId, { startTimeSeconds: activeClock }),
    onSuccess: (rally) => {
      invalidateRallyQueries();
      onActiveRallyChange(rally.id);
    },
  });

  const closeRallyMut = useMutation({
    mutationFn: (rallyId: string) =>
      client.ralliesUpdate(rallyId, { endTimeSeconds: activeClock }),
    onSuccess: () => {
      invalidateRallyQueries();
    },
  });

  const deleteRallyMut = useMutation({
    mutationFn: (rallyId: string) => client.ralliesDelete(rallyId),
    onSuccess: (_, rallyId) => {
      if (activeRallyId === rallyId) onActiveRallyChange(null);
      invalidateRallyQueries();
    },
  });

  const busy =
    upsertPlayersMut.isPending ||
    createRallyMut.isPending ||
    closeRallyMut.isPending ||
    deleteRallyMut.isPending;

  const err =
    upsertPlayersMut.error ??
    createRallyMut.error ??
    closeRallyMut.error ??
    deleteRallyMut.error;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Players & rallies</CardTitle>
        <CardDescription>
          Name players, start rallies at the active clock, tag shots into the active rally.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="font-medium" htmlFor="p1-name">
              Player 1
            </label>
            <input
              id="p1-name"
              value={name1}
              onChange={(e) => setName1(e.target.value)}
              placeholder="You"
              className="border-input bg-background flex h-9 w-full rounded-md border px-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="font-medium" htmlFor="p2-name">
              Player 2
            </label>
            <input
              id="p2-name"
              value={name2}
              onChange={(e) => setName2(e.target.value)}
              placeholder="Opponent"
              className="border-input bg-background flex h-9 w-full rounded-md border px-2 text-sm"
            />
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy || playersQ.isLoading}
          onClick={() => upsertPlayersMut.mutate()}
        >
          Save player names
        </Button>

        <div className="border-t pt-3 space-y-2">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            Active rally
          </p>
          <select
            value={activeRallyId ?? ""}
            onChange={(e) => onActiveRallyChange(e.target.value === "" ? null : e.target.value)}
            className="border-input bg-background flex h-9 w-full rounded-md border px-2 text-sm"
          >
            <option value="">None</option>
            {openRallies.map((r, i) => (
              <option key={r.id} value={r.id}>
                Open #{i + 1} · {formatClock(r.startTimeSeconds)}
                {r.shotCount > 0 ? ` · ${r.shotCount} shots` : ""}
              </option>
            ))}
          </select>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => createRallyMut.mutate()}
            >
              New rally at {formatClock(activeClock)}
            </Button>
            {activeRallyId && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => closeRallyMut.mutate(activeRallyId)}
              >
                Close at {formatClock(activeClock)}
              </Button>
            )}
          </div>
        </div>

        <div className="border-t pt-3">
          <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
            Rallies ({rallies.length})
          </p>
          {ralliesQ.isLoading && <p className="text-muted-foreground text-xs">Loading…</p>}
          {rallies.length === 0 && !ralliesQ.isLoading && (
            <p className="text-muted-foreground text-xs">No rallies yet.</p>
          )}
          <ul className="max-h-40 space-y-2 overflow-y-auto pr-1">
            {rallies.map((r, i) => (
              <li key={r.id} className="rounded-md border p-2 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      #{i + 1} · {formatClock(r.startTimeSeconds)}
                      {r.endTimeSeconds != null ? ` – ${formatClock(r.endTimeSeconds)}` : " · open"}
                    </p>
                    <p className="text-muted-foreground mt-0.5">
                      {r.shotCount} shot{r.shotCount === 1 ? "" : "s"}
                      {r.winningPlayerSlot != null &&
                        ` · ${playerLabel(r.winningPlayerSlot, players)} won`}
                      {r.endReason != null && (
                        <span className="ml-1 inline-flex rounded bg-muted px-1 py-0.5 capitalize">
                          {endReasonBadge(r.endReason)}
                        </span>
                      )}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-destructive h-7 px-2"
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm("Delete this rally? Shots stay but lose rally assignment.")) {
                        deleteRallyMut.mutate(r.id);
                      }
                    }}
                  >
                    Del
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {err && (
          <p className="text-destructive text-xs">
            {err instanceof ApiClientError ? err.message : "Request failed"}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
