/**
 * Unit tests for the glass-skin browser module.
 *
 * Runs the real lib/client.js against a minimal DOM stub and asserts the
 * mounting contract: registration shape, namespace class, style element,
 * CSS coverage, and idempotence. Zero dependencies — `node --test` only.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = readFileSync(join(root, "lib/client.js"), "utf8");

/** Evaluate lib/client.js against DOM stubs and return the harness. */
function bootstrap() {
  let registration = null;
  let styleEl = null;

  const documentElement = {
    classes: new Set(),
    classList: {
      add(c) { documentElement.classes.add(c); },
      contains(c) { return documentElement.classes.has(c); },
    },
  };
  const document = {
    documentElement,
    head: { appendChild(el) { styleEl = el; } },
    createElement() { return { id: null, textContent: "" }; },
    getElementById(id) { return styleEl && styleEl.id === id ? styleEl : null; },
    addEventListener() {},
    removeEventListener() {},
  };
  const observers = [];
  const MutationObserver = class {
    constructor(cb) { this.cb = cb; observers.push(this); }
    observe() { /* mutations are fired manually via h.fireMutation() */ }
  };
  const window = { __ModuleLoader__: { load(reg) { registration = reg; } } };

  new Function("window", "document", "MutationObserver", source)(
    window, document, MutationObserver,
  );
  return {
    get registration() { return registration; },
    get styleEl() { return styleEl; },
    documentElement,
    observers,
    fireMutation() { for (const o of observers) o.cb([]); },
    removeStyle() { styleEl = null; },
  };
}

test("registers with the DSH module loader under the expected id", () => {
  const h = bootstrap();
  assert.ok(h.registration, "must call window.__ModuleLoader__.load");
  assert.equal(h.registration.id, "dsh-glass-skin");
  assert.equal(typeof h.registration.factory, "function");
});

test("factory exports apply()", () => {
  const h = bootstrap();
  const exports1 = h.registration.factory(() => ({}));
  assert.equal(typeof exports1.apply, "function");
});

test("apply() mounts the namespace class and the stylesheet", () => {
  const h = bootstrap();
  h.registration.factory(() => ({})).apply();
  assert.ok(h.documentElement.classList.contains("glass-skin"), "html.glass-skin set");
  assert.equal(h.styleEl.id, "dsh-glass-skin-style");
  assert.ok(h.styleEl.textContent.length > 3000, "CSS payload present");
});

test("CSS covers the key surfaces and both themes", () => {
  const h = bootstrap();
  h.registration.factory(() => ({})).apply();
  const css = h.styleEl.textContent;
  for (const needle of [
    "html.glass-skin",                    // namespace everywhere
    "[class*=\"titlebar\"]",               // app bar
    "[class*=\"sidebarCol\"]",             // sidebar
    "[data-composer-card]",               // composer
    "[data-cordis-panel]",                // panels
    "backdrop-filter",                    // actual frosting
    "data-ds-dark-theme",                 // dark theme hook
    "--dsw-alias-bg-layer-1",             // token override lever
    "@supports not",                      // no-blur fallback
  ]) {
    assert.ok(css.includes(needle), `CSS should contain ${needle}`);
  }
});

test("CSS carries the Liquid Glass material, not just a blur", () => {
  const h = bootstrap();
  h.registration.factory(() => ({})).apply();
  const css = h.styleEl.textContent;
  for (const needle of [
    "--lg-fill-thin", "--lg-fill-thick", "--lg-fill-overlay", // three thicknesses
    "inset 1px 1px 0 var(--lg-rim)",      // specular rim light
    "saturate(var(--lg-saturate))",        // pulls color from behind
    "[data-composer-seat]",                // opaque scroll band replaced
    ":active",                             // interactive press feedback
    "prefers-reduced-transparency",        // accessibility opt-out
    "prefers-reduced-motion",
  ]) {
    assert.ok(css.includes(needle), `CSS should contain ${needle}`);
  }
});

test("apply() is idempotent — no duplicate style elements", () => {
  const h = bootstrap();
  const exports1 = h.registration.factory(() => ({}));
  exports1.apply();
  const first = h.styleEl;
  const text = first.textContent;
  exports1.apply();
  assert.equal(h.styleEl, first, "reuses the same <style> node");
  assert.equal(h.styleEl.textContent, text, "does not rewrite identical CSS");
});

test("package manifest is a valid DSH client plugin", () => {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  assert.equal(pkg.dsh.client.platform, "web");
  assert.equal(pkg.dsh.bundle.patch, "./cordis.patch.yml");
  assert.equal(pkg.exports["./client"], "./lib/client.js");
  const patch = readFileSync(join(root, "cordis.patch.yml"), "utf8");
  assert.match(patch, /- insert:/);
  assert.match(patch, /name: dsh-glass-skin/);
});

test("observer restores the namespace class when the app rewrites html.className", () => {
  const h = bootstrap();
  h.registration.factory(() => ({})).apply();
  assert.equal(h.observers.length, 1, "observer installed");
  h.documentElement.classes.clear();           // e.g. theme switch replaces className
  h.fireMutation();
  assert.ok(h.documentElement.classList.contains("glass-skin"), "class re-added");
});

test("observer re-mounts a removed stylesheet", () => {
  const h = bootstrap();
  h.registration.factory(() => ({})).apply();
  h.removeStyle();
  h.fireMutation();
  assert.equal(h.styleEl.id, "dsh-glass-skin-style");
});

test("observer is a no-op when class and stylesheet are intact", () => {
  const h = bootstrap();
  h.registration.factory(() => ({})).apply();
  const style = h.styleEl;
  let adds = 0;
  const add = h.documentElement.classList.add;
  h.documentElement.classList.add = (c) => { adds++; add(c); };
  h.fireMutation();
  assert.equal(adds, 0, "no class write, so no mutation feedback loop");
  assert.equal(h.styleEl, style);
});

test("CSS header version matches package.json", () => {
  const h = bootstrap();
  h.registration.factory(() => ({})).apply();
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  assert.ok(h.styleEl.textContent.includes(`dsh-glass-skin v${pkg.version} `), `injected CSS should say v${pkg.version}`);
});

