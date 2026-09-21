"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motionDuration } from "@/lib/ui/motion-tokens";

export type ClipPhase = "enter" | "shown" | "exit";

export type ClipPresenceEntry<T> = {
  key: string;
  phase: ClipPhase;
  item: T;
};

type Options = {
  enabled?: boolean;
  enterMs?: number;
  exitMs?: number;
};

export function clipPresencePhaseKey(
  entries: readonly { key: string; phase: ClipPhase }[],
): string {
  return entries.map((e) => `${e.key}:${e.phase}`).join("|");
}

export function clipPresenceLiveKey(keys: readonly string[]): string {
  return keys.join("\0");
}

/**
 * 라이브 키 집합 기준으로 enter/shown/exit 엔트리를 계산한다.
 * 렌더 중 setState 없이 같은 입력이면 같은 phase 시그니처를 만든다.
 */
export function nextClipPresenceEntries<T>(
  prev: readonly ClipPresenceEntry<T>[],
  liveKeys: readonly string[],
  itemByKey: Map<string, T>,
): ClipPresenceEntry<T>[] {
  const liveSet = new Set(liveKeys);
  const prevByKey = new Map(prev.map((e) => [e.key, e]));
  const next: ClipPresenceEntry<T>[] = [];
  for (const key of liveKeys) {
    const item = itemByKey.get(key)!;
    const old = prevByKey.get(key);
    if (!old || old.phase === "exit") {
      next.push({ key, phase: "enter", item });
    } else {
      next.push({
        key,
        phase: old.phase === "enter" ? "enter" : "shown",
        item,
      });
    }
  }
  for (const e of prev) {
    if (!liveSet.has(e.key)) {
      next.push({
        key: e.key,
        phase: "exit",
        item: e.item,
      });
    }
  }
  return next;
}

function mapItemsByKey<T>(
  items: readonly T[],
  getKey: (item: T) => string,
): { liveKeys: string[]; itemByKey: Map<string, T> } {
  const liveKeys = items.map(getKey);
  const itemByKey = new Map<string, T>();
  for (let i = 0; i < items.length; i++) {
    itemByKey.set(liveKeys[i]!, items[i]!);
  }
  return { liveKeys, itemByKey };
}

/**
 * 시리즈/히스토그램 키 단위 enter·exit 유지.
 * 첫 마운트는 wipe 없이 shown, 이후 추가/삭제만 클립 와이프.
 * 키 동기화는 layout effect — 렌더 중 setState로 #301이 나지 않게 한다.
 */
export function useClipPresence<T>(
  items: T[],
  getKey: (item: T) => string,
  options: Options = {},
): ClipPresenceEntry<T>[] {
  const {
    enabled = true,
    enterMs = motionDuration.moderate,
    exitMs = motionDuration.moderate,
  } = options;

  const { liveKeys, itemByKey } = mapItemsByKey(items, getKey);
  const liveKeyStr = clipPresenceLiveKey(liveKeys);

  const [entries, setEntries] = useState<ClipPresenceEntry<T>[]>(() =>
    liveKeys.map((key) => ({
      key,
      phase: "shown" as const,
      item: itemByKey.get(key)!,
    })),
  );

  const syncedKeyRef = useRef(liveKeyStr);
  const enabledRef = useRef(enabled);

  useLayoutEffect(() => {
    const wasEnabled = enabledRef.current;
    enabledRef.current = enabled;
    if (!enabled) {
      syncedKeyRef.current = liveKeyStr;
      return;
    }
    if (liveKeyStr === syncedKeyRef.current && wasEnabled) return;
    syncedKeyRef.current = liveKeyStr;
    const { liveKeys: keys, itemByKey: byKey } = mapItemsByKey(items, getKey);
    setEntries((prev) => {
      const next = nextClipPresenceEntries(prev, keys, byKey);
      return clipPresencePhaseKey(next) === clipPresencePhaseKey(prev)
        ? prev
        : next;
    });
    // liveKeyStr이 바뀐 렌더의 items/getKey를 쓴다. identity 의존은 #301을 다시 연다.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- liveKeyStr is the membership trigger
  }, [enabled, liveKeyStr]);

  const phaseKey = clipPresencePhaseKey(entries);

  useEffect(() => {
    if (!enabled) return;
    const timers: number[] = [];
    for (const e of entries) {
      if (e.phase === "enter") {
        timers.push(
          window.setTimeout(() => {
            setEntries((prev) =>
              prev.map((x) =>
                x.key === e.key && x.phase === "enter"
                  ? { ...x, phase: "shown" }
                  : x,
              ),
            );
          }, enterMs),
        );
      } else if (e.phase === "exit") {
        timers.push(
          window.setTimeout(() => {
            setEntries((prev) => prev.filter((x) => x.key !== e.key));
          }, exitMs),
        );
      }
    }
    return () => {
      for (const t of timers) window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- phaseKey tracks enter/exit
  }, [enabled, enterMs, exitMs, phaseKey]);

  if (!enabled) {
    return liveKeys.map((key) => ({
      key,
      phase: "shown" as const,
      item: itemByKey.get(key)!,
    }));
  }

  return entries.map((e) => ({
    key: e.key,
    phase: e.phase,
    item:
      e.phase === "exit" ? e.item : (itemByKey.get(e.key) ?? e.item),
  }));
}

/**
 * 열림/닫힘 유지 — 닫힐 때 exit 애니 후 unmount.
 * 열릴 때는 boolean 한 번만 보정 (객체 identity 비교 없음).
 * @see https://react.dev/reference/react/useState#storing-information-from-previous-renders
 */
export function useOpenPresence(
  open: boolean,
  exitMs: number = motionDuration.exit,
): { mounted: boolean; phase: "enter" | "exit" } {
  const [show, setShow] = useState(open);

  if (open && !show) {
    setShow(true);
  }

  useEffect(() => {
    if (open) return;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const wait = reduced ? 0 : exitMs;
    const t = window.setTimeout(() => setShow(false), wait);
    return () => window.clearTimeout(t);
  }, [open, exitMs]);

  return {
    mounted: show,
    phase: open ? "enter" : "exit",
  };
}

/**
 * 값이 없어져도 exit 동안 마지막 값을 유지한다.
 * 차트 호버 카드·드래프트·강조선처럼 등장/퇴장 UI용.
 * 객체 identity로 렌더 중 setState 하지 않는다 — 매 렌더 새 객체여도 #301이 나지 않는다.
 */
export function usePresenceValue<T>(
  value: T | null | undefined,
  options?: { exitMs?: number; open?: boolean },
): { mounted: boolean; phase: "enter" | "exit"; value: T | null } {
  const open = Boolean(options?.open ?? value != null);
  const presence = useOpenPresence(open, options?.exitMs);
  const [held, setHeld] = useState<T | null>(value ?? null);
  const openRef = useRef(open);
  const lastValueRef = useRef<T | null>(value ?? null);

  useLayoutEffect(() => {
    if (value != null) {
      lastValueRef.current = value;
    }
    const wasOpen = openRef.current;
    openRef.current = open;
    if (wasOpen && !open) {
      setHeld(lastValueRef.current);
    }
  }, [open, value]);

  return {
    mounted: presence.mounted,
    phase: presence.phase,
    value: value ?? held,
  };
}
