"use client";

import type { ReactNode } from "react";
import { ProfileAvatar } from "@/components/account/profile-avatar";
import { accountMenuLayout } from "@/lib/ui/account-menu-layout";

type Props = {
  name: string;
  avatarUrl: string | null;
  email: string | null;
  roleLabel?: string | null;
  trailing?: ReactNode;
};

export function AccountMenuHub({
  name,
  avatarUrl,
  email,
  roleLabel,
  trailing,
}: Props) {
  return (
    <div className={accountMenuLayout.sheetHeader}>
      <ProfileAvatar url={avatarUrl} className={accountMenuLayout.hubAvatar} />
      <div className="min-w-0 flex-1">
        <p id="account-menu-sheet-title" className={accountMenuLayout.hubName}>
          {name}
        </p>
        {email ? <p className={accountMenuLayout.hubMeta}>{email}</p> : null}
        {roleLabel ? (
          <p className={accountMenuLayout.hubMeta}>{roleLabel}</p>
        ) : null}
      </div>
      {trailing ? (
        <div className={accountMenuLayout.sheetHeaderActions}>{trailing}</div>
      ) : null}
    </div>
  );
}
