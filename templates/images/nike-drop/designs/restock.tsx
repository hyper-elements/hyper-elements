import NikeDrop from "../template";

export const meta = { label: "Back in stock" };

export default function Restock() {
  return (
    <NikeDrop
      eyebrow="Back in stock"
      headline="Unbeatable in every size"
      description="Brazil Stadium Away. Women's Dri-FIT Soccer Jersey, from XS to XXL."
      price={90}
      availability="Available June 6"
      product={{ src: "https://hyperelements.dev/generated/gallery/assets/companies/nike/product.jpg", width: 560, height: 560 }}
      productAlt="Brazil Stadium Away Women's Dri-FIT Soccer Jersey"
    />
  );
}
