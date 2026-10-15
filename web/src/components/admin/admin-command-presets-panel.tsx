"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteSharedCommandPresetAction,
  saveCommandDefaultsAction,
  upsertSharedCommandPresetAction,
} from "@/app/(dashboard)/admin/ops/preset-actions";
import type { PanelDraft } from "@/lib/controllers/controller-panel-draft";
import {
  COMMAND_PRESET_MAX,
  COMMAND_PRESET_NAME_MAX,
  PRESET_VENT_STEP,
  applyPresetCreateField,
  clampPresetCreateDraft,
  hasPresetChannels,
  seedPresetCreateChannels,
  type CommandPresetChannels,
  type PresetCreateField,
} from "@/lib/farm/command-presets";
import type { SharedCommandPreset } from "@/lib/farm/shared-command-presets";
import {
  STALL_TYPE_NAMES,
  formatStallTypeLabelLocalized,
  normalizeStallTyCode,
  stallTyCodeSortKey,
} from "@/lib/domain/stall-type";
import {
  SettingsChannelStepperGrid,
  SettingsChannelWell,
} from "@/components/farm/settings-channel-stepper-grid";
import { useProfileSheetPrefs, useSheetCopy } from "@/components/account/profile-sheet-prefs";
import { sheetCopy } from "@/lib/ui/sheet-copy";
import type { SheetLocale } from "@/lib/ui/profile-sheet-prefs";
import { SettingsEditOverlay } from "@/components/farm/settings-edit-overlay";
import {
  dashboardAffordance,
  dashboardElevation,
  opsControl,
  opsTypography,
} from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";
import { motionClass } from "@/lib/ui/motion-classes";

type Props = {
  initialDefaults: PanelDraft;
  initialPresets: SharedCommandPreset[];
};

type EditorMode = "defaults" | "create" | "edit";

const STALL_OPTIONS = Object.keys(STALL_TYPE_NAMES)
  .filter((code) => code.startsWith("SP"))
  .sort((a, b) => stallTyCodeSortKey(a) - stallTyCodeSortKey(b));

function draftSummary(d: PanelDraft, locale: SheetLocale): string {
  return sheetCopy(locale, "preset.summary", {
    setpoint: d.setpointTemp.toFixed(1),
    dev: d.tempDeviation.toFixed(1),
    min: d.minVentPct,
    max: d.maxVentPct,
  });
}

function firstChannelDraft(
  channels: CommandPresetChannels,
  fallback: PanelDraft,
): PanelDraft {
  for (const slot of ["A", "B", "C"] as const) {
    const ch = channels[slot];
    if (ch) return clampPresetCreateDraft(ch);
  }
  return clampPresetCreateDraft(fallback);
}

function channelsFromUniformDraft(draft: PanelDraft): CommandPresetChannels {
  const one = clampPresetCreateDraft(draft);
  return seedPresetCreateChannels({ A: one, B: { ...one }, C: { ...one } });
}

function AdminDraftEditor({
  name,
  onName,
  showName,
  draft,
  onDraft,
  disabled,
  error,
}: {
  name: string;
  onName: (value: string) => void;
  showName: boolean;
  draft: PanelDraft;
  onDraft: (next: PanelDraft) => void;
  disabled?: boolean;
  error?: string | null;
}) {
  const t = useSheetCopy();
  return (
    <div className="flex flex-col gap-3">
      {showName ? (
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-muted-foreground">{t("preset.name")}</span>
          <input
            value={name}
            maxLength={COMMAND_PRESET_NAME_MAX}
            disabled={disabled}
            placeholder={t("preset.name")}
            aria-label={t("preset.nameAria")}
            className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm outline-none"
            onChange={(e) => onName(e.target.value)}
          />
        </label>
      ) : null}
      <SettingsChannelWell>
        <SettingsChannelStepperGrid
          draft={draft}
          disabled={disabled}
          ventStep={PRESET_VENT_STEP}
          onChange={(field: PresetCreateField, value: number) =>
            onDraft(applyPresetCreateField(draft, field, value))
          }
        />
      </SettingsChannelWell>
      <p className="text-[11px] text-muted-foreground">
        {error ?? t("preset.adminHint")}
      </p>
    </div>
  );
}

