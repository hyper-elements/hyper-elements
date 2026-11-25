import Certificate from "../template";

export const meta = { label: "Accessible design" };

export default function AccessibleDesign() {
  return (
    <Certificate
      recipient="Ada Park"
      photo={{ src: "https://hyperelements.dev/generated/gallery/assets/images/recipient.jpg", width: 600, height: 600 }}
      achievement="Completed the Foundations of Accessible Design course, with distinction"
      dateAwarded="June 20"
      level="Merit"
    />
  );
}
