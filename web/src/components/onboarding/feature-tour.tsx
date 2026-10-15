"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useProfileSheetPrefs, useSheetCopy } from "@/components/account/profile-sheet-prefs";
import { tourStepBody, tourStepBullets, tourStepTitle } from "@/lib/onboarding/tour-copy";
import {
  FARM_TOUR_ACTION_EVENT,
  FARM_TOUR_ACTIVE_EVENT,
  FARM_TOUR_RESTART_EVENT,
  FARM_TOUR_RESTART_FLAG,
  FARM_TOUR_RESTART_SCOPE_KEY,
  TOUR_READY_CHART_SELECTOR,
  TOUR_READY_CONTROLLER_SELECTOR,
  TOUR_READY_FIELD_STATUS_SELECTOR,
  TOUR_READY_HEATMAP_SELECTOR,
  TOUR_READY_MAP_GRID_SELECTOR,
  TOUR_READY_MIN_CARDS,
  TOUR_READY_SELECTOR,
  TOUR_READY_VIEW_TOGGLE_SELECTOR,
  getTourStepsForScope,
  parseTourScope,
  tourScopeFromHubView,
  type TourScope,
  type TourStepDef,
  type TourView,
} from "@/lib/onboarding/tour-steps";
import { setFarmTourActiveSync } from "@/lib/onboarding/use-farm-tour-active";
import {
  getTourViewport,
  getTourPortalBounds,
  toTourLocalRect,
  mobileTourSheetBottomCss,
  measureTourTargetBandDrift,
  resetTourScrollContainers,
  resolveTourScrollPolicy,
  resolveTourScrollTarget,
  resolveTourStepSelector,
  scrollTourTargetIntoView,
  scrollTourTargetUntilBandAligned,
  stabilizeMobileBrowserViewport,
  isMobileTourSheet,
  subscribeTourViewportCssSync,
  subscribeTourViewportResize,
  findBestTourTarget,
  countPresentTourTargets,
  placeTourTooltip,
  resolveTourTooltipDock,
  TOUR_MOBILE_SETTLE_MS,
  TOUR_REALIGN_DRIFT_THRESHOLD,
  type TourScrollPolicy,
  type TourTooltipDock,
} from "@/lib/onboarding/tour-viewport";
import { subscribeViewportPreview } from "@/lib/ui/viewport-preview-store";
import {
  afterFrames,
  markTourStepReady,
  markTourStepSettling,
  settleSelectorsForGridAction,
  TOUR_AUTO_READY_GIVE_UP_MS,
  TOUR_FIND_INTERVAL_MS,
  TOUR_FIND_RETRIES,
  TOUR_FIND_RETRIES_AFTER_VIEW_CHANGE,
  TOUR_MANUAL_READY_FORCE_MS,
  TOUR_READY_INTERVAL_MS,
  TOUR_REVEAL_MAX_ATTEMPTS,
  waitForTooltipExtraReady,
  waitForTourGridAction,
  waitForTourTarget,
} from "@/lib/onboarding/tour-timing";
import type { TourGridAction } from "@/lib/onboarding/tour-grid-actions";
import {
  markOnboardingTourDoneAction,
  shouldShowOnboardingTourAction,
} from "@/app/(dashboard)/farm/onboarding-actions";
import {
  GaugeAnatomy,
  HeaderIconsGuide,
  ListModeIconsGuide,
  PanelPillsGuide,
} from "@/components/onboarding/tour-guides";
import { cn } from "@/lib/utils";

type Rect = { top: number; left: number; width: number; height: number };

const HOLE_PAD = 6;
const TOOLTIP_W = 440;
const TOOLTIP_W_MOBILE = 400;

/**
 * 스코프별 DOM 준비 — 스켈레톤/빈 패널 위 투어 시작 방지.
 * 현장: PC 현황/컨트롤러 · 모바일 map-grid · 레거시 카드+히트맵.
 */
function isTourContentReady(scope: TourScope): boolean {
  if (countPresentTourTargets(TOUR_READY_VIEW_TOGGLE_SELECTOR) < 1) return false;
  if (scope === "chart") {
    return countPresentTourTargets(TOUR_READY_CHART_SELECTOR) >= 1;
  }
  if (countPresentTourTargets(TOUR_READY_FIELD_STATUS_SELECTOR) >= 1) {
    return true;
  }
  if (countPresentTourTargets(TOUR_READY_CONTROLLER_SELECTOR) >= 1) {
    return true;
  }
  // 모바일 fieldMerge — 맵 카드 그리드(히트맵 없음)
  if (countPresentTourTargets(TOUR_READY_MAP_GRID_SELECTOR) >= 1) {
    return countPresentTourTargets(TOUR_READY_SELECTOR) >= TOUR_READY_MIN_CARDS;
  }
  // 레거시 그리드(병합 off) — 카드+히트맵
  if (countPresentTourTargets(TOUR_READY_SELECTOR) < TOUR_READY_MIN_CARDS) {
    return false;
  }
  return countPresentTourTargets(TOUR_READY_HEATMAP_SELECTOR) >= 1;
}

