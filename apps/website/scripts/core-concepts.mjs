// The Core concepts pages' pictures, from their examples: each design in examples/core-concepts is rendered by the
// built CLI in a project of its own, drawn in Chromium at desktop and phone width, and its parts outlined from the
// boxes Chromium gives the elements' ids. Run it after `pnpm build`:
//
//   pnpm --filter @hyper-elements/website generate:core-concepts
//
// It writes public/generated/core-concepts/ (the pictures) and src/generated/core-concepts.json (what each command
// printed), and fails where a page's copy of an example, or the output it quotes, isn't the example's. A page marks
// each code block it takes from an example with a comment on the line before it, `<!-- example: layout/row.tsx -->`;
// the block is the example's lines in order, less the ids the pictures find elements by.
import { execFileSync, spawn } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { annotate, card, draw, escapeText, panels, picture } from "./pictures.mjs";

const site = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repo = resolve(site, "../..");
const example = join(site, "examples/core-concepts");
const out = join(site, "public/generated/core-concepts");
const cli = join(repo, "packages/cli/dist/bin.js");
const reactPackage = join(repo, "packages/react");

const [PART, GAP, PADDING] = ["#2dd4bf", "#fbbf24", "#f472b6"];
const only = process.argv.slice(2);
const wanted = (name) => !only.length || only.some((prefix) => name.startsWith(prefix));

