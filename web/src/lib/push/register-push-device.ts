import { Capacitor } from "@capacitor/core";

type UpsertPushDevice = (input: {
  fcmToken: string;
  platform: "android" | "ios";
  appId?: string | null;
  deviceLabel?: string | null;
}) => Promise<unknown>;

const APP_ID = "com.autofankorea.dashboard";

function resolveHrefFromNotificationData(
  data: Record<string, unknown> | undefined,
): string | null {
  if (!data) return null;
  const href = data.href;
  if (typeof href === "string" && href.startsWith("/")) return href;
  const lsind = typeof data.lsind === "string" ? data.lsind : "";
  const itemCode =
    typeof data.itemCode === "string"
      ? data.itemCode
      : typeof data.item === "string"
        ? data.item
        : "";
  if (!lsind) return "/farm";
  const params = new URLSearchParams();
  params.set("lsind", lsind);
  if (itemCode) params.set("item", itemCode);
  return `/farm?${params.toString()}`;
}

/** Capacitor Android에서만 FCM 권한·토큰 등록. 브라우저/iOS 웹은 no-op. */
export async function registerPushDeviceIfNative(
  upsertPushDevice: UpsertPushDevice,
): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  if (Capacitor.getPlatform() !== "android") return;

  const { PushNotifications } = await import("@capacitor/push-notifications");

  let perm = await PushNotifications.checkPermissions();
  if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") {
    perm = await PushNotifications.requestPermissions();
  }
  if (perm.receive !== "granted") return;

  await PushNotifications.register();

  await new Promise<void>((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    void PushNotifications.addListener("registration", (token) => {
      void upsertPushDevice({
        fcmToken: token.value,
        platform: "android",
        appId: APP_ID,
        deviceLabel: Capacitor.getPlatform(),
      }).finally(done);
    });

    void PushNotifications.addListener("registrationError", () => {
      done();
    });

    // 리스너가 오지 않는 환경 대비
    setTimeout(done, 15_000);
  });
}

/** 알림 탭 → 앱 내 라우트 이동. Capacitor Android만. */
export async function bindPushNotificationNavigation(
  navigate: (href: string) => void,
): Promise<() => void> {
  if (!Capacitor.isNativePlatform()) return () => undefined;
  if (Capacitor.getPlatform() !== "android") return () => undefined;

  const { PushNotifications } = await import("@capacitor/push-notifications");
  const { App } = await import("@capacitor/app");

  const handleData = (data: Record<string, unknown> | undefined) => {
    const href = resolveHrefFromNotificationData(data);
    if (href) navigate(href);
  };

  const actionSub = await PushNotifications.addListener(
    "pushNotificationActionPerformed",
    (event) => {
      handleData(event.notification.data as Record<string, unknown> | undefined);
    },
  );

  const urlSub = await App.addListener("appUrlOpen", (event) => {
    try {
      const url = new URL(event.url);
      const path = `${url.pathname}${url.search}`;
      if (path.startsWith("/")) navigate(path);
    } catch {
      /* ignore malformed */
    }
  });

  return () => {
    void actionSub.remove();
    void urlSub.remove();
  };
}
