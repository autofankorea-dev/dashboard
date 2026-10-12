"use client";

import { Capacitor } from "@capacitor/core";
import { SocialLogin } from "@capgo/capacitor-social-login";
import { KakaoLogin } from "@chuseok22/capacitor-kakao-login";
import { createClient } from "@/lib/supabase/browser";
import type { OAuthProvider } from "@/lib/auth/oauth-provider";

let googleReady: Promise<void> | null = null;

function googleWebClientId(): string {
  return process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() ?? "";
}

function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

async function ensureGoogleInitialized(): Promise<void> {
  const webClientId = googleWebClientId();
  if (!webClientId) {
    throw new Error(
      "Google 로그인 설정이 없습니다. NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID를 확인해 주세요.",
    );
  }
  if (!googleReady) {
    googleReady = SocialLogin.initialize({
      google: {
        webClientId,
        mode: "online",
      },
    });
  }
  await googleReady;
}

async function signInWithGoogleIdToken(): Promise<void> {
  await ensureGoogleInitialized();
  // scopes를 넘기면 Capgo가 ModifiedMainActivity를 요구함.
  // email/profile/openid는 Android 플러그인 기본값으로 이미 포함됨.
  const login = await SocialLogin.login({
    provider: "google",
    options: {},
  });

  const idToken =
    login.provider === "google" && login.result && "idToken" in login.result
      ? login.result.idToken
      : null;

  if (!idToken) {
    throw new Error("Google 로그인 토큰을 받지 못했습니다.");
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: idToken,
  });
  if (error) throw error;
}

async function signInWithKakaoIdToken(): Promise<void> {
  const { idToken } = await KakaoLogin.login();
  if (!idToken) {
    throw new Error(
      "카카오 ID 토큰이 없습니다. OpenID Connect 설정을 확인해 주세요.",
    );
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithIdToken({
    provider: "kakao",
    token: idToken,
  });
  if (error) throw error;
}

/** 네이티브(Android)에서 Google / 카카오 → Supabase 세션 */
export async function signInWithNativeOAuth(
  provider: OAuthProvider,
): Promise<void> {
  if (!isNativeApp()) {
    throw new Error("네이티브 앱에서만 사용할 수 있습니다.");
  }
  if (provider === "google") {
    await signInWithGoogleIdToken();
    return;
  }
  await signInWithKakaoIdToken();
}

export function shouldUseNativeOAuth(): boolean {
  return isNativeApp();
}
