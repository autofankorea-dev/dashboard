"use client";

import { useEffect, useRef, useState } from "react";
import { type FarmKey } from "@/lib/domain/farm-key";
import { farmDisplayLabel } from "@/lib/domain/farm-summaries";
import { type AdminHubFarmRow } from "@/lib/farm/admin-hub-farm-status";
import {
  HUB_MAP_TONE_LABEL,
  HUB_MAP_VIEW_NE,
  HUB_MAP_VIEW_SW,
  hubMapFarmId,
  hubMapInPan,
  hubMapPinClass,
  hubMapPinLabel,
  hubMapPinTooltipHtml,
} from "@/lib/farm/admin-hub-map-markers";
import { loadKakaoMapsSdk } from "@/lib/farm/kakao-maps-loader";
import "./admin-hub-leaflet-map.css";

type KakaoLatLng = { getLat: () => number; getLng: () => number };
type KakaoMap = {
  setMapTypeId: (id: unknown) => void;
  addControl: (control: unknown, pos: unknown) => void;
  setBounds: (bounds: unknown, t?: number, r?: number, b?: number, l?: number) => void;
  setLevel: (level: number) => void;
  relayout: () => void;
  setMinLevel?: (level: number) => void;
  setMaxLevel?: (level: number) => void;
};

type KakaoOverlay = {
  setMap: (map: KakaoMap | null) => void;
  setPosition: (ll: KakaoLatLng) => void;
  setZIndex: (n: number) => void;
};

type KakaoNs = {
  LatLng: new (lat: number, lng: number) => KakaoLatLng;
  LatLngBounds: new (sw: KakaoLatLng, ne: KakaoLatLng) => unknown;
  Map: new (
    el: HTMLElement,
    opts: { center: KakaoLatLng; level: number },
  ) => KakaoMap;
  MapTypeId: { ROADMAP: unknown };
  ZoomControl: new () => unknown;
  ControlPosition: { TOPLEFT: unknown };
  CustomOverlay: new (opts: {
    position: KakaoLatLng;
    content: HTMLElement;
    xAnchor?: number;
    yAnchor?: number;
    zIndex?: number;
    clickable?: boolean;
  }) => KakaoOverlay;
};

type PinRec = {
  overlay: KakaoOverlay;
  span: HTMLSpanElement;
};

type Props = {
  appKey: string;
  rows: AdminHubFarmRow[];
  activeId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (farmKey: FarmKey) => void;
  onFail: () => void;
};

function fitKorea(map: KakaoMap, maps: KakaoNs) {
  map.relayout();
  const bounds = new maps.LatLngBounds(
    new maps.LatLng(HUB_MAP_VIEW_SW.lat, HUB_MAP_VIEW_SW.lng),
    new maps.LatLng(HUB_MAP_VIEW_NE.lat, HUB_MAP_VIEW_NE.lng),
  );
  map.setBounds(bounds, 36, 36, 36, 36);
}

