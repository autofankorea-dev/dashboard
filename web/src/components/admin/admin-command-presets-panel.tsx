"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteSharedCommandPresetAction,
  saveCommandDefaultsAction,
  upsertSharedCommandPresetAction,
} from "@/app/(dashboard)/admin/ops/preset-actions";
import type { PanelDraft } from "@/lib/controllers/controller-panel-draft";
import {
  COMMAND_PRESET_MAX,
  hasPresetChannels,
  seedPresetCreateChannels,
  type CommandPresetChannels,
} from "@/lib/farm/command-presets";
import type { SharedCommandPreset } from "@/lib/farm/shared-command-presets";
import {
  STALL_TYPE_NAMES,
  formatStallTypeLabel,
  normalizeStallTyCode,
  stallTyCodeSortKey,
} from "@/lib/data/stall-type";
import { SettingsPresetCreateForm } from "@/components/farm/settings-preset-create-form";
import { CHANNEL_SLOT_LABELS } from "@/lib/data/iot-channel";
import { opsTypography } from "@/lib/ui/dashboard-page-ui";

type Props = {
  initialDefaults: PanelDraft;
  initialPresets: SharedCommandPreset[];
};

const STALL_OPTIONS = Object.keys(STALL_TYPE_NAMES)
  .filter((code) => code.startsWith("SP"))
  .sort((a, b) => stallTyCodeSortKey(a) - stallTyCodeSortKey(b));

function draftFields(d: PanelDraft) {
  return [
    { label: "설정온도", value: `${d.setpointTemp.toFixed(1)}℃` },
    { label: "편차", value: `${d.tempDeviation.toFixed(1)}℃` },
    { label: "최저환기", value: `${d.minVentPct}%` },
    { label: "최고환기", value: `${d.maxVentPct}%` },
  ];
}

export function AdminCommandPresetsPanel({
  initialDefaults,
  initialPresets,
}: Props) {
  const router = useRouter();
  const [defaults, setDefaults] = useState(initialDefaults);
  const [presets, setPresets] = useState(initialPresets);
  const [stallTyCode, setStallTyCode] = useState(STALL_OPTIONS[0] ?? "SP07");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [channels, setChannels] = useState<CommandPresetChannels>({});

  useEffect(() => {
    setDefaults(initialDefaults);
  }, [initialDefaults]);
  useEffect(() => {
    setPresets(initialPresets);
  }, [initialPresets]);

  const forStall = useMemo(
    () =>
      presets.filter(
        (p) => normalizeStallTyCode(p.stallTyCode) === normalizeStallTyCode(stallTyCode),
      ),
    [presets, stallTyCode],
  );

  const seedChannels = useMemo((): CommandPresetChannels => {
    const one = { ...defaults };
    return { A: one, B: { ...one }, C: { ...one } };
  }, [defaults]);

  const saveDefaults = () => {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await saveCommandDefaultsAction(defaults);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage("기본값을 저장했습니다.");
    });
  };

  const openCreate = () => {
    setChannels(seedPresetCreateChannels(seedChannels));
    setName(`${forStall.length + 1}번`);
    setCreating(true);
    setError(null);
  };

  const submitCreate = () => {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await upsertSharedCommandPresetAction({
        stallTyCode,
        name,
        channels,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setCreating(false);
      setMessage(`${formatStallTypeLabel(stallTyCode)} 프리셋을 저장했습니다.`);
      router.refresh();
    });
  };

  const removePreset = (id: string) => {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await deleteSharedCommandPresetAction(id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setPresets((prev) => prev.filter((p) => p.id !== id));
      setMessage("프리셋을 삭제했습니다.");
    });
  };

  return (
    <section id="presets" className="order-2 scroll-mt-3 space-y-4 md:order-3">
      <header className="space-y-1">
        <h2 className={opsTypography.sectionTitle}>명령 기본값 · 프리셋</h2>
        <p className={opsTypography.sectionDesc}>
          기본값은 설정 패널 「기본값」에 쓰입니다. 프리셋은 축사유형별로 현장
          칩에 공용으로 표시됩니다 (유형당 최대 {COMMAND_PRESET_MAX}개).
        </p>
      </header>

      <div className="rounded-lg border border-border bg-background p-3 space-y-3">
        <h3 className="text-sm font-semibold">전역 기본값</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(
            [
              ["setpointTemp", "설정온도", 0.1],
              ["tempDeviation", "편차", 0.1],
              ["minVentPct", "최저환기", 1],
              ["maxVentPct", "최고환기", 1],
            ] as const
          ).map(([key, label, step]) => (
            <label key={key} className="flex flex-col gap-1 text-xs">
              <span className="text-muted-foreground">{label}</span>
              <input
                type="number"
                step={step}
                className="h-9 rounded-md border border-border bg-background px-2 text-sm"
                value={defaults[key]}
                disabled={pending}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (!Number.isFinite(n)) return;
                  setDefaults((prev) => ({ ...prev, [key]: n }));
                }}
              />
            </label>
          ))}
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={saveDefaults}
          className="h-9 rounded-md border border-border px-3 text-sm font-medium"
        >
          기본값 저장
        </button>
      </div>

      <div className="rounded-lg border border-border bg-background p-3 space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">축사유형</span>
            <select
              className="h-9 min-w-[12rem] rounded-md border border-border bg-background px-2 text-sm"
              value={stallTyCode}
              disabled={pending}
              onChange={(e) => {
                setStallTyCode(e.target.value);
                setCreating(false);
              }}
            >
              {STALL_OPTIONS.map((code) => (
                <option key={code} value={code}>
                  {formatStallTypeLabel(code)} ({code})
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={pending || forStall.length >= COMMAND_PRESET_MAX}
            onClick={openCreate}
            className="h-9 rounded-md border border-border px-3 text-sm font-medium"
          >
            프리셋 추가
          </button>
        </div>

        <ul className="space-y-2">
          {forStall.length === 0 ? (
            <li className="text-sm text-muted-foreground">
              이 축사유형에 등록된 공용 프리셋이 없습니다.
            </li>
          ) : (
            forStall.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-start justify-between gap-2 rounded-md border border-border/80 px-3 py-2"
              >
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-medium">{item.name}</p>
                  <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                    {(["A", "B", "C"] as const).map((slot) => {
                      const ch = item.channels[slot];
                      if (!ch) return null;
                      return (
                        <span key={slot}>
                          {CHANNEL_SLOT_LABELS[slot]}{" "}
                          {draftFields(ch)
                            .map((f) => f.value)
                            .join(" · ")}
                        </span>
                      );
                    })}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => removePreset(item.id)}
                  className="h-8 rounded-md px-2 text-xs text-destructive"
                >
                  삭제
                </button>
              </li>
            ))
          )}
        </ul>

        {creating ? (
          <div className="space-y-2 rounded-md border border-dashed border-border p-3">
            <SettingsPresetCreateForm
              name={name}
              onName={setName}
              channels={channels}
              onChannels={setChannels}
              error={error}
              disabled={pending}
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={pending || !hasPresetChannels(channels)}
                onClick={submitCreate}
                className="h-9 rounded-md border border-border px-3 text-sm font-medium"
              >
                저장
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => setCreating(false)}
                className="h-9 rounded-md px-3 text-sm text-muted-foreground"
              >
                취소
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {message ? (
        <p className="text-sm text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}
      {error && !creating ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