function css() {
  const h = bootstrap();
  h.registration.factory(() => ({})).apply();
  return h.styleEl.textContent;
}

/** Return the declaration block of the first rule whose selector contains `sel`. */
function block(text, sel) {
  const i = text.indexOf(sel);
  assert.ok(i >= 0, `CSS should contain ${sel}`);
  const open = text.indexOf("{", i);
  return text.slice(open + 1, text.indexOf("}", open));
}

test("no gradients anywhere (design rule: flat colors only)", () => {
  const text = css();
  assert.doesNotMatch(text, /gradient\(/);
  // Masks may only be switched off (to strip the app's gradient fades).
  for (const m of text.matchAll(/mask-image:\s*([^;}]+)/g)) {
    assert.match(m[1].trim(), /^none( !important)?$/, `mask-image must be none, got ${m[1]}`);
  }
});

test("card rule matches only classes ending in _card, not _cardTitle or _cards", () => {
  const text = css();
  assert.ok(!text.includes('[class*="_card"]'), "no bare substring match on _card");
  assert.ok(text.includes(':is([class$="_card"], [class*="_card "])'));
});

test("per-message surfaces carry no backdrop-filter (scroll perf in WebView)", () => {
  const text = css();
  assert.doesNotMatch(block(text, '[class*="_userRow"]) [class*="_bubble"] {'), /backdrop-filter/);
  assert.doesNotMatch(block(text, ".md-code-block {"), /backdrop-filter/);
  assert.match(block(text, "[data-composer-card] {"), /backdrop-filter/);
});

test("light mode darkens secondary labels; dark mode keeps the app's", () => {
  const light = block(css(), "body:not([data-ds-dark-theme]) {");
  for (const t of ["secondary", "tertiary", "caption"]) {
    assert.match(light, new RegExp(`--dsw-alias-label-${t}: #`));
  }
  assert.doesNotMatch(block(css(), "html.glass-skin [data-ds-dark-theme] {"), /--dsw-alias-label-/);
});

/** Every rule (selector + body) whose selector mentions `needle`. */
function rules(text, needle) {
  const out = [];
  for (const m of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (m[1].includes(needle)) out.push({ sel: m[1].trim(), body: m[2] });
  }
  return out;
}

test("ds-bot rules are scoped to ds-bot's own interface", () => {
  const text = css();
  const bt = rules(text, ".bt-");
  assert.ok(bt.length > 20, "ds-bot surfaces are covered");
  for (const r of bt) {
    for (const part of r.sel.split(/,(?![^(]*\))/)) {
      if (!part.includes(".bt-")) continue;
      assert.match(part, /html\.glass-skin(\.[\w-]+)* body\[data-bt-motion\]/, `unscoped ds-bot selector: ${part}`);
    }
  }
});

