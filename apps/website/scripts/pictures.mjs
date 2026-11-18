// Pictures for the docs, made from real output: an HTML file drawn in Chromium, with the boxes of the elements a
// picture names, and SVGs that outline and label them. Used by templates-guide.mjs and core-concepts.mjs.
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const site = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * An HTML file (or a URL) as Chromium draws it at a width: a PNG of the whole page, of the element `clip` selects, or
 * (`fullPage: false`) of a window `height` tall, with its size in px and the box of each element `boxes` selects,
 * inside it.
 */
export async function draw(html, width, { clip, boxes = {}, optional = false, ready, settle = 0, height = 100, fullPage = true } = {}) {
  const clientsDir = dirname(createRequire(join(site, "package.json")).resolve("@hyper-elements/email-clients/package.json"));
  const { chromium } = createRequire(join(clientsDir, "package.json"))("playwright");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
    await page.goto(/^https?:/.test(html) ? html : pathToFileURL(html).href);
    // A page that draws itself says when it has, on an element `ready` selects.
    if (ready) await page.waitForSelector(ready, { timeout: 30000 });
    // And one that loads pictures inside frames of its own is given `settle` ms for them.
    if (settle) await page.waitForTimeout(settle);
    await page.evaluate(() => document.fonts.ready);
    const frame = clip ? await page.locator(clip).first().boundingBox() : fullPage ? await page.evaluate(() => ({ x: 0, y: 0, width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight })) : { x: 0, y: 0, width, height };
    const found = {};
    for (const [name, selector] of Object.entries(boxes)) {
      const box = (await page.locator(selector).count()) ? await page.locator(selector).first().boundingBox() : null;
      // Nothing drawn there (it's hidden at this width): an error, or with `optional`, a box left out.
      if (!box && optional) continue;
      if (!box) throw new Error(`${html} has nothing at ${selector}`);
      found[name] = { x: box.x - frame.x, y: box.y - frame.y, width: box.width, height: box.height };
    }
    const png = clip ? await page.locator(clip).first().screenshot({ type: "png" }) : await page.screenshot({ type: "png", fullPage });
    return { png, width: Math.round(frame.width), height: Math.round(frame.height), boxes: found };
  } finally {
    await browser.close();
  }
}

/**
 * A picture with its parts outlined and named beside it: the open parts (what a design gives) in a solid line, the
 * locked parts (the template's) dashed, hatched and marked with a padlock. One SVG, the picture inside it, so it's one
 * file to show. Each label sits level with its part where there's room, or (`even`) in evenly spaced rows.
 */
