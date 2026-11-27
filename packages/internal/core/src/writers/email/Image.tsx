/**
 * An Image: its width attribute in px (Word's size for it), fluid elsewhere
 * (100% of its cell, its width at most), its height in proportion where the
 * file's size is known. With a background color, that's what shows where it
 * doesn't load, its alternate text in the text's color and font (a picture of
 * a Canvas has its background).
 */
import { assetParts, opaqueRgb, type Asset } from "../../kinds";
import { h, type Style } from "../jsx";
import type { Component } from "./context";
import { fluidImage, PLACE, toNumber } from "./layout";
import { hiding } from "./styles";

export const Image: Component = ({ node, style, mobile, parent, fill, inline }) => {
  const { src, width: fileWidth, height: fileHeight } = assetParts(node.props.src as Asset);
  const width = node.width ?? undefined;
  const height = style.height !== undefined ? toNumber(style.height) : undefined;
  const fluid = fluidImage(node, style, mobile, fill);
  // In a stack or a Row its cell hides it; in a link, its own style.
  const hidden: { class?: string; style: Style } = parent.type === "Link" ? hiding(node, "block") : { style: {} };
  // Where it doesn't load: its background, and its alt text in the text's font, in a color that reads on it.
  const placeholder: Style =
    style.backgroundColor !== undefined
      ? { backgroundColor: style.backgroundColor, color: readableOn(String(style.backgroundColor), node.text.color), fontFamily: node.text.fontFamily, fontSize: `${node.text.fontSize}px`, lineHeight: `${node.text.lineHeightPx}px` }
      : {};
  return (
    <img
      id={node.id}
      class={hidden.class}
      phone={fluid.phone}
      src={src}
      alt={(node.props.alt as string) ?? ""}
      title={node.props.title as string | undefined}
      width={width}
      // Its height in proportion, for Word, when the file's size is known.
      height={height ?? (width !== undefined && fileWidth && fileHeight ? Math.round((fileHeight * width) / fileWidth) : undefined)}
      border="0"
      style={[
        // Among text it's in the line.
        { display: inline ? "inline-block" : "block", verticalAlign: style.verticalAlign, ...fluid.style, height: height ?? "auto", border: "0" },
        { border: style.border, borderRadius: style.borderRadius },
        placeholder,
        PLACE[style.alignSelf as string],
        hidden.style,
      ]}
    />
  );
};

/** An opaque color's relative luminance (WCAG); undefined for a see-through one, which shows what's behind it. */
function luminance(color: string): number | undefined {
  const rgb = opaqueRgb(color.trim());
  if (!rgb) return undefined;
  const [r, g, b] = rgb.map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/** The text's color where it reads on the background (WCAG's 4.5:1), else black or white, whichever reads better. */
function readableOn(background: string, text: string): string {
  const behind = luminance(background);
  if (behind === undefined) return text;
  const ratio = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  const own = luminance(text);
  if (own !== undefined && ratio(own, behind) >= 4.5) return text;
  return ratio(1, behind) >= ratio(0, behind) ? "#ffffff" : "#000000";
}
