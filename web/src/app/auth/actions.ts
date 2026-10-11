"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { resolvePostLoginPath } from "@/lib/auth/resolve-post-login-path";
import { resolveFixedFarmKey } from "@/lib/auth/farm-access";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import type { FarmKey } from "@/lib/domain/farm-key";
import { createClient } from "@/lib/supabase/server";

export type SignInErrorCode = "missing" | "credentials" | "auth";

export type SignInResult =
  | { ok: true; nextPath: "/farm" | "/pending"; farmKey: FarmKey | null }
  | { ok: false; error: SignInErrorCode };

export type OAuthProvider = "google" | "kakao";

/** Admin hub cold TTFB — 로그인 직후 overview 캐시를 미리 채운다. */
async function warmAdminHubOverviewCache(): Promise<void> {
  try {
    const { fetchFarmOverviewRows } = await import(
      "@/lib/data/iot-live-fetch"
    );
    await fetchFarmOverviewRows();
  } catch {
    /* best-effort — /farm이 다시 조회 */
  }
}

async function farmKeyForPostLoginWarm(): Promise<FarmKey | null> {
  const user = await getCurrentUser();
  if (!user?.hasAccess || user.isAdmin) return null;
  return resolveFixedFarmKey(user);
}

async function okSignIn(nextPath: "/farm" | "/pending"): Promise<{
  ok: true;
  nextPath: "/farm" | "/pending";
  farmKey: FarmKey | null;
}> {
  return {
    ok: true,
    nextPath,
    farmKey: nextPath === "/farm" ? await farmKeyForPostLoginWarm() : null,
  };
}

/** OAuth enter — 세션이 이미 있을 때 필드 warm 대상. */
export async function getPostLoginFarmWarmKeyAction(): Promise<FarmKey | null> {
  return farmKeyForPostLoginWarm();
}

function appOriginFromHeaders(headerStore: Headers): string {
  const envSite = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (envSite) return envSite;

  const forwardedHost = headerStore.get("x-forwarded-host");
  const forwardedProto = headerStore.get("x-forwarded-proto") ?? "https";
  if (forwardedHost) return `${forwardedProto}://${forwardedHost}`;

  const origin = headerStore.get("origin");
  if (origin) return origin;

  const host = headerStore.get("host");
  if (host) {
    const proto = host.includes("localhost") ? "http" : "https";
    return `${proto}://${host}`;
  }

  return "http://localhost:3000";
}

export async function signInWithEmail(formData: FormData): Promise<SignInResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { ok: false, error: "missing" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { ok: false, error: "credentials" };
  }

  const { nextPath, isAdmin } = await resolvePostLoginPath(supabase);
  if (
    nextPath === "/farm" &&
    isAdmin &&
    process.env.SKIP_ADMIN_HUB_WARM !== "1"
  ) {
    await warmAdminHubOverviewCache();
  }
  return okSignIn(nextPath);
}

export async function signInWithOAuthProvider(provider: OAuthProvider) {
  const result = await getOAuthSignInUrl(provider);
  if (!result.ok) {
    redirect("/login?error=auth");
  }
  redirect(result.url);
}

/** 클라이언트 top-level 이동용 — skipBrowserRedirect로 URL만 반환 */
export async function getOAuthSignInUrl(
  provider: OAuthProvider,
): Promise<{ ok: true; url: string } | { ok: false }> {
  const supabase = await createClient();
  const headerStore = await headers();
  const origin = appOriginFromHeaders(headerStore);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${origin}/auth/callback`,
      skipBrowserRedirect: true,
    },
  });

  if (error || !data.url) {
    return { ok: false };
  }
  return { ok: true, url: data.url };
}

export async function signInWithGoogle() {
  await signInWithOAuthProvider("google");
}

export async function signInWithKakao() {
  await signInWithOAuthProvider("kakao");
}

/**
 * 네이티브 SDK → signInWithIdToken 후 쿠키 세션이 잡힌 뒤 호출.
 * 이메일 로그인과 동일하게 /farm | /pending 을 결정한다.
 */
export async function finalizeNativeOAuthLogin(): Promise<SignInResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "auth" };
  }

  const { nextPath, isAdmin } = await resolvePostLoginPath(supabase);
  if (
    nextPath === "/farm" &&
    isAdmin &&
    process.env.SKIP_ADMIN_HUB_WARM !== "1"
  ) {
    await warmAdminHubOverviewCache();
  }
  return okSignIn(nextPath);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
