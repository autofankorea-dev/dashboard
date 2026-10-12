"use client";

import { useState, useTransition } from "react";
import {
  toggleFarmCommandInline,
  toggleFarmReadInline,
} from "@/app/(dashboard)/admin/ops/users-actions";
import { saveFarmLocationInlineAction } from "@/lib/actions/app-settings-actions";
import { PageActionButton } from "@/components/common/page-action-button";
import { Input } from "@/components/ui/input";
import type { FarmKey } from "@/lib/domain/farm-key";
import { farmKeyId } from "@/lib/domain/farm-key";
import type { EditableFarmOption } from "@/lib/data/farm-location";
import { opsControl, opsTypography } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

export type FarmDirectoryAccess = {
  can_read: boolean;
  can_command: boolean;
};

type Props = {
  email: string;
  farmKey: FarmKey;
  label: string;
  access: FarmDirectoryAccess;
  locationOption: EditableFarmOption | null;
  onAccessChange: (farmId: string, access: FarmDirectoryAccess) => void;
  /** 동시 편집 1개 — 부모가 제어. */
  expanded: boolean;
  onExpandedChange: (open: boolean) => void;
  onNotify?: (message: string, tone?: "ok" | "err") => void;
};

function accessSummary(access: FarmDirectoryAccess): string {
  if (access.can_command) return "조회·명령";
  if (access.can_read) return "조회";
  return "권한 없음";
}

function grantErrorMessage(error: "forbidden" | "invalid" | "notfound"): string {
  switch (error) {
    case "forbidden":
      return "권한이 없습니다.";
    case "notfound":
      return "사용자를 찾을 수 없습니다.";
    default:
      return "요청을 처리할 수 없습니다.";
  }
}

