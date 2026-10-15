"use client";

import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { grantFarmAccessInline } from "@/app/(dashboard)/admin/ops/users-actions";
import {
  AdminFarmDirectoryCard,
  type FarmDirectoryAccess,
} from "@/components/admin/admin-farm-directory-card";
import { InlineStatusToast } from "@/components/common/inline-status-toast";
import { BarnPanelBottomSheet } from "@/components/farm/barn-panel-bottom-sheet";
import { PageActionButton } from "@/components/common/page-action-button";
import { Input } from "@/components/ui/input";
import type { ManagedUser } from "@/lib/admin/list-users";
import type { GrantFarmOption } from "@/components/admin/grant-farm-types";
import { farmKeyId, type FarmKey } from "@/lib/domain/farm-key";
import type { EditableFarmOption } from "@/lib/data/farm-location";
import { useMobileLayout } from "@/lib/ui/use-mobile-layout";
import { opsControl, opsLayout, opsStatus, opsTypography } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

function directoryKey(user: ManagedUser): string {
  return user.email ?? user.id;
}

function directoryName(user: ManagedUser): string {
  return user.displayName?.trim() || user.email || user.id.slice(0, 8);
}

function directoryMeta(user: ManagedUser): string {
  return user.email ?? "이메일 없음";
}

function grantErrorMessage(
  error: "forbidden" | "invalid" | "notfound" | "config",
): string {
  switch (error) {
    case "forbidden":
      return "권한이 없습니다.";
    case "notfound":
      return "사용자를 찾을 수 없습니다.";
    case "config":
      return "권한 부여는 SUPABASE_SERVICE_ROLE_KEY가 필요합니다.";
    default:
      return "요청을 처리할 수 없습니다.";
  }
}

type Props = {
  users: ManagedUser[];
  farmOptions: GrantFarmOption[];
  locationOptions: EditableFarmOption[];
};

function farmValue(fk: FarmKey) {
  return farmKeyId(fk);
}

function buildAccessMap(user: ManagedUser | null): Map<string, FarmDirectoryAccess> {
  const map = new Map<string, FarmDirectoryAccess>();
  if (!user) return map;
  for (const a of user.farmAccess) {
    map.set(`${a.lsindRegistNo}/${a.itemCode}`, {
      can_read: a.can_read,
      can_command: a.can_command,
    });
  }
  return map;
}

