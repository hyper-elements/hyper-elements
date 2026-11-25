import Announcement from "../template";

export const meta = { label: "Shared boards launch" };

// No screenshot: the artwork fills the window's place.
export default function SharedBoards() {
  return (
    <Announcement
      eyebrow="June 3"
      headline="Shared boards for every team you work with, inside and out"
      features={["Invite guests in one click", "Cards that stay in sync", "A calmer layout for guests", "Comments that reach the right person"]}
      artwork={{ src: "https://hyperelements.dev/generated/gallery/assets/images/shapes.png", width: 1600, height: 1200 }}
    />
  );
}
