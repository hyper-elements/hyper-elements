import StoreScreenshot from "../template";

export const meta = { label: "Tidewise, Google Play" };

export default function EveryBeach() {
  return (
    <StoreScreenshot
      app="Tidewise"
      headline="Find the beach that suits the tide."
      subhead="Swim, surf or rock pools: sorted by what the tide is doing."
      screenshot={{ src: "https://hyperelements.dev/generated/gallery/assets/images/store-screenshot/beaches-android.png", width: 1080, height: 2347 }}
      size="play"
      backdrop="paper"
      pattern="none"
    />
  );
}
