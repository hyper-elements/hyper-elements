import Speaker from "../template";

export const meta = { label: "Build Day speaker" };

export default function BuildDay() {
  return (
    <Speaker
      photo={{ src: "https://hyperelements.dev/generated/gallery/assets/images/speaker.jpg", width: 800, height: 800 }}
      name="Rosa Lindqvist"
      role="Staff engineer, Northwind"
      talk="Shipping weekly without breaking anything"
      date="May 14"
      event="Build Day"
    />
  );
}
