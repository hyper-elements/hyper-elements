import { Email, Row } from "@hyper-elements/react";
import { ProductCard } from "./product-card";

const poster = {
  src: "https://hyperelements.dev/img/gradient.png",
  width: 1200,
  height: 500,
};
const weekly = {
  src: "https://hyperelements.dev/img/newsletter-hero.png",
  width: 1200,
  height: 500,
};

export default function Shop() {
  return (
    <Email width={600} lang="en" previewText="Two new arrivals this week, picked for you.">
      <Row style={{ gap: 16 }}>
        <ProductCard
          id="first"
          name="Night poster"
          photo={poster}
          href="https://example.com/p/1"
          price="$48.00"
        />
        <ProductCard
          id="second"
          name="The Weekly Signal"
          photo={weekly}
          href="https://example.com/p/2"
          size="large"
          soldOut
        />
      </Row>
    </Email>
  );
}
