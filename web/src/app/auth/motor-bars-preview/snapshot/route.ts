import { fieldPreviewSnapshot } from "../fixture";

export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") return new Response(null, { status: 404 });
  const revision = Number(new URL(request.url).searchParams.get("revision"));
  // Leave enough time to inspect the refresh button's busy state.
  await new Promise((resolve) => setTimeout(resolve, 600));
  return Response.json(fieldPreviewSnapshot(Number.isFinite(revision) ? revision : 0), {
    headers: { "Cache-Control": "no-store" },
  });
}
