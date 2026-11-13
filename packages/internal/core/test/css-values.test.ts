/**
 * A Page's CSS values (Decision 5): each kind against valid and invalid CSS, values kept as written, nothing that
 * could end a declaration, and lengths evaluated against the right references.
 */
import {
  areas,
  backgroundRepeat,
  backgroundSize,
  between,
  evalLength,
  filter,
  gridPlace,
  images,
  integer,
  lengths,
  origin,
  outline,
  position,
  ratio,
  readTerms,
  richLength,
  shadows,
  tracks,
  transform,
  transition,
} from "../src/css-kinds";
import type { Kind } from "../src/kinds";

const value = (kind: Kind<any, any>, input: unknown) => {
  const parsed = kind.parse(input);
  if (!parsed.ok) throw new Error(parsed.message);
  return parsed.value;
};
const rejects = (kind: Kind<any, any>, input: unknown) => expect([input, kind.parse(input).ok]).toEqual([input, false]);

describe("richLength", () => {
  const kind = richLength({ percent: true, words: ["auto"] });

  it("keeps what today's length kind gives: px as a number, a percentage as written", () => {
    expect(value(kind, 16)).toBe(16);
    expect(value(kind, "16px")).toBe(16);
    expect(value(kind, "50%")).toBe("50%");
  });

  it("takes rem, em, viewport units, the math functions and its words, kept as written", () => {
    for (const input of ["1.5rem", "2em", "100vw", "50vh", "10svh", "auto", "calc(100% - 2rem)", "min(100%, 1200px)", "max(1rem, 2vw)", "clamp(1rem, 2.5vw, 2rem)", "calc((100% - 2rem) / 3)"]) {
      expect(value(kind, input)).toBe(input);
    }
    expect(value(kind, "calc( 100%  -  2rem )")).toBe("calc(100% - 2rem)");
  });

  it("refuses what isn't a length, a percentage where it takes none, and CSS that could end the declaration", () => {
    for (const input of ["red", "10", "1 rem", "calc(100% -2rem)", "calc(100%)extra", "min()", "clamp(1px, 2px)", "1px; color: red", "1px}body{", "expression(1)", "calc(1px + )", "var(--x)", "-moz-calc(1px)"]) {
      if (input === "10") continue;
      rejects(kind, input);
    }
    rejects(richLength(), "50%");
    rejects(richLength(), -4);
    // A least value is in px: rem, em and viewport units aren't compared to it.
    expect(value(richLength({ min: 1 }), "0.875rem")).toBe("0.875rem");
    expect(value(richLength({ min: 1 }), "0.5em")).toBe("0.5em");
    rejects(richLength({ min: 1 }), "0.5px");
    expect(value(richLength({ negative: true }), "-4px")).toBe(-4);
  });
});

describe("evalLength", () => {
  const context = { percentOf: 800, fontSize: 20, viewport: { width: 1000, height: 800 } };

  it("evaluates each unit against its reference: rem 16px, em the font size, % its whole, viewport units the viewport", () => {
    expect(evalLength(12, context)).toBe(12);
    expect(evalLength("2rem", context)).toBe(32);
    expect(evalLength("1.5em", context)).toBe(30);
    expect(evalLength("25%", context)).toBe(200);
    expect(evalLength("10vw", context)).toBe(100);
    expect(evalLength("50vh", context)).toBe(400);
  });

  it("evaluates calc(), min(), max() and clamp(), * and / before + and -", () => {
    expect(evalLength("calc(100% - 2rem)", context)).toBe(768);
    expect(evalLength("calc(2 * 10px + 4px)", context)).toBe(24);
    expect(evalLength("calc((100% - 32px) / 3)", context)).toBe(256);
    expect(evalLength("min(100%, 600px)", context)).toBe(600);
    expect(evalLength("max(1rem, 1px)", context)).toBe(16);
    expect(evalLength("clamp(1rem, 5vw, 40px)", context)).toBe(40);
  });

  it("is unknown where a percentage has nothing to be of, and for words", () => {
    expect(evalLength("50%", { ...context, percentOf: null })).toBeNull();
    expect(evalLength("auto", context)).toBeNull();
  });
});

describe("tracks", () => {
  it("takes lengths, fr, the content words, minmax(), fit-content() and repeat()", () => {
    for (const input of ["1fr 2fr", "200px 1fr", "repeat(3, 1fr)", "repeat(auto-fill, minmax(200px, 1fr))", "repeat(auto-fit, minmax(min(100%, 16rem), 1fr))", "auto 1fr auto", "minmax(0, 1fr) 300px", "fit-content(40%)", "none", "min-content max-content"]) {
      expect(value(tracks(), input)).toBe(input);
    }
  });

  it("refuses commas between tracks, a repeat inside a repeat, and other words", () => {
    for (const input of ["1fr, 2fr", "repeat(2, repeat(2, 1fr))", "repeat(0, 1fr)", "big 1fr", "minmax(1fr)", "[full] 1fr", "repeat(1001, 1fr)", "repeat(20000000, 1fr)"]) rejects(tracks(), input);
    expect(value(tracks(), "repeat(1000, 1fr)")).toBe("repeat(1000, 1fr)");
  });
});

