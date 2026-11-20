import { ASSETS } from "../_brand";
import { brand as orbit } from "../_brands/orbit";
import { companies, designs } from "./discover";
import { treeFacts } from "./tree";
import { recreationProblems } from "./recreations";

const owned = await companies();
for (const t of (await designs()).filter((x) => x.meta.recreates)) {
  it(`${t.key} holds to the recreation rules`, () => {
    const brand = owned.find((c) => c.id === t.meta.recreates!.company)?.brand;
    const images = treeFacts(<t.Design brand={brand ?? orbit} />).images.filter((src) => src.startsWith(ASSETS));
    expect(recreationProblems({ file: `${t.key}.tsx`, recreates: t.meta.recreates!, ...(brand ? { brand } : {}), images })).toEqual([]);
  });
}

describe("the rules themselves", () => {
  const logo = `${ASSETS}companies/acme/logo.png`;
  const brand = { ...orbit, name: "Acme", logo: { ...orbit.logo, src: logo } };
  const good = { file: "emails/acme-welcome.tsx", recreates: { company: "acme", what: "welcome email", original: "https://example.com/archive/acme-welcome" }, brand, images: [logo] };

  it("pass a recreation in its company's brand, saying what it rebuilds and where the original is", () => {
    expect(recreationProblems(good)).toEqual([]);
  });
  it("fail a recreation without its company, its company's brand, or without saying what it rebuilds and where the original is", () => {
    const { brand: _, ...noBrand } = good;
    expect(recreationProblems(noBrand).join("\n")).toMatch(/drawn in its company's brand/);
    expect(recreationProblems({ ...good, recreates: { ...good.recreates, company: "" } }).join("\n")).toMatch(/names the company/);
    expect(recreationProblems({ ...good, recreates: { company: "acme", what: "", original: "" } }).join("\n")).toMatch(/what it rebuilds[\s\S]*where the original/);
    expect(recreationProblems({ ...good, recreates: { ...good.recreates, original: "http://example.com" } }).join("\n")).toMatch(/an https address/);
  });
  it("fail a recreation's image outside its company's folder", () => {
    expect(recreationProblems({ ...good, images: [logo, `${ASSETS}images/artwork.png`] }).join("\n")).toMatch(/outside .*companies\/acme\//);
  });
  it("hold the company's brand to the same checks as a sample brand", () => {
    const pale = { ...brand, theme: { ...(brand.theme as object), colors: { ...(brand.theme.colors as object), muted: "#d0d0d0" } } as never };
    expect(recreationProblems({ ...good, brand: pale }).join("\n")).toMatch(/_companies\/acme\.ts: colors\.muted on colors\.background/);
  });
});