export function annotate({ png, width: fullWidth, height: fullHeight, scale, parts, labelWidth, label, even = false, legend = "", outset = 0 }) {
  const [imageWidth, imageHeight, gutter, pad] = [Math.round(fullWidth * scale), Math.round(fullHeight * scale), 48, 16];
  const [width, height] = [pad + imageWidth + gutter + labelWidth + pad, pad + imageHeight + pad];
  const [OPEN, FIXED] = ["#2dd4bf", "#94a3b8"];
  const labelX = pad + imageWidth + gutter;
  const text = (value) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;");
  // A box on the picture, `outset` px around its part, and kept a line's width inside the picture's edges so a part as
  // wide as the picture still shows its outline.
  const placed = parts.map((part) => {
    const [x, y] = [Math.max(pad + part.box.x * scale - outset, pad + 1), Math.max(pad + part.box.y * scale - outset, pad + 1)];
    return { ...part, x, y, w: Math.min(pad + (part.box.x + part.box.width) * scale + outset, pad + imageWidth - 1) - x, h: Math.min(pad + (part.box.y + part.box.height) * scale + outset, pad + imageHeight - 1) - y };
  });
  const rows = parts.length + (legend ? 1 : 0);
  const rowHeight = (imageHeight - 8) / rows;
  const ys = placed.map((part, i) => (even ? pad + 4 + rowHeight * i + rowHeight / 2 : part.y + part.h / 2));
  if (!even) {
    // Level with its part, at least a label's height from the one above and inside the picture's height.
    const [gap, top, bottom] = [48, pad + 22, pad + imageHeight - 22];
    for (let i = 0; i < ys.length; i++) ys[i] = Math.max(ys[i], i ? ys[i - 1] + gap : top);
    for (let i = ys.length - 1; i >= 0; i--) ys[i] = Math.min(ys[i], i === ys.length - 1 ? bottom : ys[i + 1] - gap);
  }
  const items = placed.map((part, i) => {
    const color = part.open ? OPEN : FIXED;
    const y = ys[i];
    const fromY = part.from === "bottom" ? part.y + part.h - 12 : part.from === "top" ? part.y + 12 : part.y + part.h / 2;
    const fromX = part.x + part.w;
    // Its leader, straight to the labels; or first up to the height `over` gives, past what sits beside the part.
    const overY = part.over === undefined ? undefined : pad + part.over * scale;
    const start = overY === undefined ? `M${fromX.toFixed(1)} ${fromY.toFixed(1)} L${(labelX - 28).toFixed(1)} ${fromY.toFixed(1)}` : `M${fromX.toFixed(1)} ${fromY.toFixed(1)} L${(fromX + 10).toFixed(1)} ${fromY.toFixed(1)} L${(fromX + 10).toFixed(1)} ${overY.toFixed(1)} L${(labelX - 28).toFixed(1)} ${overY.toFixed(1)}`;
    const mark = part.open
      ? `<circle cx="${labelX + 4}" cy="${y.toFixed(1)}" r="5" fill="${color}"/>`
      : `<g transform="translate(${labelX + 4} ${y.toFixed(1)})"><path d="M-3.5 -1.5 v-2.5 a3.5 3.5 0 0 1 7 0 v2.5" fill="none" stroke="${color}" stroke-width="1.8"/><rect x="-6" y="-1.5" width="12" height="9" rx="2" fill="${color}"/></g>`;
    return [
      `<rect x="${part.x.toFixed(1)}" y="${part.y.toFixed(1)}" width="${part.w.toFixed(1)}" height="${part.h.toFixed(1)}" rx="4" fill="${part.open ? "none" : "url(#locked)"}" stroke="${color}" stroke-width="2"${part.open ? "" : ' stroke-dasharray="6 4"'}/>`,
      `<path d="${start} L${(labelX - 12).toFixed(1)} ${y.toFixed(1)} L${(labelX - 4).toFixed(1)} ${y.toFixed(1)}" fill="none" stroke="${color}" stroke-width="1.5" opacity="0.7"/>`,
      mark,
      `<text x="${labelX + 18}" y="${(y - 3).toFixed(1)}" font-size="18" font-weight="700" fill="#f1f5f9">${text(part.label)}</text>`,
      `<text x="${labelX + 18}" y="${(y + 17).toFixed(1)}" font-size="14.5" fill="#cbd5e1">${text(part.note)}</text>`,
    ].join("\n  ");
  });
  const lastY = pad + 4 + rowHeight * parts.length + rowHeight / 2;
  const legendRow = legend
    ? [
        `<rect x="${labelX - 2}" y="${(lastY - 9).toFixed(1)}" width="12" height="12" rx="2" fill="none" stroke="${FIXED}" stroke-width="2" stroke-dasharray="3 2"/>`,
        `<text x="${labelX + 18}" y="${(lastY - 3).toFixed(1)}" font-size="18" font-weight="700" fill="#f1f5f9">Everything else</text>`,
        `<text x="${labelX + 18}" y="${(lastY + 17).toFixed(1)}" font-size="14.5" fill="#cbd5e1">${text(legend)}</text>`,
      ].join("\n  ")
    : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" font-family="ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif" role="img" aria-label="${text(label).replaceAll('"', "&quot;")}">
  <defs><pattern id="locked" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="${FIXED}" fill-opacity="0.06"/><rect width="2" height="8" fill="${FIXED}" fill-opacity="0.2"/></pattern></defs>
  <rect width="${width}" height="${height}" rx="12" fill="#0f172a"/>
  <image x="${pad}" y="${pad}" width="${imageWidth}" height="${imageHeight}" href="data:image/png;base64,${png.toString("base64")}"/>
  ${items.join("\n  ")}${legendRow ? `\n  ${legendRow}` : ""}
</svg>
`;
  return { svg, width, height };
}

/** Text as an SVG's text or attribute. */
export function escapeText(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
}

/** A concept's picture: a 600×400 card holding what `picture()` and `caption()` drew. */
export function card(label, children) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400" width="600" height="400" font-family="ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif" role="img" aria-label="${escapeText(label)}">
  <rect width="600" height="400" rx="12" fill="#0f172a"/>
  ${children.join("\n  ")}
</svg>
`;
}

