import Announcement from "../template";

export const meta = { label: "Release notes launch" };

export default function ReleaseNotes() {
  return (
    <Announcement
      eyebrow="March 12"
      headline="Release notes that write themselves"
      features={["Drafts from merged changes", "Your voice, every release", "Ships to chat and email"]}
      screenshot={{ src: "https://hyperelements.dev/generated/gallery/assets/images/screenshot.png", width: 1600, height: 1000 }}
      artwork={{ src: "https://hyperelements.dev/generated/gallery/assets/images/artwork.png", width: 1600, height: 1200 }}
    />
  );
}
