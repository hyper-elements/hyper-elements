import { Canvas, Column, Heading, Image, Row, Text, token } from "@hyper-elements/react";
import type { Brand } from "../_brand";

export const meta = {
  label: "Product drop post",
  category: "announcement",
  description: "A new product for a social feed, 1080 by 1080: a huge headline in capitals, what it is and when, and the product's photo on a pale panel",
  recreates: { company: "nike", what: "product drop post", original: "https://www.instagram.com/nike/" },
};

const PRODUCT = "https://hyperelements.dev/generated/gallery/assets/companies/nike/product.jpg";

export default function NikeDrop({ brand }: { brand: Brand }) {
  const host = new URL(brand.links.site).host.replace(/^www\./, "");
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
            <Text style={{ fontSize: 28, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", color: token("colors.muted") }}>Just dropped</Text>
            <Heading level={1} fit={{ sizes: [104, 92, 80], maxLines: 4 }} style={{ lineHeight: 0.95, letterSpacing: -3, textTransform: "uppercase" }}>
              Made for the big night
            </Heading>
            <Text style={{ fontSize: 30, lineHeight: 1.35 }}>Brazil Stadium Away. Women's Dri-FIT Soccer Jersey.</Text>
          </Column>
          <Column style={{ gap: 6 }}>
            <Text style={{ fontSize: 28, fontWeight: 700 }}>Available now</Text>
            <Text style={{ fontSize: 26, color: token("colors.muted") }}>{host}</Text>
          </Column>
        </Column>
        <Column style={{ width: 540, height: 1080, padding: 48, backgroundColor: token("colors.surface"), justifyContent: "center", alignItems: "center" }}>
          <Image
            src={{ src: PRODUCT, width: 560, height: 560 }}
            alt="Brazil Stadium Away Women's Dri-FIT Soccer Jersey"
            style={{ width: 444, border: { width: 1, style: "solid", color: token("colors.border") } }}
          />
        </Column>
      </Row>
    </Canvas>
  );
}
