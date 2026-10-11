"use client";

import { useSyncExternalStore } from "react";
import type { AlarmRow } from "@/lib/domain/alarms";
import { isModuleAlarmRow } from "@/lib/domain/alarms";

/**
 * FarmLiveRefreshProvider(페이지 children) → TopBar/FAB(PageShell 밖) 알람 브리지.
 * Context로 못 올리므로 모듈 구독으로 전달한다.
 */
let published: AlarmRow[] | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function sameAlarmInbox(a: AlarmRow[], b: AlarmRow[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const left = a[i]!;
    const right = b[i]!;
    if (
      left.id !== right.id ||
      left.alarmType !== right.alarmType ||
      left.detail !== right.detail ||
      left.status !== right.status
    ) {
      return false;
    }
  }
  return true;
}

export function publishShellAlarms(next: AlarmRow[]): void {
  if (published != null && sameAlarmInbox(published, next)) return;
  published = next;
  emit();
}

/** 확인(ack) 직후 낙관적 제거 — 배지·목록 즉시 반영 */
export function removeShellAlarm(id: string, fromList?: AlarmRow[]): void {
  const base = published ?? fromList;
  if (base == null) return;
  const next = base.filter((a) => a.id !== id);
  if (published != null && next.length === published.length) return;
  published = next;
  emit();
}

/** 일괄 확인 — 여러 id 낙관적 제거 */
export function removeShellAlarms(ids: Iterable<string>, fromList?: AlarmRow[]): void {
  const idSet = new Set(ids);
  if (idSet.size === 0) return;
  const base = published ?? fromList;
  if (base == null) return;
  const next = base.filter((a) => !idSet.has(a.id));
  if (published != null && next.length === published.length) return;
  published = next;
  emit();
}

/** 모듈 경보만 갱신 — 통신두절(derived) 행은 유지 */
export function patchShellModuleAlarms(moduleAlarms: AlarmRow[]): void {
  const base = published ?? [];
  const derived = base.filter((a) => !isModuleAlarmRow(a));
  published = [...moduleAlarms, ...derived];
  emit();
}

/** Provider unmount · farm 이탈 시 SSR props로 되돌림 */
export function clearShellAlarms(): void {
  if (published == null) return;
  published = null;
  emit();
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

export const EMPTY_SITUATION_ALARMS: AlarmRow[] = [];

function getSnapshot(fallback: AlarmRow[]): AlarmRow[] {
  return published ?? fallback;
}

/**
 * LIVE/설정 패치가 있으면 그걸, 없으면 PageShell SSR `alarms` 사용.
 */
export function useShellAlarms(fallback: AlarmRow[]): AlarmRow[] {
  return useSyncExternalStore(
    subscribe,
    () => getSnapshot(fallback),
    () => fallback,
  );
}
