// The templates docs' examples, run for real: the commands the docs show, with the CLI, on the examples in
// examples/templates-guide/. What the docs show is what those commands wrote.
//
//   pnpm --filter @hyper-elements/website generate:templates-guide
//
// It needs the packages built (`pnpm build`) and Playwright's Chromium (`npx playwright install chromium`), for the
// emails' and the invoice's pictures.
//
// Writes:
//   public/generated/templates-guide/*.png   each image the docs show: the launch graphic in its formats, the
//                                            pictures a launch gives, and the emails as Chromium draws them
//   public/generated/templates-guide/parts.svg   the launch graphic with its fixed and open parts outlined, from
//                                            the boxes layoutImage() measured
//   public/generated/templates-guide/email-parts.svg, invoice-parts.svg   an email and an invoice's page with their
//                                            locked and open parts outlined, from the boxes Chromium laid out
//   public/generated/templates-guide/concept-*.svg   one small picture per idea (a field, an image field, formats, a
//                                            slot, blocks, a rule), each made from the pictures above
//   src/generated/templates-guide.json       each command's output, as the docs quote it
//
// It fails if a doc's copy of an example isn't the example's file, so what's shown is what ran: a whole file where
// the doc shows one, and each excerpt (a block that starts `// from <file>`) line by line.
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { annotate, caption, card, draw, picture } from "./pictures.mjs";

const site = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repo = resolve(site, "../..");
const example = join(site, "examples/templates-guide");
const out = join(site, "public/generated/templates-guide");
const cli = join(repo, "packages/cli/dist/bin.js");
const reactPackage = join(repo, "packages/react");
const cliRequire = createRequire(join(repo, "packages/cli/package.json"));

