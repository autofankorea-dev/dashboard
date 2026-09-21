"use client";

import { useEffect, useMemo, useState } from "react";
import { SectionCard } from "@/components/common/section-card";
import { SimpleSelect } from "@/components/common/filter-bar";
import { Label } from "@/components/ui/label";
import { PageActionButton } from "@/components/common/page-action-button";
import { AlarmDomainIcon } from "@/components/settings/alarm-domain-icon";
import {
  saveAlarmSettingsAction,
  saveAlarmSettingsInlineAction,
} from "@/lib/actions/app-settings-actions";
import type { BarnReading } from "@/lib/data/iot";
import {
  activeScopeKeyFromSelection,
  clearScopeThreshold,
  describeAlarmScope,
  filterReadingsForAlarmScope,
  hasScopeOverride,
  mergeScopeThreshold,
  resolveThresholdsForScope,
} from "@/lib/data/alarm-scope";
import {
  DEFAULT_ALARM_THRESHOLDS,
  validateAlarmThresholds,
  type AlarmSettings,
  type AlarmThresholds,
} from "@/lib/data/alarms";
import { farmKeyId } from "@/lib/data/farm-key";
import { farmShortLabel } from "@/lib/data/farm-summaries";
import {
  filterReadingsByHierarchy,
  stallLabelFromKey,
  uniqueSpCodes,
  uniqueStallKeys,
} from "@/lib/data/reading-hierarchy";
import { formatStallTypeLabel } from "@/lib/data/stall-type";
import { ThresholdRangeSlider } from "@/components/settings/threshold-range-slider";
import { formatAlarmBaselineSummary } from "@/lib/data/alarm-baseline";
import { useFarmLiveRefreshOptional } from "@/lib/navigation/farm-live-refresh";
import { dashboardTypography, dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

export type AlarmThresholdHeaderState = {
  scopeDescription: string;
  scopeHasOverride: boolean;
  scopeReady: boolean;
  hasChanges: boolean;
  pending: boolean;
  validationError: string | null;
  /** 모바일 접이식 summary — draft 기준 */
  collapsedSummary: string;
  onSave: () => void;
  onApplyDefaults: () => void;
  onClear: () => void;
};

function formatAlarmCollapsedSummary(draft: AlarmThresholds): string {
  return formatAlarmBaselineSummary(draft);
}

type Props = {
  initialSettings: AlarmSettings;
  readings: BarnReading[];
  /** 3열 우측 — 선택 컨트롤러 scope 고정 */
  fixedScope?: {
    farmId: string;
    spCode: string;
    stallKey: string;
    readingKey: string;
  } | null;
  /** SectionCard 없이 필드만 (부모가 제목·카드 제공) */
  embedded?: boolean;
  /** embedded 시 compact(우측 사이드) | default(중앙 패널) */
  density?: "compact" | "default" | "mobileSplit";
  /** embedded + SectionCard 헤더에 저장·scope 상태 위임 */
  onHeaderState?: (state: AlarmThresholdHeaderState | null) => void;
  /** mobileSplit ThresholdRangeSlider typography (목록 카드 등) */
  sliderTitleClassName?: string;
  sliderAxisClassName?: string;
  /** true — 조회 전용(입력·저장 비활성) */
  disabled?: boolean;
};

const SCOPE_ALL = "__all__";

function uniqueFarmOptions(readings: BarnReading[]) {
  const seen = new Map<string, string>();
  for (const r of readings) {
    const id = farmKeyId(r.farmKey);
    if (!seen.has(id)) seen.set(id, farmShortLabel(r.farmKey));
  }
  return [...seen.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([value, label]) => ({ value, label }));
}

export function AlarmThresholdForm({
  initialSettings,
  readings,
  fixedScope = null,
  embedded = false,
  density = "compact",
  onHeaderState,
  sliderTitleClassName,
  sliderAxisClassName,
  disabled = false,
}: Props) {
  const compact = embedded && density === "compact";
  const mobileSplit = embedded && density === "mobileSplit";
  const hideScopeSelectors = embedded && Boolean(fixedScope);
  const externalHeader = embedded && Boolean(onHeaderState);
  const [settings, setSettings] = useState<AlarmSettings>(initialSettings);
  const [draft, setDraft] = useState<AlarmThresholds>(initialSettings.global);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const liveRefresh = useFarmLiveRefreshOptional();

  const farmOptions = useMemo(() => uniqueFarmOptions(readings), [readings]);

  const [farmId, setFarmId] = useState(
    () => fixedScope?.farmId ?? farmOptions[0]?.value ?? "",
  );
  const [spCode, setSpCode] = useState(
    () => fixedScope?.spCode ?? SCOPE_ALL,
  );
  const [stallKey, setStallKey] = useState(
    () => fixedScope?.stallKey ?? SCOPE_ALL,
  );
  const [controllerReadingKey, setControllerReadingKey] = useState(
    () => fixedScope?.readingKey ?? SCOPE_ALL,
  );

  // Prop sync during render — parent often passes a fresh fixedScope object
  if (fixedScope) {
    if (farmId !== fixedScope.farmId) setFarmId(fixedScope.farmId);
    if (spCode !== fixedScope.spCode) setSpCode(fixedScope.spCode);
    if (stallKey !== fixedScope.stallKey) setStallKey(fixedScope.stallKey);
    if (controllerReadingKey !== fixedScope.readingKey) {
      setControllerReadingKey(fixedScope.readingKey);
    }
  }

  const spOptions = useMemo(() => {
    if (!farmId) return [];
    return uniqueSpCodes(readings, farmId).map((code) => ({
      value: code,
      label: formatStallTypeLabel(code),
    }));
  }, [readings, farmId]);

  const stallOptions = useMemo(() => {
    if (!farmId || spCode === SCOPE_ALL) return [];
    const stalls = uniqueStallKeys(readings, farmId, spCode).map((key) => ({
      value: key,
      label: stallLabelFromKey(key),
    }));
    return [{ value: SCOPE_ALL, label: "전체 (축사유형 일괄)" }, ...stalls];
  }, [readings, farmId, spCode]);

  const controllerList = useMemo(() => {
    if (!farmId || spCode === SCOPE_ALL || stallKey === SCOPE_ALL) return [];
    return filterReadingsByHierarchy(readings, farmId, spCode, stallKey);
  }, [readings, farmId, spCode, stallKey]);

  const controllerOptions = useMemo(
    () => [
      { value: SCOPE_ALL, label: "전체 (축사)" },
      ...controllerList.map((r) => ({
        value: r.key,
        label: r.label || r.eqpmnNo || r.controllerKey,
      })),
    ],
    [controllerList]
  );

  const resolvedStallKey = stallKey === SCOPE_ALL ? "" : stallKey;
  const resolvedCtrlKey =
    controllerReadingKey === SCOPE_ALL ? "" : controllerReadingKey;

  const activeScopeKey = useMemo(
    () =>
      activeScopeKeyFromSelection(
        farmId,
        spCode === SCOPE_ALL ? "" : spCode,
        resolvedStallKey,
        resolvedCtrlKey,
        readings
      ),
    [farmId, spCode, resolvedStallKey, resolvedCtrlKey, readings]
  );

  const scopeReady = Boolean(farmId && spCode !== SCOPE_ALL);
  const fieldsDisabled = disabled || !scopeReady || pending;

  // Scope 전환 시에만 draft 상속값 로드 (render-time prop sync)
  const scopeSyncKey = scopeReady && activeScopeKey ? activeScopeKey : "";
  const [prevScopeSyncKey, setPrevScopeSyncKey] = useState<string | null>(null);
  if (scopeSyncKey !== prevScopeSyncKey) {
    setPrevScopeSyncKey(scopeSyncKey);
    if (!scopeReady || !activeScopeKey) {
      setDraft(settings.global);
    } else {
      setDraft(resolveThresholdsForScope(settings, activeScopeKey));
      setValidationError(null);
    }
  }

  const scopeReadings = useMemo(
    () =>
      filterReadingsForAlarmScope(
        readings,
        farmId,
        spCode === SCOPE_ALL ? "" : spCode,
        resolvedStallKey,
        resolvedCtrlKey
      ),
    [readings, farmId, spCode, resolvedStallKey, resolvedCtrlKey]
  );

  const scopeHasOverride = hasScopeOverride(settings, activeScopeKey);

  const savedThresholds = useMemo(
    () =>
      scopeReady && activeScopeKey
        ? resolveThresholdsForScope(settings, activeScopeKey)
        : null,
    [settings, activeScopeKey, scopeReady]
  );

  const hasChanges = useMemo(() => {
    if (!savedThresholds) return false;
    return (
      draft.tempHigh !== savedThresholds.tempHigh ||
      draft.tempLow !== savedThresholds.tempLow ||
      draft.humidityHigh !== savedThresholds.humidityHigh ||
      draft.humidityLow !== savedThresholds.humidityLow
    );
  }, [draft, savedThresholds]);

  /** 부모 patchAlarmSettings — 편집 중이 아니면 settings·draft를 새 initialSettings에 맞춤 */
  const incomingSettingsKey = useMemo(
    () => JSON.stringify(initialSettings),
    [initialSettings],
  );
  const [prevIncomingSettingsKey, setPrevIncomingSettingsKey] =
    useState(incomingSettingsKey);
  if (incomingSettingsKey !== prevIncomingSettingsKey) {
    setPrevIncomingSettingsKey(incomingSettingsKey);
    const dirty = hasChanges;
    setSettings(initialSettings);
    if (!dirty) {
      if (scopeReady && activeScopeKey) {
        setDraft(resolveThresholdsForScope(initialSettings, activeScopeKey));
      } else {
        setDraft(initialSettings.global);
      }
      setValidationError(null);
    }
  }

  const scopeDescription = describeAlarmScope(
    farmId,
    spCode === SCOPE_ALL ? "" : spCode,
    resolvedStallKey,
    resolvedCtrlKey,
    readings
  );

  const handleFarmChange = (id: string | null) => {
    if (!id) return;
    setFarmId(id);
    setSpCode(SCOPE_ALL);
    setStallKey(SCOPE_ALL);
    setControllerReadingKey(SCOPE_ALL);
  };

  const handleSpChange = (code: string | null) => {
    if (!code) return;
    setSpCode(code);
    setStallKey(SCOPE_ALL);
    setControllerReadingKey(SCOPE_ALL);
  };

  const handleStallChange = (key: string | null) => {
    if (!key) return;
    setStallKey(key);
    setControllerReadingKey(SCOPE_ALL);
  };

  const updateDraft = (next: AlarmThresholds) => {
    if (disabled) return;
    setValidationError(validateAlarmThresholds(next));
    setDraft(next);
  };

  const persistSettings = (
    nextSettings: AlarmSettings,
    rollbackSettings?: AlarmSettings,
  ) => {
    if (pending) return;
    const formData = new FormData();
    formData.set("settings_json", JSON.stringify(nextSettings));

    if (embedded) {
      setPending(true);
      void (async () => {
        try {
          const result = await saveAlarmSettingsInlineAction(formData);
          if (!result.ok) {
            setValidationError(result.error ?? "저장 실패");
            if (rollbackSettings) setSettings(rollbackSettings);
            return;
          }
          setValidationError(null);
          liveRefresh?.patchAlarmSettings(nextSettings);
        } finally {
          setPending(false);
        }
      })();
      return;
    }

    setPending(true);
    void (async () => {
      try {
        await saveAlarmSettingsAction(formData);
      } finally {
        setPending(false);
      }
    })();
  };

  const handleSaveScope = () => {
    if (disabled || !activeScopeKey) return;
    const err = validateAlarmThresholds(draft);
    if (err) {
      setValidationError(err);
      return;
    }
    const previousSettings = settings;
    const nextSettings = mergeScopeThreshold(settings, activeScopeKey, draft);
    setSettings(nextSettings);
    persistSettings(nextSettings, previousSettings);
  };

  const handleClearScope = () => {
    if (disabled || !activeScopeKey) return;
    const previousSettings = settings;
    const nextSettings = clearScopeThreshold(settings, activeScopeKey);
    setSettings(nextSettings);
    setDraft(resolveThresholdsForScope(nextSettings, activeScopeKey));
    persistSettings(nextSettings, previousSettings);
  };

  const handleApplyDefaults = () => {
    if (disabled) return;
    updateDraft({ ...DEFAULT_ALARM_THRESHOLDS });
  };

  useEffect(() => {
    if (!onHeaderState) return;
    if (!scopeReady || !activeScopeKey) {
      onHeaderState(null);
      return;
    }
    onHeaderState({
      scopeDescription,
      scopeHasOverride,
      scopeReady,
      hasChanges: disabled ? false : hasChanges,
      pending,
      validationError,
      collapsedSummary: formatAlarmCollapsedSummary(draft),
      onSave: handleSaveScope,
      onApplyDefaults: handleApplyDefaults,
      onClear: handleClearScope,
    });
    return () => onHeaderState(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- header action sync
  }, [
    onHeaderState,
    scopeDescription,
    scopeHasOverride,
    scopeReady,
    pending,
    validationError,
    activeScopeKey,
    draft,
    settings,
    hasChanges,
    disabled,
  ]);

  const formBody = (
    <>
      {validationError ? (
        <p
          className={cn(
            "mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700",
            embedded ? dashboardUi.opsSideBody : dashboardUi.body
          )}
        >
          {validationError}
        </p>
      ) : null}

      {!hideScopeSelectors ? (
        <div className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2">
            <Label size="dashboard">농장</Label>
            <SimpleSelect
              options={farmOptions}
              value={farmId || undefined}
              onValueChange={handleFarmChange}
              triggerClassName="w-full"
            />
          </div>
          <div className="space-y-2">
            <Label size="dashboard">축사유형</Label>
            <SimpleSelect
              placeholder="선택"
              options={spOptions}
              value={spCode === SCOPE_ALL ? undefined : spCode}
              onValueChange={handleSpChange}
              triggerClassName="w-full"
            />
          </div>
          <div className="space-y-2">
            <Label size="dashboard">축사번호</Label>
            <SimpleSelect
              placeholder={spCode === SCOPE_ALL ? "—" : "전체 (축사유형 일괄)"}
              options={stallOptions}
              value={stallOptions.length > 0 ? stallKey : undefined}
              onValueChange={handleStallChange}
              triggerClassName="w-full"
            />
          </div>
          <div className="space-y-2">
            <Label size="dashboard">컨트롤러</Label>
            <SimpleSelect
              placeholder={stallKey === SCOPE_ALL ? "—" : "전체 (축사)"}
              options={controllerOptions}
              value={
                controllerOptions.length > 0 ? controllerReadingKey : undefined
              }
              onValueChange={(v) => v && setControllerReadingKey(v)}
              triggerClassName="w-full"
            />
          </div>
        </div>
      ) : null}

      {scopeReady && !externalHeader ? (
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "inline-flex min-h-[2rem] items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-900",
              dashboardTypography.badge
            )}
          >
            {scopeDescription}
          </span>
          {!hideScopeSelectors && stallKey === SCOPE_ALL ? (
            <span
              className={cn(
                "inline-flex min-h-[2rem] items-center rounded-full border border-emerald-300 bg-emerald-50/80 px-3 py-1 text-emerald-800",
                dashboardTypography.badge
              )}
            >
              축사유형 일괄
            </span>
          ) : null}
          {!hideScopeSelectors ? (
            <span className={cn("text-muted-foreground", dashboardTypography.meta)}>
              {scopeReadings.length}대
            </span>
          ) : null}
          {scopeHasOverride ? (
            <span className={cn("text-amber-700", dashboardTypography.meta)}>
              저장됨
            </span>
          ) : (
            <span className={cn("text-muted-foreground", dashboardTypography.meta)}>
              상위/기본값 상속
            </span>
          )}
          <div className="ml-auto flex flex-wrap gap-2">
            <PageActionButton
              type="button"
              variant="outline"
              disabled={fieldsDisabled}
              onClick={handleApplyDefaults}
            >
              기본값
            </PageActionButton>
            {scopeHasOverride ? (
              <PageActionButton
                type="button"
                variant="outline"
                disabled={fieldsDisabled}
                onClick={handleClearScope}
              >
                설정 삭제
              </PageActionButton>
            ) : null}
            {embedded ? (
              <PageActionButton
                type="submit"
                variant="primary"
                disabled={
                  fieldsDisabled ||
                  !!validationError ||
                  !hasChanges
                }
              >
                {pending ? "저장 중…" : "저장"}
              </PageActionButton>
            ) : null}
          </div>
        </div>
      ) : null}

      <div
        className={cn(
          mobileSplit ? "space-y-3" : "grid gap-4",
          !mobileSplit && "grid-cols-1 lg:grid-cols-2"
        )}
      >
        {mobileSplit || compact ? (
          <>
            <ThresholdRangeSlider
              title="온도 알림"
              icon={<AlarmDomainIcon domain="temp" />}
              min={10}
              max={35}
              step={0.1}
              low={draft.tempLow}
              high={draft.tempHigh}
              unit="℃"
              valueMode="baseline-dev"
              accentClass="bg-channel-temp/35"
              disabled={fieldsDisabled}
              compact
              bare
              titleClassName={sliderTitleClassName}
              axisClassName={sliderAxisClassName}
              axisInputSize="compact"
              axisMode="editable"
              onChange={(low, high) =>
                updateDraft({ ...draft, tempLow: low, tempHigh: high })
              }
            />
            <ThresholdRangeSlider
              title="습도 알림"
              icon={<AlarmDomainIcon domain="humidity" />}
              min={0}
              max={100}
              step={1}
              low={draft.humidityLow}
              high={draft.humidityHigh}
              unit="%"
              valueMode="baseline-dev"
              accentClass="bg-channel-info/35"
              disabled={fieldsDisabled}
              compact
              bare
              titleClassName={sliderTitleClassName}
              axisClassName={sliderAxisClassName}
              axisInputSize="compact"
              axisMode="editable"
              onChange={(low, high) =>
                updateDraft({ ...draft, humidityLow: low, humidityHigh: high })
              }
            />
          </>
        ) : (
          <>
            <ThresholdRangeSlider
              title="온도 알림"
              icon={
                <AlarmDomainIcon domain="temp" sizeClass={dashboardUi.iconSm} />
              }
              min={10}
              max={35}
              step={0.1}
              low={draft.tempLow}
              high={draft.tempHigh}
              unit="℃"
              valueMode="baseline-dev"
              axisMode="editable"
              accentClass="bg-channel-temp/35"
              disabled={fieldsDisabled}
              onChange={(tempLow, tempHigh) =>
                updateDraft({ ...draft, tempLow, tempHigh })
              }
            />
            <ThresholdRangeSlider
              title="습도 알림"
              icon={
                <AlarmDomainIcon
                  domain="humidity"
                  sizeClass={dashboardUi.iconSm}
                />
              }
              min={0}
              max={100}
              step={1}
              low={draft.humidityLow}
              high={draft.humidityHigh}
              unit="%"
              valueMode="baseline-dev"
              axisMode="editable"
              accentClass="bg-channel-info/35"
              disabled={fieldsDisabled}
              onChange={(humidityLow, humidityHigh) =>
                updateDraft({ ...draft, humidityLow, humidityHigh })
              }
            />
          </>
        )}
      </div>
    </>
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!disabled && scopeReady && activeScopeKey) handleSaveScope();
      }}
    >
      <input type="hidden" name="settings_json" value={JSON.stringify(settings)} />

      {embedded ? (
        formBody
      ) : (
        <SectionCard
          title="알람 임계값"
          action={
            <PageActionButton
              type="submit"
              variant="primary"
              disabled={disabled || pending || !!validationError || !scopeReady}
            >
              {pending ? "저장 중…" : "저장"}
            </PageActionButton>
          }
        >
          {formBody}
        </SectionCard>
      )}
    </form>
  );
}