/** A line of text on a card, centered at x. */
export function caption(x, y, value, color = "#cbd5e1", size = 19) {
  return `<text x="${x}" y="${y}" text-anchor="middle" font-size="${size}" font-weight="${color === "#cbd5e1" ? 400 : 700}" fill="${color}">${escapeText(value)}</text>`;
}

/**
 * A picture inside an area of a card, centered: all of it, or the part of it `crop` gives. Its `parts` are outlined,
 * each with its name on a tag (above it, `below` it, or `inside` its top right corner); with `dim`, everything but the parts is
 * darkened. A `frame` outlines the picture.
 */
export function picture({ png, width, height }, area, { parts = [], dim = false, frame, dashed = false, crop = { x: 0, y: 0, width, height } } = {}) {
  const scale = Math.min(area.width / crop.width, area.height / crop.height);
  const [w, h] = [crop.width * scale, crop.height * scale];
  const [x, y] = [area.x + (area.width - w) / 2, area.y + (area.height - h) / 2];
  const n = (value) => value.toFixed(1);
  // Inside a nested <svg>, which clips what the crop leaves out: coordinates from the shown part's top left corner.
  const boxes = parts.map((part) => {
    const [left, top] = [Math.max((part.box.x - crop.x) * scale, 1.5), Math.max((part.box.y - crop.y) * scale, 1.5)];
    return { ...part, left, top, w: Math.min((part.box.x + part.box.width - crop.x) * scale, w - 1.5) - left, h: Math.min((part.box.y + part.box.height - crop.y) * scale, h - 1.5) - top };
  });
  const holes = boxes.map((b) => `M${n(b.left)} ${n(b.top)}h${n(b.w)}v${n(b.h)}h${n(-b.w)}z`).join("");
  return [
    `<svg x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}">`,
    `<image x="${n(-crop.x * scale)}" y="${n(-crop.y * scale)}" width="${n(width * scale)}" height="${n(height * scale)}" href="data:image/png;base64,${png.toString("base64")}"/>`,
    dim ? `<path fill-rule="evenodd" d="M0 0h${n(w)}v${n(h)}h${n(-w)}z${holes}" fill="#0f172a" fill-opacity="0.62"/>` : "",
    frame ? `<rect x="1.5" y="1.5" width="${n(w - 3)}" height="${n(h - 3)}" rx="3" fill="none" stroke="${frame}" stroke-width="3"${dashed ? ' stroke-dasharray="8 6"' : ""}/>` : "",
    ...boxes.flatMap((b) => {
      const tagWidth = b.tag.length * 9.4 + 16;
      const [tagX, tagY] = b.inside ? [b.left + b.w - tagWidth - 5, b.top + 5] : [b.left, b.below || b.top < 30 ? b.top + b.h + 5 : b.top - 29];
      return [
        `<rect x="${n(b.left)}" y="${n(b.top)}" width="${n(b.w)}" height="${n(b.h)}" rx="3" fill="none" stroke="${b.color}" stroke-width="3"/>`,
        `<rect x="${n(tagX)}" y="${n(tagY)}" width="${n(tagWidth)}" height="25" rx="5" fill="${b.color}"/>`,
        `<text x="${n(tagX + 8)}" y="${n(tagY + 18)}" font-size="17" font-weight="700" fill="#0f172a">${escapeText(b.tag)}</text>`,
      ];
    }),
    `</svg>`,
  ]
    .filter(Boolean)
    .join("\n  ");
}

/**
 * Pictures side by side on one card, all at one scale, each with a caption under it and its marks. A mark is a part of
 * the picture outlined, shaded (`shade`) or both, with a name on a tag where it has one: above it (below, where there's
 * no room above), or `place`d "below" it, in its top right "corner" or at its "center".
 */
