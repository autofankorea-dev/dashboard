"use client";

import { useEffect, useState } from "react";
import { HealthSystemShell } from "@/components/admin/health/health-system-shell";
import { AdminOpsTabContentSkeleton } from "@/components/admin/admin-ops-loading-skeleton";
import { fetchHealthSnapshotAction } from "@/app/(dashboard)/admin/ops/health-actions";
import type { HealthSnapshot } from "@/lib/admin/health/types";
import { opsLayout } from "@/lib/ui/dashboard-page-ui";

/**
 * Phase C — Ops Scan을 SSR critical path에서 분리.
 * Directory/Commands와 서버 경쟁 없이 mount/idle 후 client fetch.
 */
export function OpsScanClient() {
  const [snapshot, setSnapshot] = useState<HealthSnapshot | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let idleId = 0;
    const run = () => {
      void fetchHealthSnapshotAction()
        .then((next) => {
          if (cancelled) return;
          setSnapshot(next);
          setError(false);
        })
        .catch(() => {
          if (cancelled) return;
          setError(true);
        });
    };
    const ric =
      typeof window !== "undefined" && "requestIdleCallback" in window
        ? window.requestIdleCallback.bind(window)
        : null;
    if (ric) {
      idleId = ric(run, { timeout: 1200 });
    } else {
      idleId = window.setTimeout(run, 0);
    }
    return () => {
      cancelled = true;
      if (ric && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      } else {
        window.clearTimeout(idleId);
      }
    };
  }, []);

  if (error && !snapshot) {
    return (
      <section id="scan" className={opsLayout.sectionScan}>
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          스캔 데이터를 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.
        </p>
      </section>
    );
  }

  if (!snapshot) {
    return (
      <section id="scan" className={opsLayout.sectionScan}>
        <AdminOpsTabContentSkeleton label="스캔" />
      </section>
    );
  }

  return (
    <section id="scan" className={opsLayout.sectionScan}>
      <HealthSystemShell snapshot={snapshot} />
    </section>
  );
}
