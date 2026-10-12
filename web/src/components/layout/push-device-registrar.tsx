"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { upsertPushDeviceAction } from "@/app/(dashboard)/push-actions";
import {
  bindPushNotificationNavigation,
  registerPushDeviceIfNative,
} from "@/lib/push/register-push-device";

/**
 * 로그인된 대시보드 셸에서 Capacitor Android 푸시 토큰 등록·알림 탭 라우팅.
 * 브라우저/iPhone 웹에서는 no-op.
 */
export function PushDeviceRegistrar() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    let unbind: (() => void) | undefined;

    void (async () => {
      await registerPushDeviceIfNative(upsertPushDeviceAction);
      if (cancelled) return;
      unbind = await bindPushNotificationNavigation((href) => {
        router.push(href);
      });
    })();

    return () => {
      cancelled = true;
      unbind?.();
    };
  }, [router]);

  return null;
}
