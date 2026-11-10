// Elements made in script, with what the sandbox answered as text: never as markup.

type Child = Node | string | number | null | undefined | false;

/** An element: `class`, `data-*` and other attributes by name, `on*` listeners, then its children as nodes or text. */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props?: Record<string, unknown> | null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(props ?? {})) {
    if (value === undefined || value === null || value === false) continue;
    if (name.startsWith("on") && typeof value === "function") element.addEventListener(name.slice(2), value as EventListener);
    else if (name === "class") element.className = String(value);
    else element.setAttribute(name, value === true ? "" : String(value));
  }
  element.append(...children.filter((child): child is Node | string | number => child !== null && child !== undefined && child !== false).map((child) => (typeof child === "number" ? String(child) : child)));
  return element;
}

export const $ = <T extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document): T => {
  const found = root.querySelector<T>(selector);
  if (!found) throw new Error(`The playground's page has no ${selector}`);
  return found;
};

export const $$ = <T extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document): T[] => [...root.querySelectorAll<T>(selector)];

export const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

export const bytes = (size: number) => (size < 1000 ? `${size} B` : size < 1e6 ? `${(size / 1000).toFixed(size < 1e4 ? 1 : 0)} kB` : `${(size / 1e6).toFixed(1)} MB`);

/** A file the visitor asked for, saved by the browser. */
export function download(name: string, content: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = h("a", { href: url, download: name });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
