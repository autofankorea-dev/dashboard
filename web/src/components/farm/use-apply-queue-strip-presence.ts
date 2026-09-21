"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ApplyQueueChannelStripItem } from "@/lib/farm/apply-queue";
import { motionDuration } from "@/lib/ui/motion-tokens";

function prefersStripReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** 확인 단계에서 체크를 보여 준 뒤 exit로 내린다. 덮개 줄·설정 행 공용. */
export function useApplyQueueStripPresence(
  items: readonly ApplyQueueChannelStripItem[],
): {
  visible: ApplyQueueChannelStripItem[];
  leaving: ReadonlySet<string>;
} {
  const [leaving, setLeaving] = useState<ReadonlySet<string>>(() => new Set());
  const [gone, setGone] = useState<ReadonlySet<string>>(() => new Set());
  const holdTimers = useRef(new Map<string, number>());
  const exitTimers = useRef(new Map<string, number>());

  const confirmIds = useMemo(
    () =>
      items
        .filter((item) => item.stage === "확인")
        .map((item) => item.id)
        .sort()
        .join(","),
    [items],
  );
  const leavingSig = useMemo(() => [...leaving].sort().join(","), [leaving]);

  useEffect(() => {
    const ids = confirmIds.split(",").filter((id) => id.length > 0);
    const active = new Set(ids);
    const hold = prefersStripReducedMotion() ? 0 : motionDuration.emphasis;
    for (const [id, timer] of holdTimers.current) {
      if (active.has(id)) continue;
      window.clearTimeout(timer);
      holdTimers.current.delete(id);
    }
    for (const id of ids) {
      if (holdTimers.current.has(id)) continue;
      const timer = window.setTimeout(() => {
        holdTimers.current.delete(id);
        setLeaving((prev) => {
          if (prev.has(id)) return prev;
          const next = new Set(prev);
          next.add(id);
          return next;
        });
      }, hold);
      holdTimers.current.set(id, timer);
    }
  }, [confirmIds]);

  useEffect(() => {
    const ids = leavingSig.split(",").filter((id) => id.length > 0);
    const active = new Set(ids);
    const exitMs = prefersStripReducedMotion() ? 0 : motionDuration.exit;
    for (const [id, timer] of exitTimers.current) {
      if (active.has(id)) continue;
      window.clearTimeout(timer);
      exitTimers.current.delete(id);
    }
    for (const id of ids) {
      if (exitTimers.current.has(id)) continue;
      const timer = window.setTimeout(() => {
        exitTimers.current.delete(id);
        setGone((prev) => {
          if (prev.has(id)) return prev;
          const next = new Set(prev);
          next.add(id);
          return next;
        });
      }, exitMs);
      exitTimers.current.set(id, timer);
    }
  }, [leavingSig]);

  useEffect(() => {
    const hold = holdTimers.current;
    const exit = exitTimers.current;
    return () => {
      for (const timer of hold.values()) window.clearTimeout(timer);
      for (const timer of exit.values()) window.clearTimeout(timer);
      hold.clear();
      exit.clear();
    };
  }, []);

  return {
    visible: items.filter((item) => !gone.has(item.id)),
    leaving,
  };
}
