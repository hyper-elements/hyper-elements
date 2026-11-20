import { categories } from "./discover";

const GROUPS = ["Account", "Billing", "Orders", "Launches", "Content", "Events", "Social", "People", "Records", "Marketing"];
const ROOTS = ["Email", "Page", "Document", "Canvas"];

for (const { id, category } of await categories()) {
  it(`${id} is a category`, () => {
    expect(GROUPS).toContain(category.group);
    for (const key of ["label", "useWhen", "avoidWhen"]) expect(typeof category[key], `${id}.${key}`).toBe("string");
    expect((category.useWhen as string).length).toBeLessThanOrEqual(200);
    expect((category.avoidWhen as string).length).toBeLessThanOrEqual(200);
    expect((category.roots as string[]).length).toBeGreaterThan(0);
    for (const root of category.roots as string[]) expect(ROOTS).toContain(root);
  });
}
