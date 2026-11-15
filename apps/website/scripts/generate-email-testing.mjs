// Render the editable HTML sample from its Hyper Elements source. Requires pnpm build.
import { build } from "esbuild";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const site = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(site, "package.json"));
const pkg = process.env.HYPER_ELEMENTS_PACKAGE
  ? resolve(process.env.HYPER_ELEMENTS_PACKAGE)
  : dirname(require.resolve("@hyper-elements/react/package.json"));
const elementsRequire = createRequire(join(pkg, "package.json"));
const cache = join(site, ".cache/email-testing");
const bundle = join(cache, "render.cjs");
const output = join(site, "src/generated/email-testing.html");

await mkdir(cache, { recursive: true });
try {
  await build({
    stdin: {
      contents: 'import Email from "./examples/email-testing/macbook-pro"; import { render } from "@hyper-elements/react"; export const run = () => render(<Email />, { pretty: true });',
      resolveDir: site, loader: "tsx", sourcefile: "render-email-testing.tsx",
    },
    outfile: bundle, bundle: true, platform: "node", format: "cjs", jsx: "automatic", logLevel: "warning",
    plugins: [{ name: "hyper-elements", setup(b) {
      b.onResolve({ filter: /^@hyper-elements\/react$/ }, () => ({ path: join(pkg, "dist/primitives.cjs") }));
      b.onResolve({ filter: /^react(-dom)?(\/.*)?$/ }, ({ path }) => ({ path: elementsRequire.resolve(path) }));
    } }],
  });
  const { html } = await require(bundle).run();
  if (process.argv.includes("--check")) {
    if (await readFile(output, "utf8") !== html) throw new Error("The email testing HTML is stale. Run pnpm --filter @hyper-elements/website generate:email-testing.");
    console.log("Email testing HTML matches its Hyper Elements source.");
  } else {
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, html);
    console.log(`Email testing: rendered MacBook Pro with Hyper Elements (${Buffer.byteLength(html)} bytes).`);
  }
} finally {
  await rm(cache, { recursive: true, force: true });
}
