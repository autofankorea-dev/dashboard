"use client";

import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { signInWithEmail } from "@/app/auth/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoginSubmitButton } from "@/components/login/login-submit-button";
import type { FarmKey } from "@/lib/domain/farm-key";

const ERROR_MESSAGES: Record<string, string> = {
  credentials: "이메일 또는 비밀번호가 올바르지 않습니다.",
  missing: "이메일과 비밀번호를 입력해 주세요.",
  auth: "로그인에 실패했습니다. 다시 시도해 주세요.",
};

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

  const [error, submitAction] = useActionState(
    async (_prev: string | null, formData: FormData) => {
      const result = await signInWithEmail(formData);
      if (!result.ok) {
        return ERROR_MESSAGES[result.error] ?? ERROR_MESSAGES.auth;
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
          <Label htmlFor="email">아이디</Label>
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
          <Label htmlFor="password">비밀번호</Label>
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
