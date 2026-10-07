/**
 * v0x0B wire decode types for LIVE row-stream.
 * Decode implementation lives in supabase/functions/decode-batch.
 */

export type DecodedThermo = {
  setpointTemp: string | null;
  tempDeviation: string | null;
  minVentPct: number | null;
  maxVentPct: number | null;
};

export type DecodedChannel = {
  channel: string;
  eqpmnCode: string;
  tempC?: string | null;
  humidityPct?: string | null;
  outputs: Record<string, string>;
  thermo: DecodedThermo | null;
};

export type DecodedControllerPayload = {
  wireVer: number;
  packetMode: "live" | "history";
  sessionId: number | null;
  chunkSeq: number;
  partial: boolean;
  lastChunk: boolean;
  controllerKey: string;
  eqpmnNo: string;
  stallTyCode: string;
  stallNo: string;
  mesureDt: string;
  /** v0x0C — controller run mode (uint8) */
  runMode?: number;
  /** v0x0C — row-level temperature probes (×10 decoded strings) */
  tempsC?: (string | null)[];
  /** v0x0C — row-level humidity */
  humidityPct?: string | null;
  alarmLowTempC?: string | null;
  alarmHighTempC?: string | null;
  channels: DecodedChannel[];
};
