// The kit's render: the launch's values (designs/launch.json) given to the template (templates/launch.tsx's render),
// in the format tools/render-launch.mjs asks for (LAUNCH_FORMAT).
import values from "../designs/launch.json";
import { render as renderLaunch } from "../templates/launch";

export default async function render() {
  return renderLaunch(values, (process.env.LAUNCH_FORMAT ?? "square") as "square" | "landscape");
}
