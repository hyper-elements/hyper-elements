import { Column, Email, Heading, Image, Layer } from "@hyper-elements/react";

const photo = {
  src: "https://hyperelements.dev/img/gradient.png",
  width: 1200,
  height: 500,
};

export default function Example() {
  return (
    <Email width={600}>
      <Layer id="layer" style={{ height: 240, alignItems: "end" }}>
        <Image src={photo} alt="" />
        <Column id="words" style={{ padding: 32 }}>
          <Heading level={2} style={{ color: "#ffffff" }}>Spring collection</Heading>
        </Column>
      </Layer>
    </Email>
  );
}