// A project of its own, as a reader's would be: the examples' files, the brand's fonts, and the packages it installs.
const project = realpathSync(mkdtempSync(join(tmpdir(), "templates-guide-")));
const env = { ...process.env, NO_COLOR: "1" };
delete env.NODE_PATH;
try {
  cpSync(example, project, { recursive: true });
  mkdirSync(join(project, "fonts"));
  for (const font of ["Inter-Regular.ttf", "Inter-Bold.ttf"]) cpSync(join(repo, "benchmark/suites/image/fonts", font), join(project, "fonts", font));
  writeFileSync(join(project, "package.json"), JSON.stringify({ name: "templates-guide", private: true, type: "module", hyperElements: { templates: ["templates/**"] } }));
  writeFileSync(join(project, "tsconfig.json"), JSON.stringify({ compilerOptions: { jsx: "react-jsx", module: "esnext", moduleResolution: "bundler", target: "es2022" } }));
  const link = (name, target) => {
    mkdirSync(dirname(join(project, "node_modules", name)), { recursive: true });
    symlinkSync(realpathSync(target), join(project, "node_modules", name), "dir");
  };
  const elementsRequire = createRequire(join(reactPackage, "package.json"));
  link("@hyper-elements/react", reactPackage);
  link("@hyper-elements/lint", join(repo, "packages/lint"));
  link("@hyper-elements/email-clients", join(repo, "packages/email-clients"));
  for (const name of ["react", "react-dom", "satori", "@resvg/resvg-js", "@react-pdf/renderer"]) link(name, dirname(elementsRequire.resolve(`${name}/package.json`)));

  /** One command, as the docs write it: its output and its exit code. */
  const run = (args) => {
    const command = `npx hyper-elements ${args.map((arg) => (/[\s:,]/.test(arg) && arg.includes("=") ? JSON.stringify(arg) : arg)).join(" ")}`;
    try {
      return { command, code: 0, output: execFileSync(process.execPath, [cli, ...args], { cwd: project, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }) };
    } catch (error) {
      return { command, code: error.status, output: `${error.stdout ?? ""}${error.stderr ?? ""}` };
    }
  };
  const expect = (step, code) => {
    if (step.code !== code) throw new Error(`${step.command} exited ${step.code}, not ${code}:\n${step.output}`);
    return step;
  };
  const save = (from, to) => cpSync(join(project, from), join(out, to));
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const steps = {};

  // ── The launch graphic: a design made from the template, checked, and rendered in both formats ──
  steps.new = expect(run(["design", "new", "templates/launch-graphic.tsx", "-o", "designs/orbit.values.json", "--values", "brief.json", "--set", "screenshot=@designs/art/screenshot.png", "--set", "artwork=@designs/art/shapes.png"]), 0);
  const file = JSON.parse(readFileSync(join(project, "designs/orbit.values.json"), "utf8"));
  steps.check = expect(run(["check", "designs/orbit.values.json"]), 0);
  steps.render = expect(run(["render", "designs/orbit.values.json"]), 0);
  save("out/designs/orbit.square.png", "orbit-square.png");
  save("out/designs/orbit.landscape.png", "orbit-landscape.png");
  // The pictures a launch gives: the one taken, and the one refused below.
  save("designs/art/screenshot.png", "art-screenshot.png");
  save("designs/art/banner.png", "art-banner.png");

  // Its parts, from the boxes the image entry measured: what the diagram outlines.
  writeFileSync(
    join(project, "layout.tsx"),
    `import { readFileSync } from "node:fs";
import { layoutImage } from "@hyper-elements/react/image";
import Launch from "./templates/launch-graphic";
const values = JSON.parse(readFileSync("designs/orbit.values.json", "utf8")).values;
// As the CLI reads them: the design's pictures beside it, the template's own beside the template.
const at = (src: string) => ({ ...values, screenshot: { ...values.screenshot, src: "../designs/art/screenshot.png" }, artwork: { ...values.artwork, src: "../designs/art/shapes.png" } });
const checked = Launch.check(at(""), { format: "square" });
const file = (path: string) => new Uint8Array(readFileSync(path));
const fonts = [{ family: "Inter", src: file("fonts/Inter-Regular.ttf"), weight: 400 }, { family: "Inter", src: file("fonts/Inter-Bold.ttf"), weight: 700 }];
const images = { "../designs/art/screenshot.png": file("designs/art/screenshot.png"), "../designs/art/shapes.png": file("designs/art/shapes.png"), "./assets/orbit-logo.png": file("templates/assets/orbit-logo.png") };
const layout = await layoutImage(checked.snapshots.square!, { fonts, images });
process.stdout.write(JSON.stringify(layout.nodes.map(({ path, field, type, x, y, width, height }) => ({ path, field, type, x, y, width, height }))));
`
  );
  const nodes = JSON.parse(execFileSync(process.execPath, [cliRequire.resolve("tsx/cli"), "layout.tsx"], { cwd: project, env, encoding: "utf8" }));
  writeFileSync(
    join(out, "parts.svg"),
    annotate({
      png: readFileSync(join(out, "orbit-square.png")),
      width: 1080,
      height: 1080,
      scale: 0.42,
      labelWidth: 350,
      even: true,
      legend: "Locked: layout, colors, fonts, sizes",
      label: "The square launch graphic with its parts outlined: the logo is locked; the headline, the three features, the launch date, the screenshot and the artwork are open fields; everything else is locked.",
      parts: launchParts(nodes),
    }).svg
  );

  // A longer headline: the same template draws it smaller where it has to, to fit its three lines.
  steps.long = expect(run(["design", "set", "designs/orbit.values.json", "headline=Meet Orbit 3.0: release notes that write themselves, in your voice"]), 0);
  steps.longCheck = expect(run(["check", "designs/orbit.values.json", "--json"]), 0);
  expect(run(["render", "designs/orbit.values.json"]), 0);
  save("out/designs/orbit.landscape.png", "long-landscape.png");

  // What the template refuses. A banner in place of the screenshot is refused as it's set, and the file stays as it was.
  steps.banner = expect(run(["design", "set", "designs/orbit.values.json", "screenshot=@designs/art/banner.png"]), 1);
  // A headline within its 90 characters that can't fit the landscape format's three lines is refused when it's measured.
  steps.unfit = expect(run(["design", "set", "designs/orbit.values.json", "headline=Meet Orbit 3.0: release notes that write themselves, in your own voice"]), 0);
  steps.unfitCheck = expect(run(["check", "designs/orbit.values.json"]), 1);

  // ── The newsletter: an issue written as TSX in its slot, checked and rendered; and one that isn't on brand ──
  steps.newsletterCheck = expect(run(["check", "designs/june.tsx"]), 0);
  steps.newsletterRender = expect(run(["render", "designs/june.tsx"]), 0);
  steps.offBrand = expect(run(["check", "designs/off-brand.tsx"]), 1);
  writeFileSync(join(out, "newsletter.png"), (await draw(join(project, "out/designs/june.html"), 680)).png);

  // ── The brand email: a locked header and footer around a body that takes anything ──
  steps.emailCheck = expect(run(["check", "designs/welcome.tsx", "designs/launch-week.tsx"]), 0);
  steps.emailRender = expect(run(["render", "designs/welcome.tsx", "designs/launch-week.tsx"]), 0);
  steps.offSite = expect(run(["check", "designs/off-site.tsx"]), 1);
  const bands = { header: "#header", body: "#body", footer: "#footer" };
  const welcome = await draw(join(project, "out/designs/welcome.html"), 680);
  const launchWeek = await draw(join(project, "out/designs/launch-week.html"), 680, { boxes: bands });
  writeFileSync(join(out, "welcome.png"), welcome.png);
  writeFileSync(join(out, "launch-week.png"), launchWeek.png);
  writeFileSync(
    join(out, "email-parts.svg"),
    annotate({
      ...launchWeek,
      scale: 0.62,
      labelWidth: 330,
      label: "An email made from the Orbit email template, with its parts outlined: the header and the footer are locked; the body between them is open.",
      parts: [
        { label: "Header", note: "Locked: the template's own", box: launchWeek.boxes.header, open: false },
        { label: "body", note: "Open: any elements, styled freely", box: launchWeek.boxes.body, open: true },
        { label: "Footer", note: "Locked: the address and the unsubscribe link", box: launchWeek.boxes.footer, open: false },
      ],
    }).svg
  );

  // ── The invoice: a Document filled from data, its letterhead, sums and footer locked ──
  steps.invoiceNew = expect(run(["design", "new", "templates/invoice.tsx", "-o", "designs/northwind.values.json", "--values", "invoice.json"]), 0);
  steps.invoiceRender = expect(run(["render", "designs/northwind.values.json", "--html"]), 0);
  steps.invoiceRefused = expect(run(["design", "set", "designs/northwind.values.json", "number=NW-12"]), 1);
  // Its print HTML names its fonts as the template does, relative to the template's folder: read it from a folder as deep.
  cpSync(join(project, "out/designs/northwind.a4.html"), join(project, "designs/northwind.a4.html"));
  const ids = ["letterhead", "customer", "details", "lines", "total", "note", "footer"];
  const invoice = await draw(join(project, "designs/northwind.a4.html"), 900, { clip: ".elements-page", boxes: Object.fromEntries(ids.map((id) => [id, `#${id}`])) });
  writeFileSync(
    join(out, "invoice-parts.svg"),
    annotate({
      ...invoice,
      scale: 0.6,
      labelWidth: 340,
      outset: 5,
      label: "An invoice's page made from the Orbit invoice template, with its parts outlined: the letterhead, the total and the footer are locked; the customer, the number, the dates, the lines and the note are open fields.",
      parts: [
        { label: "Letterhead", note: "Locked: the template's own", box: invoice.boxes.letterhead, open: false },
        { label: "number, issued, due", note: "Text that matches INV-0000, and two dates", box: invoice.boxes.details, open: true },
        { label: "customer", note: "A name and one to four address lines", box: invoice.boxes.customer, open: true, from: "bottom" },
        { label: "lines", note: "1 to 40: a description, a quantity, a price", box: invoice.boxes.lines, open: true },
        { label: "Total", note: "Locked: the template adds it up", box: invoice.boxes.total, open: false },
        { label: "note", note: "Optional text, up to 200 characters", box: invoice.boxes.note, open: true },
        { label: "Footer", note: "Locked: on every page, with its number", box: invoice.boxes.footer, open: false },
      ],
    }).svg
  );

  // ── The digest: sections picked and ordered as data, each one of three approved types ──
  const digests = {};
  for (const day of ["monday", "friday"]) {
    expect(run(["design", "new", "templates/digest.tsx", "-o", `designs/digest-${day}.values.json`, "--values", `digest-${day}.json`]), 0);
    digests[day] = JSON.parse(readFileSync(join(project, `digest-${day}.json`), "utf8")).body.map((block, i) => ({ type: block.type, id: `${block.type}-${i}` }));
  }
  steps.digestRender = expect(run(["render", "designs/digest-monday.values.json", "designs/digest-friday.values.json"]), 0);
  steps.digestRefused = expect(run(["design", "set", "designs/digest-monday.values.json", 'body=[{"type":"video"}]']), 1);
  const digestPictures = {};
  for (const [day, blocks] of Object.entries(digests)) {
    digestPictures[day] = await draw(join(project, `out/designs/digest-${day}.html`), 680, { boxes: Object.fromEntries(blocks.map((block) => [block.id, `#${block.id}`])) });
    writeFileSync(join(out, `digest-${day}.png`), digestPictures[day].png);
  }

  // The email its template refuses, drawn all the same, to show where its rule fails: the design the values build,
  // which is what the template checked, written by render() without the check.
  writeFileSync(
    join(project, "off-site.tsx"),
    `import { writeFileSync } from "node:fs";
import { render } from "@hyper-elements/react";
import Brand from "./templates/brand-email";
import OffSite from "./designs/off-site";
const { html } = await render(Brand.design((OffSite() as { props: Parameters<typeof Brand.design>[0] }).props));
writeFileSync("out/designs/off-site.html", html);
`
  );
  execFileSync(process.execPath, [cliRequire.resolve("tsx/cli"), "off-site.tsx"], { cwd: project, env, encoding: "utf8" });
  const offSite = await draw(join(project, "out/designs/off-site.html"), 680, { boxes: { link: 'a[href*="northwind"]' } });

  // ── One small picture per idea, from the pictures above ──
  const [TEAL, VIOLET, AMBER, RED] = ["#2dd4bf", "#a78bfa", "#fbbf24", "#f87171"];
  const square = { png: readFileSync(join(out, "orbit-square.png")), width: 1080, height: 1080 };
  const landscape = { png: readFileSync(join(out, "orbit-landscape.png")), width: 1200, height: 630 };
  const headline = launchParts(nodes).find((part) => part.label === "headline").box;
  const concepts = {
    field: card("A field: the launch graphic with its headline outlined, the rest dimmed.", [picture(square, { x: 20, y: 20, width: 560, height: 360 }, { dim: true, crop: { x: 0, y: 0, width: 1080, height: 694 }, parts: [{ box: headline, color: TEAL, tag: "headline" }] })]),
    image: card("An image field: a product screenshot, 1.6 to 1, is taken; a banner, 4 to 1, is refused.", [
      caption(300, 56, "screenshot: a PNG, 1.2:1 to 2:1", "#f1f5f9", 21),
      picture({ png: readFileSync(join(out, "art-screenshot.png")), width: 1600, height: 1000 }, { x: 24, y: 96, width: 264, height: 170 }, { frame: TEAL }),
      caption(156, 306, "Taken", TEAL),
      caption(156, 334, "1600×1000, 1.6:1"),
      picture({ png: readFileSync(join(out, "art-banner.png")), width: 1600, height: 400 }, { x: 312, y: 96, width: 264, height: 170 }, { frame: RED, dashed: true }),
      caption(444, 306, "Refused", RED),
      caption(444, 334, "1600×400, 4:1"),
    ]),
    format: card("Formats: one design as a square image and as a landscape image.", [
      picture(square, { x: 20, y: 60, width: 216, height: 240 }),
      caption(128, 338, "square"),
      picture(landscape, { x: 252, y: 60, width: 328, height: 240 }),
      caption(416, 338, "landscape"),
    ]),
    slot: card("A slot: an email with its body outlined, the header and footer dimmed.", [picture(launchWeek, { x: 20, y: 20, width: 560, height: 360 }, { dim: true, parts: [{ box: launchWeek.boxes.body, color: TEAL, tag: "body", inside: true }] })]),
    blocks: card("Blocks: two emails made of the same three section types (story, quote, button), picked and ordered differently.", Object.entries(digests).map(([day, blocks], i) =>
      picture(digestPictures[day], { x: 20, y: 16 + i * 188, width: 560, height: 180 }, { parts: blocks.map((block) => ({ box: digestPictures[day].boxes[block.id], color: { story: TEAL, quote: VIOLET, button: AMBER }[block.type], tag: block.type, inside: true })) })
    )),
    rule: card("A rule: an email whose button links outside the brand's domains, the button outlined and the email refused.", [
      picture(offSite, { x: 20, y: 20, width: 560, height: 310 }, { dim: true, parts: [{ box: offSite.boxes.link, color: RED, tag: "northwind.example.net", below: true }] }),
      caption(300, 368, "Refused: links go to orbit.example", RED, 20),
    ]),
  };
  for (const [name, svg] of Object.entries(concepts)) writeFileSync(join(out, `concept-${name}.svg`), svg);

  // ── From code: an email rendered and an image checked and drawn, with no command line ──
  execFileSync(process.execPath, [cliRequire.resolve("tsx/cli"), "scripts/render.tsx"], { cwd: project, env, encoding: "utf8" });
  for (const written of ["out/welcome.html", "out/launch.png"]) {
    if (!readFileSync(join(project, written)).length) throw new Error(`scripts/render.tsx wrote nothing at ${written}`);
  }

  // What describe() says of the artwork, as the Values page shows it.
  const described = JSON.parse(expect(run(["describe", "templates/launch-graphic.tsx", "--json"]), 0).output.trim().split("\n")[0]);
  const artwork = described.fields.find((entry) => entry.path === "artwork");
  const inline = (value) => (Array.isArray(value) ? `[${value.map(inline).join(", ")}]` : value && typeof value === "object" ? `{ ${Object.entries(value).map(([key, item]) => `${JSON.stringify(key)}: ${inline(item)}`).join(", ")} }` : JSON.stringify(value));
  const describeArtwork = `{\n${["path", "kind", "fit", "maxCrop", "regions", "suggested"].map((key) => `  ${JSON.stringify(key)}: ${inline(artwork[key])}`).join(",\n")}\n}`;
  // The values file design new wrote, its hashes cut short.
  const fileShown = JSON.stringify(file, null, 2).replace(/"([0-9a-f]{12})[0-9a-f]{52}"/g, '"$1…"');

  const fit = steps.longCheck.output.trim().split("\n").slice(0, 2).map((line) => JSON.parse(line)).map((line) => ({ format: line.templateFormat, fits: line.fits }));
  const tidy = (step) => ({ command: step.command, code: step.code, output: step.output.replaceAll(project, ".").trimEnd() });
  writeFileSync(join(site, "src/generated/templates-guide.json"), `${JSON.stringify({ file, fileShown, describeArtwork, fit, steps: Object.fromEntries(Object.entries(steps).map(([name, step]) => [name, tidy(step)])) }, null, 2)}\n`);

  const sizes = { "welcome.png": welcome, "launch-week.png": launchWeek, "digest-monday.png": digestPictures.monday, "digest-friday.png": digestPictures.friday };
  checkDocs(Object.fromEntries(Object.entries(steps).map(([name, step]) => [name, tidy(step).output])), sizes, { fileShown, describeArtwork });
  console.log(`wrote public/generated/templates-guide/ and src/generated/templates-guide.json`);
} finally {
  rmSync(project, { recursive: true, force: true });
}