/** B안 — 사용자 레일 + 농장 상세 (모바일: bottom sheet). */
export function AdminDirectoryPanel({
  users,
  farmOptions,
  locationOptions,
}: Props) {
  const isMobile = useMobileLayout();
  const listedUsers = users;

  const [userQuery, setUserQuery] = useState("");
  const [selectedKey, setSelectedKey] = useState(
    () => (listedUsers[0] ? directoryKey(listedUsers[0]) : ""),
  );
  const [sheetOpen, setSheetOpen] = useState(false);
  const [accessByFarmId, setAccessByFarmId] = useState(() =>
    buildAccessMap(listedUsers[0] ?? null),
  );
  const [addFarmId, setAddFarmId] = useState("");
  const [addPending, startAdd] = useTransition();
  const [expandedFarmId, setExpandedFarmId] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    tone: "ok" | "err";
  } | null>(null);
  const addFarmSelectRef = useRef<HTMLSelectElement>(null);

  const notify = useCallback((message: string, tone: "ok" | "err" = "ok") => {
    setToast({ message, tone });
  }, []);

  const dismissToast = useCallback(() => setToast(null), []);

  const focusAddFarm = useCallback(() => {
    addFarmSelectRef.current?.focus();
    addFarmSelectRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, []);

  const filteredUsers = useMemo(() => {
    const q = userQuery.trim().toLowerCase();
    if (!q) return listedUsers;
    return listedUsers.filter((u) => {
      const hay = `${directoryName(u)} ${directoryMeta(u)}`.toLowerCase();
      return hay.includes(q);
    });
  }, [listedUsers, userQuery]);

  const selectedUser =
    listedUsers.find((u) => directoryKey(u) === selectedKey) ?? null;

  const locationById = useMemo(() => {
    const map = new Map<string, EditableFarmOption>();
    for (const o of locationOptions) {
      map.set(farmKeyId(o.farmKey), o);
    }
    return map;
  }, [locationOptions]);

  const labelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const o of farmOptions) {
      map.set(farmValue(o.farmKey), o.label);
    }
    for (const o of locationOptions) {
      const id = farmKeyId(o.farmKey);
      if (!map.has(id)) map.set(id, o.label);
    }
    return map;
  }, [farmOptions, locationOptions]);

  const userFarmCards = useMemo(() => {
    const ids = [...accessByFarmId.keys()].filter((id) => {
      const a = accessByFarmId.get(id);
      return a?.can_read || a?.can_command;
    });
    return ids
      .map((id) => {
        const [lsind, item] = id.split("/");
        if (!lsind || !item) return null;
        const farmKey: FarmKey = { lsindRegistNo: lsind, itemCode: item };
        return {
          farmKey,
          farmId: id,
          label: labelById.get(id) ?? id,
          access: accessByFarmId.get(id) ?? {
            can_read: false,
            can_command: false,
          },
          locationOption: locationById.get(id) ?? null,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x != null)
      .sort((a, b) => a.label.localeCompare(b.label, "ko"));
  }, [accessByFarmId, labelById, locationById]);

  const addableFarms = useMemo(() => {
    return farmOptions.filter((o) => {
      const id = farmValue(o.farmKey);
      const a = accessByFarmId.get(id);
      return !(a?.can_read || a?.can_command);
    });
  }, [farmOptions, accessByFarmId]);

  const selectUser = (key: string) => {
    const user = listedUsers.find((u) => directoryKey(u) === key) ?? null;
    setSelectedKey(key);
    setAccessByFarmId(buildAccessMap(user));
    setAddFarmId("");
    setExpandedFarmId(null);
    if (isMobile) setSheetOpen(true);
  };

  const onAccessChange = (farmId: string, access: FarmDirectoryAccess) => {
    setAccessByFarmId((prev) => {
      const next = new Map(prev);
      if (!access.can_read && !access.can_command) next.delete(farmId);
      else next.set(farmId, access);
      return next;
    });
  };

  const addFarm = () => {
    if (!selectedUser?.email || !addFarmId || addPending) {
      if (selectedUser && !selectedUser.email) {
        notify("권한 부여는 SUPABASE_SERVICE_ROLE_KEY가 필요합니다.", "err");
      }
      return;
    }
    const opt = farmOptions.find((o) => farmValue(o.farmKey) === addFarmId);
    if (!opt) return;
    const email = selectedUser.email;
    startAdd(async () => {
      const result = await grantFarmAccessInline({
        email,
        farmKey: opt.farmKey,
        canCommand: false,
      });
      if (result.ok) {
        onAccessChange(addFarmId, { can_read: true, can_command: false });
        setAddFarmId("");
        notify(`${opt.label}에 조회 권한을 부여했습니다.`);
      } else {
        notify(grantErrorMessage(result.error), "err");
      }
    });
  };

  const userRail = (
    <div className="flex min-h-0 flex-col gap-2 lg:w-56 lg:min-w-[11rem] lg:max-w-[18rem] lg:shrink-0">
      <Input
        uiSize="dashboard"
        placeholder="사용자 검색…"
        value={userQuery}
        onChange={(e) => setUserQuery(e.target.value)}
        aria-label="사용자 검색"
        className={opsControl.input}
      />
      <ul className="flex max-h-[min(50vh,24rem)] flex-col gap-1 overflow-y-auto overscroll-contain lg:max-h-none lg:flex-1">
        {filteredUsers.length === 0 ? (
          <li className={cn("px-2 py-4 text-center", opsTypography.meta)}>
            사용자가 없습니다.
          </li>
        ) : (
          filteredUsers.map((u) => {
            const active = directoryKey(u) === selectedKey;
            const farmCount = u.farmAccess.filter(
              (a) => a.can_read || a.can_command,
            ).length;
            const name = directoryName(u);
            const meta = directoryMeta(u);
            return (
              <li key={u.id}>
                <button
                  type="button"
                  title={`${name} · ${meta}`}
                  onClick={() => selectUser(directoryKey(u))}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "flex w-full flex-col rounded-lg border px-3 py-2 text-left transition-colors",
                    opsStatus.chipFocus,
                    active ? opsStatus.selected : "border-transparent bg-muted/30 hover:bg-muted/60",
                  )}
                >
                  <span className={cn("truncate font-medium", opsTypography.body)}>
                    {name}
                  </span>
                  <span className={cn("truncate", opsTypography.meta)}>
                    {meta} · {farmCount}곳
                  </span>
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );

  const farmDetail = (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain">
      {!selectedUser ? (
        <p className={cn("py-8 text-center", opsTypography.meta)}>
          왼쪽에서 사용자를 선택하세요.
        </p>
      ) : (
        <>
          <div className="sticky top-0 z-10 -mx-0.5 shrink-0 border-b bg-card/95 px-0.5 pb-2 backdrop-blur supports-[backdrop-filter]:bg-card/80">
            <p
              className={cn("truncate", opsTypography.sectionTitle)}
              title={directoryName(selectedUser)}
            >
              {directoryName(selectedUser)}
            </p>
            <p className={cn("truncate", opsTypography.meta)} title={directoryMeta(selectedUser)}>
              {directoryMeta(selectedUser)}
            </p>
          </div>

          <div
            id="directory-add-farm"
            className="flex flex-wrap items-end gap-2 rounded-lg border bg-muted/20 p-2.5"
          >
            <label className={cn("min-w-0 flex-1 font-medium", opsTypography.meta)}>
              농장 추가
              <select
                ref={addFarmSelectRef}
                className={opsControl.select}
                value={addFarmId}
                onChange={(e) => setAddFarmId(e.target.value)}
              >
                <option value="">미부여 농장 선택…</option>
                {addableFarms.map((o) => (
                  <option key={farmValue(o.farmKey)} value={farmValue(o.farmKey)}>
                    {o.label} · {farmValue(o.farmKey)}
                  </option>
                ))}
              </select>
            </label>
            <PageActionButton
              type="button"
              variant="primary"
              disabled={!addFarmId || addPending}
              onClick={addFarm}
              className={opsControl.button}
            >
              {addPending ? "부여중…" : "조회권한 부여"}
            </PageActionButton>
          </div>

          {userFarmCards.length === 0 ? (
            <div
              className={cn(
                "flex flex-col items-center gap-3 rounded-lg border border-dashed px-3 py-6 text-center",
                opsTypography.meta,
              )}
            >
              <p>권한 있는 농장이 없습니다.</p>
              <PageActionButton
                type="button"
                variant="outline"
                onClick={focusAddFarm}
                className={opsControl.buttonOutline}
                disabled={addableFarms.length === 0}
              >
                {addableFarms.length === 0
                  ? "추가할 농장이 없습니다"
                  : "농장 추가"}
              </PageActionButton>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {userFarmCards.map((card) => (
                <AdminFarmDirectoryCard
                  key={card.farmId}
                  email={selectedUser.email ?? ""}
                  farmKey={card.farmKey}
                  label={card.label}
                  access={card.access}
                  locationOption={card.locationOption}
                  onAccessChange={onAccessChange}
                  onNotify={notify}
                  expanded={expandedFarmId === card.farmId}
                  onExpandedChange={(open) =>
                    setExpandedFarmId(open ? card.farmId : null)
                  }
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );

  return (
    <div className={opsLayout.stack}>
      <div className="rounded-xl border border-border bg-card px-3 py-2 sm:px-4">
        <h2 className={opsTypography.sectionTitle}>
          {isMobile ? "사용자" : "디렉터리 · 사용자 우선"}
        </h2>
        {isMobile ? null : (
          <p className={opsTypography.sectionDesc}>
            사용자를 고르면 권한·주소를 이어서 처리합니다.
          </p>
        )}
      </div>

      {isMobile ? (
        <>
          {userRail}
          <BarnPanelBottomSheet
            open={sheetOpen && Boolean(selectedUser)}
            onClose={() => setSheetOpen(false)}
            title={
              selectedUser
                ? `${directoryName(selectedUser)} · 농장`
                : "농장"
            }
            auditRegion="admin-directory-user-sheet"
            contentClassName="overflow-y-auto p-3"
          >
            {farmDetail}
          </BarnPanelBottomSheet>
        </>
      ) : (
        <div className="flex min-h-0 flex-col gap-3 lg:flex-row lg:gap-4">
          {userRail}
          <div className="hidden min-h-[1px] w-px shrink-0 bg-border lg:block" />
          {farmDetail}
        </div>
      )}

      <InlineStatusToast
        message={toast?.message ?? null}
        onDismiss={dismissToast}
        className={
          toast?.tone === "err"
            ? "border-red-300/70 text-red-900"
            : undefined
        }
      />
    </div>
  );
}