export function AdminHubKakaoMap({
  appKey,
  rows,
  activeId,
  onHover,
  onSelect,
  onFail,
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<KakaoMap | null>(null);
  const mapsRef = useRef<KakaoNs | null>(null);
  const pinsRef = useRef<Map<string, PinRec>>(new Map());
  const tipRef = useRef<KakaoOverlay | null>(null);
  const onHoverRef = useRef(onHover);
  const onSelectRef = useRef(onSelect);
  const rowsRef = useRef(rows);
  const activeIdRef = useRef(activeId);
  const mapReadyRef = useRef(false);
  const [mapEpoch, setMapEpoch] = useState(0);

  useEffect(() => {
    onHoverRef.current = onHover;
  }, [onHover]);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  useEffect(() => {
    const host = hostRef.current;
    const pins = pinsRef.current;
    if (!host) return;
    let cancelled = false;
    let fitTimer = 0;

    void loadKakaoMapsSdk(appKey)
      .then(() => {
        if (cancelled) return;
        const maps = window.kakao?.maps as unknown as KakaoNs | undefined;
        if (!maps?.Map || !maps.CustomOverlay) {
          onFail();
          return;
        }
        mapsRef.current = maps;
        const map = new maps.Map(host, {
          center: new maps.LatLng(36.2, 127.8),
          level: 12,
        });
        map.setMapTypeId(maps.MapTypeId.ROADMAP);
        map.addControl(new maps.ZoomControl(), maps.ControlPosition.TOPLEFT);
        map.setMinLevel?.(3);
        map.setMaxLevel?.(13);
        fitKorea(map, maps);
        mapRef.current = map;
        mapReadyRef.current = true;
        setMapEpoch((n) => n + 1);
        fitTimer = window.setTimeout(() => {
          if (!cancelled && mapRef.current && mapsRef.current) {
            fitKorea(mapRef.current, mapsRef.current);
          }
        }, 80);
      })
      .catch(() => {
        if (!cancelled) onFail();
      });

    const ro = new ResizeObserver(() => {
      mapRef.current?.relayout();
    });
    ro.observe(host);

    return () => {
      cancelled = true;
      window.clearTimeout(fitTimer);
      ro.disconnect();
      tipRef.current?.setMap(null);
      tipRef.current = null;
      for (const pin of pins.values()) pin.overlay.setMap(null);
      pins.clear();
      mapReadyRef.current = false;
      mapRef.current = null;
      mapsRef.current = null;
      host.replaceChildren();
    };
  }, [appKey, onFail]);

  useEffect(() => {
    const map = mapRef.current;
    const maps = mapsRef.current;
    if (!map || !maps || !mapReadyRef.current) return;

    for (const pin of pinsRef.current.values()) pin.overlay.setMap(null);
    pinsRef.current.clear();
    tipRef.current?.setMap(null);

    for (const row of rows) {
      const loc = row.location;
      if (!loc) continue;
      if (!hubMapInPan(loc.lat, loc.lng)) continue;
      const id = hubMapFarmId(row);
      const title = farmDisplayLabel(row.farmKey, loc.farmName);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "hub-map-pin-hit";
      btn.setAttribute(
        "aria-label",
        `${title} ${HUB_MAP_TONE_LABEL[row.tone]}`,
      );
      const span = document.createElement("span");
      span.className = hubMapPinClass(row, activeIdRef.current === id);
      span.textContent = hubMapPinLabel(row.farmKey);
      btn.appendChild(span);
      btn.addEventListener("mouseenter", () => {
        onHoverRef.current(id);
        const tipHost = document.createElement("div");
        tipHost.className = "hub-kakao-tip";
        tipHost.innerHTML = hubMapPinTooltipHtml(row);
        tipRef.current?.setMap(null);
        const tip = new maps.CustomOverlay({
          position: new maps.LatLng(loc.lat, loc.lng),
          content: tipHost,
          xAnchor: 0,
          yAnchor: 1.15,
          zIndex: 500,
          clickable: false,
        });
        tip.setMap(map);
        tipRef.current = tip;
      });
      btn.addEventListener("mouseleave", () => {
        onHoverRef.current(null);
        tipRef.current?.setMap(null);
        tipRef.current = null;
      });
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        onSelectRef.current(row.farmKey);
      });
      const overlay = new maps.CustomOverlay({
        position: new maps.LatLng(loc.lat, loc.lng),
        content: btn,
        xAnchor: 0.5,
        yAnchor: 0.5,
        zIndex: 1,
        clickable: true,
      });
      overlay.setMap(map);
      pinsRef.current.set(id, { overlay, span });
    }
  }, [rows, mapEpoch]);

  useEffect(() => {
    for (const row of rowsRef.current) {
      const id = hubMapFarmId(row);
      const pin = pinsRef.current.get(id);
      if (!pin) continue;
      pin.span.className = hubMapPinClass(row, activeId === id);
      pin.overlay.setZIndex(activeId === id ? 400 : 1);
    }
  }, [activeId]);

  return (
    <div
      ref={hostRef}
      className="hub-kakao absolute inset-0 min-h-[18rem]"
      aria-label="전체 농장 지리 지도"
    />
  );
}
