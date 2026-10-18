/** Fixed-width uint16 HEX. Even 0000/FFFF stay visible until firmware meanings are agreed. */
export function controllerErrorHex(raw: number | null | undefined): string {
  return raw != null && Number.isInteger(raw) && raw >= 0 && raw <= 0xffff
    ? `0x${raw.toString(16).toUpperCase().padStart(4, "0")}`
    : "—";
}
