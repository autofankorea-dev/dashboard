import {
  farmKeyId,
  parseFarmKeyFromQuery,
  parseFarmKeyId,
  parseFarmKeyUrlSlug,
} from "@/lib/domain/farm-key";
import { adminOpsHealthHref, parseHealthNodeId } from "@/lib/admin/health/health-routes";

/** Legacy `/admin/health/farm/:slug` segment → `FARM01/P00` farm query value */
export function parseLegacyHealthFarmSlug(raw: string): string | null {
  const slug = decodeURIComponent(raw.trim());
  if (!slug) return null;

  const fromDash = parseFarmKeyUrlSlug(slug);
  if (fromDash) return farmKeyId(fromDash);

  const fromSlash = parseFarmKeyId(slug);
  if (fromSlash) return farmKeyId(fromSlash);

  const colon = slug.indexOf(":");
  if (colon > 0) {
    const fk = parseFarmKeyFromQuery(slug.slice(0, colon), slug.slice(colon + 1));
    if (fk) return farmKeyId(fk);
  }

  return null;
}

/** `/admin/health…` → `/admin/ops?…` (farm·node·modules 쿼리 보존). 해당 없으면 null */
export function legacyAdminHealthRedirectUrl(pathname: string): string | null {
  if (pathname === "/admin/health") {
    return adminOpsHealthHref();
  }
  if (!pathname.startsWith("/admin/health/")) return null;

  const rest = pathname.slice("/admin/health/".length);
  const segments = rest.split("/").filter(Boolean);
  if (segments.length === 0) return adminOpsHealthHref();

  const [head, second] = segments;

  if (head === "farm" && second) {
    const farmId = parseLegacyHealthFarmSlug(second);
    return adminOpsHealthHref(
      farmId ? { farm: farmId, modules: true } : { modules: true },
    );
  }

  if (head === "group") {
    return adminOpsHealthHref({ modules: true });
  }

  const nodeId = parseHealthNodeId(head);
  if (nodeId) {
    return adminOpsHealthHref({ node: nodeId });
  }

  return adminOpsHealthHref();
}
