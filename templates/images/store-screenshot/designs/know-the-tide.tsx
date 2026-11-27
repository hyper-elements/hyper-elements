import StoreScreenshot from "../template";

export const meta = { label: "Tidewise, iPhone 6.9\"" };

export default function KnowTheTide() {
  return (
    <StoreScreenshot
      app="Tidewise"
      headline="Know the tide before you leave."
      subhead="High and low water for 1,400 beaches, to the minute."
      screenshot={{ src: "https://hyperelements.dev/generated/gallery/assets/images/store-screenshot/today.png", width: 1320, height: 2868 }}
      size="iphone69"
      backdrop="brand"
      pattern="contours"
    />
  );
}
