"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { dashboardTypography } from "@/lib/ui/dashboard-page-ui";
import { motionClass } from "@/lib/ui/motion-classes";
import { cn } from "@/lib/utils";
import {
  captureCoverMorphTargets,
  coverMorphDurationMs,
  type CoverMorphRect,
  type CoverMorphSnapshot,
} from "@/lib/farm/cover-reveal-morph";
import {
  controllerEnvCoverInkClass,
  type ControllerEnvCoverLevel,
} from "@/lib/farm/controller-env-cover";
export const COVER_REVEAL_STATUS_VAR: Record<ControllerEnvCoverLevel, string> = {
  ok: "var(--status-ok)",
  warn: "var(--status-warn)",
  danger: "var(--status-danger)",
  offline: "var(--status-offline)",
};

const GLYPH_STAGGER_MS = 12;

function glyphDest(
  band: CoverMorphRect,
  index: number,
  count: number,
  glyph: CoverMorphRect,
): { dx: number; dy: number } {
  const t = count <= 1 ? 0.5 : index / (count - 1);
  const destLeft = band.left + band.width * t - glyph.width / 2;
  const destTop = band.top + (band.height - glyph.height) / 2;
  return { dx: destLeft - glyph.left, dy: destTop - glyph.top };
}

function ValueGlyphs({
  text,
  first,
  band,
  play,
  reverse,
  level,
}: {
  text: string;
  first: CoverMorphRect;
  band: CoverMorphRect | null;
  play: boolean;
  reverse: boolean;
  level: ControllerEnvCoverLevel;
}) {
  const rowRef = useRef<HTMLSpanElement>(null);
  const [dest, setDest] = useState<{ dx: number; dy: number }[] | null>(null);
  const chars = Array.from(text);

  useLayoutEffect(() => {
    if (!band || !rowRef.current) return;
    const nodes = [...rowRef.current.children] as HTMLElement[];
    setDest(
      nodes.map((node, i) => {
        const glyph = {
          left: first.left + node.offsetLeft,
          top: first.top + node.offsetTop,
          width: node.offsetWidth,
          height: node.offsetHeight,
        };
        return glyphDest(band, i, nodes.length, glyph);
      }),
    );
  }, [band, first]);

  if (!text) return null;

  return (
    <span
      ref={rowRef}
      aria-hidden
      className={cn(
        "pointer-events-none absolute z-20 flex items-baseline",
        dashboardTypography.envCoverValue,
        controllerEnvCoverInkClass(level),
      )}
      style={{
        left: first.left,
        top: first.top,
        height: first.height,
      }}
    >
      {chars.map((ch, i) => {
        const delay = reverse
          ? Math.max(0, chars.length - 1 - i) * GLYPH_STAGGER_MS
          : i * GLYPH_STAGGER_MS;
        const parked = reverse && dest?.[i] && !play;
        return (
          <span
            key={`${ch}-${i}`}
            className={cn(
              play &&
                dest &&
                (reverse
                  ? motionClass.coverRevealGlyphReverse
                  : motionClass.coverRevealGlyph),
            )}
            style={
              dest?.[i]
                ? ({
                    ["--cover-glyph-dx" as string]: `${dest[i].dx}px`,
                    ["--cover-glyph-dy" as string]: `${dest[i].dy}px`,
                    animationDelay: `${delay}ms`,
                    ...(parked
                      ? {
                          transform: `translate(${dest[i].dx}px, ${dest[i].dy}px)`,
                          opacity: 0,
                        }
                      : null),
                  } as CSSProperties)
                : reverse
                  ? ({ opacity: 0 } as CSSProperties)
                  : undefined
            }
          >
            {ch === " " ? "\u00a0" : ch}
          </span>
        );
      })}
    </span>
  );
}

export type CoverRevealDirection = "open" | "close";

function CoverIdentityHold({
  snapshot,
  level,
}: {
  snapshot: CoverMorphSnapshot;
  level: ControllerEnvCoverLevel;
}) {
  const textClass = controllerEnvCoverInkClass(level);
  return (
    <>
      {snapshot.identity ? (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute z-30 truncate break-keep",
            dashboardTypography.envCoverIdentity,
            textClass,
          )}
          style={{
            left: snapshot.identity.left,
            top: snapshot.identity.top,
            width: snapshot.identity.width,
            height: snapshot.identity.height,
          }}
        >
          {snapshot.identityText}
        </span>
      ) : null}
      {snapshot.marks ? (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute z-30 truncate",
            dashboardTypography.envCoverMeta,
            textClass,
          )}
          style={{
            left: snapshot.marks.left,
            top: snapshot.marks.top,
            width: snapshot.marks.width,
            height: snapshot.marks.height,
          }}
        >
          {snapshot.marksText}
        </span>
      ) : null}
    </>
  );
}

type Props = {
  snapshot: CoverMorphSnapshot;
  level: ControllerEnvCoverLevel;
  direction?: CoverRevealDirection;
  onDone: () => void;
};

export function CoverRevealOverlay({
  snapshot,
  level,
  direction = "open",
  onDone,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [band, setBand] = useState<CoverMorphRect | null>(null);
  const [measured, setMeasured] = useState(false);
  const [play, setPlay] = useState(false);
  const reverse = direction === "close";
  const fill = COVER_REVEAL_STATUS_VAR[level];
  const glyphCount = snapshot.valueText.length;
  const holdMs =
    coverMorphDurationMs() + Math.max(0, glyphCount - 1) * GLYPH_STAGGER_MS;

  useLayoutEffect(() => {
    const root = wrapRef.current?.parentElement;
    if (!root) {
      setMeasured(true);
      return;
    }
    const targets = captureCoverMorphTargets(root, snapshot.band);
    setBand(targets?.band ?? null);
    setMeasured(true);
  }, [snapshot]);

  useEffect(() => {
    if (reverse && !measured) return;
    const id = window.requestAnimationFrame(() => setPlay(true));
    return () => window.cancelAnimationFrame(id);
  }, [reverse, measured]);

  useEffect(() => {
    if (!play) return;
    const id = window.setTimeout(onDone, holdMs);
    return () => window.clearTimeout(id);
  }, [play, onDone, holdMs]);

  return (
    <div
      ref={wrapRef}
      className="pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-xl"
      style={{ ["--cover-reveal-fill" as string]: fill }}
    >
      <div
        className={cn(
          "absolute inset-0 rounded-xl",
          reverse
            ? motionClass.coverRevealFillReverse
            : motionClass.coverRevealFill,
          play &&
            (reverse
              ? motionClass.coverRevealFillReversePlay
              : motionClass.coverRevealFillPlay),
        )}
      />
      {reverse ? (
        <CoverIdentityHold snapshot={snapshot} level={level} />
      ) : null}
      {snapshot.value ? (
        <ValueGlyphs
          text={snapshot.valueText}
          first={snapshot.value}
          band={band}
          play={play}
          reverse={reverse}
          level={level}
        />
      ) : null}
      {snapshot.bandLabel && snapshot.bandText ? (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute z-20",
            dashboardTypography.envCoverMeta,
            controllerEnvCoverInkClass(level),
            reverse && !play && "opacity-0",
            play &&
              (reverse
                ? motionClass.coverRevealGhostFadeIn
                : motionClass.coverRevealGhostFade),
          )}
          style={{
            left: snapshot.bandLabel.left,
            top: snapshot.bandLabel.top,
            width: snapshot.bandLabel.width,
            height: snapshot.bandLabel.height,
          }}
        >
          {snapshot.bandText}
        </span>
      ) : null}
    </div>
  );
}
