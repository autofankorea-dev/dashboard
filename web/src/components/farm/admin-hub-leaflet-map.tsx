"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./admin-hub-leaflet-map.css";
import { type FarmKey } from "@/lib/domain/farm-key";
import { farmDisplayLabel } from "@/lib/domain/farm-summaries";
import { type AdminHubFarmRow } from "@/lib/farm/admin-hub-farm-status";
import {
  HUB_MAP_PAN_NE,
  HUB_MAP_PAN_SW,
  HUB_MAP_VIEW_NE,
  HUB_MAP_VIEW_SW,
  hubMapFarmId,
  hubMapInPan,
  hubMapPinClass,
  hubMapPinLabel,
  hubMapPinTooltipHtml,
} from "@/lib/farm/admin-hub-map-markers";

const SOUTH_KOREA_VIEW = L.latLngBounds(
  [HUB_MAP_VIEW_SW.lat, HUB_MAP_VIEW_SW.lng],
  [HUB_MAP_VIEW_NE.lat, HUB_MAP_VIEW_NE.lng],
);
const SOUTH_KOREA_PAN = L.latLngBounds(
  [HUB_MAP_PAN_SW.lat, HUB_MAP_PAN_SW.lng],
  [HUB_MAP_PAN_NE.lat, HUB_MAP_PAN_NE.lng],
);
const SOUTH_KOREA_MAX_ZOOM = 16;

type Props = {
  rows: AdminHubFarmRow[];
  activeId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (farmKey: FarmKey) => void;
};

function pinIcon(row: AdminHubFarmRow, active: boolean): L.DivIcon {
  return L.divIcon({
    className: "hub-map-pin-wrap",
    iconSize: active ? [32, 32] : [28, 28],
    iconAnchor: active ? [16, 16] : [14, 14],
    html: `<span class="${hubMapPinClass(row, active)}">${hubMapPinLabel(row.farmKey)}</span>`,
  });
}

export function AdminHubLeafletMap({
  rows,
  activeId,
  onHover,
  onSelect,
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const onHoverRef = useRef(onHover);
  const onSelectRef = useRef(onSelect);
  const rowsRef = useRef(rows);

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
    const host = hostRef.current;
    if (!host || mapRef.current) return;

    const map = L.map(host, {
      attributionControl: true,
      zoomControl: false,
      scrollWheelZoom: true,
      maxBounds: SOUTH_KOREA_PAN,
      maxBoundsViscosity: 0.75,
      minZoom: 5,
      maxZoom: SOUTH_KOREA_MAX_ZOOM,
    });
    L.control
      .zoom({
        position: "topleft",
        zoomInTitle: "확대",
        zoomOutTitle: "축소",
      })
      .addTo(map);
    L.control
      .scale({
        position: "bottomleft",
        metric: true,
        imperial: false,
      })
      .addTo(map);
    L.tileLayer("https://tiles.osm.kr/hot/{z}/{x}/{y}.png", {
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">오픈스트리트맵 기여자</a> · <a href="https://osm.kr/">OSM 한국</a>',
      maxZoom: SOUTH_KOREA_MAX_ZOOM,
    }).addTo(map);

    const fitSouthKorea = (force = true) => {
      map.invalidateSize();
      const needed = map.getBoundsZoom(SOUTH_KOREA_VIEW, false, L.point(28, 28));
      if (!Number.isFinite(needed)) return;
      map.setMinZoom(needed);
      if (force || map.getZoom() <= needed + 0.05) {
        map.fitBounds(SOUTH_KOREA_VIEW, {
          padding: [36, 36],
          animate: false,
        });
      }
    };
    fitSouthKorea();
    mapRef.current = map;

    const ro = new ResizeObserver(() => {
      fitSouthKorea(false);
    });
    ro.observe(host);
    const ready = window.setTimeout(() => fitSouthKorea(true), 80);
    const markers = markersRef.current;

    return () => {
      window.clearTimeout(ready);
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      markers.clear();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    for (const marker of markersRef.current.values()) {
      map.removeLayer(marker);
    }
    markersRef.current.clear();

    for (const row of rows) {
      const loc = row.location;
      if (!loc) continue;
      if (!hubMapInPan(loc.lat, loc.lng)) continue;
      const id = hubMapFarmId(row);
      const title = farmDisplayLabel(row.farmKey, loc.farmName);
      const marker = L.marker([loc.lat, loc.lng], {
        icon: pinIcon(row, false),
        title,
        keyboard: true,
        riseOnHover: true,
      });
      marker.bindTooltip(hubMapPinTooltipHtml(row), {
        direction: "auto",
        offset: [14, 0],
        className: "hub-map-tip",
        opacity: 1,
      });
      marker.on("mouseover", () => onHoverRef.current(id));
      marker.on("mouseout", () => onHoverRef.current(null));
      marker.on("click", () => onSelectRef.current(row.farmKey));
      marker.addTo(map);
      markersRef.current.set(id, marker);
    }

    map.invalidateSize();
  }, [rows]);

  useEffect(() => {
    for (const row of rowsRef.current) {
      const id = hubMapFarmId(row);
      const marker = markersRef.current.get(id);
      if (!marker) continue;
      marker.setIcon(pinIcon(row, activeId === id));
      marker.setZIndexOffset(activeId === id ? 400 : 0);
    }
  }, [activeId]);

  return (
    <div
      ref={hostRef}
      className="hub-leaflet absolute inset-0 min-h-[18rem]"
      aria-label="전체 농장 지리 지도"
    />
  );
}
