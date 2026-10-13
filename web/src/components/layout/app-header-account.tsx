"use client";



import { AccountMenu } from "@/components/account/account-menu";

import type { EditableFarmOption } from "@/lib/data/farm-location";

import type { FarmKey } from "@/lib/domain/farm-key";

import type { FarmSummaryRow } from "@/lib/domain/farm-summaries";

import type { ModuleReceipt, FarmOverview } from "@/lib/data/iot";

import type { AlarmRow } from "@/lib/domain/alarms";



type Role = "admin" | "operator" | "viewer";



type Props = {

  user: {

    displayName: string | null;

    email: string | null;

    role: Role | null;

    avatarUrl: string | null;

  };

  receipts?: ModuleReceipt[];

  farmLocationOptions?: EditableFarmOption[];

  farmOptions?: FarmKey[];

  activeFarmKey?: FarmKey | null;

  farmSummaries?: FarmSummaryRow[];

  canEditLocation?: boolean;

  overview?: FarmOverview;

  alarms?: AlarmRow[];

};



export function AppHeaderAccount({

  user,

  receipts = [],

  farmLocationOptions = [],

  farmOptions = [],

  activeFarmKey = null,

  farmSummaries = [],

  canEditLocation = false,

  overview,

  alarms = [],

}: Props) {

  return (

    <AccountMenu

      user={user}

      receipts={receipts}

      farmLocationOptions={farmLocationOptions}

      farmOptions={farmOptions}

      activeFarmKey={activeFarmKey}

      farmSummaries={farmSummaries}

      canEditLocation={canEditLocation}

      overview={overview}

      alarms={alarms}

    />

  );

}