/** The square launch graphic's parts, from the boxes the image entry measured: its open fields and its logo. */
function launchParts(nodes) {
  const union = (boxes) => {
    const [x, y] = [Math.min(...boxes.map((b) => b.x)), Math.min(...boxes.map((b) => b.y))];
    return { x, y, width: Math.max(...boxes.map((b) => b.x + b.width)) - x, height: Math.max(...boxes.map((b) => b.y + b.height)) - y };
  };
  const byField = (test) => nodes.filter((node) => node.field && test(node.field));
  return [
    { label: "Logo", note: "Locked: the template's own", box: nodes.find((node) => node.type === "Image" && !node.field), open: false },
    { label: "launchDate", note: "A date, written for the language", box: union(byField((f) => f === "launchDate")), open: true },
    { label: "headline", note: "Text, up to 90 characters, fitted to three lines", box: union(byField((f) => f === "headline")), open: true },
    { label: "features", note: "Exactly three, up to 40 characters each", box: union(byField((f) => f.startsWith("features["))), open: true },
    // The artwork is behind the screenshot: its leader starts from its own edge, above the screenshot's.
    { label: "artwork", note: "A PNG that fills its panel", box: union(byField((f) => f === "artwork")), open: true, from: "top" },
    { label: "screenshot", note: "A PNG, 1.2:1 to 2:1, shown whole in a window", box: union(byField((f) => f === "screenshot")), open: true },
  ];
}

