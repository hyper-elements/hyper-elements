/** The shop's weekly email two ways: as the email it is, and as the editor's design JSON, each component a block of its own tool. */
import { render } from "@hyper-elements/react";
import { toDesign } from "@hyper-elements/react/builder";
import Weekly from "./email";

export const { html } = await render(<Weekly />);
export const { design, report } = toDesign(<Weekly />, { customTools: true });