export function AdminCommandPresetsPanel({
  initialDefaults,
  initialPresets,
}: Props) {
  const router = useRouter();
  const locale = useProfileSheetPrefs().locale;
  const en = locale === "en";
  const typeName = (code: string) => formatStallTypeLabelLocalized(code, locale);
  const [defaults, setDefaults] = useState(initialDefaults);
  const [presets, setPresets] = useState(initialPresets);
  const [stallTyCode, setStallTyCode] = useState(STALL_OPTIONS[0] ?? "SP07");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<EditorMode>("create");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [draft, setDraft] = useState<PanelDraft>(initialDefaults);
  const [pendingDelete, setPendingDelete] = useState<SharedCommandPreset | null>(
    null,
  );

  // router.refresh() 후 서버 props가 바뀌면 낙관 상태를 서버값으로 재동기화
  const [syncedDefaults, setSyncedDefaults] = useState(initialDefaults);
  if (initialDefaults !== syncedDefaults) {
    setSyncedDefaults(initialDefaults);
    setDefaults(initialDefaults);
  }
  const [syncedPresets, setSyncedPresets] = useState(initialPresets);
  if (initialPresets !== syncedPresets) {
    setSyncedPresets(initialPresets);
    setPresets(initialPresets);
  }

  const forStall = useMemo(
    () =>
      presets.filter(
        (p) =>
          normalizeStallTyCode(p.stallTyCode) ===
          normalizeStallTyCode(stallTyCode),
      ),
    [presets, stallTyCode],
  );

  const closeEditor = () => {
    if (pending) return;
    setEditorOpen(false);
    setEditingId(null);
    setError(null);
  };

  const openDefaults = () => {
    setEditorMode("defaults");
    setEditingId(null);
    setName("");
    setDraft(clampPresetCreateDraft(defaults));
    setError(null);
    setMessage(null);
    setEditorOpen(true);
  };

  const openCreate = () => {
    setEditorMode("create");
    setEditingId(null);
    setName(`${forStall.length + 1}번`);
    setDraft(clampPresetCreateDraft(defaults));
    setError(null);
    setMessage(null);
    setEditorOpen(true);
  };

  const openEdit = (item: SharedCommandPreset) => {
    setEditorMode("edit");
    setEditingId(item.id);
    setName(item.name);
    setDraft(firstChannelDraft(item.channels, defaults));
    setError(null);
    setMessage(null);
    setEditorOpen(true);
  };

  const submitEditor = () => {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      if (editorMode === "defaults") {
        const result = await saveCommandDefaultsAction(draft);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setDefaults(clampPresetCreateDraft(draft));
        setEditorOpen(false);
        setMessage("기본값을 저장했습니다.");
        router.refresh();
        return;
      }

      const channels = channelsFromUniformDraft(draft);
      if (!hasPresetChannels(channels)) {
        setError("저장할 값이 없습니다.");
        return;
      }
      const result = await upsertSharedCommandPresetAction({
        id: editorMode === "edit" ? (editingId ?? undefined) : undefined,
        stallTyCode,
        name,
        channels,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEditorOpen(false);
      setEditingId(null);
      setMessage(
        editorMode === "edit"
          ? "프리셋을 수정했습니다."
          : `${typeName(stallTyCode)} 프리셋을 저장했습니다.`,
      );
      router.refresh();
    });
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    const id = pendingDelete.id;
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await deleteSharedCommandPresetAction(id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setPresets((prev) => prev.filter((p) => p.id !== id));
      setPendingDelete(null);
      if (editingId === id) {
        setEditorOpen(false);
        setEditingId(null);
      }
      setMessage("프리셋을 삭제했습니다.");
      router.refresh();
    });
  };

  const editorTitle =
    editorMode === "defaults"
      ? "전역 기본값"
      : editorMode === "edit"
        ? "수정"
        : "생성";

  const editorHint =
    editorMode === "defaults"
      ? "설정 패널 「기본값」 버튼에 쓰입니다."
      : "칩만 만들고 고칩니다. 현장으로는 나가지 않습니다.";

  const primaryDisabled =
    pending ||
    (editorMode !== "defaults" && name.trim().length === 0);

  return (
    <section id="presets" className="order-2 scroll-mt-3 space-y-4 md:order-3">
      <header className="space-y-1">
        <h2 className={opsTypography.sectionTitle}>{en ? "Command defaults · presets" : "명령 기본값 · 프리셋"}</h2>
        <p className={opsTypography.sectionDesc}>
          {en
            ? `Choose a stall type, then save values on one card. The card is the shared chip on site, and tapping it edits the same card (up to ${COMMAND_PRESET_MAX} per type).`
            : `축사유형을 고른 뒤 통합 카드로 값을 저장합니다. 카드는 현장 「공용」칩으로 쓰이며, 탭하면 같은 카드로 수정합니다 (유형당 최대 ${COMMAND_PRESET_MAX} 개).`}
        </p>
      </header>

      <div
        className={cn(
          dashboardElevation.card,
          "flex flex-wrap items-center justify-between gap-3 p-3",
        )}
      >
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold">{en ? "Global defaults" : "전역 기본값"}</p>
          <p
            className={cn(
              opsTypography.meta,
              "font-variant-numeric tabular-nums",
            )}
          >
            {draftSummary(defaults, locale)}
          </p>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={openDefaults}
          className={cn(opsControl.buttonOutline, dashboardAffordance.tool)}
        >
          {en ? "Edit" : "편집"}
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label={en ? "Stall type" : "축사유형"}>
        {STALL_OPTIONS.map((code) => {
          const on =
            normalizeStallTyCode(code) === normalizeStallTyCode(stallTyCode);
          return (
            <button
              key={code}
              type="button"
              disabled={pending}
              aria-pressed={on}
              onClick={() => setStallTyCode(code)}
              className={cn(
                "inline-flex h-9 items-center rounded-lg border px-3 text-xs font-semibold",
                motionClass.microHover,
                on
                  ? cn(dashboardAffordance.action, "border-transparent")
                  : dashboardAffordance.chipToggleIdle,
              )}
            >
              {typeName(code)}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pending || forStall.length >= COMMAND_PRESET_MAX}
          onClick={openCreate}
          className={cn(
            "inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-xs font-semibold",
            dashboardAffordance.chipToggleIdle,
            motionClass.microHover,
          )}
        >
          <span aria-hidden>＋</span> {en ? "Create" : "생성"}
        </button>
        <p className={opsTypography.meta}>
          {typeName(stallTyCode)} · {forStall.length}/
          {COMMAND_PRESET_MAX}
        </p>
      </div>

      {forStall.length === 0 ? (
        <div
          className={cn(
            dashboardElevation.well,
            "px-4 py-8 text-center text-sm text-muted-foreground",
          )}
        >
          {en ? "No presets for this stall type." : "이 축사유형에 프리셋이 없습니다."}
          <br />
          {en ? "Use Create to make the first card." : "「생성」으로 첫 카드를 만드세요."}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {forStall.map((item) => {
            const summary = draftSummary(
              firstChannelDraft(item.channels, defaults),
              locale,
            );
            return (
              <button
                key={item.id}
                type="button"
                disabled={pending}
                onClick={() => openEdit(item)}
                className={cn(
                  dashboardElevation.card,
                  dashboardAffordance.hitSurface,
                  motionClass.microHover,
                  "flex flex-col items-start gap-1.5 p-3 text-left transition-colors hover:border-primary/40",
                )}
              >
                <p className="text-sm font-semibold leading-snug">{item.name}</p>
                <p
                  className={cn(
                    opsTypography.meta,
                    "font-variant-numeric tabular-nums",
                  )}
                >
                  {summary}
                </p>
                <p className="mt-1 text-[11px] text-channel-info">
                  {typeName(stallTyCode)} · {en ? "Shared" : "공용"}
                </p>
              </button>
            );
          })}
        </div>
      )}

      {message ? (
        <p className="text-sm text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}
      {error && !editorOpen ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <SettingsEditOverlay
        open={editorOpen}
        wide
        focusTarget="content"
        title={editorTitle}
        closeLabel={en ? "Cancel" : "취소"}
        primaryLabel={en ? "Save" : "저장"}
        primaryBusyLabel={en ? "Saving" : "저장 중"}
        primaryDisabled={primaryDisabled}
        busy={pending}
        hint={editorHint}
        onClose={closeEditor}
        onPrimary={submitEditor}
        footerContent={
          editorMode === "edit" ? (
            <button
              type="button"
              disabled={pending}
              className="text-xs font-medium text-destructive hover:underline"
              onClick={() => {
                const item = forStall.find((p) => p.id === editingId);
                if (!item) return;
                setPendingDelete(item);
              }}
            >
              이 프리셋 삭제
            </button>
          ) : null
        }
      >
        {editorOpen ? (
          <AdminDraftEditor
            name={name}
            onName={setName}
            showName={editorMode !== "defaults"}
            draft={draft}
            onDraft={setDraft}
            disabled={pending}
            error={error}
          />
        ) : null}
      </SettingsEditOverlay>

      <SettingsEditOverlay
        open={pendingDelete != null}
        title="삭제하시겠습니까?"
        closeLabel="취소"
        primaryLabel="삭제"
        primaryBusyLabel="삭제 중"
        busy={pending}
        hint="칩만 지웁니다. 현장 설정은 그대로입니다."
        onClose={() => {
          if (!pending) setPendingDelete(null);
        }}
        onPrimary={confirmDelete}
      >
        <p className="text-sm text-foreground">{pendingDelete?.name}</p>
      </SettingsEditOverlay>
    </section>
  );
}
