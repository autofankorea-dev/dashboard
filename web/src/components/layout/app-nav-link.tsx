"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useCallback,
  useSyncExternalStore,
  type ComponentProps,
  type MouseEvent,
} from "react";
import { useProfileSheetPrefs } from "@/components/account/profile-sheet-prefs";
import { useAppNavigate } from "@/components/layout/use-app-navigate";
import { hrefToString, shouldUseGlobalNav } from "@/lib/navigation/nav-utils";
import type { NavMessageOptions } from "@/lib/navigation/nav-messages";
import { cn } from "@/lib/utils";

type AppNavLinkProps = ComponentProps<typeof Link> & NavMessageOptions;

const emptySubscribe = () => () => {};

export function AppNavLink({
  href,
  onClick,
  message,
  sublabel,
  className,
  "aria-busy": ariaBusyProp,
  ...rest
}: AppNavLinkProps) {
  const pathname = usePathname();
  const { navigate, isPending } = useAppNavigate();
  const { locale } = useProfileSheetPrefs();
  const hrefStr = hrefToString(href as Parameters<typeof hrefToString>[0]);
  const useGlobal = shouldUseGlobalNav(hrefStr, pathname);
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  /** SSR·hydration과 동일 — pending 시각은 마운트 후에만 */
  const pendingVisual = mounted && isPending && useGlobal;
  const ariaBusy = pendingVisual || ariaBusyProp ? true : undefined;

  const handleClick = useCallback(
    (e: MouseEvent<HTMLAnchorElement>) => {
      onClick?.(e);
      if (e.defaultPrevented) return;
      if (!useGlobal) return;
      e.preventDefault();
      /* pending 중이어도 navigate가 목적지를 교체 */
      navigate(hrefStr, { message, sublabel, locale });
    },
    [onClick, useGlobal, navigate, hrefStr, message, sublabel, locale],
  );

  return (
    <Link
      href={href}
      className={cn(pendingVisual && "opacity-70", className)}
      onClick={handleClick}
      aria-busy={ariaBusy}
      suppressHydrationWarning
      {...rest}
    />
  );
}
