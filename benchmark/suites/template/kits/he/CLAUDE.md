# Conventions

You're making one issue of Orbit's newsletter, The Orbit Dispatch. The brief is in BRIEF.md.

- Orbit's newsletter is a template, templates/newsletter.tsx (`orbit.Newsletter`): its header, footer, heading and brand styles are its own. Write the issue in designs/newsletter.tsx, a design whose root is the template, its fields as props:

  ```tsx
  import { Button, Column, Heading, Image, Text } from "@hyper-elements/react";
  import Newsletter from "../templates/newsletter";

  export default () => <Newsletter preview="…" heading="…" body={<Column>…</Column>} />;
  ```

- The body is written only with Column, Heading, Text, Image, Button and Link, with no styles of its own (the template's theme styles them), and has at least one Button. An Image's src is { src, width, height }, its file's size. Links stay on orbit.dev, with ?utm_source=newsletter.
- `node tools/render.mjs` renders it to out/email.html. The template refuses a body that breaks its rules, and says why.
- `npx tsc --noEmit` type-checks it.
- `node tools/check.mjs` checks out/email.html in a browser, at a desktop and a phone width. The newsletter is done when it passes.
- The images are already hosted at https://assets.orbit.dev/img/.
- Don't change anything in tools/.
- Don't change templates/.

@docs/TEMPLATES.md
@docs/GUIDE.md
