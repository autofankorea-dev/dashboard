"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  useTransition,
} from "react";
import { createPortal } from "react-dom";
import {
  geocodeFarmAddressAction,
  saveFarmAddressAction,
} from "@/lib/actions/app-settings-actions";
import type { FarmKey } from "@/lib/domain/farm-key";
import { PageActionButton } from "@/components/common/page-action-button";
import type { FarmLocationRow } from "@/lib/data/farm-location";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { ACCOUNT_MENU_SHEET_Z, accountMenuLayout } from "@/lib/ui/account-menu-layout";
import { cn } from "@/lib/utils";

export type AddressDraft = {
  addressText: string;
  lat: number | null;
  lng: number | null;
  sido: string;
  sigungu: string;
  addressDetail: string;
  geocodeSource: string;
};

export function addressDraftFromLocation(
  location: FarmLocationRow | null | undefined
): AddressDraft {
  if (!location) {
    return {
      addressText: "",
      lat: null,
      lng: null,
      sido: "",
      sigungu: "",
      addressDetail: "",
      geocodeSource: "",
    };
  }
  return {
    addressText: location.addressText,
    lat: location.lat,
    lng: location.lng,
    sido: location.sido,
    sigungu: location.sigungu,
    addressDetail: location.addressDetail ?? "",
    geocodeSource: location.geocodeSource,
  };
}

const ERROR_LABEL: Record<string, string> = {
  address_too_short: "주소를 4자 이상 입력하세요.",
  geocode_not_found:
    "주소를 찾을 수 없습니다. 도로명·지번을 확인하거나 KAKAO_REST_API_KEY 설정 후 다시 시도하세요.",
  forbidden: "수정 권한이 없습니다.",
  invalid: "입력값이 올바르지 않습니다.",
  invalid_coords: "좌표가 올바르지 않습니다.",
  invalid_region:
    "시·군·구가 목록과 맞지 않습니다. 시·도는 시·도만, 도로명은 상세 주소에 넣으세요.",
  unauthorized: "로그인이 필요합니다.",
};

function AddressSystemMessage({
  message,
  onDone,
}: {
  message: string;
  onDone: () => void;
}) {
  const [leaving, setLeaving] = useState(false);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });

  useEffect(() => {
    const hold = window.setTimeout(() => setLeaving(true), 2600);
    const done = window.setTimeout(() => onDoneRef.current(), 2750);
    return () => {
      window.clearTimeout(hold);
      window.clearTimeout(done);
    };
  }, [message]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      data-address-system-message=""
      className={cn(
        "pointer-events-none fixed inset-0 flex items-center justify-center bg-black/45 px-8 text-center",
        leaving ? "ui-motion-exit-fade" : "ui-motion-enter-fade",
      )}
      style={{ zIndex: ACCOUNT_MENU_SHEET_Z + 20 }}
    >
      <p id="farm-address-error" className="max-w-[22rem] text-sm font-medium leading-snug text-white">
        {message}
      </p>
    </div>,
    document.body,
  );
}

type Props = {
  farmKey: FarmKey;
  location: FarmLocationRow | null | undefined;
  disabled?: boolean;
  compact?: boolean;
  /** 모바일 계정 메뉴 등 — 열릴 때 키보드·포커스 없이, 입력칸 터치 시에만 편집 */
  deferFocusUntilTap?: boolean;
  /** compact + saveOnly — 검색 없이 저장만 (프로필 Top Sheet) */
  saveOnly?: boolean;
  /** 상태 줄 높이 안에 한 줄로 둔다. 오류는 화면 중앙 시스템 메시지. */
  inline?: boolean;
  onSaved?: () => void;
};

export type FarmAddressInputHandle = {
  save: () => void;
};

