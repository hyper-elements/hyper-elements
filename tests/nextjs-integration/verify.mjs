// Starts the built app and checks that an email rendered on the server is one: email tables, not a web layout,
// and a design with its rows, from a route handler and from a Server Component; and what an edge route gets. `next build`
// succeeding isn't enough: Elements once rendered rows as a web page there, and an empty design, without an error.
// With --og, an OpenGraph image drawn from a template too.
import { spawn } from "node:child_process";

// Run in the app's folder (tests/next14-integration and tests/next16-integration run it too, without an edge route:
// Next.js 14 can't bundle Elements for the edge runtime, 0.1.22 neither, and Next.js 16 deprecates it), on a port of
// its own.
const port = Number(process.argv.slice(2).find((arg) => /^\d+$/.test(arg)) ?? 3765);
const edgeRoute = !process.argv.includes("--no-edge");
// With --og (the Next.js 15 and 16 apps): an OpenGraph image drawn from a template, prerendered and on request.
const og = process.argv.includes("--og");
const server = spawn("npx", ["next", "start", "-p", String(port)], { stdio: "inherit" });
const fail = (message) => {
  console.error(`✗ ${message}`);
  server.kill();
  process.exit(1);
};
const get = async (path, as = "text") => {
  for (let i = 0; i < 60; i++) {
    try {
      const response = await fetch(`http://localhost:${port}${path}`);
      if (response.ok) return as === "bytes" ? new Uint8Array(await response.arrayBuffer()) : response.text();
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  fail(`${path} didn't respond`);
};
// A template in the new components (the main entry), and its design for the builder (/builder): an email (tables) with
// its words in the HTML and the plain text, and a design with its rows, from a route handler and a Server Component.
const checkPrimitives = (where, counts) => {
  if (!(counts.tables >= 2)) fail(`${where} (new components): ${counts.tables} tables in the email`);
  if (!counts.text) fail(`${where} (new components): the email's words are missing from its HTML or its plain text`);
  if (!(counts.rows >= 1)) fail(`${where} (new components): the design has no rows`);
  console.log(`✓ ${where} (new components): ${counts.tables} tables, ${counts.rows} design rows`);
};
checkPrimitives("route handler", JSON.parse(await get("/primitives")));
const primitivesJson = /<pre id="counts">([^<]*)<\/pre>/.exec(await get("/primitives-page"))?.[1]?.replace(/&quot;/g, '"');
if (!primitivesJson) fail("Server Component (new components): no counts on the page");
checkPrimitives("Server Component", JSON.parse(primitivesJson));
const primitivesEdge = edgeRoute ? JSON.parse(await get("/primitives-edge")) : undefined;
if (!primitivesEdge);
else if (primitivesEdge.error === undefined) checkPrimitives("edge route", primitivesEdge);
else if (/render emails in the Node\.js runtime/.test(primitivesEdge.error)) console.log(`✓ edge route (new components): ${primitivesEdge.error}`);
else fail(`edge route (new components): ${primitivesEdge.error}`);
if (og) {
  // A template (og.mjs) drawn by the app's route, the bytes the same as the same template drawn here in Node: a PNG of
  // 1200×630, for the two pages prerendered when the app built and for one drawn on request.
  const { join } = await import("node:path");
  const { pathToFileURL } = await import("node:url");
  const { ogImage, PAGES } = await import(pathToFileURL(join(process.cwd(), "og.mjs")).href);
  for (const [i, slug] of Object.keys(PAGES).entries()) {
    const served = await get(`/og/${slug}/opengraph-image`, "bytes");
    const view = new DataView(served.buffer, served.byteOffset, served.byteLength);
    const isPng = served.length > 24 && String.fromCharCode(...served.subarray(1, 4)) === "PNG";
    if (!isPng || view.getUint32(16) !== 1200 || view.getUint32(20) !== 630) fail(`OpenGraph image (${slug}): not a PNG of 1200×630`);
    const drawn = await ogImage(slug);
    if (Buffer.compare(Buffer.from(served), Buffer.from(drawn)) !== 0) fail(`OpenGraph image (${slug}): ${served.length} bytes served, ${drawn.length} drawn in Node for the same values`);
    console.log(`✓ OpenGraph image (${slug}, ${i < 2 ? "prerendered" : "on request"}): a PNG of 1200×630, the bytes Node draws`);
  }
  // A card measured and checked by its template, where the app has the route: its too-small badge is reported.
  const reportRoute = await fetch(`http://localhost:${port}/og-report`).catch(() => undefined);
  if (reportRoute?.ok) {
    const report = await reportRoute.json();
    if (!report.diagnostics.includes("template/asset-pixels")) fail(`OpenGraph report: the undersized badge isn't reported (${report.diagnostics.join(", ") || "nothing"})`);
    if (!report.fits.some((fit) => fit.field === "title" && fit.chosen)) fail("OpenGraph report: the title has no fitted size");
    console.log(`✓ OpenGraph report: the title fitted at ${report.fits[0].chosen}px, and the undersized badge reported (template/asset-pixels)`);
  }
}
server.kill();
process.exit(0);