test("ds-bot tokens are re-pointed at the glass material", () => {
  const text = css();
  const tokens = block(text, "html.glass-skin body[data-bt-motion] {");
  for (const t of ["--bt-main", "--bt-sidebar", "--bt-card", "--bt-bubble", "--bt-user", "--bt-user-ink", "--bt-ink-2", "--bt-ink-3"]) {
    assert.match(tokens, new RegExp(`${t}:`), `ds-bot token ${t} overridden`);
  }
  assert.match(tokens, /--bt-main: var\(--lg-fill/);
});

test("ds-bot composer keeps its glass over its !important card", () => {
  // v0.3.0: the composer is clear control glass (--lg-fill-ctl), no longer
  // the thick fill; the !important override itself is what this guards.
  const body = block(css(), "html.glass-skin body[data-bt-motion] [data-composer-card],");
  assert.match(body, /background: var\(--lg-fill-ctl\) !important/);
  assert.match(body, /backdrop-filter/);
});

test("ds-bot repeated items (bubbles, list rows, cards) carry no backdrop-filter", () => {
  const text = css();
  for (const item of [".bt-bubble", ".bt-row", ".bt-tile", ".bt-mem-row", ".bt-set-card", ".bt-us-card"]) {
    for (const r of rules(text, item)) {
      assert.doesNotMatch(r.body, /backdrop-filter:\s*(?!none)/, `${item} must not blur: ${r.sel}`);
    }
  }
  for (const surface of [".bt-panel", ".bt-pane", ".bt-pill", ".bt-drop"]) {
    assert.ok(rules(text, surface).some((r) => /backdrop-filter: blur/.test(r.body)), `${surface} is glass`);
  }
});

test("ds-bot's own decorative gradients are neutralised", () => {
  const text = css();
  for (const needle of [
    'header:is([class$="_header"], [class*="_header "])::before',
    ".bt-theme-chip",
    ".bt-shimmer",
    ".bt-cluster > span",
  ]) {
    assert.ok(text.includes(needle), `CSS should handle ${needle}`);
  }
  const cluster = block(text, ".bt-cluster > span {");
  assert.match(cluster, /mask-image: none !important/);
});

test("ds-bot name inks are darkened on text only, for both themes", () => {
  const text = css();
  const light = rules(text, ".bt-group-name").map((r) => r.body).join("\n");
  assert.match(light, /--bt-ink-rose: #/);
  assert.ok(rules(text, "[data-ds-dark-theme]").some((r) => r.sel.includes(".bt-group-name") && /--bt-ink-rose: #/.test(r.body)));
});

test("nested listboxes inside a menu or dialog draw no second sheet of glass", () => {
  const body = block(css(), '[role="dialog"]) [role="listbox"] {');
  assert.match(body, /backdrop-filter: none/);
  assert.match(body, /background: none/);
});

test("bot-owned colors are left as ds-bot paints them (Aurora keeps its gradient)", () => {
  const text = css();
  // No rule may repaint a Bot's color: not ds-bot's Aurora ink, not its
  // inline swatch / bar gradients, not the SVG gradient stops of avatars
  // and the usage ring.
  for (const r of rules(text, "")) {
    assert.doesNotMatch(r.body, /background[\w-]*:[^;]*--bt-ink-aurora/, `bot color override: ${r.sel}`);
    assert.doesNotMatch(r.sel, /\[style\*=[^\]]*gradient/, `inline bot paint targeted: ${r.sel}`);
    assert.doesNotMatch(r.sel, /linearGradient|radialGradient|\bstop\b/, `SVG bot paint targeted: ${r.sel}`);
  }
  assert.doesNotMatch(text, /stop-color/);
});

test("mention text is darkened but its icon keeps ds-bot's original ink", () => {
  const text = css();
  const tokens = block(text, "html.glass-skin body[data-bt-motion] {");
  const icon = block(text, '.bt-bubble a[href^="https://bots.local/"]::before {');
  // Every ink the skin darkens on a mention anchor (light or dark theme)...
  const darkened = new Set();
  for (const r of rules(text, '.bt-bubble a[href^="https://bots.local/"]')) {
    if (r.sel.includes("::before")) continue;
    for (const m of r.body.matchAll(/--bt-ink-([\w-]+):/g)) darkened.add(m[1]);
  }
  assert.ok(darkened.has("rose") && darkened.has("sky"), "mention text inks are darkened");
  for (const name of darkened) {
    // ...is captured from ds-bot on <body> and handed back to the icon.
    assert.match(tokens, new RegExp(`--lg-bot-${name}: var\\(--bt-ink-${name}\\);`), `capture ${name}`);
    assert.match(icon, new RegExp(`--bt-ink-${name}: var\\(--lg-bot-${name}\\);`), `icon keeps original ${name}`);
  }
  assert.doesNotMatch(icon, /#[0-9a-f]{3,8}\b/i, "icon gets no hard-coded color");
});

test("the custom-color swatch keeps ds-bot's own rainbow", () => {
  // Bot settings > General > Accent: ds-bot draws .bt-swatch-custom as a
  // conic rainbow. The skin must not repaint it or draw over it.
  const text = css();
  assert.equal(rules(text, ".bt-swatch-custom").length, 0, "no rule targets .bt-swatch-custom");
  assert.ok(!text.includes("bt-swatch-custom"), "custom swatch not mentioned in any selector");
});

/* ------------------------------------------------------------------ *
 * v0.3.0: refraction, phone layout, composer without glow
 * ------------------------------------------------------------------ */

const UA = {
  chrome: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  webview: "Mozilla/5.0 (Linux; Android 14; Pixel 7; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/140.0.0.0 Mobile Safari/537.36",
  firefox: "Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0",
  safari: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
};

/** A fuller DOM stub: element registry, <body>, navigator, matchMedia. */
function browser({ ua = UA.chrome, brands, reduced = false, storageBlocked = false, pill = null, rail = null, animations = null } = {}) {
  let registration = null;
  const byId = new Map();
  const node = (id) => ({
    id,
    textContent: "",
    remove() { if (byId.get(this.id) === this) byId.delete(this.id); },
  });
  const classes = new Set();
  const styleProps = new Map();
  const documentElement = {
    classes,
    style: {
      setProperty(k, v) { styleProps.set(k, v); },
      getPropertyValue(k) { return styleProps.get(k) || ""; },
      removeProperty(k) { styleProps.delete(k); },
    },
    classList: {
      add(c) { classes.add(c); },
      remove(c) { classes.delete(c); },
      contains(c) { return classes.has(c); },
    },
  };
  const inserted = [];
  const buttons = [];
  const body = {
    insertAdjacentHTML(pos, html) {
      const m = /^<(svg|button|div)[^>]*\sid="([^"]+)"/.exec(html);
      if (m && m[1] === "svg") inserted.push(html);   // `inserted` tracks the refraction <svg> only
      else if (m) buttons.push(html);
      if (m) byId.set(m[2], node(m[2]));
    },
  };
  const document = {
    documentElement,
    body,
    head: { appendChild(el) { byId.set(el.id, el); } },
    createElement() { return node(null); },
    getElementById(id) { return byId.get(id) || null; },
    querySelector(sel) {
      const r = sel.includes(".bt-pill") ? pill : sel.includes(".bt-rail") ? rail : null;
      return r ? { getBoundingClientRect: () => r, contains: () => false } : null;
    },
    ...(animations ? { getAnimations: () => animations } : {}),
    addEventListener(type, fn) { if (type === "click") clicks.add(fn); },
    removeEventListener(type, fn) { if (type === "click") clicks.delete(fn); },
  };
  const clicks = new Set();
  const store = new Map();
  const observers = [];
  const MutationObserver = class {
    constructor(cb) { this.cb = cb; this.targets = []; this.live = true; observers.push(this); }
    observe(t) { this.targets.push(t); }
    disconnect() { this.live = false; }
  };
  const listeners = new Set();
  const query = {
    get matches() { return reduced; },
    addEventListener(_t, fn) { listeners.add(fn); },
    removeEventListener(_t, fn) { listeners.delete(fn); },
  };
  const window = {
    __ModuleLoader__: { load(reg) { registration = reg; } },
    navigator: { userAgent: ua, ...(brands ? { userAgentData: { brands } } : {}) },
    matchMedia: (q) => (q.includes("reduced-transparency") ? query : { matches: false }),
    localStorage: {
      getItem: (k) => { if (storageBlocked) throw new Error("blocked"); return store.has(k) ? store.get(k) : null; },
      setItem: (k, v) => { if (storageBlocked) throw new Error("blocked"); store.set(k, String(v)); },
    },
  };
  new Function("window", "document", "MutationObserver", source)(window, document, MutationObserver);
  const mod = registration.factory(() => ({}));
  return {
    mod, document, byId, classes, inserted, buttons, observers, listeners, clicks, store, styleProps,
    /** Fire a click whose target matches only the given selectors. */
    click(...matches) {
      const target = { closest: (sel) => (matches.includes(sel) ? {} : null) };
      for (const fn of [...clicks]) fn({ target });
    },
    fire() { for (const o of observers) if (o.live) o.cb([]); },
    setReduced(v) { reduced = v; for (const fn of listeners) fn(); },
  };
}

test("no gradient in the injected SVG either", () => {
  // The CSS check above covers the stylesheet; the refraction <svg> must
  // not carry gradient paint (linearGradient / radialGradient / stops).
  const b = browser();
  b.mod.apply();
  assert.equal(b.inserted.length, 1);
  assert.doesNotMatch(b.inserted[0], /gradient|<stop\b/i);
  assert.doesNotMatch(source, /gradient\(/, "no gradient() anywhere in lib/client.js");
});

test("Chromium: refraction <svg> injected once and html.lg-refract set", () => {
  for (const ua of [UA.chrome, UA.webview]) {
    const b = browser({ ua });
    b.mod.apply();
    b.mod.apply();
    b.fire();
    assert.equal(b.inserted.length, 1, "svg inserted exactly once");
    assert.ok(b.byId.has("lg-svg-defs"));
    assert.ok(b.classes.has("lg-refract"));
    assert.ok(b.classes.has("glass-skin"));
  }
});

test("userAgentData brands decide when present", () => {
  const yes = browser({ ua: UA.firefox, brands: [{ brand: "Chromium", version: "140" }] });
  yes.mod.apply();
  assert.ok(yes.classes.has("lg-refract"));
  const no = browser({ ua: UA.chrome, brands: [{ brand: "Other", version: "1" }] });
  no.mod.apply();
  assert.ok(!no.classes.has("lg-refract"));
});

test("Firefox and Safari keep the blur-only look: no class, no svg", () => {
  for (const ua of [UA.firefox, UA.safari]) {
    const b = browser({ ua });
    b.mod.apply();
    b.fire();
    assert.ok(!b.classes.has("lg-refract"), ua);
    assert.equal(b.inserted.length, 0, ua);
    assert.ok(b.classes.has("glass-skin"), "skin itself still mounts");
  }
});

test("prefers-reduced-transparency removes refraction, live", () => {
  const off = browser({ reduced: true });
  off.mod.apply();
  assert.ok(!off.classes.has("lg-refract"));
  assert.equal(off.inserted.length, 0);

  const b = browser();
  b.mod.apply();
  assert.ok(b.classes.has("lg-refract"));
  b.setReduced(true);
  assert.ok(!b.classes.has("lg-refract"), "class dropped on change");
  assert.ok(!b.byId.has("lg-svg-defs"), "svg dropped on change");
  b.setReduced(false);
  assert.ok(b.classes.has("lg-refract"));
  assert.ok(b.byId.has("lg-svg-defs"));
});

test("observer re-mounts the svg and the class when the app drops them", () => {
  const b = browser();
  b.mod.apply();
  assert.ok(b.observers[0].targets.includes(b.document.body), "watches <body> children");
  b.byId.get("lg-svg-defs").remove();
  b.classes.delete("lg-refract");
  b.fire();
  assert.ok(b.byId.has("lg-svg-defs"));
  assert.ok(b.classes.has("lg-refract"));
  assert.equal(b.inserted.length, 2, "re-inserted once, not duplicated");
});

test("dispose removes svg, class and stylesheet and stops observing", () => {
  const b = browser();
  b.mod.apply();
  b.mod.dispose();
  assert.ok(!b.byId.has("lg-svg-defs"));
  assert.ok(!b.byId.has("dsh-glass-skin-style"));
  assert.ok(!b.classes.has("lg-refract"));
  assert.ok(!b.classes.has("glass-skin"));
  assert.ok(b.observers.every((o) => !o.live), "observer disconnected");
  assert.equal(b.listeners.size, 0, "media listener removed");
  b.fire();
  assert.ok(!b.byId.has("lg-svg-defs"), "nothing comes back after dispose");
});

test("with a cordis context, the skin is disposed with the plugin", () => {
  const b = browser();
  let cleanup = null;
  b.mod.apply({ effect(fn) { cleanup = fn(); } });
  assert.ok(b.byId.has("lg-svg-defs"));
  assert.equal(typeof cleanup, "function");
  cleanup();
  assert.ok(!b.byId.has("lg-svg-defs"));
  assert.ok(!b.classes.has("glass-skin"));
});

test("refraction is used only on the title pill, composer and settings sheets", () => {
  const text = css();
  const users = rules(text, "").filter((r) => /url\(#lg-refract|var\(--lg-refract-/.test(r.body));
  assert.ok(users.length >= 3);
  const allowed = /\[data-composer-card\]|\.bt-pill|\.bt-settings|\[data-shortcut-modal="settings"\]|lg-refract body/;
  for (const r of users) {
    for (const part of r.sel.split(/,(?![^(]*\))/)) {
      assert.match(part, allowed, `refraction on an unexpected surface: ${part}`);
      assert.doesNotMatch(part, /bubble|\.bt-msg|\.bt-row|_bubble|md-code|\.bt-q\b/, `refraction on content: ${part}`);
    }
  }
  // and it is keyed on the class the script sets (Chromium only)
  for (const r of users.filter((u) => /backdrop-filter/.test(u.body))) {
    assert.match(r.sel, /lg-refract/, `refraction not gated on html.lg-refract: ${r.sel}`);
  }
});

test("message bubbles carry no backdrop-filter in any rule", () => {
  const text = css();
  for (const needle of ["_bubble", ".bt-bubble", ".bt-ububble", ".bt-msg"]) {
    for (const r of rules(text, needle)) {
      assert.doesNotMatch(r.body, /backdrop-filter:\s*(?!none)/, `${needle} must not blur: ${r.sel}`);
    }
  }
});

test("composer: no glow and no focus ring at any width", () => {
  const text = css();
  for (const r of rules(text, "[data-composer-card]")) {
    if (r.sel.includes("[data-composer-card] ")) continue; // descendants (placeholder, scroller)
    assert.doesNotMatch(r.body, /--lg-glow/, `glow on composer: ${r.sel}`);
    assert.doesNotMatch(r.body, /0 0 0 [2-9]px/, `focus ring on composer: ${r.sel}`);
  }
  assert.match(block(text, "html.glass-skin [data-composer-card]:focus-within {"), /border-color: var\(--lg-focus-edge\)/);
});

/** Split the stylesheet into the phone block and everything else. */
function phoneSplit(text) {
  const start = text.indexOf("@media (max-width: 480px) {");
  assert.ok(start >= 0, "phone block present");
  let depth = 0;
  let end = start;
  for (let i = text.indexOf("{", start); i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}" && --depth === 0) { end = i + 1; break; }
  }
  return { inside: text.slice(start, end), outside: text.slice(0, start) + text.slice(end) };
}

test("phone layout rules live only under @media (max-width: 480px)", () => {
  const text = css();
  assert.equal(text.split("@media (max-width: 480px)").length, 2, "one phone block");
  const { inside, outside } = phoneSplit(text);
  for (const needle of [
    ".bt-astack .bt-bubble",          // full-width replies without bubble
    ".bt-astack > .bt-msg",
    ".bt-settings-main",              // detail column goes full width
    ".bt-settings-head",
    '[data-shortcut-modal="settings"] > nav',
    "[data-input-scroll]",            // composer scrollbar hidden
    ".bt-us-stat:nth-child",          // usage tiles 2x2
    "--bt-panel-w",                   // drawer as full-width sheet
  ]) {
    assert.ok(inside.includes(needle), `phone block should contain ${needle}`);
    assert.ok(!outside.includes(needle), `${needle} must not apply on desktop`);
  }
  assert.match(block(inside, ".bt-astack .bt-bubble {"), /background: transparent/);
  assert.match(block(inside, "body[data-bt-motion] .bt-settings-nav {"), /flex-direction: row/);
  assert.match(block(inside, ".bt-settings-nav > .bt-thumb {"), /display: none/, "y-axis thumb hidden in the tab strip");
});

test("custom scrollbars are for mouse/trackpad only", () => {
  const text = css();
  const at = text.indexOf("::-webkit-scrollbar {");
  assert.ok(at > 0);
  const media = text.lastIndexOf("@media", at);
  assert.match(text.slice(media, at), /^@media \(hover: hover\) and \(pointer: fine\) \{/);
});

test("sidebar draws no panel (floating pieces only), same box", () => {
  const body = block(css(), 'html.glass-skin [class*="sidebarCol"] {');
  assert.match(body, /background: transparent/);
  assert.match(body, /backdrop-filter: none/);
  assert.match(body, /margin: 10px 4px 10px 10px/, "desktop geometry unchanged");
});

test("wallpaper stays one flat color: white in light mode, black in dark", () => {
  const text = css();
  assert.match(block(text, "html.glass-skin body::before {"), /background: #ffffff;/);
  assert.match(block(text, "html.glass-skin body[data-ds-dark-theme]::before {"), /background: #000000;/);
});

test("light mode is neutral white: no blue-tinted shadow, fill or wallpaper", () => {
  const text = css();
  const dark = text.indexOf("[data-ds-dark-theme]");
  const light = text.slice(0, dark);
  for (const m of light.matchAll(/rgba?\((\d+),\s*(\d+),\s*(\d+)/g)) {
    const [r, , b] = [Number(m[1]), Number(m[2]), Number(m[3])];
    assert.ok(b - r < 6, `blue cast in light mode: ${m[0]}`);
  }
});

test("dark composer placeholder is lifted for contrast", () => {
  const body = block(css(), '[data-ds-dark-theme] [data-composer-card] [class*="_placeholder"] {');
  assert.match(body, /color: #b6b8bc/);
});

test("dark theme is neutral black: black wallpaper, grey glass, never flat black", () => {
  const text = css();
  assert.match(block(text, "body[data-ds-dark-theme]::before {"), /background: #000000/);
  const dark = block(text, "html.glass-skin [data-ds-dark-theme] {");
  for (const m of dark.matchAll(/(--[\w-]+):\s*rgba\((\d+), (\d+), (\d+), ([\d.]+)\)/g)) {
    const [, name, r, g, b, a] = m;
    assert.ok(Number(b) - Number(r) <= 6, `${name} is tinted blue: rgba(${r}, ${g}, ${b})`);
    if (/^--(lg-fill(?!-piece|-card)|dsw-alias-bg)/.test(name)) {
      const onBlack = Number(r) * Number(a);
      assert.ok(onBlack >= 12, `${name} lands at ${onBlack.toFixed(1)}/255 on black: too dark to read as a surface`);
    }
  }
});

/* ------------------------------------------------------------------ *
 * Phone bot rail: a toggle button, shown by default (ds-bot, <=480px)
 * ------------------------------------------------------------------ */

test("bot-rail toggle button is mounted once and the rail starts shown", () => {
  const b = browser();
  b.mod.apply();
  b.mod.apply();
  assert.ok(b.byId.has("lg-rail-toggle"), "toggle button mounted");
  assert.equal(b.buttons.filter((h) => h.includes('id="lg-rail-toggle"')).length, 1, "inserted once");
  assert.ok(!b.classes.has("lg-rail-hidden"), "shown by default");
});

test("clicking the toggle shows and hides the rail, and the choice is remembered", () => {
  const b = browser();
  b.mod.apply();
  b.click("#lg-rail-toggle");
  assert.ok(b.classes.has("lg-rail-hidden"), "closed");
  assert.equal(b.store.get("dsh-glass-skin:rail-v2"), "hidden");
  b.click("#lg-rail-toggle");
  assert.ok(!b.classes.has("lg-rail-hidden"), "opened again");
  assert.equal(b.store.get("dsh-glass-skin:rail-v2"), "open");

  const again = browser();
  again.store.set("dsh-glass-skin:rail-v2", "hidden");
  again.mod.apply();
  assert.ok(again.classes.has("lg-rail-hidden"), "a saved closed state is restored");

  const old = browser();
  old.store.set("dsh-glass-skin:rail", "hidden");   // written by the old auto-close
  old.mod.apply();
  assert.ok(!old.classes.has("lg-rail-hidden"), "the old key is ignored, so the rail starts shown");
});

test("picking a bot or any other click leaves the rail open; only the toggle closes it", async () => {
  const b = browser();
  b.mod.apply();
  b.click("body");                                  // some other click
  assert.ok(!b.classes.has("lg-rail-hidden"), "unrelated click keeps it open");
  b.click('[class*="sidebarCol"] .bt-row');         // pick a bot (or the DSH Agent)
  await new Promise((r) => setTimeout(r, 5));
  assert.ok(!b.classes.has("lg-rail-hidden"), "bot pick keeps the rail open");
  assert.equal(b.store.get("dsh-glass-skin:rail-v2"), undefined, "nothing written by a pick");
});

test("blocked storage never breaks the toggle", () => {
  const b = browser({ storageBlocked: true });
  b.mod.apply();
  assert.ok(!b.classes.has("lg-rail-hidden"), "defaults to shown");
  b.click("#lg-rail-toggle");
  assert.ok(b.classes.has("lg-rail-hidden"), "still toggles for this visit");
});

test("the observer puts the toggle back if the app drops it, and keeps the rail state", () => {
  const b = browser();
  b.mod.apply();
  b.click("#lg-rail-toggle");                       // close it
  b.byId.delete("lg-rail-toggle");
  b.fire();
  assert.ok(b.byId.has("lg-rail-toggle"), "re-mounted");
  b.classes.clear();                                // app rewrote html.className
  b.fire();
  assert.ok(b.classes.has("lg-rail-hidden"), "hidden state re-applied with the skin class");
});

test("dispose removes the toggle, its class and its click listener", () => {
  const b = browser();
  b.mod.apply();
  assert.equal(b.clicks.size, 1);
  b.mod.dispose();
  assert.ok(!b.byId.has("lg-rail-toggle"));
  assert.ok(!b.classes.has("lg-rail-hidden"));
  assert.equal(b.clicks.size, 0, "click listener removed");
});

test("rail CSS: hidden rail frees the grid on phones only, toggle is hidden elsewhere", () => {
  const text = css();
  const { inside, outside } = phoneSplit(text);
  const hide = '.lg-rail-hidden body[data-bt-motion] [class*="_frame"] > [class*="sidebarCol"] {';
  const span = '.lg-rail-hidden body[data-bt-motion] [class*="_frame"] > [class*="centerCol"] {';
  assert.ok(inside.includes(hide) && !outside.includes(hide), "rail hidden only under the phone query");
  assert.match(block(inside, hide), /display: none/);
  assert.match(block(inside, span), /grid-column: 1 \/ 3/, "center column spans the freed tracks");
  assert.ok(!/_frame"\][^{]*\{[^}]*grid-template-columns/.test(inside), "the app's inline grid columns are not fought");
  assert.match(block(outside, "#lg-rail-toggle {"), /display: none/, "toggle hidden outside the phone block");
  assert.match(block(inside, "body[data-bt-motion] #lg-rail-toggle {"), /display: flex/);
  assert.ok(inside.includes("body[data-bt-motion] #lg-rail-toggle"), "scoped to ds-bot's interface");
});

test("rail: toggle is centred on the rail and level with the title pill, the rail starts below it, art is smaller", () => {
  const text = css();
  const { inside, outside } = phoneSplit(text);
  const tog = block(outside, "#lg-rail-toggle {");
  assert.match(tog, /left: calc\(var\(--lg-rail-cx, 28px\) - 16px\)/, "centred on the rail's icons");
  assert.match(tog, /top: var\(--lg-toggle-top/, "top edge follows the title pill");
  assert.match(tog, /width: 32px;\s*height: 32px/, "toggle is 32px");
  assert.ok(!/#lg-rail-toggle \{\s*left:/.test(inside), "toggle is not shifted sideways when the rail opens");
  assert.match(block(inside, 'body[data-bt-motion] [class*="_frame"] > [class*="sidebarCol"] {'.replace("body", ":not(.lg-rail-hidden) body")), /margin-top: calc\(var\(--lg-toggle-top, 8px\) \+ 40px\)/);
  assert.match(block(outside, ".bt-rail .bt-row :is(.bt-mark, .bt-cluster) {"), /zoom: 0\.78/);
  assert.match(block(outside, ".bt-rail .bt-row {"), /min-height: 40px/, "rows stay a decent touch target");
});

test("rail toggle lines up with the title pill's top edge and the rail icons' centre line", () => {
  const b = browser({
    pill: { top: 12.8, height: 42, left: 105, width: 180 },
    rail: { left: 6, width: 50, top: 60, height: 500 },
  });
  b.mod.apply();
  assert.equal(b.styleProps.get("--lg-toggle-top"), "13px", "top edge = pill top (rounded to half px)");
  assert.equal(b.styleProps.get("--lg-rail-cx"), "31px", "centre = rail centre");
  b.mod.dispose();
  assert.equal(b.styleProps.size, 0, "dispose removes the measured values");
});

test("nothing is written when the pill or rail cannot be measured (hidden or absent)", () => {
  const hidden = browser({ pill: { top: 0, height: 0 }, rail: { left: 0, width: 0 } });
  hidden.mod.apply();
  assert.equal(hidden.styleProps.size, 0);
  const absent = browser();
  absent.mod.apply();
  assert.equal(absent.styleProps.size, 0);
});

test("phone: group-chat avatar sits on the name's line, to its left (phone-only)", () => {
  const { inside, outside } = phoneSplit(css());
  assert.match(block(inside, ".bt-group-msg .bt-astack[data-lead] .bt-msg-line {"), /align-items: flex-start/);
  assert.match(block(inside, ".bt-group-msg .bt-astack[data-lead] .bt-lead {"), /margin-top: -21px/);
  assert.match(block(inside, "body[data-bt-motion] .bt-group-name {"), /margin-left: 30px/);
  assert.ok(!outside.includes(".bt-group-msg .bt-astack[data-lead]"), "desktop keeps ds-bot's own avatar placement");
  assert.ok(!/\.bt-group-name \{\s*margin-left/.test(outside), "desktop name offset untouched");
});

test("phone: DSH Agent header title is a centred pill clear of the rail toggle (phone-only)", () => {
  const { inside, outside } = phoneSplit(css());
  const head = 'header:is([class$="_header"], [class*="_header "]):has([class*="_titleRow"])';
  assert.ok(inside.includes(head), "header rule lives in the phone block");
  assert.ok(!outside.includes("_titleRow"), "desktop header is untouched");
  assert.match(block(inside, head), /padding: var\(--lg-toggle-top, 8px\) 12px 8px/, "pill top level with the toggle");
  assert.match(block(inside, `.lg-rail-hidden body[data-bt-motion] ${head}`), /padding-inline: 56px/, "room for the toggle on both sides");
  assert.match(block(inside, 'header [class*="_titleRow"]'), /justify-content: center/);
  const pill = block(inside, 'header nav[class*="_crumbs"] {');
  assert.match(pill, /height: 32px/, "same height as the toggle");
  assert.match(pill, /box-sizing: border-box/);
  assert.match(pill, /border-radius: 999px/);
});

test("trajectory details panel is near-solid glass, not the 34% layer", () => {
  const text = css();
  const panel = block(text, '[class*="_split"] aside[class*="_details"]');
  assert.match(panel, /--dsw-alias-bg-layer-1: var\(--lg-fill-solid\)/, "inner layer-1 surfaces follow");
  assert.match(panel, /background: var\(--lg-fill-solid\)/);
  for (const m of text.matchAll(/--lg-fill-solid: rgba\([^)]*,\s*([\d.]+)\)/g)) {
    assert.ok(Number(m[1]) >= 0.9, `--lg-fill-solid alpha ${m[1]} too clear`);
  }
  assert.equal([...text.matchAll(/--lg-fill-solid: rgba/g)].length, 2, "light and dark values");
});

test("phone: composer runs edge to edge with 12px margins; the rail stops above it (phone-only)", () => {
  const { inside, outside } = phoneSplit(css());
  assert.ok(!outside.includes("--lg-rail-col"), "desktop layout untouched");
  assert.match(block(inside, "[data-composer-seat] :has(> [data-composer-card]) {"), /padding-left: 12px !important;\s*padding-right: 12px !important;/);
  assert.match(block(inside, '[data-composer-seat] [data-composer-card]) [class*="_frame"] > [class*="centerCol"] {'), /grid-column: 1 \/ 3;/,
    "the conversation spans the rail's column so the composer can");
  const rail = block(inside, '[data-composer-seat] [data-composer-card]) [class*="_frame"] > [class*="sidebarCol"] {');
  assert.match(rail, /z-index: 2;/, "the rail stays on top and tappable");
  assert.match(rail, /margin-bottom: var\(--lg-composer-room, 96px\);/, "and ends above the composer");
  assert.match(block(inside, "[data-conversation-scroll]:has(> [data-composer-seat] [data-composer-card]) {"), /padding-left: var\(--lg-rail-col, 56px\);/,
    "messages stay clear of the rail");
  assert.match(block(inside, "[data-conversation-scroll] > [data-composer-seat]:has([data-composer-card]) {"), /margin-left: calc\(-1 \* var\(--lg-rail-col, 56px\)\);/);
});

test("phone: message tools sit under the reply, never off screen (phone-only)", () => {
  const { inside, outside } = phoneSplit(css());
  assert.ok(!outside.includes(".bt-msg-line > .bt-tools"), "desktop keeps ds-bot's side tools");
  const tools = block(inside, ".bt-astack .bt-msg-line > .bt-tools {");
  assert.match(tools, /bottom: 0/);
  assert.match(tools, /(^|\s)right: 0;/, "at the reply's right edge");
  assert.match(tools, /(^|\s)left: auto;/);
  assert.match(tools, /transform: none/);
  assert.match(block(inside, ".bt-msg-line > .bt-tools::after {"), /display: none/, "no 128px hover bridge to widen the page");
  assert.match(inside, /\.bt-msg:last-child > \.bt-msg-line:has\(> \.bt-tools\)[^{]*\{\s*padding-bottom: 28px/, "room made under the reply");
  assert.match(block(inside, ".bt-astack > .bt-msg:last-child > .bt-msg-line > .bt-tools {"), /visibility: visible/, "always shown under the last message");
  assert.match(block(inside, ':has(> [data-chat-flow]) {\n          overflow-x'), /overflow-x: hidden/, "the conversation never scrolls sideways");
});

test("the narrow rail is styled by its own presence, at any width (foldables too)", () => {
  const { inside, outside } = phoneSplit(css());
  assert.ok(!inside.includes(".bt-rail .bt-list"), "not tied to the phone breakpoint");
  assert.match(block(outside, '[class*="sidebarCol"]:has(.bt-rail) {'), /margin: 6px 0 6px 6px/, "rail gets the narrow inset");
  assert.match(block(outside, ".bt-rail .bt-list {"), /scrollbar-width: none/);
  assert.match(block(outside, ".bt-rail .bt-list::-webkit-scrollbar {"), /display: none/);
  assert.match(block(outside, ':has(.bt-rail) :is(.bt-round, .bt-account) {'), /zoom: 0\.85/, "the wide sidebar's buttons keep their size");
});

test("every user-side bubble is glass, so a steering or unsent message never flashes the theme color", () => {
  const text = css();
  const sel = ':is([data-chat-flow-kind="user"], [data-chat-flow-kind="steering"], [data-chat-flow-kind="question-reply"], [data-chat-flow-kind="command-input"], [class*="_userRow"]) [class*="_bubble"] {';
  assert.match(block(text, "html.glass-skin " + sel), /background: var\(--lg-user-fill\)/, "light: neutral glass");
  assert.match(block(text, "html.glass-skin {"), /--lg-user-fill: rgba\(0, 0, 0, 0\.045\)/);
  assert.match(block(text, "html.glass-skin " + sel), /box-shadow: none;/, "light: flat, no white rim that reads as a ring");
  assert.match(block(text, "body[data-bt-motion]:not([data-ds-dark-theme]) .bt-ububble {"), /box-shadow: none;/, "ds-bot's sent bubble too");
  assert.match(block(text, "[data-ds-dark-theme] " + sel), /inset 1px 1px 0 var\(--lg-rim\)/, "dark keeps the glass edge");
  assert.match(block(text, "[data-ds-dark-theme] " + sel), /background: rgba\(var\(--lg-accent\), 0\.20\)/, "dark, not ds-bot's near-white");
});

/* ------------------------------------------------------------------ *
 * v0.3.14: Bot list (pull tab on the rail, full-screen list)
 * ------------------------------------------------------------------ */

test("bot list: the pull tab and the back bar are mounted once, and re-mounted if dropped", () => {
  const b = browser();
  b.mod.apply();
  b.mod.apply();
  assert.equal(b.buttons.filter((h) => h.includes('id="lg-list-tab"')).length, 1, "tab inserted once");
  assert.equal(b.buttons.filter((h) => h.includes('id="lg-list-bar"')).length, 1, "bar inserted once");
  const bar = b.buttons.find((h) => h.includes('id="lg-list-bar"'));
  // The Android app's back key closes the top visible aria-modal dialog through its 关闭 button.
  assert.match(bar, /role="dialog" aria-modal="true"/);
  assert.match(bar, /<button type="button" aria-label="关闭列表"/);
  b.byId.delete("lg-list-tab");
  b.fire();
  assert.ok(b.byId.has("lg-list-tab"), "re-mounted");
});

test("bot list: dispose removes the tab and the bar", () => {
  const b = browser();
  b.mod.apply();
  b.mod.dispose();
  assert.ok(!b.byId.has("lg-list-tab"));
  assert.ok(!b.byId.has("lg-list-bar"));
});

test("bot list: the rail's right edge and middle are measured for the tab", () => {
  const b = browser({ rail: { left: 6, top: 88, width: 49, height: 700, right: 55 } });
  b.mod.apply();
  assert.equal(b.styleProps.get("--lg-rail-right"), "55px");
  assert.equal(b.styleProps.get("--lg-rail-mid"), "438px");
});

test("bot list: a rail caught sliding in is measured once it stops, not mid-slide", async () => {
  let finish;
  const slide = {
    playState: "running",
    effect: { target: { contains: () => true } },
    finished: new Promise((resolve) => { finish = resolve; }),
  };
  const rail = { left: 49, top: 88, width: 49, height: 700, right: 98 };
  const b = browser({ rail, animations: [slide] });
  b.mod.apply();
  assert.equal(b.styleProps.get("--lg-rail-right"), undefined, "nothing written mid-slide");
  assert.equal(b.styleProps.get("--lg-rail-cx"), undefined);
  slide.playState = "finished";
  Object.assign(rail, { left: 0, right: 49 });
  finish();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(b.styleProps.get("--lg-rail-right"), "49px", "measured where the rail came to rest");
  assert.equal(b.styleProps.get("--lg-rail-cx"), "24.5px");
  b.mod.dispose();
});

test("bot list CSS: tab only beside ds-bot's rail, full-screen layer over the chat, under ds-bot's menus", () => {
  const text = css();
  assert.match(block(text, "html.glass-skin #lg-list-tab {"), /display: none/);
  assert.match(block(text, 'body[data-bt-motion]:has([class*="sidebarCol"] .bt-rail) #lg-list-tab {'), /display: flex/);
  assert.match(block(text, ".lg-list-open #lg-list-tab {"), /display: none/);
  const { inside } = phoneSplit(text);
  assert.match(block(inside, ".lg-rail-hidden #lg-list-tab {"), /display: none/, "no tab when the phone rail is closed");
  const layer = block(text, '.lg-list-open body[data-bt-motion] [class*="_frame"] > [class*="sidebarCol"] {');
  assert.match(layer, /position: fixed/);
  assert.match(layer, /width: var\(--lg-list-w, min\(calc\(100vw - 72px\), 360px\)\)/,
    "open, a strip of the chat stays on the right on a phone; a 360px drawer on a larger screen");
  assert.match(layer, /touch-action: pan-y/, "vertical scroll stays native; sideways swipes reach the script");
  const z = Number(/z-index: (\d+)/.exec(layer)[1]);
  assert.ok(z < 60, "ds-bot's menus (z 60) stay above the list");
  assert.match(block(text, '.lg-list-open body[data-bt-motion] [class*="_frame"] {'), /grid-template-columns: var\(--lg-frame-cols/,
    "the chat keeps its grid while the sidebar is open");
  assert.match(block(text, '.lg-list-open body[data-bt-motion] [class*="_frame"] > [class*="centerCol"] {'), /grid-column: 2/);
  assert.match(block(text, '[class*="sidebarCol"] [class*="_root"][style*="width"] {'), /width: min\(calc\(100vw - 72px\), 360px\) !important/,
    "content is laid out at the open width, so the panel reveals it");
  const dim = block(text, '.lg-list-open body[data-bt-motion] [class*="_frame"] > [class*="centerCol"] {');
  assert.match(dim, /opacity: 0\.4/);
  assert.match(dim, /pointer-events: none/, "taps on the dimmed chat go to the script, which closes the list");
  assert.match(block(text, '.lg-list-open.lg-list-closing body[data-bt-motion] [class*="_frame"] > [class*="centerCol"] {'), /opacity: 1/,
    "the chat brightens while the list closes, not at the end");
  assert.match(block(text, '.lg-list-quiet body[data-bt-motion] [class*="sidebarCol"] [class*="_railIn"] * {'), /animation: none !important/,
    "DSH's rail slide-in does not play (or replay) after our close");
  assert.ok(!text.includes('.lg-list-settle body[data-bt-motion] [class*="sidebarCol"] [class*="_railIn"]'),
    "the hold is not tied to the short settle class, whose removal would restart the slide-in");
  const dissolve = block(text, '.lg-list-open.lg-list-closing body[data-bt-motion] [class*="_frame"] > [class*="sidebarCol"] > * {');
  assert.match(dissolve, /opacity: 0/);
  assert.match(dissolve, /transition: opacity [\d.]+s ease [\d.]+s/, "the list dissolves during its slide back");
  assert.match(block(text, ".lg-list-open.lg-list-drag body"), /transition: none/, "the width follows the finger");
  assert.match(block(text, ".lg-list-open #lg-list-bar {"), /display: block/);
  assert.match(block(text, "html.glass-skin [data-ds-dark-theme] {"), /--lg-list-bg: rgb\(/, "an opaque list in dark mode");
});