function resolveStepGridAction(step: TourStepDef): TourGridAction | undefined {
  if (isMobileTourSheet() && step.mobileGridAction) {
    return step.mobileGridAction;
  }
  return step.gridAction;
}

function measure(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return toTourLocalRect({
    top: r.top,
    left: r.left,
    width: r.width,
    height: r.height,
  });
}

function getStepSpotlightSelector(step: TourStepDef): string {
  return resolveTourStepSelector(step.selector, step.mobileSelector);
}

function dispatchGridAction(action: TourGridAction) {
  window.dispatchEvent(
    new CustomEvent(FARM_TOUR_ACTION_EVENT, { detail: { action } }),
  );
}

function setFarmTourActive(active: boolean): void {
  setFarmTourActiveSync(active);
  window.dispatchEvent(
    new CustomEvent(FARM_TOUR_ACTIVE_EVENT, { detail: { active } }),
  );
}

/**
 * 스포트라이트 투어 오버레이 — 대상 요소를 밝게 남기고 나머지를 어둡게 처리.
 * 스텝마다 뷰 전환(preAction)·확대 상세 열기를 수행하고 대상 요소를 폴링으로 찾는다.
 * 대상이 없는 스텝(데이터 없음 등)은 진행 방향으로 자동 건너뛴다.
 */
