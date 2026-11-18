import { Email } from "@hyper-elements/react";
import { ProductCard } from "../product-card";

const poster = { src: "https://hyperelements.dev/img/gradient.png", width: 1200, height: 500 };

export default function Huge() {
  return (
    <Email width={600} lang="en">
      {/* @ts-expect-error: "huge" isn't one of its sizes */}
      <ProductCard name="Night poster" photo={poster} href="https://example.com/p/1" size="huge" />
    </Email>
  );
}