const project = realpathSync(mkdtempSync(join(tmpdir(), "core-concepts-")));
const env = { ...process.env, NO_COLOR: "1" };
delete env.NODE_PATH;
try {
  cpSync(example, project, { recursive: true });
  mkdirSync(join(project, "fonts"));
  for (const font of ["Inter-Regular.ttf", "Inter-Bold.ttf"]) cpSync(join(repo, "benchmark/suites/image/fonts", font), join(project, "fonts", font));
  writeFileSync(join(project, "package.json"), JSON.stringify({ name: "core-concepts", private: true, type: "module" }));
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
  for (const name of ["@types/react", "@types/react-dom", "@types/node"]) link(name, dirname(elementsRequire.resolve(`${name}/package.json`)));
  /** A script of the examples, run as a reader would run it: `npx tsx <file>`. */
  const script = (file) => execFileSync(process.execPath, [createRequire(join(repo, "packages/cli/package.json")).resolve("tsx/cli"), file], { cwd: project, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

  /** One command, as the docs write it: its output and its exit code. */
  const run = (args, cwd = project) => {
    const command = `npx hyper-elements ${args.join(" ")}`;
    try {
      return { command, code: 0, output: execFileSync(process.execPath, [cli, ...args], { cwd, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }) };
    } catch (error) {
      return { command, code: error.status, output: `${error.stdout ?? ""}${error.stderr ?? ""}` };
    }
  };
  const expect = (step, code) => {
    if (step.code !== code) throw new Error(`${step.command} exited ${step.code}, not ${code}:\n${step.output}`);
    return step;
  };
  mkdirSync(out, { recursive: true });
  const steps = {};
  const sizes = {};

  // Every example is strict TypeScript, as a reader's project would check it.
  try {
    execFileSync(process.execPath, [elementsRequire.resolve("typescript/bin/tsc"), "--noEmit", "--strict", "--skipLibCheck", "--jsx", "react-jsx", "--module", "esnext", "--moduleResolution", "bundler", "--target", "es2022", ...sources(project)], { cwd: project, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (error) {
    throw new Error(`The examples don't typecheck:\n${error.stdout}`);
  }

  // Every design, rendered once: out/<folder>/<name>.html (and an Email's .txt, a Document's .pdf, a Canvas's .png).
  const folders = readdirSync(example, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  // (The command line's own folder aside: its page runs the commands it shows, there.)
  expect(run(["render", ...folders.filter((folder) => folder !== "cli"), "--html", "--no-lint"]), 0);

  // A design's fonts are files beside it (../fonts): its written HTML, a folder down in out/, looks for them there.
  cpSync(join(project, "fonts"), join(project, "out/fonts"), { recursive: true });

  /**
   * A design as Chromium draws it in a window `width` wide: its picture, the box of each of its ids, and `content`, the
   * `across` px of the window's middle its content takes, `around` px more on each side.
   */
  const shot = async (name, width, { across = Math.min(width, 600), around = 20, clip, ids: more = [], room = 16 } = {}) => {
    const source = readFileSync(join(example, `${name}.tsx`), "utf8");
    const ids = [...[...source.matchAll(/\bid="([\w-]+)"/g)].map((match) => match[1]), ...more];
    // The pictures a design names by their address on the site are the site's own files.
    // And a Document's page is paper: white, where its print HTML shows it on a browser's gray.
    const html = readFileSync(join(project, "out", `${name}.html`), "utf8")
      .replaceAll("https://hyperelements.dev/img/", `${pathToFileURL(join(site, "public/img")).href}/`)
      // And `room` px of the design's own background above and below it, so what sits at its edges shows whole.
      .replace("</head>", `<style>.elements-page{background-color:#fff}${clip ? "" : `body{padding:${room}px 0 !important}`}</style></head>`);
    const file = join(project, "out", `${name}.${width}.html`);
    writeFileSync(file, html);
    const drawn = await draw(file, width, { clip, optional: true, boxes: { ...Object.fromEntries(ids.map((id) => [id, `#${id}`])), body: "body" } });
    if (clip) return { ...drawn, crop: { x: 0, y: 0, width: drawn.width, height: drawn.height } };
    const left = Math.max((drawn.width - across) / 2 - around, 0);
    // As tall as its content, not the window.
    return { ...drawn, crop: { x: left, y: 0, width: Math.min(across + 2 * around, drawn.width), height: Math.min(drawn.boxes.body.height, drawn.height) } };
  };
  /** A design's HTML with the site's pictures read from the site's own files, as a file to draw. */
  const local = (name) => {
    const file = join(project, "out", `${name}.local.html`);
    writeFileSync(file, readFileSync(join(project, "out", `${name}.html`), "utf8").replaceAll("https://hyperelements.dev/img/", `${pathToFileURL(join(site, "public/img")).href}/`));
    return file;
  };
  const write = (name, { svg, width, height }) => {
    writeFileSync(join(out, name), svg);
    sizes[name] = { width, height };
  };
  /** The space between two boxes, one after the other across or down. */
  const between = (a, b) => (b.x >= a.x + a.width ? { x: a.x + a.width, y: Math.min(a.y, b.y), width: b.x - a.x - a.width, height: Math.max(a.height, b.height) } : { x: Math.min(a.x, b.x), y: a.y + a.height, width: Math.max(a.width, b.width), height: b.y - a.y - a.height });
  /** The four strips of padding inside a box, `inset` px each. */
  const inside = (box, inset) => [
    { x: box.x, y: box.y, width: box.width, height: inset },
    { x: box.x, y: box.y + box.height - inset, width: box.width, height: inset },
    { x: box.x, y: box.y + inset, width: inset, height: box.height - 2 * inset },
    { x: box.x + box.width - inset, y: box.y + inset, width: inset, height: box.height - 2 * inset },
  ];
  const px = (box) => `${Math.round(box.width)}px`;
  /** A crop with room below it, for tags under what sits at the bottom. */
  const below = (crop, room = 30) => ({ ...crop, height: crop.height + room });
  /** A crop with room above it, for tags over what sits at the top. */
  const above = (crop, room = 34) => ({ ...crop, y: crop.y - room, height: crop.height + room });

  // ── Designs ──
  if (wanted("designs")) {
    // The four roots, each as its output, in a frame that suits it: an email in a mail window, a page in a browser's,
    // a document as a sheet of paper, a canvas as the image it is. What's inside each frame is the design's output.
    const top = (drawn, at, height) => picture(drawn, { ...at, height }, { crop: { x: 0, y: 0, width: drawn.width, height: (height * drawn.width) / at.width } });
    const text = (x, y, value, { size = 14, weight = 400, fill = "#0f172a", anchor = "start" } = {}) => `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${escapeText(value)}</text>`;
    const save = (name, label, parts) => {
      writeFileSync(join(out, `designs-${name}.svg`), card(label, parts));
      sizes[`designs-${name}.svg`] = { width: 600, height: 400 };
    };
    {
      const email = await shot("designs/newsletter", 640, { room: 0 });
      save("email", "An email in a mail window: from Orbit, subject The Weekly Signal, with a logo, a banner, a headline and the start of its text", [
        `<rect x="70" y="24" width="460" height="400" rx="12" fill="#ffffff"/>`,
        text(92, 54, "The Weekly Signal", { size: 17, weight: 700 }),
        `<circle cx="106" cy="82" r="13" fill="#4f46e5"/>`,
        text(106, 87, "O", { size: 13, weight: 700, fill: "#ffffff", anchor: "middle" }),
        text(128, 79, "Orbit", { size: 13, weight: 700 }),
        text(128, 95, "to me", { size: 12, fill: "#64748b" }),
        text(508, 79, "Inbox", { size: 12, fill: "#64748b", anchor: "end" }),
        top(email, { x: 70, y: 108, width: 460 }, 292),
      ]);
    }
    {
      const page = await draw(local("designs/landing"), 1200, { height: 780, fullPage: false });
      save("page", "A web page in a browser window at orbit.example: a navigation bar, a large headline on a colored band, a button and a screenshot of the product", [
        `<rect x="24" y="24" width="552" height="400" rx="10" fill="#e2e8f0"/>`,
        ...[0, 1, 2].map((dot) => `<circle cx="${42 + dot * 16}" cy="40" r="5" fill="${["#f87171", "#fbbf24", "#34d399"][dot]}"/>`),
        `<rect x="150" y="30" width="300" height="20" rx="10" fill="#ffffff"/>`,
        text(300, 44.5, "orbit.example", { size: 12, fill: "#475569", anchor: "middle" }),
        top(page, { x: 24, y: 56, width: 552 }, 344),
      ]);
    }
    {
      const sheet = await shot("designs/invoice", 900, { clip: ".elements-page" });
      save("document", "A document as a sheet of paper: an invoice with a letterhead, who it's billed to, a table of three lines and the total due", [
        `<rect x="122" y="14" width="380" height="400" fill="#94a3b8"/>`,
        `<rect x="110" y="24" width="380" height="400" fill="#ffffff"/>`,
        top(sheet, { x: 110, y: 24, width: 380 }, 376),
      ]);
    }
    {
      const image = { png: readFileSync(join(project, "out/designs/card.png")), width: 1200, height: 630 };
      save("canvas", "An image, 1200 by 630: a social card with a large headline on indigo beside a grid of bright shapes in yellow, teal, coral and pink", [picture(image, { x: 24, y: 55, width: 552, height: 290 })]);
    }
    // And one receipt, written once, under three of them.
    {
      const [email, page, sheet] = [await shot("designs/receipt-email", 700), await shot("designs/receipt-page", 700), await shot("designs/receipt-document", 900, { clip: ".elements-page" })];
      write(
        "designs-shared.svg",
        panels("One receipt three times: as an email, as a web page, and at the top of a document's first page", [
          { ...email, caption: "<Email>" },
          { ...page, caption: "<Page>" },
          { ...sheet, crop: { x: 0, y: 0, width: sheet.width, height: 420 }, caption: "<Document>, the top of its page" },
        ], { valign: "center" })
      );
    }
  }

  // ── Styles ──
  if (wanted("styles")) {
    {
      const [desktop, phone] = [await shot("styles/mobile", 700), await shot("styles/mobile", 375)];
      const marks = (boxes, inset, size) => [...inside(boxes.card, inset).map((strip) => ({ box: strip, color: PADDING, shade: 0.45, outline: false })), { box: boxes.heading, color: PART, tag: size }];
      write(
        "styles-mobile.svg",
        panels(
          "A card on desktop, its heading 32px at the left inside 32px of padding, and the same card on a phone, its heading 24px and centered inside 16px of padding",
          [
            { ...desktop, crop: above(desktop.crop, 14), caption: "Desktop: its own styles", marks: marks(desktop.boxes, 32, "fontSize: 32") },
            { ...phone, crop: above(phone.crop, 14), caption: "Phone: its mobile block over them", marks: marks(phone.boxes, 16, "fontSize: 24, centered") },
          ],
          { valign: "center", legend: [{ color: PART, text: "The Heading", outline: true }, { color: PADDING, text: "The Column's padding: 32, and 16 on phones" }] }
        )
      );
    }
    {
      const [desktop, phone] = [await shot("styles/hidden", 700), await shot("styles/hidden", 375)];
      write(
        "styles-hidden.svg",
        panels("A card on desktop showing its desktop detail and not its phone detail, and the same card on a phone showing its phone detail and not its desktop detail", [
          { ...desktop, crop: below(desktop.crop), caption: "Desktop", marks: [{ box: desktop.boxes.desktop, color: PART, tag: "hidden={{ mobile: true }}", place: "below" }] },
          { ...phone, crop: below(phone.crop), caption: "Phone", marks: [{ box: phone.boxes.phone, color: GAP, tag: "hidden={{ desktop: true }}", place: "below" }] },
        ], { valign: "center" })
      );
    }
    {
      const design = await shot("styles/values", 700);
      write("styles-values.svg", panels("A card with a 1px border, its top corners rounded and its bottom corners square, holding a title in capitals and a line of text with a rule under it and a superscript 2", [design], { width: 720 }));
    }
    write("styles-phones.svg", phones());
  }

  // ── Rendering ──
  if (wanted("rendering")) {
    steps.receiptOutline = expect(run(["outline", "rendering/receipt.tsx"]), 0);
    steps.receiptText = { output: readFileSync(join(project, "out/rendering/receipt.txt"), "utf8") };
    {
      const [desktop, phone] = [await shot("rendering/receipt", 700), await shot("rendering/receipt", 375)];
      write("rendering-receipt.svg", panels("The receipt email on desktop, its two columns side by side under the table, and on a phone, the columns stacked and the heading smaller", [{ ...desktop, caption: "html, in a desktop window" }, { ...phone, caption: "html, on a phone" }], { maxHeight: 560 }));
    }
    // The scripts the page shows write a PDF and an image; the PDF's picture is its print HTML's first page.
    script("rendering/_scripts/pdf.tsx");
    script("rendering/_scripts/image.tsx");
    if (!readFileSync(join(project, "receipt.pdf")).subarray(0, 5).equals(Buffer.from("%PDF-"))) throw new Error("rendering/_scripts/pdf.tsx wrote no PDF");
    {
      const sheet = await shot("designs/receipt-document", 900, { clip: ".elements-page" });
      write("rendering-pdf.svg", panels("The top of the PDF's first page: the receipt inside the A4 page's margins", [{ ...sheet, crop: { x: 0, y: 0, width: sheet.width, height: 400 }, caption: "receipt.pdf: the top of its A4 page" }], { width: 720 }));
      const image = { png: readFileSync(join(project, "card.png")), width: 1200, height: 630 };
      write("rendering-image.svg", panels("The image: a social card 1200 by 630, with a name, a large headline and a line of text", [{ ...image, caption: "card.png, 1200×630" }], { width: 720 }));
    }
    write("rendering-flow.svg", flow());
  }

  // ── Themes ──
  if (wanted("themes")) {
    const email = await shot("themes/welcome", 640);
    const { card: box, heading, text, primary, secondary, band, small } = email.boxes;
    write(
      "themes-welcome.svg",
      annotate({
        png: email.png,
        width: email.width,
        height: Math.round(email.boxes.body.height),
        scale: 0.92,
        labelWidth: 318,
        outset: 3,
        even: true,
        label: "The welcome email, each part labeled with what in the theme styles it: the card by a named style, the heading and text by roles, the buttons by a role and a variant, the dark band by a scope, and its small text by a token.",
        parts: [
          { label: 'apply: ["card"]', note: "A named style: padding, gap, background", box, open: true, from: "top" },
          { label: "Heading", note: "A role, fonts.heading, and its level's size", box: heading, open: true },
          { label: "Text", note: "Roles: colors.foreground, fonts.body", box: text, open: true },
          { label: "Button", note: "A role, colors.primary, and its default radius", box: primary, open: true },
          { label: 'variant="secondary"', note: "A variant of the Button", box: secondary, open: true },
          { label: "tokens={{ colors }}", note: "A scope: other colors for this band", box: band, open: true, from: "bottom" },
          { label: 'token("fontSizes.small")', note: "One token, by name", box: small, open: true },
        ],
      })
    );
  }

  // ── Custom elements ──
  if (wanted("custom")) {
    steps.customRefused = expect(run(["check", "custom/_refused/huge.tsx", "--no-lint"]), 1);
    steps.customInspect = expect(run(["inspect", "custom/shop.tsx"]), 0);
    // An id inside a custom element is written after its instance's: "first-card".
    const shop = await shot("custom/shop", 700, { ids: ["first-card", "second-card"] });
    write(
      "custom-cards.svg",
      panels("Two product cards side by side, each a photo, a name and a button: the first with a price and an indigo Buy button, the second with a larger name and a gray Sold out button", [{ ...shop, crop: above(shop.crop), marks: [{ box: shop.boxes["first-card"], color: PART, tag: "<ProductCard />" }, { box: shop.boxes["second-card"], color: GAP, tag: "<ProductCard size=\"large\" soldOut />" }] }], { width: 800 })
    );
  }

  // ── Command line ──
  if (wanted("cli")) {
    // A project's folder of emails: the welcome email, and the receipt from the Rendering page.
    const home = join(project, "cli");
    cpSync(join(example, "rendering/receipt.tsx"), join(home, "emails/receipt.tsx"));
    steps.cliCheck = expect(run(["check", "emails/"], home), 0);
    steps.cliRender = expect(run(["render", "emails/welcome.tsx"], home), 0);
    steps.cliOutline = expect(run(["outline", "emails/welcome.tsx"], home), 0);
    steps.cliPreview = expect(run(["preview", "emails/welcome.tsx", "--fonts", "inline"], home), 0);
    steps.cliJson = expect(run(["check", "drafts/broken.tsx", "--json"], home), 1);
    {
      // A preview file draws itself when a browser opens it: classic Outlook's, with what it changed listed above it.
      const outlook = await draw(join(home, "out/clients/emails/welcome/outlook.html"), 860, { ready: "html[data-email-client-ready]" });
      write("cli-preview.svg", panels("The welcome email's preview file for classic Outlook: a note that it removed border-radius, and the email drawn with square corners", [{ ...outlook, crop: { x: 0, y: 0, width: outlook.width, height: 425 }, caption: "out/clients/emails/welcome/outlook.html, opened in a browser" }], { width: 880 }));
    }
    {
      // dev's page, from the server it starts: the designs listed, the first one's diagnostics and its desktop preview.
      const server = spawn(process.execPath, [cli, "dev", "emails/"], { cwd: home, env });
      try {
        let said = "";
        const url = await new Promise((found, failed) => {
          const late = setTimeout(() => failed(new Error(`dev printed no URL:\n${said}`)), 30000);
          for (const stream of [server.stdout, server.stderr]) {
            stream.on("data", (chunk) => {
              said += chunk;
              const match = /http:\/\/127\.0\.0\.1:\d+\/\S*/.exec(said);
              if (match) {
                clearTimeout(late);
                found(match[0]);
              }
            });
          }
        });
        const page = await draw(url, 1200, { height: 760, fullPage: false, ready: "iframe, img", settle: 4000 });
        writeFileSync(join(out, "cli-dev.png"), page.png);
        sizes["cli-dev.png"] = { width: 1200, height: 760 };
      } finally {
        server.kill("SIGINT");
      }
    }
  }

  // ── Layout ──
  if (wanted("layout")) {
    steps.rowOutline = expect(run(["outline", "layout/row.tsx"]), 0);
    {
      const [desktop, phone] = [await shot("layout/row", 700), await shot("layout/row", 375)];
      const columns = (boxes) => ["fixed", "two", "one"].map((id) => boxes[id]);
      const gaps = (boxes) => columns(boxes).slice(1).map((box, i) => ({ box: between(columns(boxes)[i], box), color: GAP, shade: 0.55, outline: false }));
      write(
        "layout-row.svg",
        panels(
          "A Row of three Columns on desktop, 180px, 259px and 129px wide with 16px gaps between them, and the same Row on a phone, its Columns stacked at full width",
          [
            { ...desktop, crop: above(desktop.crop), caption: "Desktop: side by side", marks: [...gaps(desktop.boxes), ...columns(desktop.boxes).map((box) => ({ box, color: PART, tag: px(box) }))] },
            { ...phone, crop: above(phone.crop), caption: "Phone: stacked", marks: [...gaps(phone.boxes), ...columns(phone.boxes).map((box) => ({ box, color: PART, tag: px(box), place: "corner" }))] },
          ],
          { valign: "center", legend: [{ color: PART, text: "A Column, with its width", outline: true }, { color: GAP, text: "The Row's gap, 16px" }] }
        )
      );
    }
    {
      const card = await shot("layout/spacing", 700);
      const { card: box, heading, text, button } = card.boxes;
      write(
        "layout-spacing.svg",
        panels(
          "A card with its padding shaded on all four sides, 32px, and the gap between its heading, text and button shaded, 16px each",
          [{ ...card, marks: [...inside(box, 32).map((strip) => ({ box: strip, color: PADDING, shade: 0.45, outline: false })), { box: between(heading, text), color: GAP, shade: 0.6, outline: false }, { box: { ...between(text, button), x: heading.x, width: heading.width }, color: GAP, shade: 0.6, outline: false }] }],
          { width: 720, legend: [{ color: PADDING, text: "padding: 32, inside the box" }, { color: GAP, text: "gap: 16, between its children" }] }
        )
      );
    }
    {
      const email = await shot("layout/section", 800, { across: 800, around: 0, room: 0 });
      const { band, card } = email.boxes;
      write(
        "layout-section.svg",
        panels(
          "An email in a window wider than its content: the Section's dark background spans the whole window, and its heading and the card below sit inside the 600px content width",
          [{ ...email, crop: above(email.crop, 6), marks: [{ box: { x: 100, y: 0, width: 600, height: email.height }, color: "#94a3b8", dashed: true }, { box: band, color: PART, tag: "Section: a band", place: "corner" }, { box: card, color: GAP, tag: "Column: a card", place: "corner" }] }],
          { width: 880, legend: [{ color: "#94a3b8", text: "The content width, 600px", dashed: true }] }
        )
      );
    }
    {
      const [desktop, phone] = [await shot("layout/grid", 700), await shot("layout/grid", 375)];
      write(
        "layout-grid.svg",
        panels("A Grid of four cards in three columns on desktop, the fourth starting a second row, and the same Grid on a phone, one card under another", [
          { ...desktop, caption: "Desktop: three columns" },
          { ...phone, caption: "Phone: one under another" },
        ], { valign: "center" })
      );
    }
    {
      const layer = await shot("layout/layer", 700);
      write("layout-layer.svg", panels("A Layer 240px tall: a photo covering it, and a heading over the photo at its bottom left", [{ ...layer, marks: [{ box: layer.boxes.layer, color: PART, tag: "Layer", place: "corner" }, { box: layer.boxes.words, color: GAP, tag: "Column, over the Image" }] }], { width: 720 }));
    }
    {
      const design = await shot("layout/alignment", 700);
      write(
        "layout-alignment.svg",
        panels("A Row whose logo and two lines of text are centered on each other vertically, and a Column whose heading and button are centered across it", [{ ...design, marks: [{ box: design.boxes.row, color: PART, tag: "Row", place: "corner" }, { box: design.boxes.column, color: GAP, tag: "Column", place: "corner" }] }], { width: 720 })
      );
    }
  }

  const outputs = Object.fromEntries(Object.entries(steps).map(([name, step]) => [name, step.output.trimEnd()]));
  // What was printed and drawn, before the pages are held to it. A run of some pages only adds to what's recorded.
  const record = join(site, "src/generated/core-concepts.json");
  const before = only.length ? JSON.parse(readFileSync(record, "utf8")) : { outputs: {}, sizes: {} };
  const all = { outputs: { ...before.outputs, ...outputs }, sizes: { ...before.sizes, ...sizes } };
  writeFileSync(record, `${JSON.stringify(all, null, 2)}\n`);
  if (!only.length) checkDocs(all.outputs, all.sizes);
} finally {
  rmSync(project, { recursive: true, force: true });
}

/** Where phones start: an Email's and a Page's window widths, each split at the width at and below which phone styles apply. */
function phones() {
  const [width, height, left, right] = [880, 250, 150, 850];
  const at = (px) => left + ((right - left) * px) / 1000;
  const row = (y, name, limit, note) => `
  <text x="24" y="${y + 5}" font-size="16" font-weight="700" fill="#f1f5f9">${escapeText(name)}</text>
  <rect x="${at(0)}" y="${y - 14}" width="${at(limit) - at(0)}" height="28" rx="6" fill="#2dd4bf" fill-opacity="0.85"/>
  <rect x="${at(limit) + 3}" y="${y - 14}" width="${at(1000) - at(limit) - 3}" height="28" rx="6" fill="#334155"/>
  <text x="${at(limit / 2)}" y="${y + 5}" text-anchor="middle" font-size="14.5" font-weight="700" fill="#0f172a">phone styles</text>
  <text x="${(at(limit) + at(1000)) / 2}" y="${y + 5}" text-anchor="middle" font-size="14.5" fill="#cbd5e1">desktop styles</text>
  <path d="M${at(limit) + 1.5} ${y - 22} V${y + 22}" stroke="#f1f5f9" stroke-width="2"/>
  <text x="${at(limit) + 1.5}" y="${y + 40}" text-anchor="middle" font-size="14" fill="#cbd5e1">${escapeText(note)}</text>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" font-family="ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif" role="img" aria-label="Window widths from 0 to 1000px. A 600px Email takes its phone styles up to 620px wide, its width plus 20px. A Page takes them up to 480px wide, or up to its own breakpoints.mobile.">
  <rect width="${width}" height="${height}" rx="12" fill="#0f172a"/>
  <text x="${at(0)}" y="34" font-size="14" fill="#94a3b8">A window 0px wide</text>
  <text x="${at(1000)}" y="34" text-anchor="end" font-size="14" fill="#94a3b8">1000px wide</text>${row(80, "Email, 600px", 620, "620px: its width + 20px")}${row(174, "Page", 480, "480px, or its breakpoints.mobile")}
</svg>
`;
  return { svg, width, height };
}

/** What every entry point does with a design, in order, and how far each goes. */
function flow() {
  const [width, height, pad, gap, boxHeight] = [880, 318, 20, 22, 92];
  const stages = [
    ["Your design", "JSX with one root"],
    ["Collect", "React runs your", "functions, once"],
    ["Check", "Props, styles,", "children, ids"],
    ["Lay out", "Every box's", "width in px"],
    ["Write", "The root's output"],
  ];
  const boxWidth = (width - 2 * pad - gap * (stages.length - 1)) / stages.length;
  const x = (i) => pad + i * (boxWidth + gap);
  const boxes = stages.map(([title, ...lines], i) => `
  <rect x="${x(i)}" y="${pad}" width="${boxWidth}" height="${boxHeight}" rx="10" fill="${i ? "#1e293b" : "#0f172a"}" stroke="${i ? "#334155" : "#2dd4bf"}" stroke-width="2"/>
  <text x="${x(i) + boxWidth / 2}" y="${pad + 34}" text-anchor="middle" font-size="17" font-weight="700" fill="#f1f5f9">${escapeText(title)}</text>${lines.map((line, n) => `
  <text x="${x(i) + boxWidth / 2}" y="${pad + 56 + n * 18}" text-anchor="middle" font-size="13.5" fill="#cbd5e1">${escapeText(line)}</text>`).join("")}${i ? `
  <path d="M${x(i) - gap + 4} ${pad + boxHeight / 2} H${x(i) - 7} m-6 -5 l6 5 l-6 5" fill="none" stroke="#94a3b8" stroke-width="2"/>` : ""}`);
  // Each function, as a bar under the stages it runs.
  const bar = (row, to, color, name, note) => {
    const y = pad + boxHeight + 26 + row * 58;
    return `
  <rect x="${x(1)}" y="${y}" width="${x(to) + boxWidth - x(1)}" height="8" rx="4" fill="${color}"/>
  <text x="${x(1)}" y="${y + 30}" font-size="15" font-weight="700" fill="#f1f5f9" font-family="ui-monospace, SFMono-Regular, Menlo, monospace">${escapeText(name)}</text>
  <text x="${x(1) + name.length * 9.2 + 14}" y="${y + 30}" font-size="14" fill="#cbd5e1">${escapeText(note)}</text>`;
  };
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" font-family="ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif" role="img" aria-label="A design goes through four steps: it is collected in one React render, checked, laid out, and written. validate() and outline() stop after the layout: one returns what is wrong, the other prints the layout. render(), renderPdf() and renderImage() go on to write the output.">
  <rect width="${width}" height="${height}" rx="12" fill="#0f172a"/>${boxes.join("")}${bar(0, 3, "#fbbf24", "validate()", "returns what's wrong, and writes nothing")}${bar(1, 3, "#f472b6", "outline()", "prints the layout as text")}${bar(2, 4, "#2dd4bf", "render()  renderPdf()  renderImage()", "write the output")}
</svg>
`;
  return { svg, width, height };
}

/** Every .tsx file under a folder, node_modules aside. */
function sources(folder) {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => (entry.name === "node_modules" || entry.name === "out" ? [] : entry.isDirectory() ? sources(join(folder, entry.name)) : entry.name.endsWith(".tsx") ? [join(folder, entry.name)] : []));
}

/**
 * What a page takes from the examples is the examples': each code block marked `<!-- example: <file> -->` is that
 * file's lines in order (less its ids), each block marked `<!-- output: <name> -->` is what that command printed
 * (`part-of`: some of its lines; `json`: one of its JSON lines, laid out to read), and each picture has the size it was
 * drawn at.
 */
function checkDocs(outputs, sizes) {
  const docs = ["designs", "layout", "styles", "rendering", "themes", "themes/reference", "custom-elements", "cli", "cli/reference"].map((name) => join(site, "src/content/docs", `${name}.md`));
  const problems = [];
  const used = new Set();
  for (const doc of docs) {
    let text;
    try {
      text = readFileSync(doc, "utf8");
    } catch {
      continue;
    }
    const at = doc.slice(site.length + 1);
    for (const [, kind, name, block] of text.matchAll(/<!-- (example|output|part-of|json): ([\w./-]+) -->\n *```\w*\n([\s\S]*?)```/g)) {
      if (kind === "part-of" || kind === "json") {
        // Some of an output's lines, or one of its JSON lines laid out to read.
        const lines = (outputs[name] ?? "").split("\n").map((line) => line.trim());
        if (outputs[name] === undefined) problems.push(`${at}: no command printed "${name}"`);
        else if (kind === "json" ? !lines.includes(JSON.stringify(JSON.parse(block))) : !block.split("\n").map((line) => line.trim()).filter(Boolean).every((line) => lines.includes(line))) problems.push(`${at}: what it quotes of "${name}" isn't in what the command printed (see src/generated/core-concepts.json)`);
        continue;
      }
      if (kind === "output") {
        if (outputs[name] === undefined) problems.push(`${at}: no command printed "${name}"`);
        else if (block.trimEnd() !== outputs[name]) problems.push(`${at}: the output it quotes for "${name}" isn't what the command printed (see src/generated/core-concepts.json)`);
        continue;
      }
      let source;
      try {
        source = readFileSync(join(example, name), "utf8");
      } catch {
        problems.push(`${at}: there's no examples/core-concepts/${name}`);
        continue;
      }
      used.add(name);
      const lines = source.replace(/ id="[\w-]+"/g, "").split("\n").map((line) => line.trim());
      let from = 0;
      for (const line of block.split("\n").map((line) => line.trim()).filter((line) => line && line !== "// …" && line !== "{/* … */}")) {
        const found = lines.indexOf(line, from);
        if (found < 0) {
          problems.push(`${at}: its copy of ${name} has a line that isn't in it (or is out of order): ${line}`);
          break;
        }
        from = found + 1;
      }
    }
    if (/<!-- (example|output|part-of|json): [^>]*-->(?!\n *```)/.test(text)) problems.push(`${at}: a marker with no code block right after it`);
    for (const [, file, width, height] of text.matchAll(/<img src="\/generated\/core-concepts\/([\w.-]+)" width="(\d+)" height="(\d+)"/g)) {
      const drawn = sizes[file];
      if (!drawn) problems.push(`${at}: there's no picture ${file}`);
      else if (drawn.width !== Number(width) || drawn.height !== Number(height)) problems.push(`${at}: ${file} is ${drawn.width}×${drawn.height}, which isn't the size its <img> gives`);
    }
  }
  if (problems.length) throw new Error(`The docs and the examples differ:\n- ${problems.join("\n- ")}`);
}