/**
 * Every copy of an example in the docs is the example's: a whole file, or an excerpt's lines in the file's order. And
 * the output the guide quotes for a command is what the command printed.
 */
function checkDocs(outputs, sizes, shown) {
  const docs = [
    join(site, "src/content/docs/templates.md"),
    join(site, "src/content/docs/templates/examples.md"),
    join(site, "src/content/docs/templates/fields.md"),
    join(site, "src/content/docs/templates/slots.md"),
    join(site, "src/content/docs/templates/rules.md"),
    join(site, "src/content/docs/templates/cli.md"),
    join(repo, "packages/react/docs/templates.md"),
  ];
  const problems = [];
  for (const doc of docs) {
    let text;
    try {
      text = readFileSync(doc, "utf8");
    } catch {
      problems.push(`${doc} isn't there`);
      continue;
    }
    for (const [, block] of text.matchAll(/```tsx\n([\s\S]*?)```/g)) {
      const first = block.split("\n")[0];
      const whole = /^\/\/ ((?:templates|designs|scripts)\/[\w./-]+)$/.exec(first);
      const excerpt = /^\/\/ from ((?:templates|designs|scripts)\/[\w./-]+)$/.exec(first);
      if (!whole && !excerpt) continue;
      const name = (whole ?? excerpt)[1];
      let source;
      try {
        source = readFileSync(join(example, name), "utf8");
      } catch {
        continue; // Another project's file of that name: not one of these examples.
      }
      if (whole) {
        if (block.trimEnd() !== source.trimEnd()) problems.push(`${doc}: its copy of ${name} isn't examples/templates-guide/${name} as it is`);
        continue;
      }
      // An excerpt: each line, in the file's order (a line of only "// …" skips ahead).
      const lines = source.split("\n").map((line) => line.trim());
      let at = 0;
      for (const line of block.split("\n").slice(1).map((line) => line.trim()).filter((line) => line && line !== "// …")) {
        const found = lines.indexOf(line, at);
        if (found < 0) {
          problems.push(`${doc}: an excerpt of ${name} has a line that isn't in it (or is out of order): ${line}`);
          break;
        }
        at = found + 1;
      }
    }
  }
  const quoted = [
    [docs[1], ["check", "render", "banner", "unfitCheck", "offSite", "offBrand", "invoiceNew", "invoiceRender", "invoiceRefused"]],
    [docs[3], ["digestRefused"]],
  ];
  for (const [doc, names] of quoted) {
    const text = readFileSync(doc, "utf8");
    for (const name of names) {
      if (!text.includes(outputs[name])) problems.push(`${doc}: the output it quotes for "${name}" isn't what the command printed (see src/generated/templates-guide.json)`);
    }
  }
  // The examples page shows the values file design new wrote, and the values page what describe() says of the artwork.
  if (!readFileSync(docs[1], "utf8").includes(shown.fileShown)) problems.push(`${docs[1]}: the values file it shows isn't the one design new wrote (see fileShown in src/generated/templates-guide.json)`);
  if (!readFileSync(docs[2], "utf8").includes(shown.describeArtwork)) problems.push(`${docs[2]}: what it shows of describe() isn't what describe printed (see describeArtwork in src/generated/templates-guide.json)`);
  // The examples page shows the invoice's values as the file has them, and the content page a digest's.
  for (const [doc, name] of [[docs[1], "invoice.json"], [docs[3], "digest-monday.json"]]) {
    if (!readFileSync(doc, "utf8").includes(readFileSync(join(example, name), "utf8").trimEnd())) problems.push(`${doc}: its copy of ${name} isn't examples/templates-guide/${name} as it is`);
  }
  // A page gives each email's picture the size Chromium drew it at.
  for (const doc of docs.slice(0, -1)) {
    for (const [, file, width, height] of readFileSync(doc, "utf8").matchAll(/<img src="[^"]*\/([\w-]+\.png)" width="(\d+)" height="(\d+)"/g)) {
      const drawn = sizes[file];
      if (drawn && (drawn.width !== Number(width) || drawn.height !== Number(height))) problems.push(`${doc}: ${file} is ${drawn.width}×${drawn.height}, which isn't the size its <img> gives`);
    }
  }
  if (problems.length) throw new Error(`The docs and the examples differ:\n- ${problems.join("\n- ")}`);
}
