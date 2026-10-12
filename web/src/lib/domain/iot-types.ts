/**
 * LIVE 판독·집계 도메인 타입. 서버 로더(`lib/data/iot.ts`)와 순수 모듈(`lib/domain/*`)이 공유한다.
 * React·Next·Supabase 의존 없음 — Edge/클라/서버 어디서든 import 가능.
 */
import type { BarnMeta } from "@/lib/domain/barn-meta-types";
import type { FarmKey } from "@/lib/domain/farm-key";
import type { ChannelReading, DecodedChannel } from "@/lib/domain/iot-channel";

export type ControllerStatus = "normal" | "caution" | "offline";

export type PacketMode = "live" | "replay";

export type BarnReading = {

  key: string;

  farmKey: FarmKey;

  moduleUid: number;

  /** v0x0A business key SPxx:stallNo:eqpmnNo (legacy: legacy:idx:N) */
  controllerKey: string;

  /** @deprecated v0x09 legacy; v0x0A decoded rows omit idx */
  idx?: number;

  eqpmnNo: string;

  stallNo: string | null;

  stallTyCode: string | null;

  label: string;

  alarmLowTempC?: number | null;
  alarmHighTempC?: number | null;
  tempC: number | null;

  humidityPct: number | null;

  fanSupply: number | null; // EC01 송풍팬

  fanExhaust: number | null; // EC02 배기팬

  fanIntake: number | null; // EC03 입기팬

  fanSupplySeries: number[]; // EC01 추이

  fanExhaustSeries: number[]; // EC02 추이

  fanIntakeSeries: number[]; // EC03 추이

  mesureDt: string | null;

  receivedAt: string;

  status: ControllerStatus;

  packetMode: PacketMode;

  wireVer: number | null;

  decodedId?: number;

  thermo?: DecodedController["thermo"];

  /** v0x0B schema 2.0 — A/B/C channel readings */
  channels?: ChannelReading[];

  /** v0x0C — controller run mode */
  runMode?: number | null;

  /** v0x0C — row-level temperature probes (up to 4) */
  tempsC?: (number | null)[];

};

/** BarnReading 과 동일 구조 (컨트롤러 페이지에서 의미상 사용) */

export type ControllerReading = BarnReading;

export type BarnSummary = {

  total: number;

  normal: number;

  caution: number;

  offline: number;

};

export type DecodedController = {

  controllerKey?: string;

  idx?: number;

  eqpmnNo?: string;

  stallNo?: unknown;

  stallTyCode?: unknown;

  ES01?: unknown;

  ES02?: unknown;

  EC01?: unknown;

  EC02?: unknown;

  EC03?: unknown;

  mesureDt?: string;

  channels?: DecodedChannel[];

  thermo?: {
    setpointTemp?: string | number;
    tempDeviation?: string | number;
    minVentPct?: number;
    maxVentPct?: number;
  } | null;

};

/** 축사 페이지 차트·비교용. stallNo 있으면 축사별 평균, 없으면 컨트롤러 단위. */

export type BarnCompareRow = {

  key: string;

  label: string;

  tempC: number | null;

  humidityPct: number | null;

  fanSupply: number | null;

  fanExhaust: number | null;

  fanIntake: number | null;

  status: ControllerStatus;

};

export type ModuleReceipt = {

  farmKey: FarmKey;

  moduleUid: number;

  receivedAt: string;

  status: ControllerStatus;

};

export type FarmOverview = {

  farmCount: number;

  moduleCount: number;

  controllerCount: number;

  connectedCount: number;

  expectedControllerCount: number;

  offlineCount: number;

  avgTempC: number | null;

  avgHumidityPct: number | null;

  avgFanSupply: number | null;

  avgFanExhaust: number | null;

  avgFanIntake: number | null;

  receipts: ModuleReceipt[];

};

export type BarnMapSnapshot = {

  meta: BarnMeta;

  controllerCount: number;

  /** SP 그룹 내 고유 축사번호(stallNo) 수 */
  stallCount?: number;

  tempC: number | null;

  humidityPct: number | null;

  fanSupply: number | null;

  fanExhaust: number | null;

  fanIntake: number | null;

  status: ControllerStatus;

  receivedAt: string | null;

};