export function panels(label, shots, { width = 880, maxHeight = 520, valign = "top", legend = [] } = {}) {
  const [pad, gap] = [20, 24];
  const sized = shots.map((shot) => ({ ...shot, crop: shot.crop ?? { x: 0, y: 0, width: shot.width, height: shot.height } }));
  const scale = Math.min((width - 2 * pad - gap * (sized.length - 1)) / sized.reduce((sum, shot) => sum + shot.crop.width, 0), maxHeight / Math.max(...sized.map((shot) => shot.crop.height)), 1);
  const tallest = Math.max(...sized.map((shot) => shot.crop.height)) * scale;
  const total = sized.reduce((sum, shot) => sum + shot.crop.width * scale, 0) + gap * (sized.length - 1);
  const n = (value) => value.toFixed(1);
  let x = (width - total) / 2;
  const drawn = sized.map((shot) => {
    const [w, h] = [shot.crop.width * scale, shot.crop.height * scale];
    const [at, top] = [x, pad + (valign === "center" ? (tallest - h) / 2 : 0)];
    x += w + gap;
    const marks = (shot.marks ?? []).flatMap((mark) => {
      const [left, y] = [Math.max((mark.box.x - shot.crop.x) * scale, 1.5), Math.max((mark.box.y - shot.crop.y) * scale, 1.5)];
      const [mw, mh] = [Math.min((mark.box.x + mark.box.width - shot.crop.x) * scale, w - 1.5) - left, Math.min((mark.box.y + mark.box.height - shot.crop.y) * scale, h - 1.5) - y];
      const made = [];
      if (mark.shade) made.push(`<rect x="${n(left)}" y="${n(y)}" width="${n(mw)}" height="${n(mh)}" fill="${mark.color}" fill-opacity="${mark.shade === true ? 0.4 : mark.shade}"/>`);
      if (mark.outline !== false) made.push(`<rect x="${n(left)}" y="${n(y)}" width="${n(mw)}" height="${n(mh)}" rx="3" fill="none" stroke="${mark.color}" stroke-width="2.5"${mark.dashed ? ' stroke-dasharray="7 5"' : ""}/>`);
      if (mark.tag) {
        const tagWidth = mark.tag.length * 8.5 + 16;
        const above = y > 26 ? y - 25 : y + mh + 4;
        const [tagX, tagY] = mark.place === "center" ? [left + (mw - tagWidth) / 2, y + (mh - 22) / 2] : mark.place === "corner" ? [left + mw - tagWidth - 4, y + 4] : [left, mark.place === "below" ? y + mh + 4 : above];
        const tx = Math.min(Math.max(tagX, 1), w - tagWidth - 1);
        made.push(`<rect x="${n(tx)}" y="${n(tagY)}" width="${n(tagWidth)}" height="22" rx="5" fill="${mark.color}"/>`);
        made.push(`<text x="${n(tx + 8)}" y="${n(tagY + 16)}" font-size="14.5" font-weight="700" fill="#0f172a">${escapeText(mark.tag)}</text>`);
      }
      return made;
    });
    return [
      `<svg x="${n(at)}" y="${n(top)}" width="${n(w)}" height="${n(h)}">`,
      `<image x="${n(-shot.crop.x * scale)}" y="${n(-shot.crop.y * scale)}" width="${n(shot.width * scale)}" height="${n(shot.height * scale)}" href="data:image/png;base64,${shot.png.toString("base64")}"/>`,
      ...marks,
      `</svg>`,
      shot.caption ? `<text x="${n(at + w / 2)}" y="${n(pad + tallest + 26)}" text-anchor="middle" font-size="15" fill="#cbd5e1">${escapeText(shot.caption)}</text>` : "",
    ]
      .filter(Boolean)
      .join("\n  ");
  });
  // The legend: what each color marks, in one centered line under the captions.
  const captioned = pad + tallest + (sized.some((shot) => shot.caption) ? 40 : 14);
  const widths = legend.map((item) => 22 + item.text.length * 7.6 + 22);
  let lx = (width - widths.reduce((sum, w) => sum + w, 0) + 22) / 2;
  const key = legend.map((item, i) => {
    const at = lx;
    lx += widths[i];
    return `<rect x="${n(at)}" y="${n(captioned + 3)}" width="14" height="14" rx="3" fill="${item.color}"${item.dashed ? ` fill-opacity="0" stroke="${item.color}" stroke-width="2" stroke-dasharray="4 3"` : item.outline ? ` fill-opacity="0" stroke="${item.color}" stroke-width="2.5"` : ""}/><text x="${n(at + 22)}" y="${n(captioned + 15)}" font-size="14.5" fill="#cbd5e1">${escapeText(item.text)}</text>`;
  });
  const height = Math.round(captioned + (legend.length ? 34 : 6));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" font-family="ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif" role="img" aria-label="${escapeText(label)}">
  <rect width="${width}" height="${height}" rx="12" fill="#0f172a"/>
  ${[...drawn, ...key].join("\n  ")}
</svg>
`;
  return { svg, width, height };
}
