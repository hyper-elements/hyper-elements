import Speaker from "../template";

export const meta = { label: "Design Week keynote" };

export default function DesignWeek() {
  return (
    <Speaker
      photo={{ src: "https://hyperelements.dev/generated/gallery/assets/images/recipient.jpg", width: 600, height: 600 }}
      name="Tomas Achterberg"
      role="Head of product design, Fernway Studio Collective"
      talk="Small teams, big launches: planning a release with three people and one week"
      date="Oct 2–3"
      event="Harbor Design Week, online"
    />
  );
}
