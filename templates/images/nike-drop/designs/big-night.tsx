import NikeDrop from "../template";

export const meta = { label: "Jersey drop" };

export default function BigNight() {
  return (
    <NikeDrop
      eyebrow="Just dropped"
      headline="Made for the big night"
      description="Brazil Stadium Away. Women's Dri-FIT Soccer Jersey."
      availability="Available now"
      product={{ src: "https://hyperelements.dev/generated/gallery/assets/companies/nike/product.jpg", width: 560, height: 560 }}
      productAlt="Brazil Stadium Away Women's Dri-FIT Soccer Jersey"
    />
  );
}
