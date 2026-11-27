/**
 * Whether a Document's pages are flowed: any page's content that runs past its room.
 */
import type { Page, PlacedPage } from "@hyper-elements/core/pdf";

/**
 * How far past its room a page's content must run to be flowed: a document that fits, give or take the engine's
 * rounding, is drawn as it always was.
 */
const ROUNDING = 0.5;

const inside = (path: string, of: string) => path === of || path.startsWith(`${of}.`);

/** Whether any page's content (not its header or footer) runs past its room. */
export function overflows(pages: Page[], placed: PlacedPage[]): boolean {
  return placed.some(({ room, blocks }, i) => {
    const outside = [pages[i]?.header?.path, pages[i]?.footer?.path].filter((path): path is string => path !== undefined);
    return blocks.some((block) => !outside.some((path) => inside(block.path, path)) && block.y + block.height > room.bottom + ROUNDING);
  });
}
