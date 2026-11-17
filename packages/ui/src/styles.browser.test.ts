import { afterEach, describe, expect, it } from "vitest";
import { addStyle, cleanUp, loadStyles, mount, track } from "./test/dom.js";

afterEach(cleanUp);

/** Every style rule's text, through imports, layers and media queries. */
function ruleTexts(rules: CSSRuleList): string[] {
  return [...rules].flatMap((rule) => {
    if (rule instanceof CSSImportRule) {
      return rule.styleSheet ? ruleTexts(rule.styleSheet.cssRules) : [];
    }
    if (rule instanceof CSSStyleRule) {
      return [rule.cssText];
    }
    return "cssRules" in rule ? ruleTexts((rule as CSSGroupingRule).cssRules) : [];
  });
}

/**
 * The custom properties a declaration needs: each `var()` without a fallback,
 * and whatever its fallback needs otherwise. `var(--a, var(--b))` needs `--b`.
 */
function needed(css: string): string[] {
  const names: string[] = [];
  const pattern = /var\(\s*(--[\w-]+)\s*(,?)/g;
  for (let match = pattern.exec(css); match; match = pattern.exec(css)) {
    if (!match[2]) {
      names.push(match[1] as string);
    }
    // With a fallback, the search goes on inside it, where the next var() is.
  }
  return names;
}

describe("styles.css", () => {
  it("declares the cascade layers first, in the order of ADR 0005", async () => {
    const sheet = await loadStyles();
    const [first, second] = [...sheet.cssRules];
    expect(first).toBeInstanceOf(CSSLayerStatementRule);
    expect([...(first as CSSLayerStatementRule).nameList]).toEqual([
      "hm.tokens",
      "hm.base",
      "hm.components",
      "hm.sdk",
    ]);
    expect([...(second as CSSLayerStatementRule).nameList]).toEqual([
      "hm.tokens.default",
      "hm.tokens.theme",
    ]);
  });

  it("makes later layers win, whatever order their rules load in", async () => {
    await loadStyles();
    // Each rule is in an earlier layer than the one before it, so without the
    // declared order the last rule in the source would win.
    addStyle(`
      @layer hm.sdk { .hm-layer-probe { order: 4; } }
      @layer hm.components { .hm-layer-probe { order: 3; } }
      @layer hm.base { .hm-layer-probe { order: 2; } }
      @layer hm.tokens { .hm-layer-probe { order: 1; } }
    `);
    const probe = track(document.createElement("div"));
    probe.className = "hm-layer-probe";
    document.body.append(probe);
    expect(getComputedStyle(probe).order).toBe("4");

    // A host's unlayered CSS beats every hm layer, without !important.
    addStyle(".hm-layer-probe { order: 5; }");
    expect(getComputedStyle(probe).order).toBe("5");
  });

  it("resolves every custom property it needs, in each theme and density", async () => {
    const sheet = await loadStyles();
    const names = [...new Set(ruleTexts(sheet.cssRules).flatMap(needed))];
    // Enough to know the walk reached the tokens and the components.
    expect(names.length).toBeGreaterThan(100);
    expect(names).toContain("--hm-color-border-strong");

    // The page itself, with no provider and no attribute, then each scope.
    const scopes: [string, Element][] = [["the page", document.documentElement]];
    for (const attribute of [
      'data-hm-theme="light"',
      'data-hm-theme="dark"',
      'data-hm-theme="system"',
      'data-hm-density="comfortable"',
      'data-hm-density="compact"',
    ]) {
      scopes.push([attribute, mount(`<div ${attribute}></div>`).firstElementChild as Element]);
    }
    for (const [scope, element] of scopes) {
      const style = getComputedStyle(element);
      // A property that's undefined, or whose own var() didn't resolve, is empty.
      const unresolved = names.filter((name) => style.getPropertyValue(name).trim() === "");
      expect(unresolved, scope).toEqual([]);
    }
  });

  it("styles a component on a page with no provider, theme attribute or SDK", async () => {
    await loadStyles();
    const field = mount('<input class="hm-text-field" />').firstElementChild as Element;
    const style = getComputedStyle(field);
    expect(style.borderTopStyle).toBe("solid");
    expect(Number.parseFloat(style.borderTopWidth)).toBeGreaterThan(0);
    expect(style.borderTopColor).not.toBe(style.backgroundColor);
    expect(Number.parseFloat(style.borderTopLeftRadius)).toBeGreaterThan(0);
  });

  it("makes ThemeProvider's wrapper take no box, and themed roots set color-scheme", async () => {
    await loadStyles();
    const root = mount('<div data-hm-theme="dark"><div data-hm-theme-scope="x"></div></div>');
    const themed = root.querySelector("[data-hm-theme]") as Element;
    expect(getComputedStyle(themed).colorScheme).toBe("dark");
    expect(getComputedStyle(root.querySelector("[data-hm-theme-scope]") as Element).display).toBe(
      "contents",
    );
  });
});
