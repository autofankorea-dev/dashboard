"use client";

import type { ReactNode } from "react";
import { ProfileAvatar } from "@/components/account/profile-avatar";
import { accountMenuLayout } from "@/lib/ui/account-menu-layout";

type Props = {
  name: string;
  avatarUrl: string | null;
  identity?: ReactNode;
  trailing?: ReactNode;
};

export function AccountMenuHub({ name, avatarUrl, identity, trailing }: Props) {
  return (
    <div className={accountMenuLayout.sheetHeader} data-tour-id="account-menu-hub">
      <ProfileAvatar url={avatarUrl} className={accountMenuLayout.hubAvatar} />
      <p id="account-menu-sheet-title" className={accountMenuLayout.hubName}>
        {name}
      </p>
      {identity ? (
        <div className={accountMenuLayout.sheetIdentity}>{identity}</div>
      ) : (
        <div className="min-w-0 flex-1" />
      )}
      {trailing ? (
        <div className={accountMenuLayout.sheetHeaderActions}>{trailing}</div>
      ) : null}
    </div>
  );
}
