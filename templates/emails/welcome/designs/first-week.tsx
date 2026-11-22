import Welcome from "../template";

export const meta = { label: "First week" };

export default function FirstWeek() {
  return (
    <Welcome
      preview="Three ways to get started, Ada"
      heading="Glad you're here, Ada"
      intro="Here's how to get the most from your first week. It takes about ten minutes."
      steps={[
        { title: "Invite your team", detail: "Everyone sees the same work, and nothing gets lost in email." },
        { title: "Connect your calendar", detail: "Plan the week around the time you actually have." },
        { title: "Start your first project", detail: "Pick a template, or begin with a blank page." },
      ]}
      buttonLabel="Start your first week"
      buttonLink="https://orbit.example/start"
    />
  );
}
