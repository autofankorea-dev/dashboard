"use client";

import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { signInWithEmail } from "@/app/auth/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoginSubmitButton } from "@/components/login/login-submit-button";
import type { FarmKey } from "@/lib/domain/farm-key";
import { useSheetCopy } from "@/components/account/profile-sheet-prefs";
import { readDashboardLocale } from "@/lib/ui/dashboard-locale-store";
import { sheetCopy, type SheetCopyKey } from "@/lib/ui/sheet-copy";

const ERROR_KEYS = {
  credentials: "login.badCredentials",
  missing: "login.missing",
  auth: "login.failed",
} as const satisfies Record<string, SheetCopyKey>;

type LoginFormProps = {
  initialError?: string | null;
  onSuccessNavigate?: (
    nextPath: "/farm" | "/pending",
    farmKey: FarmKey | null,
  ) => void | Promise<void>;
};

export function LoginForm({
  initialError = null,
  onSuccessNavigate,
}: LoginFormProps) {
  const router = useRouter();
  const t = useSheetCopy();

  const [error, submitAction] = useActionState(
    async (_prev: string | null, formData: FormData) => {
      const result = await signInWithEmail(formData);
      if (!result.ok) {
        const locale = readDashboardLocale();
        const key = ERROR_KEYS[result.error] ?? ERROR_KEYS.auth;
        return sheetCopy(locale, key);
      }

      await router.refresh();

      if (onSuccessNavigate) {
        await onSuccessNavigate(result.nextPath, result.farmKey);
      } else {
        router.push(result.nextPath);
      }

      return null;
    },
    initialError
  );

  return (
    <>
      {error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-center text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <form action={submitAction} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">{t("login.id")}</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="name@example.com"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">{t("login.password")}</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            required
          />
        </div>
        <LoginSubmitButton />
      </form>
    </>
  );
}