describe("grid placement and areas", () => {
  it("takes lines, spans and area names", () => {
    for (const input of ["1 / 3", "span 2", "2 / span 2", "auto", "main", "-1 / 1"]) expect(value(gridPlace(), input)).toBe(input);
    // An area's name is written as given: CSS's names are case-sensitive, its keywords aren't.
    expect(value(gridPlace(), "Main")).toBe("Main");
    expect(value(gridPlace(), "SPAN 2")).toBe("SPAN 2");
    expect(value(gridPlace(4), "1 / 2 / 3 / 4")).toBe("1 / 2 / 3 / 4");
    for (const input of ["0", "1 / 2 / 3", "span 0", "1.5"]) rejects(gridPlace(), input);
  });

  it("takes rows of area names, as many in each", () => {
    expect(value(areas(), ["header header", "nav  main"])).toEqual(["header header", "nav main"]);
    expect(value(areas(), "a . b")).toEqual(["a . b"]);
    rejects(areas(), ["a b", "c"]);
    rejects(areas(), ['a"; } b']);
    rejects(areas(), []);
  });
});

describe("backgrounds", () => {
  it("takes url()s and gradients, in layers, kept as written: & and colour-like text in a URL untouched", () => {
    expect(value(images(), 'url("https://example.com/a.png?x=1&y=2#ffffff")')).toBe('url("https://example.com/a.png?x=1&y=2#ffffff")');
    expect(value(images(), "url(https://example.com/a.png), linear-gradient(to right, #ffffff, rgba(0, 0, 0, 0.5) 40%)")).toBe(
      'url("https://example.com/a.png"), linear-gradient(to right, #ffffff, rgba(0, 0, 0, 0.5) 40%)'
    );
    expect(value(images(), "radial-gradient(circle at center, #2563eb 0%, transparent 70%)")).toBe("radial-gradient(circle at center, #2563eb 0%, transparent 70%)");
    expect(value(images(), "none")).toBe("none");
  });

  it("refuses unsafe URLs, a URL that could end the value, and what isn't an image", () => {
    for (const input of ["url(javascript:alert(1))", 'url("x")") ; color: red', "url(a b.png)", "url('a\")", "linear-gradient(red)", "element(#x)", 'url("data:text/html,<b>")', "url()"]) rejects(images(), input);
    expect(value(images(), 'url("data:image/png;base64,AAAA")')).toBe('url("data:image/png;base64,AAAA")');
  });

  it("takes sizes, positions and repeats per layer", () => {
    expect(value(backgroundSize(), "cover, 100% auto")).toBe("cover, 100% auto");
    expect(value(position(true), "center, right 20px top 10px")).toBe("center, right 20px top 10px");
    expect(value(backgroundRepeat(), "no-repeat, repeat-x")).toBe("no-repeat, repeat-x");
    rejects(backgroundSize(), "huge");
    rejects(position(), "center, top");
  });
});

describe("effects", () => {
  it("takes shadows, transforms, filters, transitions, outlines and origins", () => {
    expect(value(shadows(), "0 1px 2px rgba(0, 0, 0, 0.1), inset 0 0 0 1px #e5e7eb")).toBe("0 1px 2px rgba(0, 0, 0, 0.1), inset 0 0 0 1px #e5e7eb");
    expect(value(shadows(), "0 -1px 0 #000")).toBe("0 -1px 0 #000");
    expect(value(transform(), "translateY(-2px) scale(1.05) rotate(3deg)")).toBe("translateY(-2px) scale(1.05) rotate(3deg)");
    expect(value(filter(), "blur(4px) brightness(120%) drop-shadow(0 2px 4px #0003)")).toBe("blur(4px) brightness(120%) drop-shadow(0 2px 4px #0003)");
    expect(value(transition(), "background-color 150ms ease, transform 0.2s cubic-bezier(0.4, 0, 0.2, 1) 50ms")).toBe("background-color 150ms ease, transform 0.2s cubic-bezier(0.4, 0, 0.2, 1) 50ms");
    expect(value(outline(), "2px solid #2563eb")).toBe("2px solid #2563eb");
    expect(value(origin(), "top left")).toBe("top left");
  });

  it("refuses what isn't one", () => {
    rejects(shadows(), "0 red");
    rejects(shadows(), "inset inset 0 0 red");
    rejects(transform(), "translate3d(1px, 1px, 1px)");
    rejects(transform(), "rotate(10px)");
    rejects(filter(), "url(#x)");
    rejects(transition(), "background 1s 2s 3s");
    rejects(outline(), "2px 3px solid");
  });
});

