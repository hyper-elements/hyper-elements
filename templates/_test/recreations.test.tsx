import { ASSETS } from "../_brand";
import { brand as orbit } from "../_brands/orbit";
import { designs, kits } from "./discover";
import { treeFacts } from "./tree";
import { recreationProblems } from "./recreations";

/** Every image a kit's designs show in the kit's own brand (the first sample's otherwise), but the brand's logo. */
async function imagesOf(kit: string, brand = orbit): Promise<string[]> {
  const out = new Set<string>();
  for (const t of (await designs()).filter((x) => x.kit === kit)) {
    for (const src of treeFacts(<t.Design brand={brand} />).images) if (src.startsWith(ASSETS) && src !== brand.logo.src) out.add(src);
  }
  return [...out];
}

for (const k of await kits()) {
  it(`${k.id} holds to the recreation rules`, async () => {
    const mine = (await designs()).filter((t) => t.kit === k.id);
    const metas = mine.map((t) => ({ file: `${t.key}.tsx`, meta: t.meta }));
    const images = await imagesOf(k.id, k.brand);
    if (k.brand) images.push(k.brand.logo.src);
    expect(recreationProblems({ kit: k.id, ...(k.kit.recreates ? { recreates: k.kit.recreates } : {}), ...(k.brand ? { brand: k.brand } : {}), designs: metas, images })).toEqual([]);
  });
}

describe("the rules themselves", () => {
  const logo = `${ASSETS}recreations/acme/logo.png`;
  const brand = { ...orbit, name: "Acme", logo: { ...orbit.logo, src: logo } };
  const good = { kit: "acme", recreates: { company: "Acme" }, brand, designs: [{ file: "acme/emails/welcome.tsx", meta: { recreates: { what: "Welcome email", original: "https://example.com/archive/acme-welcome" } } }], images: [logo] };

  it("pass a recreation kit with its brand, what each template rebuilds and where the original is", () => {
    expect(recreationProblems(good)).toEqual([]);
  });
  it("fail a recreation without its company's brand, or without saying what it rebuilds and where the original is", () => {
    const { brand: _, ...noBrand } = good;
    expect(recreationProblems(noBrand).join("\n")).toMatch(/a recreation kit has its company's brand/);
    expect(recreationProblems({ ...good, designs: [{ file: "acme/emails/welcome.tsx", meta: { recreates: { what: "", original: "" } } }] }).join("\n")).toMatch(/what it rebuilds[\s\S]*where the original/);
    expect(recreationProblems({ ...good, designs: [{ file: "acme/emails/welcome.tsx", meta: { recreates: { what: "Welcome", original: "http://example.com" } } }] }).join("\n")).toMatch(/an https address/);
  });
  it("fail a recreation's image outside its own folder", () => {
    expect(recreationProblems({ ...good, images: [logo, `${ASSETS}kits/signal/artwork.png`] }).join("\n")).toMatch(/outside .*recreations\/acme\//);
  });
  it("fail a kit with a brand of its own, or a recreation's meta, that isn't a recreation", () => {
    const { recreates: _, ...plain } = good;
    expect(recreationProblems(plain).join("\n")).toMatch(/only a recreation kit has a brand/);
    expect(recreationProblems({ ...plain, brand: undefined }).join("\n")).toMatch(/meta\.recreates in a kit that isn't a recreation/);
  });
  it("hold the company's brand to the same checks as a sample brand", () => {
    const pale = { ...brand, theme: { ...(brand.theme as object), colors: { ...(brand.theme.colors as object), muted: "#d0d0d0" } } as never };
    expect(recreationProblems({ ...good, brand: pale }).join("\n")).toMatch(/acme\/brand\.ts: colors\.muted on colors\.background/);
  });
});
