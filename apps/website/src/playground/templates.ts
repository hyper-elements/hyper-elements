// The Template menu: under its button in the bar, the templates of the root that's picked, each with a thumbnail of
// it and the one that's up marked. Their code and the site's rendering of each (/playground/starters.json) are fetched
// when the menu first opens.
import { h } from "./dom";

export interface StarterInfo {
  id: string;
  title: string;
  description: string;
  root: "Email" | "Page" | "Document" | "Canvas";
}
export interface Starter extends StarterInfo {
  source: string;
  /** Its HTML as the site rendered it, for its thumbnail. */
  html?: string;
}

/** Templates under an id they had before, so a link that names it (`#starter=`) still opens them. */
const RENAMED: Record<string, string> = { "release-notes": "growth-report" };

/** A thumbnail's box, in CSS pixels (.pg-template-thumb in playground.css). */
const THUMB = { width: 84, height: 63 };

/** The width a template is laid out at for its thumbnail, as the site's template gallery draws them. */
const widthOf = (starter: Starter) =>
  starter.root === "Canvas" ? Number(/<Canvas[^>]*?\swidth=\{(\d+)\}/.exec(starter.source)?.[1] ?? 1200) : starter.root === "Page" ? 1200 : starter.root === "Document" ? 794 : 640;

export class Templates {
  private loading: Promise<Starter[]> | undefined;
  private button: HTMLButtonElement;
  private menu: HTMLElement;
  /** Each template's row, made once: its thumbnail's frame stays loaded from one opening to the next. */
  private rows = new Map<string, HTMLElement>();
  private drawn = new Set<string>();

  constructor(
    private host: HTMLElement,
    private list: StarterInfo[],
    /** The template that's up (none where the code isn't one), and the root whose templates are listed. */
    private now: () => { current: string | null; root: StarterInfo["root"] | null },
    private pick: (starter: Starter) => void,
  ) {
    this.button = host.querySelector<HTMLButtonElement>("[data-templates-open]")!;
    this.menu = host.querySelector<HTMLElement>("[data-templates-list]")!;
    for (const starter of list) {
      const row = h(
        "button",
        { type: "button", role: "menuitemradio", class: "pg-template", "aria-checked": "false", "data-starter": starter.id, "data-starter-root": starter.root, onclick: () => void this.choose(starter.id) },
        h("span", { class: "pg-template-thumb", "aria-hidden": "true" }),
        h("span", { class: "pg-template-text" }, h("span", { class: "pg-template-title" }, starter.title), h("small", { class: "pg-template-note" }, starter.description)),
      );
      this.rows.set(starter.id, row);
    }
    this.menu.replaceChildren(...this.rows.values());
    this.button.addEventListener("click", () => (this.menu.hidden ? this.open() : this.close()));
    document.addEventListener("click", (event) => !host.contains(event.target as Node) && this.close());
    host.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !this.menu.hidden) {
        this.close();
        this.button.focus();
        return;
      }
      if (this.menu.hidden || !["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
      // Up and down the list, as a menu goes.
      event.preventDefault();
      const items = [...this.menu.querySelectorAll<HTMLElement>("[role=menuitemradio]:not([hidden])")];
      const at = items.indexOf(document.activeElement as HTMLElement);
      const to = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (at + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      items[to]?.focus();
    });
  }

  /** Every template with its code. */
  all(): Promise<Starter[]> {
    this.loading ??= fetch("/playground/starters.json").then((response) => {
      if (!response.ok) throw new Error(`starters.json: ${response.status}`);
      return response.json() as Promise<Starter[]>;
    });
    this.loading.catch(() => (this.loading = undefined));
    return this.loading;
  }

  async find(id: string): Promise<Starter | undefined> {
    id = RENAMED[id] ?? id;
    try {
      return (await this.all()).find((starter) => starter.id === id);
    } catch {
      return undefined;
    }
  }

  open() {
    const { current, root } = this.now();
    for (const [id, row] of this.rows) {
      row.hidden = Boolean(root) && row.dataset.starterRoot !== root;
      row.setAttribute("aria-checked", String(id === current));
    }
    this.menu.hidden = false;
    this.menu.scrollTop = 0;
    this.button.setAttribute("aria-expanded", "true");
    const on = this.menu.querySelector<HTMLElement>("[aria-checked=true]:not([hidden])") ?? this.menu.querySelector<HTMLElement>("[role=menuitemradio]:not([hidden])");
    on?.focus();
    on?.scrollIntoView({ block: "nearest" });
    void this.drawThumbs();
  }

  close() {
    if (this.menu.hidden) return;
    this.menu.hidden = true;
    this.button.setAttribute("aria-expanded", "false");
  }

  private async choose(id: string) {
    this.close();
    const starter = await this.find(id);
    if (starter) this.pick(starter);
  }

  /** The thumbnails of the templates listed: the site's rendering of each, scaled into its box, in a frame that runs nothing. */
  private async drawThumbs() {
    let starters: Starter[];
    try {
      starters = await this.all();
    } catch {
      return;
    }
    for (const starter of starters) {
      const row = this.rows.get(starter.id);
      if (!row || row.hidden || this.drawn.has(starter.id) || !starter.html) continue;
      this.drawn.add(starter.id);
      const width = widthOf(starter);
      const scale = THUMB.width / width;
      const frame = h("iframe", { sandbox: "", tabindex: -1, title: "", width, height: Math.ceil(THUMB.height / scale), style: `transform:scale(${scale})` });
      frame.srcdoc = starter.html.replaceAll("https://hyperelements.dev/img/", "/img/");
      row.querySelector(".pg-template-thumb")!.append(frame);
    }
  }
}