function TourOverlay({
  steps,
  initialView,
  setView,
  onFinish,
}: {
  steps: TourStepDef[];
  initialView: TourView;
  setView: (v: TourView) => void;
  onFinish: (completed: boolean) => void;
}) {
  const t = useSheetCopy();
  const locale = useProfileSheetPrefs().locale;
  const [stepIdx, setStepIdx] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [accentRect, setAccentRect] = useState<Rect | null>(null);
  const [holeReady, setHoleReady] = useState(false);
  const [settling, setSettling] = useState(false);
  const dirRef = useRef<1 | -1>(1);
  const stepGenRef = useRef(0);
  const tooltipRealignedRef = useRef(false);
  const targetRef = useRef<Element | null>(null);
  const accentRef = useRef<Element | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [viewportReady, setViewportReady] = useState(false);
  const [portalBounds, setPortalBounds] = useState<ReturnType<
    typeof getTourPortalBounds
  >>(() => (typeof window !== "undefined" ? getTourPortalBounds() : null));
  const dimMaskId = useId().replace(/:/g, "");
  const step = steps[stepIdx];
  const scrollPolicy: TourScrollPolicy = step
    ? resolveTourScrollPolicy(step)
    : "none";
  const scrollEnabled = scrollPolicy !== "none";

  const getTooltipHeight = useCallback(
    () => tooltipRef.current?.getBoundingClientRect().height ?? null,
    [],
  );

  const measureTargets = useCallback(() => {
    if (targetRef.current) setRect(measure(targetRef.current));
    if (accentRef.current) {
      const ar = accentRef.current.getBoundingClientRect();
      const vv = getTourViewport();
      const visible =
        ar.bottom > vv.top + 4 &&
        ar.top < vv.top + vv.height - 4 &&
        ar.right > vv.left + 4 &&
        ar.left < vv.left + vv.width - 4;
      setAccentRect(visible ? measure(accentRef.current) : null);
    } else {
      setAccentRect(null);
    }
  }, []);

  const runTargetScrollOnce = useCallback(() => {
    const spotlight = targetRef.current as HTMLElement | null;
    if (!spotlight || !isMobileTourSheet() || !scrollEnabled || !step) return;
    const scrollEl = resolveTourScrollTarget(
      spotlight,
      step.mobileScrollSelector,
    );
    const tipH = getTooltipHeight();
    const r = scrollEl.getBoundingClientRect();
    const dock: TourTooltipDock = resolveTourTooltipDock(
      { top: r.top, height: r.height },
      getTourViewport().height,
    );
    scrollTourTargetUntilBandAligned(
      scrollEl,
      {
        scrollPolicy,
        tooltipHeight: tipH,
        tooltipDock: dock,
      },
      3,
    );
  }, [scrollPolicy, scrollEnabled, getTooltipHeight, step]);

  const finish = useCallback(
    (completed: boolean) => {
      dispatchGridAction("close-header-tools");
      setView(initialView);
      onFinish(completed);
    },
    [initialView, setView, onFinish],
  );

  const goTo = useCallback(
    (next: number, dir: 1 | -1) => {
      dirRef.current = dir;
      if (next < 0) return;
      if (next >= steps.length) {
        finish(true);
        return;
      }
      const leaving = steps[stepIdx];
      const entering = steps[next];
      if (leaving?.id === "f-header" && entering?.id !== "f-header") {
        dispatchGridAction("close-header-tools");
      }
      stepGenRef.current += 1;
      tooltipRealignedRef.current = false;
      markTourStepSettling();
      setSettling(true);
      setStepIdx(next);
    },
    [finish, stepIdx, steps],
  );

  // P2 — 투어 시작 시 모바일 브라우저 주소창 안정화(1회).
  useEffect(() => {
    let cancelled = false;
    const markReady = () => {
      if (!cancelled) setViewportReady(true);
    };
    if (typeof window === "undefined" || !isMobileTourSheet()) {
      markReady();
      return () => {
        cancelled = true;
      };
    }
    void stabilizeMobileBrowserViewport().then(markReady);
    return () => {
      cancelled = true;
    };
  }, []);

  // 모바일 프리뷰 프레임 경계 — 토글·리사이즈 시 투어 오버레이 재정렬
  useEffect(() => {
    const sync = () => {
      setPortalBounds(getTourPortalBounds());
      measureTargets();
    };
    sync();
    const unsub = subscribeViewportPreview(sync);
    window.addEventListener("resize", sync);
    return () => {
      unsub();
      window.removeEventListener("resize", sync);
    };
  }, [measureTargets]);

  // 스텝 진입 — 이벤트 기반 layout settle → scroll 1회 → hole 표시.
  useEffect(() => {
    if (!viewportReady || !step) return;
    const stepGen = stepGenRef.current;
    let cancelled = false;
    let attempts = 0;
    const timers: number[] = [];
    const spotlightSelector = getStepSpotlightSelector(step);
    const prevStep = stepIdx > 0 ? steps[stepIdx - 1] : null;

    targetRef.current = null;
    accentRef.current = null;

    const schedule = (fn: () => void, ms: number) => {
      timers.push(window.setTimeout(fn, ms));
    };

    const stepScrollPolicy = resolveTourScrollPolicy(step);
    const stepScrollEnabled = stepScrollPolicy !== "none";

    const scrollTargetOnce = (scrollEl: HTMLElement) => {
      if (!stepScrollEnabled || !isMobileTourSheet()) return;
      const r = scrollEl.getBoundingClientRect();
      const dock = resolveTourTooltipDock(
        { top: r.top, height: r.height },
        getTourViewport().height,
      );
      scrollTourTargetUntilBandAligned(
        scrollEl,
        {
          scrollPolicy: stepScrollPolicy,
          tooltipHeight: getTooltipHeight(),
          tooltipDock: dock,
        },
        3,
      );
    };

    const resolveScrollEl = (spotlightEl: HTMLElement) =>
      resolveTourScrollTarget(spotlightEl, step.mobileScrollSelector);

    const completeStep = (el: HTMLElement) => {
      if (cancelled || stepGenRef.current !== stepGen || targetRef.current !== el) {
        return;
      }
      measureTargets();
      setSettling(false);
      setHoleReady(true);
      markTourStepReady(stepIdx);
    };

    const revealHole = async (spotlightEl: HTMLElement) => {
      const scrollEl = resolveScrollEl(spotlightEl);
      for (let attempt = 0; attempt < TOUR_REVEAL_MAX_ATTEMPTS; attempt += 1) {
        if (
          cancelled ||
          stepGenRef.current !== stepGen ||
          targetRef.current !== spotlightEl
        ) {
          return;
        }
        if (stepScrollEnabled) scrollTargetOnce(scrollEl);
        await afterFrames(1);
        const r = scrollEl.getBoundingClientRect();
        const dock = resolveTourTooltipDock(
          { top: r.top, height: r.height },
          getTourViewport().height,
        );
        const band = measureTourTargetBandDrift(
          scrollEl,
          getTooltipHeight(),
          stepScrollPolicy,
          dock,
        );
        if (band.drift < TOUR_REALIGN_DRIFT_THRESHOLD) {
          completeStep(spotlightEl);
          return;
        }
      }
      completeStep(spotlightEl);
    };

    const finalizeMobileStep = async (el: HTMLElement) => {
      if (cancelled || stepGenRef.current !== stepGen) return;
      setSettling(true);
      markTourStepSettling();

      try {
        // gridAction은 runStepEntry에서 이미 대기함 — 여기서 재대기하면 done 레이스를 놓침.
        const entryAction = resolveStepGridAction(step);
        if (!entryAction) {
          if (prevStep?.view !== step.view) await afterFrames(2);
          else await afterFrames(1);
        }

        const showExtra =
          Boolean(step.extra) &&
          !(isMobileTourSheet() && step.mobileHideExtra);
        if (showExtra && tooltipRef.current) {
          await waitForTooltipExtraReady(tooltipRef.current);
        }

        if (!stepScrollEnabled) {
          completeStep(el);
          return;
        }

        await revealHole(el);
      } catch {
        completeStep(el);
      }
    };

    const finalizeDesktopStep = async (el: HTMLElement) => {
      if (cancelled || stepGenRef.current !== stepGen) return;
      setSettling(true);
      markTourStepSettling();
      try {
        if (step.extra && tooltipRef.current) {
          await waitForTooltipExtraReady(tooltipRef.current);
        }
        if (stepScrollEnabled) {
          scrollTourTargetIntoView(el, false);
          await afterFrames(2);
          // tip 높이 반영 후 한 번 더 — 그래프·설정 패널이 화면 밖으로 남지 않게.
          scrollTourTargetIntoView(el, false);
          await afterFrames(1);
        } else {
          await afterFrames(1);
        }
        completeStep(el);
      } catch {
        completeStep(el);
      }
    };

    const locate = () => {
      if (cancelled || stepGenRef.current !== stepGen) return;
      const isMobileSheet = isMobileTourSheet();
      const viewChanged = prevStep != null && prevStep.view !== step.view;
      const findRetries = viewChanged
        ? TOUR_FIND_RETRIES_AFTER_VIEW_CHANGE
        : TOUR_FIND_RETRIES;
      // 모바일 전용 → 데스크톱 셀렉터 폴백(차트 등 조건부 DOM).
      const el =
        findBestTourTarget(spotlightSelector) ??
        (step.mobileSelector && step.mobileSelector !== spotlightSelector
          ? findBestTourTarget(step.mobileSelector)
          : null) ??
        (step.mobileSelector ? findBestTourTarget(step.selector) : null);
      if (el) {
        targetRef.current = el;
        if (step.accentSelector) {
          const useMobileAlt =
            isMobileSheet && Boolean(step.mobileSelector);
          if (!useMobileAlt) {
            accentRef.current =
              (el.querySelector(step.accentSelector) as Element | null) ??
              findBestTourTarget(step.accentSelector);
          } else {
            accentRef.current = null;
          }
        } else {
          accentRef.current = null;
        }

        void (isMobileSheet
          ? finalizeMobileStep(el)
          : finalizeDesktopStep(el));
        return;
      }
      if (step.skipIfMissing) {
        const next = stepIdx + dirRef.current;
        if (next < 0 || next >= steps.length) finish(true);
        else setStepIdx(next);
        return;
      }
      attempts += 1;
      if (attempts >= findRetries) {
        const next = stepIdx + dirRef.current;
        if (next < 0 || next >= steps.length) finish(true);
        else setStepIdx(next);
        return;
      }
      schedule(locate, TOUR_FIND_INTERVAL_MS);
    };

    // expand/collapse done 수신 후에 locate — done을 locate 뒤에서 놓치지 않음.
    // 맵→목록은 view-toggle(map)과 list-command-bar(list)로 분리해 동시 전환을 피함.
    void (async () => {
      if (cancelled || stepGenRef.current !== stepGen) return;
      setView(step.view);
      if (step.view === "list" && prevStep?.view !== "list") {
        resetTourScrollContainers();
      }
      const entryAction = resolveStepGridAction(step);
      if (entryAction) {
        const pending = waitForTourGridAction(entryAction);
        dispatchGridAction(entryAction);
        await pending;
        await afterFrames(2);
        const settleSels = settleSelectorsForGridAction(entryAction);
        if (settleSels) await waitForTourTarget(settleSels);
      } else if (step.view === "list" && prevStep?.view !== "list") {
        // 목록 첫 진입 — 커맨드바·카드 마운트 여유.
        await waitForTourTarget([
          step.selector,
          ...(step.mobileSelector ? [step.mobileSelector] : []),
          '[data-tour-id="controller-card"]',
        ]);
      }
      if (!cancelled && stepGenRef.current === stepGen) locate();
    })();

    return () => {
      cancelled = true;
      for (const id of timers) window.clearTimeout(id);
    };
  }, [
    stepIdx,
    step,
    steps,
    setView,
    finish,
    viewportReady,
    measureTargets,
    getTooltipHeight,
  ]);

  // scroll → rect만(rAF). resize → drift 임계 초과 시 1회 재스크롤.
  useEffect(() => {
    let raf = 0;
    let tooltipResizeTimer: number | undefined;
    let realignSettleTimer: number | undefined;
    const effectGen = stepGenRef.current;

    const onScrollMeasure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measureTargets);
    };

    const realignMobileTargetIfNeeded = (force = false) => {
      const spotlight = targetRef.current as HTMLElement | null;
      if (!spotlight || !isMobileTourSheet() || !scrollEnabled) return false;
      const scrollEl = resolveTourScrollTarget(
        spotlight,
        step.mobileScrollSelector,
      );
      const r = scrollEl.getBoundingClientRect();
      const dock = resolveTourTooltipDock(
        { top: r.top, height: r.height },
        getTourViewport().height,
      );
      const drift = measureTourTargetBandDrift(
        scrollEl,
        getTooltipHeight(),
        scrollPolicy,
        dock,
      ).drift;
      if (!force && drift < TOUR_REALIGN_DRIFT_THRESHOLD) return false;
      setSettling(true);
      runTargetScrollOnce();
      window.clearTimeout(realignSettleTimer);
      realignSettleTimer = window.setTimeout(() => {
        if (stepGenRef.current !== effectGen) return;
        measureTargets();
        setSettling(false);
      }, TOUR_MOBILE_SETTLE_MS);
      return true;
    };

    const onTooltipResize = () => {
      if (!isMobileTourSheet()) return;
      window.clearTimeout(tooltipResizeTimer);
      tooltipResizeTimer = window.setTimeout(() => {
        if (!scrollEnabled) {
          measureTargets();
          return;
        }
        if (!holeReady || settling) {
          const el = targetRef.current as HTMLElement | null;
          if (el && realignMobileTargetIfNeeded(true)) return;
        }
        if (holeReady && !tooltipRealignedRef.current) {
          if (realignMobileTargetIfNeeded(true)) {
            tooltipRealignedRef.current = true;
          }
        } else if (holeReady) {
          measureTargets();
        }
      }, 120);
    };

    window.addEventListener("scroll", onScrollMeasure, true);

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver((entries) => {
        const fromTooltip = entries.some(
          (entry) => entry.target === tooltipRef.current,
        );
        if (fromTooltip) onTooltipResize();
        else onScrollMeasure();
      });
      if (targetRef.current) ro.observe(targetRef.current);
      if (accentRef.current) ro.observe(accentRef.current);
      if (tooltipRef.current) ro.observe(tooltipRef.current);
    }

    const unsubCss = subscribeTourViewportCssSync();
    const unsubResize = subscribeTourViewportResize(() => {
      if (!holeReady || !targetRef.current || !isMobileTourSheet()) return;
      realignMobileTargetIfNeeded(false);
    });

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(tooltipResizeTimer);
      window.clearTimeout(realignSettleTimer);
      window.removeEventListener("scroll", onScrollMeasure, true);
      ro?.disconnect();
      unsubCss();
      unsubResize();
    };
  // settling: 포함 시 settle 타이머와 재구독 루프
  // step.mobileScrollSelector: measureTargets/scrollPolicy로 간접 반영
  // eslint-disable-next-line react-hooks/exhaustive-deps -- 의도적 생략
  }, [stepIdx, holeReady, measureTargets, runTargetScrollOnce, getTooltipHeight, scrollEnabled, scrollPolicy]);

  // Esc — 건너뛰기(완료 저장).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish(false);
      else if (e.key === "ArrowRight") goTo(stepIdx + 1, 1);
      else if (e.key === "ArrowLeft") goTo(stepIdx - 1, -1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finish, goTo, stepIdx]);

  const tourVp = typeof window !== "undefined" ? getTourViewport() : null;
  const vw = tourVp?.layoutWidth ?? 1280;
  const vh = tourVp?.height ?? 800;
  const mobileSheet = isMobileTourSheet();
  const tooltipW = mobileSheet
    ? Math.min(TOOLTIP_W_MOBILE, vw - 24)
    : Math.min(TOOLTIP_W, vw - 24);
  const mobileSheetBottom = mobileTourSheetBottomCss();

  const hole = holeReady && rect
    ? {
        top: rect.top - HOLE_PAD,
        left: rect.left - HOLE_PAD,
        width: rect.width + HOLE_PAD * 2,
        height: rect.height + HOLE_PAD * 2,
      }
    : null;
  // 보조 타깃도 딤을 뚫어 밝게 표시
  const accentHole =
    holeReady && accentRect
      ? {
          top: accentRect.top - 4,
          left: accentRect.left - 4,
          width: accentRect.width + 8,
          height: accentRect.height + 8,
        }
      : null;

  const tooltipPlacement = placeTourTooltip({
    hole,
    vw,
    vh,
    tooltipW,
    mobileSheet,
    mobileSheetBottom,
    viewportTop: tourVp?.top ?? 0,
  });
  const tooltipStyle: React.CSSProperties = tooltipPlacement.style;
  if (!step) return null;
  const stepTitle = tourStepTitle(step, locale, mobileSheet);
  const stepBody = tourStepBody(step, locale, mobileSheet);
  const stepBullets = tourStepBullets(step, locale, mobileSheet);
  const showStepExtra =
    Boolean(step.extra) && !(mobileSheet && step.mobileHideExtra);
  const dimW = portalBounds?.width ?? vw;
  const dimH = portalBounds?.height ?? vh;

  return createPortal(
    <div
      className={cn(
        "fixed z-[9990]",
        portalBounds ? "" : "inset-0",
      )}
      style={
        portalBounds
          ? {
              top: portalBounds.top,
              left: portalBounds.left,
              width: portalBounds.width,
              height: portalBounds.height,
            }
          : undefined
      }
      data-farm-tour-root
      role="dialog"
      aria-modal="true"
      aria-label={t("tour.label")}
    >
      {/* 딤 + 스포트라이트 홀 — 주 타깃·보조(accent) 모두 밝게 */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {hole ? (
          <svg
            className={cn(
              "farm-tour-hole absolute inset-0 h-full w-full",
              mobileSheet && "farm-tour-hole--mobile",
            )}
            data-settling={settling ? "true" : undefined}
            viewBox={`0 0 ${dimW} ${dimH}`}
            preserveAspectRatio="none"
          >
            <defs>
              <mask
                id={`farm-tour-dim-${dimMaskId}`}
                maskUnits="userSpaceOnUse"
              >
                <rect x={0} y={0} width={dimW} height={dimH} fill="white" />
                <rect
                  x={hole.left}
                  y={hole.top}
                  width={hole.width}
                  height={hole.height}
                  rx={12}
                  ry={12}
                  fill="black"
                />
                {accentHole ? (
                  <rect
                    x={accentHole.left}
                    y={accentHole.top}
                    width={accentHole.width}
                    height={accentHole.height}
                    rx={8}
                    ry={8}
                    fill="black"
                  />
                ) : null}
              </mask>
            </defs>
            <rect
              x={0}
              y={0}
              width={dimW}
              height={dimH}
              fill="rgba(9, 12, 20, 0.62)"
              mask={`url(#farm-tour-dim-${dimMaskId})`}
            />
          </svg>
        ) : (
          <div className="absolute inset-0 bg-[rgba(9,12,20,0.62)]" />
        )}
      </div>
      {/* 클릭 차단 레이어(홀 포함 전체) */}
      <div className="absolute inset-0" aria-hidden />

      {/* 보조 강조 — 드래그 손잡이 등 */}
      {accentRect ? (
        <div
          className="farm-tour-accent pointer-events-none absolute rounded-md"
          style={{
            top: accentRect.top - 4,
            left: accentRect.left - 4,
            width: accentRect.width + 8,
            height: accentRect.height + 8,
          }}
          aria-hidden
        />
      ) : null}

      {/* 툴팁 — 헤더/본문 스크롤/푸터 분리로 버튼 잘림 방지 */}
      <div
        ref={tooltipRef}
        className={cn(
          "farm-tour-tooltip absolute flex flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-2xl",
          mobileSheet ? "p-5" : "p-6",
        )}
        style={tooltipStyle}
        data-mobile={mobileSheet ? "true" : undefined}
        data-tour-dock={tooltipPlacement.dock}
      >
        <div className={cn("flex shrink-0 items-center gap-2", mobileSheet ? "mb-1.5" : "mb-2")}>
          <span
            className={cn(
              "font-semibold tabular-nums text-muted-foreground",
              mobileSheet ? "text-xs" : "text-sm",
            )}
          >
            {stepIdx + 1} / {steps.length}
          </span>
          <span className="ml-auto" />
          <button
            type="button"
            onClick={() => finish(false)}
            className={cn(
              "rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              mobileSheet ? "p-0.5" : "p-1",
            )}
            aria-label={t("tour.close")}
          >
            <X className={mobileSheet ? "size-3.5" : "size-4"} aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <p
            className={cn(
              "font-bold leading-snug",
              mobileSheet ? "text-base" : "text-lg",
            )}
          >
            {stepTitle}
          </p>
          <p
            className={cn(
              "leading-relaxed text-muted-foreground",
              mobileSheet ? "mt-1 text-sm" : "mt-1.5 text-[0.9375rem]",
            )}
          >
            {stepBody}
          </p>
          {stepBullets && stepBullets.length > 0 ? (
            <ul
              className={cn(
                "list-disc space-y-1 pl-4 text-muted-foreground",
                mobileSheet ? "mt-1.5 text-sm leading-snug" : "mt-2 text-[0.9375rem] leading-snug",
              )}
            >
              {stepBullets.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}
          {showStepExtra && step.extra === "anatomy" ? (
            <div className={mobileSheet ? "mt-2.5" : "mt-3"} data-tour-extra="anatomy">
              <GaugeAnatomy compact={mobileSheet} />
            </div>
          ) : null}
          {showStepExtra && step.extra === "pills" ? (
            <div className={mobileSheet ? "mt-2.5" : "mt-3"} data-tour-extra="pills">
              <PanelPillsGuide compact={mobileSheet} />
            </div>
          ) : null}
          {showStepExtra && step.extra === "header-icons" ? (
            <div className={mobileSheet ? "mt-2.5" : "mt-3"} data-tour-extra="header-icons">
              <HeaderIconsGuide compact={mobileSheet} />
            </div>
          ) : null}
          {showStepExtra && step.extra === "list-mode-icons" ? (
            <div
              className={mobileSheet ? "mt-2.5" : "mt-3"}
              data-tour-extra="list-mode-icons"
            >
              <ListModeIconsGuide compact={mobileSheet} />
            </div>
          ) : null}
        </div>

        <div
          className={cn(
            "shrink-0",
            mobileSheet ? "mt-3 flex flex-col gap-2.5" : "mt-4 flex items-center gap-1.5",
          )}
        >
          <div className="flex items-center justify-center gap-1.5">
            {steps.map((s, i) => (
              <span
                key={s.id}
                className={cn(
                  "rounded-full transition-colors",
                  mobileSheet ? "size-1.5" : "size-2",
                  i === stepIdx ? "bg-primary" : "bg-muted-foreground/25",
                )}
                aria-hidden
              />
            ))}
          </div>
          <div
            className={cn(
              "flex items-center gap-2",
              mobileSheet ? "justify-end" : "ml-auto",
            )}
          >
            <button
              type="button"
              onClick={() => finish(false)}
              className={cn(
                "rounded-md font-medium text-muted-foreground transition-colors hover:bg-muted",
                mobileSheet ? "px-2 py-1.5 text-xs" : "px-2.5 py-1.5 text-sm",
              )}
            >
              {t("tour.skip")}
            </button>
            {stepIdx > 0 ? (
              <button
                type="button"
                onClick={() => goTo(stepIdx - 1, -1)}
                className={cn(
                  "rounded-md border font-semibold transition-colors hover:bg-muted",
                  mobileSheet ? "px-2.5 py-1.5 text-xs" : "px-3.5 py-1.5 text-sm",
                )}
              >
                {t("tour.back")}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => goTo(stepIdx + 1, 1)}
              className={cn(
                "rounded-md bg-primary font-semibold text-primary-foreground transition-colors hover:bg-primary/90",
                mobileSheet ? "px-3 py-1.5 text-xs" : "px-4 py-1.5 text-sm",
              )}
            >
              {stepIdx === steps.length - 1 ? t("tour.done") : t("tour.next")}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * 투어 런처 — 첫 로그인(미완료·버전 갱신) 시 현장 투어 자동 시작,
 * 헤더 물음표로 현재 탭(현장·차트) 안내 수동 시작.
 * FarmPageContent 안에 마운트되어 뷰 전환(setView)을 직접 제어한다.
 */
export function FarmFeatureTour({
  view,
  setView,
  enabled = true,
}: {
  view: TourView;
  setView: (v: TourView) => void;
  enabled?: boolean;
}) {
  const [active, setActive] = useState(false);
  /** 다시 보기 시 TourOverlay remount — 이미 활성일 때 step 유지 방지. */
  const [tourSession, setTourSession] = useState(0);
  const [startView, setStartView] = useState<TourView>("map");
  const [tourScope, setTourScope] = useState<TourScope>("field");
  const [steps, setSteps] = useState<TourStepDef[]>([]);
  const checkedRef = useRef(false);
  const viewRef = useRef(view);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  const start = useCallback(
    (opts?: { manual?: boolean; scope?: TourScope }) => {
      const manual = Boolean(opts?.manual);
      const scope =
        opts?.scope ?? tourScopeFromHubView(viewRef.current);
      const nextSteps = getTourStepsForScope(scope);
      const resumeView = viewRef.current;
      // 스코프 탭 DOM이 보이도록 전환 — 현장은 병합 패널(map)로 맞춤.
      if (scope === "field") setView("map");
      else if (scope === "chart") setView("chart");

      const activate = () => {
        dispatchGridAction("close-header-tools");
        setFarmTourActive(true);
        setTourScope(scope);
        setSteps(nextSteps);
        setStartView(resumeView);
        setTourSession((n) => n + 1);
        setActive(true);
      };
      const abort = () => {
        setFarmTourActive(false);
        setActive(false);
        setSteps([]);
      };

      if (nextSteps.length === 0) {
        abort();
        return;
      }

      if (isTourContentReady(scope)) {
        activate();
        return;
      }

      const startedAt = Date.now();
      const forceAfterMs = manual ? TOUR_MANUAL_READY_FORCE_MS : null;
      const giveUpMs = manual
        ? TOUR_MANUAL_READY_FORCE_MS
        : TOUR_AUTO_READY_GIVE_UP_MS;

      const waitForReady = () => {
        if (isTourContentReady(scope)) {
          activate();
          return;
        }
        const elapsed = Date.now() - startedAt;
        if (forceAfterMs != null && elapsed >= forceAfterMs) {
          activate();
          return;
        }
        if (elapsed >= giveUpMs) {
          // 자동: 콘텐츠 미준비 시 투어 보류 (스켈레톤 위 난잡 방지)
          abort();
          return;
        }
        window.setTimeout(waitForReady, TOUR_READY_INTERVAL_MS);
      };
      waitForReady();
    },
    [setView],
  );

  // 자동 시작 — DOM 준비 폴링과 서버 완료 확인 병렬.
  useEffect(() => {
    if (!enabled || checkedRef.current) return;
    checkedRef.current = true;
    try {
      if (sessionStorage.getItem(FARM_TOUR_RESTART_FLAG)) {
        sessionStorage.removeItem(FARM_TOUR_RESTART_FLAG);
        let scope: TourScope = "field";
        try {
          scope = parseTourScope(
            sessionStorage.getItem(FARM_TOUR_RESTART_SCOPE_KEY),
          );
          sessionStorage.removeItem(FARM_TOUR_RESTART_SCOPE_KEY);
        } catch {
          /* ignore */
        }
        start({ manual: true, scope });
        return;
      }
    } catch {
      /* storage 사용 불가 */
    }

    let cancelled = false;

    void shouldShowOnboardingTourAction()
      .then((show) => {
        if (cancelled || !show) return;
        start({ manual: false, scope: "field" });
      })
      .catch(() => {
        /* 미로그인·네트워크 오류 */
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, start]);

  // 헤더 물음표 — 현재 탭 스코프 수동 재시작.
  useEffect(() => {
    if (!enabled) return;
    const onRestart = (ev: Event) => {
      const detail = (ev as CustomEvent<{ scope?: TourScope }>).detail;
      const scope =
        detail?.scope ?? tourScopeFromHubView(viewRef.current);
      start({ manual: true, scope });
    };
    window.addEventListener(FARM_TOUR_RESTART_EVENT, onRestart);
    return () => window.removeEventListener(FARM_TOUR_RESTART_EVENT, onRestart);
  }, [enabled, start]);

  const handleFinish = useCallback(() => {
    setFarmTourActive(false);
    if (isMobileTourSheet()) {
      dispatchGridAction("field-mobile-sheet-close");
    }
    dispatchGridAction("list-mode-controller");
    setActive(false);
    setSteps([]);
    void markOnboardingTourDoneAction().catch(() => {
      /* 저장 실패 시 다음 진입에서 재노출 */
    });
  }, []);

  if (!active || steps.length === 0) return null;
  return (
    <TourOverlay
      key={`${tourSession}-${tourScope}`}
      steps={steps}
      initialView={startView}
      setView={setView}
      onFinish={handleFinish}
    />
  );
}
