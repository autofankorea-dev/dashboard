"use client";

import { useProfileSheetPrefs } from "@/components/account/profile-sheet-prefs";
import { opsTypography } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

export function OpsServiceRoleNotice() {
  const en = useProfileSheetPrefs().locale === "en";
  return (
    <p
      className={cn(
        "rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-amber-900",
        opsTypography.alert,
      )}
    >
      {en ? (
        <>
          SUPABASE_SERVICE_ROLE_KEY is not set. Add the service_role key to{" "}
          <code>web/.env.local</code> so the user list and access grants work.
        </>
      ) : (
        <>
          SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.{" "}
          <code>web/.env.local</code>에 service_role 키를 입력해야 사용자
          목록/권한 부여가 동작합니다.
        </>
      )}
    </p>
  );
}
