/** The dispatch two ways: as the email it is, and as the editor's design JSON, each of Oyen's components a block of its own tool. */
import { render } from "@hyper-elements/react";
import { toDesign } from "@hyper-elements/react/builder";
import Dispatch from "./email";

export const { html } = await render(<Dispatch />);
export const { design, report } = toDesign(<Dispatch />, { customTools: true });
