"use server";

/** 관리자 허브 지도 Web SDK. 없으면 Leaflet. */
export async function getKakaoJsKeyAction(): Promise<string | null> {
  const key =
    process.env.KAKAO_JS_KEY?.trim() ||
    process.env.NEXT_PUBLIC_KAKAO_JS_KEY?.trim() ||
    "";
  return key || null;
}
