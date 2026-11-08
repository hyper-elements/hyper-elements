/**
 * Conditional comments, resolved the way classic Outlook resolves them: it is "mso" (Microsoft
 * Office) version 16 and not "IE". A true block's content is kept as markup, a false one's is
 * dropped. Both forms:
 *   hidden from browsers:   <!--[if mso]> … <![endif]-->
 *   shown to browsers:      <!--[if !mso]><!--> … <!--<![endif]-->
 */

const MSO_VERSION = 16;

/** Evaluates a condition such as `mso`, `gte mso 9`, `(mso)|(IE)`, `(!mso)&(!IE)`. */
export function evaluate(condition) {
  const tokens = condition.match(/\(|\)|!|&|\||\b(?:gte|gt|lte|lt)\b|\bmso\b|\bIE\b|\d+(?:\.\d+)?/gi) ?? [];
  let i = 0;
  const peek = () => tokens[i];
  const next = () => tokens[i++];

  function term() {
    const t = next();
    if (t === "!") return !term();
    if (t === "(") {
      const value = or();
      next(); // ")"
      return value;
    }
    let op = null;
    let name = t;
    if (/^(gte|gt|lte|lt)$/i.test(t)) {
      op = t.toLowerCase();
      name = next();
    }
    let version = null;
    if (peek() && /^\d/.test(peek())) version = Number(next());
    if (/^ie$/i.test(name)) return false;
    if (!/^mso$/i.test(name)) throw new Error(`Unknown conditional comment feature: ${name} in [if ${condition}]`);
    if (version === null) return true;
    if (op === "gte") return MSO_VERSION >= version;
    if (op === "gt") return MSO_VERSION > version;
    if (op === "lte") return MSO_VERSION <= version;
    if (op === "lt") return MSO_VERSION < version;
    return MSO_VERSION === version;
  }
  function and() {
    let value = term();
    while (peek() === "&") {
      next();
      value = term() && value;
    }
    return value;
  }
  function or() {
    let value = and();
    while (peek() === "|") {
      next();
      value = and() || value;
    }
    return value;
  }
  return or();
}

/** The HTML with every conditional comment resolved for Outlook. */
export function resolveConditionalComments(html) {
  // Shown to browsers: <!--[if X]><!--> content <!--<![endif]-->
  html = html.replace(/<!--\[if ([^\]]+)\]><!-->([\s\S]*?)<!--<!\[endif\]-->/gi, (_, condition, content) =>
    evaluate(condition) ? content : "",
  );
  // Hidden from browsers: <!--[if X]> content <![endif]-->
  html = html.replace(/<!--\[if ([^\]]+)\]>([\s\S]*?)<!\[endif\]-->/gi, (_, condition, content) =>
    evaluate(condition) ? content : "",
  );
  return html;
}
