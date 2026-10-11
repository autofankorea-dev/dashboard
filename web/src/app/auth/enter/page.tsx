"use client";

import { Suspense, useLayoutEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useAppNavigate } from "@/components/layout/use-app-navigate";
import { getPostLoginFarmWarmKeyAction } from "@/app/auth/actions";
import { safePostLoginPath } from "@/lib/auth/resolve-post-login-path";
import { warmPostLoginFarmHub } from "@/components/farm/warm-post-login-farm-hub";

function AuthEnterContent() {
  const searchParams = useSearchParams();
  const { navigate } = useAppNavigate();
  const startedRef = useRef(false);

  useLayoutEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    const next = safePostLoginPath(searchParams.get("next"));
    if (next === "/farm") {
      void getPostLoginFarmWarmKeyAction().then((farmKey) => {
        if (farmKey) warmPostLoginFarmHub(farmKey);
      });
    }
    navigate(next, { waitForContentReady: true, variant: "brand" });
  }, [navigate, searchParams]);

  return null;
}

/** OAuth 콜백 직후 — 이메일 로그인과 동일한 brand 스플래시 후 대시보드 진입 */
export default function AuthEnterPage() {
  return (
    <Suspense fallback={null}>
      <AuthEnterContent />
    </Suspense>
  );
}
