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
  assert.doesNotMatch(block(text, '[data-chat-flow-kind="user"] [class*="_bubble"] {'), /backdrop-filter/);
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
      assert.match(part, /html\.glass-skin body\[data-bt-motion\]/, `unscoped ds-bot selector: ${part}`);
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
function browser({ ua = UA.chrome, brands, reduced = false } = {}) {
  let registration = null;
  const byId = new Map();
  const node = (id) => ({
    id,
    textContent: "",
    remove() { if (byId.get(this.id) === this) byId.delete(this.id); },
  });
  const classes = new Set();
  const documentElement = {
    classes,
    classList: {
      add(c) { classes.add(c); },
      remove(c) { classes.delete(c); },
      contains(c) { return classes.has(c); },
    },
  };
  const inserted = [];
  const body = {
    insertAdjacentHTML(pos, html) {
      inserted.push(html);
      const m = /^<svg[^>]*\sid="([^"]+)"/.exec(html);
      if (m) byId.set(m[1], node(m[1]));
    },
  };
  const document = {
    documentElement,
    body,
    head: { appendChild(el) { byId.set(el.id, el); } },
    createElement() { return node(null); },
    getElementById(id) { return byId.get(id) || null; },
  };
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
  };
  new Function("window", "document", "MutationObserver", source)(window, document, MutationObserver);
  const mod = registration.factory(() => ({}));
  return {
    mod, document, byId, classes, inserted, observers, listeners,
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
  assert.match(block(text, "html.glass-skin [data-composer-card]:focus-within {"), /border-color: rgba\(var\(--lg-accent\)/);
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

test("wallpaper stays one flat color", () => {
  const body = block(css(), "html.glass-skin body::before {");
  assert.match(body, /background: #dce3ee;/);
});

test("dark composer placeholder is lifted for contrast", () => {
  const body = block(css(), '[data-ds-dark-theme] [data-composer-card] [class*="_placeholder"] {');
  assert.match(body, /color: #b4bccb/);
});
