// The starters: the playground's own, then the site's templates as they are. Their code (and the site's rendering of
// each, for its thumbnail) is fetched when the gallery first opens.
import { h } from "./dom";

export interface StarterInfo {
  id: string;
  title: string;
  description: string;
  root: "Email" | "Page" | "Document" | "Canvas";
  group: string;
}
export interface Starter extends StarterInfo {
  source: string;
  html?: string;
}

const icon = (d: string) => {
  const span = h("span");
  // The page's own icons: fixed markup, written here.
  span.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  return span;
};
const ROOT_ICONS = [
  '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M7 6.5h.01M10 6.5h.01"/>',
  '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
  '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
];

/** The width each root's thumbnail is drawn at before it's scaled down, as the site's template gallery draws them. */
const widthOf = (starter: Starter) => (starter.root === "Canvas" ? Number(/<Canvas[^>]*?\swidth=\{(\d+)\}/.exec(starter.source)?.[1] ?? 1200) : starter.root === "Page" ? 1200 : starter.root === "Document" ? 794 : 640);

export class Gallery {
  private loading: Promise<Starter[]> | undefined;
  private drawn = false;
  private thumbs = new Map<string, HTMLElement>();

  constructor(
    private dialog: HTMLDialogElement,
    private list: StarterInfo[],
    private pick: (starter: Starter) => void,
    /** A starter rendered under each root, for the first starter's thumbnail: its four outputs. */
    private outputs?: (starter: Starter) => Promise<Array<{ html: string; width: number }>>,
  ) {
    dialog.addEventListener("click", (event) => event.target === dialog && dialog.close());
  }

  /** Every starter with its code. */
  all(): Promise<Starter[]> {
    this.loading ??= fetch("/playground/starters.json").then((response) => {
      if (!response.ok) throw new Error(`starters.json: ${response.status}`);
      return response.json() as Promise<Starter[]>;
    });
    this.loading.catch(() => (this.loading = undefined));
    return this.loading;
  }

  async find(id: string): Promise<Starter | undefined> {
    try {
      return (await this.all()).find((starter) => starter.id === id);
    } catch {
      return undefined;
    }
  }

  close() {
    this.dialog.close();
  }

  open(current: string | null) {
    const body = this.dialog.querySelector<HTMLElement>("[data-gallery-body]")!;
    if (!this.drawn) {
      this.drawn = true;
      const groups = [...new Set(this.list.map((starter) => starter.group))];
      body.replaceChildren(
        ...groups.map((group) =>
          h(
            "section",
            { class: "pg-gallery-group" },
            h("h3", null, group),
            h(
              "div",
              { class: "pg-gallery-grid" },
              ...this.list
                .filter((starter) => starter.group === group)
                .map((starter) => {
                  const thumb = h("div", { class: "pg-thumb" });
                  this.thumbs.set(starter.id, thumb);
                  if (starter.id === "four-outputs") {
                    thumb.classList.add("pg-thumb-own");
                    thumb.append(h("div", { class: "pg-thumb-roots" }, ...ROOT_ICONS.map(icon)));
                  } else if (starter.id === "fix-the-diagnostics") {
                    thumb.classList.add("pg-thumb-own");
                    thumb.append(h("div", { class: "pg-thumb-lines" }, h("i", { "data-w": true }), h("i", { "data-e": true }), h("i"), h("i", { "data-e": true }), h("i", { "data-w": true })));
                  }
                  return h(
                    "button",
                    { class: "pg-card", type: "button", "data-starter": starter.id, onclick: () => void this.choose(starter.id) },
                    thumb,
                    h("div", { class: "pg-card-text" }, h("span", { class: "pg-card-title" }, starter.title, h("span", { class: "pg-card-root" }, `<${starter.root}>`)), h("p", null, starter.description)),
                  );
                }),
            ),
          ),
        ),
      );
      void this.fillThumbs();
    }
    for (const card of body.querySelectorAll<HTMLElement>("[data-starter]")) card.setAttribute("aria-current", String(card.dataset.starter === current));
    this.dialog.showModal();
  }

  private async choose(id: string) {
    const starter = await this.find(id);
    if (!starter) return;
    this.dialog.close();
    this.pick(starter);
  }

  /** Each example's thumbnail: the site's own rendering of it, in a frame that runs nothing, drawn when it scrolls into view. */
  private async fillThumbs() {
    let starters: Starter[];
    try {
      starters = await this.all();
    } catch {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          observer.unobserve(entry.target);
          const thumb = entry.target as HTMLElement;
          const starter = starters.find((each) => this.thumbs.get(each.id) === thumb);
          if (!starter?.html) continue;
          const width = widthOf(starter);
          const scale = thumb.clientWidth / width;
          const frame = h("iframe", { sandbox: "", tabindex: -1, "aria-hidden": "true", loading: "lazy", width, height: Math.ceil(thumb.clientHeight / scale), style: `transform:scale(${scale})` });
          frame.srcdoc = starter.html.replaceAll("https://hyperelements.dev/img/", "/img/");
          thumb.append(frame);
        }
      },
      { root: this.dialog, rootMargin: "200px" },
    );
    for (const [id, thumb] of this.thumbs) if (starters.find((each) => each.id === id)?.html) observer.observe(thumb);
    // The first starter's thumbnail is what it's about: itself, as each of its four outputs.
    const first = starters.find((each) => each.id === "four-outputs");
    const tile = this.thumbs.get("four-outputs");
    if (!first || !tile || !this.outputs) return;
    try {
      const drawn = await this.outputs(first);
      if (drawn.length !== 4) return;
      const cells = drawn.map(() => h("div", { class: "pg-thumb-cell" }));
      tile.classList.remove("pg-thumb-own");
      tile.classList.add("pg-thumb-mosaic");
      tile.replaceChildren(...cells);
      drawn.forEach(({ html, width }, index) => {
        const scale = cells[index].clientWidth / width;
        const frame = h("iframe", { sandbox: "", tabindex: -1, "aria-hidden": "true", width, height: Math.ceil(cells[index].clientHeight / scale), style: `transform:scale(${scale})` });
        frame.srcdoc = html;
        cells[index].append(frame);
      });
    } catch {
      // The icons stay.
    }
  }
}
