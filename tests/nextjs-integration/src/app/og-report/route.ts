// A card measured and checked by its template (layoutImage(), then checkLayout() with its badge's file sniffed): what
// verify.mjs --og checks reports the badge it was given too small.
import { ogReport } from "../../../og.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await ogReport());
}
