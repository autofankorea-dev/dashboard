/** 로그인 세션의 프로필 사진. Google·카카오 호스트만 허용한다. */

const GOOGLE_HOST_SUFFIX = ".googleusercontent.com";
const KAKAO_HOST = "k.kakaocdn.net";

function readMetaString(metadata: unknown, key: string): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const value = (metadata as Record<string, unknown>)[key];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function allowedHost(hostname: string): boolean {
  return hostname === KAKAO_HOST || hostname.endsWith(GOOGLE_HOST_SUFFIX);
}

/**
 * `avatar_url`을 우선하고, 없으면 `picture`.
 * 카카오 CDN은 http로 저장되어 있어 https로 바꾼 뒤 쓴다.
 */
export function resolveProfileAvatarUrl(metadata: unknown): string | null {
  const raw = readMetaString(metadata, "avatar_url") ?? readMetaString(metadata, "picture");
  if (!raw) return null;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.username || url.password) return null;
  if (url.protocol === "http:" && url.hostname === KAKAO_HOST) {
    url.protocol = "https:";
  }
  if (url.protocol !== "https:") return null;
  if (!allowedHost(url.hostname)) return null;
  return url.toString();
}
