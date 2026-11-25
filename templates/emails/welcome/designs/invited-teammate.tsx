import Welcome from "../template";

export const meta = { label: "Invited teammate" };

export default function InvitedTeammate() {
  return (
    <Welcome
      preview="Your team is already here, Tomas. Two things to do first."
      heading="Your team is waiting, Tomas"
      intro="Priya added you to the Design workspace. Two quick things, and you'll be working alongside everyone."
      steps={[
        { title: "Add a photo", detail: "So your teammates know who left the comment." },
        { title: "Open the team board", detail: "See what everyone is working on this week, and pick up a card." },
      ]}
      buttonLabel="Open the team board"
      buttonLink="https://orbit.example/workspace/design"
    />
  );
}