/** B안 — 1줄 요약 + 펼침 편집. */
export function AdminFarmDirectoryCard({
  email,
  farmKey,
  label,
  access,
  locationOption,
  onAccessChange,
  expanded,
  onExpandedChange,
  onNotify,
}: Props) {
  const farmId = farmKeyId(farmKey);
  const loc = locationOption?.location ?? null;
  const locKey = `${farmId}|${loc?.sido ?? ""}|${loc?.sigungu ?? ""}|${loc?.addressDetail ?? ""}`;
  const [formKey, setFormKey] = useState(locKey);
  const [sido, setSido] = useState(loc?.sido ?? "");
  const [sigungu, setSigungu] = useState(loc?.sigungu ?? "");
  const [detail, setDetail] = useState(loc?.addressDetail ?? "");
  const [fieldError, setFieldError] = useState(false);
  const [readPending, startRead] = useTransition();
  const [cmdPending, startCmd] = useTransition();
  const [locPending, startLoc] = useTransition();

  if (locKey !== formKey) {
    setFormKey(locKey);
    setSido(loc?.sido ?? "");
    setSigungu(loc?.sigungu ?? "");
    setDetail(loc?.addressDetail ?? "");
    setFieldError(false);
  }

  const toggleRead = () => {
    if (!email.trim() || readPending) return;
    const next = !access.can_read;
    startRead(async () => {
      const result = await toggleFarmReadInline({
        email,
        farmKey,
        enabled: next,
      });
      if (result.ok) {
        onAccessChange(
          farmId,
          next
            ? { can_read: true, can_command: access.can_command }
            : { can_read: false, can_command: false },
        );
        onNotify?.(next ? "조회 권한을 부여했습니다." : "조회 권한을 회수했습니다.");
      } else {
        onNotify?.(grantErrorMessage(result.error), "err");
      }
    });
  };

  const toggleCmd = () => {
    if (!email.trim() || cmdPending || !access.can_read) return;
    const next = !access.can_command;
    startCmd(async () => {
      const result = await toggleFarmCommandInline({
        email,
        farmKey,
        enabled: next,
      });
      if (result.ok) {
        onAccessChange(farmId, {
          can_read: true,
          can_command: next,
        });
        onNotify?.(next ? "명령 권한을 부여했습니다." : "명령 권한을 회수했습니다.");
      } else {
        onNotify?.(grantErrorMessage(result.error), "err");
      }
    });
  };

  const saveLocation = () => {
    if (locPending) return;
    setFieldError(false);
    startLoc(async () => {
      const result = await saveFarmLocationInlineAction({
        farmKey,
        sido: sido.trim(),
        sigungu: sigungu.trim(),
        addressDetail: detail.trim() || undefined,
      });
      if (result.ok) {
        onNotify?.("주소를 저장했습니다.");
      } else {
        setFieldError(true);
        onNotify?.(result.error ?? "주소 저장에 실패했습니다.", "err");
      }
    });
  };

  const unconfigured = !loc;
  const locSummary = loc?.addressText
    ? loc.addressText
    : unconfigured
      ? "주소 미설정"
      : [sido, sigungu].filter(Boolean).join(" ") || "주소 미설정";

  return (
    <div
      className={cn(
        "rounded-xl border bg-card",
        unconfigured && "border-amber-300/60",
      )}
    >
      <button
        type="button"
        onClick={() => onExpandedChange(!expanded)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left sm:px-4"
      >
        <div className="min-w-0 flex-1">
          <p className={cn("truncate font-semibold", opsTypography.body)}>{label}</p>
          <p className={cn("truncate", opsTypography.meta)}>
            {accessSummary(access)} · {locSummary}
          </p>
        </div>
        {unconfigured ? (
          <span className="shrink-0 rounded-md border border-amber-300/50 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900">
            미설정
          </span>
        ) : null}
        <span className={cn("shrink-0", opsTypography.meta)}>
          {expanded ? "접기" : "편집"}
        </span>
      </button>

      {expanded ? (
        <div className="border-t px-3 py-3 sm:px-4">
          <p className={cn("mb-2 truncate", opsTypography.meta)}>{farmId}</p>

          <div className="mb-3 flex flex-wrap gap-2">
            <PageActionButton
              type="button"
              variant={access.can_read ? "danger" : "outline"}
              disabled={!email.trim() || readPending}
              onClick={toggleRead}
              className={opsControl.button}
            >
              {readPending
                ? "적용중…"
                : access.can_read
                  ? "조회회수"
                  : "조회권한"}
            </PageActionButton>
            <PageActionButton
              type="button"
              variant={access.can_command ? "danger" : "primary"}
              disabled={!email.trim() || cmdPending || !access.can_read}
              onClick={toggleCmd}
              className={opsControl.button}
            >
              {cmdPending
                ? "적용중…"
                : access.can_command
                  ? "명령회수"
                  : "명령권한"}
            </PageActionButton>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <Input
              uiSize="dashboard"
              placeholder="시/도"
              value={sido}
              onChange={(e) => {
                setSido(e.target.value);
                setFieldError(false);
              }}
              aria-label="시/도"
              aria-invalid={fieldError || undefined}
              className={cn(
                opsControl.input,
                fieldError && "border-red-400 focus-visible:ring-red-400/40",
              )}
            />
            <Input
              uiSize="dashboard"
              placeholder="시/군/구"
              value={sigungu}
              onChange={(e) => {
                setSigungu(e.target.value);
                setFieldError(false);
              }}
              aria-label="시/군/구"
              aria-invalid={fieldError || undefined}
              className={cn(
                opsControl.input,
                fieldError && "border-red-400 focus-visible:ring-red-400/40",
              )}
            />
            <Input
              uiSize="dashboard"
              placeholder="상세 주소"
              value={detail}
              onChange={(e) => {
                setDetail(e.target.value);
                setFieldError(false);
              }}
              aria-label="상세 주소"
              className={opsControl.input}
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <PageActionButton
              type="button"
              variant="outline"
              disabled={locPending || !sido.trim() || !sigungu.trim()}
              onClick={saveLocation}
              className={opsControl.buttonOutline}
            >
              {locPending ? "저장중…" : "주소 저장"}
            </PageActionButton>
          </div>
        </div>
      ) : null}
    </div>
  );
}
