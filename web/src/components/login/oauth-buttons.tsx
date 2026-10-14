"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  finalizeNativeOAuthLogin,
  getOAuthSignInUrl,
  type OAuthProvider,
} from "@/app/auth/actions";
import { isGoogleOAuthBlockedBrowser } from "@/lib/auth/oauth-browser";
import {
  shouldUseNativeOAuth,
  signInWithNativeOAuth,
} from "@/lib/auth/native-oauth";
import { useSheetCopy } from "@/components/account/profile-sheet-prefs";

const emptySubscribe = () => () => {};

function loginPageHref(): string {
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (site) return `${site}/login`;
  if (typeof window !== "undefined") return `${window.location.origin}/login`;
  return "/login";
}

export function OAuthButtons() {
  const router = useRouter();
  const t = useSheetCopy();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const googleBlocked = mounted && isGoogleOAuthBlockedBrowser();
  const nativeOAuth = mounted && shouldUseNativeOAuth();
  const [busy, setBusy] = useState<OAuthProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startOAuth = async (provider: OAuthProvider) => {
    if (busy) return;
    if (provider === "google" && !nativeOAuth && isGoogleOAuthBlockedBrowser()) {
      setError(t("login.googleBlocked"));
      return;
    }
    setError(null);
    setBusy(provider);
    try {
      if (shouldUseNativeOAuth()) {
        await signInWithNativeOAuth(provider);
        await router.refresh();
        const result = await finalizeNativeOAuthLogin();
        if (!result.ok) {
          setError(t("login.failed"));
          setBusy(null);
          return;
        }
        router.push(`/auth/enter?next=${result.nextPath}`);
        return;
      }

      const result = await getOAuthSignInUrl(provider);
      if (!result.ok) {
        setError(t("login.connectionFailed"));
        setBusy(null);
        return;
      }
      /* 사용자 제스처 직후 top-level 이동 — 서버 redirect보다 임베드/프리뷰에 안전 */
      window.location.assign(result.url);
    } catch (err) {
      const message =
        err instanceof Error && err.message.trim()
          ? err.message
          : t("login.connectionFailed");
      setError(message);
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="relative py-1">
        <div className="absolute inset-0 flex items-center" aria-hidden>
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">{t("login.or")}</span>
        </div>
      </div>

      {googleBlocked && !nativeOAuth ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
          {t("login.embeddedNote")}{" "}
          <a
            className="font-medium underline underline-offset-2"
            href={loginPageHref()}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("login.openWindow")}
          </a>
        </p>
      ) : null}

      {error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-center text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        disabled={busy != null || (googleBlocked && !nativeOAuth)}
        onClick={() => void startOAuth("google")}
        className="flex h-10 w-full items-center justify-center gap-2 rounded-md border border-neutral-300 bg-white text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-50 disabled:cursor-wait disabled:opacity-60 dark:border-neutral-300 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-50"
      >
        {busy === "google" ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <GoogleMark />
        )}
        {t("login.google")}
      </button>

      <button
        type="button"
        disabled={busy != null}
        onClick={() => void startOAuth("kakao")}
        className="flex h-10 w-full items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors disabled:cursor-wait disabled:opacity-60"
        style={{ backgroundColor: "#FEE500", color: "#191919" }}
      >
        {busy === "kakao" ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <KakaoMark />
        )}
        {t("login.kakao")}
      </button>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg
      aria-hidden
      className="size-4"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

function KakaoMark() {
  return (
    <svg
      aria-hidden
      className="size-4"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fill="#191919"
        d="M12 3C6.48 3 2 6.58 2 10.86c0 2.72 1.78 5.11 4.47 6.5-.14.52-.9 3.35-.93 3.56 0 0-.18.15.01.29.08.06.18.04.18.04.24-.03 2.77-1.82 3.21-2.13.97.14 1.98.22 3.06.22 5.52 0 10-3.58 10-7.98S17.52 3 12 3z"
      />
    </svg>
  );
}
