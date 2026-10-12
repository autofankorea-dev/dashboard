"use client";

import type { ReactNode } from "react";
import { ControllerMetaProvider } from "@/components/controllers/controller-meta-provider";
import type { ControllerMetaEntry } from "@/lib/domain/controller-meta-shared";

type Props = {
  metas: ControllerMetaEntry[];
  canEdit: boolean;
  children: ReactNode;
};

export function DashboardMetaShell({ metas, canEdit, children }: Props) {
  return (
    <ControllerMetaProvider metas={metas} canEdit={canEdit}>
      {children}
    </ControllerMetaProvider>
  );
}
