"use client";

import { LoginForm } from "@/components/login/login-form";
import { useAppNavigate } from "@/components/layout/use-app-navigate";
import { warmPostLoginFarmHub } from "@/components/farm/warm-post-login-farm-hub";

type LoginFormWithNavProps = {
  initialError?: string | null;
};

export function LoginFormWithNav({ initialError }: LoginFormWithNavProps) {
  const { navigate } = useAppNavigate();

  return (
    <LoginForm
      initialError={initialError}
      onSuccessNavigate={async (nextPath, farmKey) => {
        if (nextPath === "/farm" && farmKey) {
          warmPostLoginFarmHub(farmKey);
        }
        navigate(nextPath, {
          waitForContentReady: true,
          variant: "brand",
        });
      }}
    />
  );
}