export const FarmAddressInput = forwardRef<FarmAddressInputHandle, Props>(function FarmAddressInput({
  farmKey,
  location,
  disabled = false,
  compact = false,
  saveOnly = false,
  inline = false,
  deferFocusUntilTap = false,
  onSaved,
}: Props, ref) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputActive, setInputActive] = useState(false);
  const [draft, setDraft] = useState(() => addressDraftFromLocation(location));
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState(() => Boolean(location?.addressText));
  const [pending, startTransition] = useTransition();

  // Prop sync during render — defer off면 포커스 잠금 해제
  if (!deferFocusUntilTap && inputActive) {
    setInputActive(false);
  }

  const inputLocked = deferFocusUntilTap && !inputActive;

  const activateInput = useCallback(() => {
    if (disabled || pending || !deferFocusUntilTap || inputActive) return;
    setInputActive(true);
    requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
  }, [deferFocusUntilTap, disabled, inputActive, pending]);

  const runGeocode = useCallback(() => {
    const query = draft.addressText.trim();
    if (query.length < 4) {
      setVerified(false);
      setError(ERROR_LABEL.address_too_short);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await geocodeFarmAddressAction(query);
      if (!result.ok) {
        setVerified(false);
        setError(ERROR_LABEL[result.error] ?? "주소 검색에 실패했습니다.");
        return;
      }
      setDraft({
        addressText: result.addressText,
        lat: result.lat,
        lng: result.lng,
        sido: result.sido,
        sigungu: result.sigungu,
        addressDetail: result.addressDetail ?? "",
        geocodeSource: result.geocodeSource,
      });
      setVerified(true);
    });
  }, [draft.addressText]);

  const runSave = useCallback(() => {
    const query = draft.addressText.trim();
    const stored = (location?.addressText ?? "").trim();
    if (query === stored) {
      onSaved?.();
      return;
    }
    if (!query) {
      setVerified(false);
      setError(ERROR_LABEL.address_too_short);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await saveFarmAddressAction({
        lsindRegistNo: farmKey.lsindRegistNo,
        itemCode: farmKey.itemCode,
        address: query,
      });
      if (!result.ok) {
        setError(ERROR_LABEL[result.error ?? ""] ?? "저장에 실패했습니다.");
        return;
      }
      setVerified(true);
      onSaved?.();
    });
  }, [draft.addressText, farmKey.itemCode, farmKey.lsindRegistNo, location?.addressText, onSaved]);

  useImperativeHandle(ref, () => ({ save: runSave }), [runSave]);

  useEffect(() => {
    if (!inline || deferFocusUntilTap) return;
    inputRef.current?.focus({ preventScroll: true });
  }, [deferFocusUntilTap, inline]);

  return (
    <div
      className={cn(
        compact ? "space-y-1" : "space-y-3",
        inline && "w-max space-y-0",
      )}
    >
      {compact ? (
        <>
          <div className={cn(accountMenuLayout.compactInputRow, inline && "w-max")}>
            <span className={cn(inline && "relative inline-flex items-center")}>
            <span
              className={cn(
                "invisible whitespace-nowrap border border-transparent px-1.5 text-[length:var(--density-meta)] font-semibold leading-snug md:text-[length:var(--density-meta-md)]",
                !inline && "hidden",
              )}
              aria-hidden
            >
              {draft.addressText || "농장 주소"}
            </span>
            <input
              ref={inputRef}
              type="text"
              className={cn(
                inline
                  ? "absolute inset-0 h-full w-full rounded-md border border-border bg-background px-1.5 text-[length:var(--density-meta)] font-semibold leading-snug text-foreground md:text-[length:var(--density-meta-md)]"
                  : accountMenuLayout.compactInput,
                inputLocked && "cursor-text",
              )}
              placeholder="농장 주소"
              value={draft.addressText}
              disabled={disabled || pending}
              readOnly={inputLocked}
              tabIndex={inputLocked ? -1 : undefined}
              aria-readonly={inputLocked || undefined}
              aria-invalid={error ? true : undefined}
              aria-label={
                verified && draft.addressText && !error
                  ? "농장 주소, 확인됨"
                  : "농장 주소"
              }
              aria-describedby={error ? "farm-address-error" : undefined}
              onPointerDown={(e) => {
                e.stopPropagation();
                if (inputLocked) {
                  e.preventDefault();
                  activateInput();
                }
              }}
              onClick={(e) => e.stopPropagation()}
              onFocus={(e) => {
                if (inputLocked) e.target.blur();
              }}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (inputLocked) return;
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (saveOnly) {
                    runSave();
                  } else {
                    runGeocode();
                  }
                }
              }}
              onChange={(e) => {
                if (inputLocked) return;
                setVerified(false);
                setDraft((prev) => ({
                  ...prev,
                  addressText: e.target.value,
                  lat: null,
                  lng: null,
                }));
              }}
            />
            </span>
            {!disabled && saveOnly ? (
              <button
                type="button"
                disabled={pending}
                className={cn(accountMenuLayout.compactSaveBtn, inline && "h-7 py-0")}
                onClick={runSave}
              >
                {pending ? "…" : "저장"}
              </button>
            ) : !disabled ? (
              <div className={accountMenuLayout.compactBtnRow}>
                <button
                  type="button"
                  disabled={pending}
                  className={accountMenuLayout.compactBtn}
                  onClick={runGeocode}
                >
                  {pending ? "…" : "검색"}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  className={accountMenuLayout.compactBtnPrimary}
                  onClick={runSave}
                >
                  {pending ? "…" : "저장"}
                </button>
              </div>
            ) : null}
          </div>
          {error && inline ? (
            <AddressSystemMessage message={error} onDone={() => setError(null)} />
          ) : error ? (
            <p
              id="farm-address-error"
              className={cn("leading-snug text-destructive", accountMenuLayout.hubMeta)}
            >
              {error}
            </p>
          ) : null}
        </>
      ) : (
        <>
          <label className="block space-y-1.5">
            <span className={cn("font-medium", dashboardUi.body)}>농장 주소</span>
            <input
              ref={inputRef}
              type="text"
              className={cn(
                "w-full rounded-lg border bg-background px-3 py-2 text-sm",
                inputLocked && "cursor-text",
              )}
              placeholder="예: 경기도 수원시 영통구 월드컵로 206"
              value={draft.addressText}
              disabled={disabled || pending}
              readOnly={inputLocked}
              tabIndex={inputLocked ? -1 : undefined}
              aria-readonly={inputLocked || undefined}
              onPointerDown={(e) => {
                e.stopPropagation();
                if (inputLocked) {
                  e.preventDefault();
                  activateInput();
                }
              }}
              onClick={(e) => e.stopPropagation()}
              onFocus={(e) => {
                if (inputLocked) e.target.blur();
              }}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (inputLocked) return;
                if (e.key === "Enter") {
                  e.preventDefault();
                  runGeocode();
                }
              }}
              onChange={(e) => {
                if (inputLocked) return;
                setVerified(false);
                setDraft((prev) => ({
                  ...prev,
                  addressText: e.target.value,
                  lat: null,
                  lng: null,
                }));
              }}
            />
          </label>

          {!disabled ? (
            <div className="flex flex-wrap gap-2">
              <PageActionButton
                type="button"
                variant="outline"
                disabled={pending}
                onClick={runGeocode}
              >
                {pending ? "검색 중…" : "주소 검색"}
              </PageActionButton>
              <PageActionButton
                type="button"
                variant="primary"
                disabled={pending}
                onClick={runSave}
              >
                {pending ? "저장 중…" : "저장"}
              </PageActionButton>
            </div>
          ) : null}

          {error ? (
            <p className={cn("text-destructive", dashboardUi.tableMeta)}>{error}</p>
          ) : verified && draft.addressText ? (
            <p className={cn("text-muted-foreground", dashboardUi.tableMeta)}>
              주소를 확인했습니다.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
});
