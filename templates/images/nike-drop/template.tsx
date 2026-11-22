/**
 * A new product for a social feed, 1080 by 1080. The logo, the site and the layout are locked; a design gives the line
 * above the headline, the headline in capitals (fitted to four lines), what the product is, its price, when it's
 * available, and its photo, shown whole on a pale panel. It's made from a brand (`nikeDrop(brand)`), which sets its colors, fonts,
 * logo and site.
 */
import { Canvas, Column, Heading, Image, Row, Text, prop, token } from "@hyper-elements/react";
import { field, fitInside, template } from "@hyper-elements/react/template";
import type { Brand } from "../../_brand";
import { brand } from "../../_companies/nike";

export const meta = {
  recreates: { company: "nike", what: "product drop post", original: "https://www.instagram.com/nike/" },
};

/** What fits at the smallest size, 64px, on four lines in the narrowest brand. */
const HEADLINE_MAX = 34;

const fields = {
  eyebrow: prop.text({ label: "Line above the headline", required: true, maxLength: 20, guidance: "What's happening, in two or three words: Just dropped" }),
  headline: prop.text({
    label: "Headline",
    required: true,
    maxLength: HEADLINE_MAX,
    // Drawn in capitals four lines deep in a narrow column: no word longer than what fits on a line at the smallest size.
    pattern: "^(?![\\s\\S]*\\S{12})[\\s\\S]*$",
    guidance: `A few short words, shown in capitals and fitted to four lines: up to ${HEADLINE_MAX} characters, no word longer than 11 letters`,
  }),
  description: prop.text({ label: "What it is", required: true, maxLength: 100, guidance: "The product's name and kind: up to 100 characters" }),
  price: prop.number({ label: "Price", min: 0, guidance: "What it costs, in the brand's currency" }),
  availability: prop.text({
    label: "Availability",
    required: true,
    maxLength: 24,
    pattern: "^(?![\\s\\S]*\\b(19|20)\\d{2}\\b)[\\s\\S]*$",
    guidance: "When it can be bought, with no year or weekday: Available now, or Available June 6",
  }),
  product: field.image({
    label: "Product photo",
    required: true,
    fit: "contain",
    aspect: { min: 0.6, max: 1.25 },
    minWidth: 444,
    accepts: ["png", "jpeg"],
    guidance: "The product alone on a plain light background, shown whole",
  }),
  productAlt: prop.text({ label: "Product photo's description", required: true, maxLength: 120, guidance: "What the photo shows, for someone who can't see it" }),
};

export function nikeDrop(brand: Brand) {
  return template({
    id: "images.NikeDrop",
    version: "1.0.0",
    label: "Product drop post",
    description: "A new product for a social feed, 1080 by 1080: a huge headline in capitals, what it is and when, and the product's photo on a pale panel",
    root: "Canvas",
    fields,
    rules: {
      require: { core: ["canvas/overflow", "image/overflow", "image/glyph", "image/fit"] },
      links: { domains: [...brand.links.domains] },
    },
    example: {
      eyebrow: "New colors",
      headline: "Built for match day",
      description: "Stadium Home. Men's Dri-FIT Soccer Jersey.",
      availability: "Available now",
      product: { src: "https://hyperelements.dev/generated/gallery/assets/companies/nike/product.jpg", width: 560, height: 560 },
      productAlt: "A soccer jersey",
    },
    render: (v) => {
      const host = new URL(brand.links.site).host.replace(/^www\./, "");
      const money = (n: number) => new Intl.NumberFormat(brand.lang ?? "en", { style: "currency", currency: brand.currency }).format(n);
      return (
        <Canvas width={1080} height={1080} fonts={brand.fonts} lang={brand.lang ?? "en"} dir={brand.dir} theme={brand.theme}>
          <Row style={{ height: 1080 }}>
            <Column style={{ width: 540, height: 1080, padding: [64, 56, 64, 64], justifyContent: "space-between" }}>
              <Image
                src={{ src: brand.logo.src, width: brand.logo.width, height: brand.logo.height }}
                alt={brand.logo.alt}
                style={{ width: Math.min(220, Math.round((56 * brand.logo.width) / brand.logo.height)) }}
              />
              <Column style={{ gap: 28 }}>
                <Text field="eyebrow" fit={{ maxLines: 1 }} style={{ fontSize: 28, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", color: token("colors.muted") }}>
                  {v.eyebrow}
                </Text>
                <Heading
                  field="headline"
                  level={1}
                  fit={{ sizes: [104, 92, 80, 72, 64], maxLines: 4 }}
                  style={{ lineHeight: 0.95, letterSpacing: -3, textTransform: "uppercase" }}
                >
                  {v.headline}
                </Heading>
                <Text field="description" style={{ fontSize: 30, lineHeight: 1.35 }}>
                  {v.description}
                </Text>
              </Column>
              <Column style={{ gap: 6 }}>
                {v.price !== undefined && (
                  <Text field="price" style={{ fontSize: 36, fontWeight: 700 }}>
                    {money(v.price)}
                  </Text>
                )}
                <Text field="availability" fit={{ maxLines: 1 }} style={{ fontSize: 28, fontWeight: 700 }}>
                  {v.availability}
                </Text>
                <Text style={{ fontSize: 26, color: token("colors.muted") }}>{host}</Text>
              </Column>
            </Column>
            <Column
              style={{ width: 540, height: 1080, padding: 48, backgroundColor: token("colors.surface"), justifyContent: "center", alignItems: "center" }}
            >
              <Image
                field="product"
                src={v.product}
                alt={v.productAlt}
                style={{ ...fitInside(v.product, { width: 444, height: 740 }), border: { width: 1, style: "solid", color: token("colors.border") } }}
              />
            </Column>
          </Row>
        </Canvas>
      );
    },
  });
}

export default nikeDrop(brand);