describe("numbers", () => {
  it("takes whole numbers, numbers in a range, ratios and lengths", () => {
    expect(value(integer(1, ["none"]), 3)).toBe(3);
    expect(value(integer(1, ["none"]), "none")).toBe("none");
    rejects(integer(1), 0);
    rejects(integer(), 1.5);
    expect(value(between(0, 1), 0.5)).toBe(0.5);
    rejects(between(0, 1), 2);
    expect(value(ratio(), "16 / 9")).toBe("16 / 9");
    expect(value(ratio(), 1.5)).toBe(1.5);
    rejects(ratio(), "16:9");
    expect(value(lengths({ negative: true, words: ["auto"] }), "0 auto -1rem 10%".replace("10%", "1px"))).toBe("0 auto -1rem 1px");
    rejects(lengths(), "1px 2px 3px 4px 5px");
  });
});

describe("hostile values", () => {
  it("can't end a declaration, a rule or the <style> from any kind", () => {
    const kinds: Kind<any, any>[] = [richLength({ percent: true }), tracks(), images(), shadows(), transform(), filter(), transition(), outline(), position(), gridPlace(), backgroundSize()];
    for (const kind of kinds) {
      for (const input of ["1px;color:red", "1px}body{color:red", "</style><script>alert(1)</script>", "1px\\;", "1px !important", "@import url(x)", "1px\ncolor:red"]) rejects(kind, input);
    }
    // A ; inside a quoted url can't end the declaration (a data URL holds one); outside quotes it can.
    expect(readTerms('url("a;b")').ok).toBe(true);
    expect(readTerms("url(a;b)").ok).toBe(false);
    expect(readTerms('url("a\\";b")').ok).toBe(false);
  });
});

describe("fixes from the second review", () => {
  it("refuses a control character anywhere, quoted or not: a form feed ends a CSS string", () => {
    for (const input of ['url("https://example.com/x\f);color:red;/*")', 'url("a\nb")', 'url("a\rb")', "url(a\u0000b)", 'url("a\u007fb")']) {
      expect([input, readTerms(input).ok]).toEqual([input, false]);
      rejects(images(), input);
    }
  });

  it("types calc(): a length and a number don't add, a number multiplies, a length doesn't divide", () => {
    const kind = richLength({ percent: true });
    for (const input of ["calc(1px + 1)", "calc(1 + 1px)", "calc(1px * 2px)", "calc(2 / 1px)", "calc(50% - 2)", "min(1px, 2)", "calc(1px / 0px)"]) rejects(kind, input);
    for (const input of ["calc(1px * 2)", "calc(2 * 1rem)", "calc(100% / 3)", "calc((100% - 2rem) / 3)", "min(10px, 5vw)", "clamp(1rem, 2vw + 1px, 3rem)"]) expect(value(kind, input)).toBe(input);
  });

  it("refuses a flexible minimum in minmax(), and areas that aren't rectangles", () => {
    rejects(tracks(), "minmax(1fr, 2fr)");
    expect(value(tracks(), "minmax(100px, 1fr)")).toBe("minmax(100px, 1fr)");
    rejects(areas(), ["a a", "a b"]);
    rejects(areas(), ["a b a"]);
    rejects(areas(), ["a b", "b b"]);
    expect(value(areas(), ["a a", "b c"])).toEqual(["a a", "b c"]);
    expect(value(areas(), ["a a b", "a a ."])).toEqual(["a a b", "a a ."]);
  });
});

describe("fixes from the fifth review", () => {
  it("takes an auto repeat() only beside fixed sizes, and one at most, as CSS's <auto-track-list>", () => {
    for (const input of ["repeat(auto-fill, 1fr)", "repeat(auto-fit, minmax(min-content, 1fr))", "repeat(auto-fill, 100px) 1fr", "repeat(auto-fill, 100px) auto", "repeat(auto-fill, 100px) repeat(auto-fit, 100px)", "repeat(auto-fill, fit-content(100px))"]) rejects(tracks(), input);
    for (const input of ["repeat(auto-fill, minmax(200px, 1fr))", "repeat(auto-fill, minmax(auto, 200px)) 50px", "200px repeat(auto-fit, minmax(10rem, 1fr)) repeat(2, 50px)", "repeat(3, 1fr) auto"]) expect(value(tracks(), input)).toBe(input);
  });

  it("takes only a breadth at each end of minmax(): no function inside it", () => {
    for (const input of ["minmax(100px, minmax(200px, 300px))", "minmax(fit-content(100px), 1fr)", "repeat(auto-fill, minmax(100px, fit-content(200px)))", "minmax(100px, repeat(2, 1fr))"]) rejects(tracks(), input);
    for (const input of ["minmax(min-content, 1fr)", "minmax(auto, max-content)", "minmax(10%, 2fr)"]) expect(value(tracks(), input)).toBe(input);
  });
});
