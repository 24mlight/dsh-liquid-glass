/**
 * dsh-glass-skin — client side.
 *
 * Injects a namespaced Liquid Glass stylesheet into the DSH web app and keeps
 * it alive across SPA re-renders. No DOM restructuring, no per-frame work:
 * everything visual is CSS. The JavaScript mounts the sheet and, on
 * Chromium (incl. Android WebView), one hidden <svg> holding the edge
 * refraction filters plus the html.lg-refract class, so the title pill,
 * composer and settings sheet bend what is behind them. Other engines,
 * and users who ask for reduced transparency, keep the blur-only look.
 *
 * Selector strategy (ordered by resilience to upstream rebuilds):
 *   1. Official data attributes   [data-composer-card], [data-cordis-panel], …
 *   2. Design-token overrides     --dsw-alias-bg-*, --dsw-alias-border-*
 *   3. CSS-module semantic suffix [class*="titlebar"] — hash prefix churns
 *                                  per build, semantic suffixes are stable.
 *
 * Theme handling is pure CSS keyed off [data-ds-dark-theme]; this script does
 * not track theme state.
 */
window.__ModuleLoader__.load({
  id: "dsh-glass-skin",
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;

    const NAMESPACE = "glass-skin";
    const STYLE_ID = "dsh-glass-skin-style";
    const SVG_ID = "lg-svg-defs";
    const REFRACT = "lg-refract";

    const CSS = [
      "/* ============================================================ ",
      " * dsh-glass-skin v0.3.0 — Liquid Glass",
      " * Web translation of Apple's Liquid Glass material: thin clear",
      " * fills, light frost with high saturation, edge refraction on",
      " * Chromium (SVG filter, html.lg-refract), specular rim light from",
      " * box-shadow only, flat solid fills (no gradients anywhere), small",
      " * floating pieces instead of slabs, controls that respond to touch.",
      " * Sections: tokens / wallpaper / structure / sidebar / composer /",
      " *            messages / controls / overlays / ds-bot / dark theme /",
      " *            phone layout / accessibility + no-blur fallback",
      " * ============================================================ */",

      /* ---- material tokens ------------------------------------ */
      /* Three thicknesses, like the system material: thin for content
       * accents, regular for chrome, thick for the surfaces you type on
       * and the ones that float over everything (menus, dialogs). */
      `html.${NAMESPACE} {
        --lg-fill-thin: rgba(255, 255, 255, 0.26);
        --lg-fill: rgba(255, 255, 255, 0.40);
        --lg-fill-thick: rgba(255, 255, 255, 0.58);
        --lg-fill-overlay: rgba(250, 251, 255, 0.74);
        --lg-fill-bubble: rgba(255, 255, 255, 0.62);
        --lg-blur-thin: 12px;
        --lg-blur: 22px;
        --lg-blur-thick: 34px;
        --lg-saturate: 190%;
        --lg-edge: rgba(255, 255, 255, 0.60);
        --lg-rim: rgba(255, 255, 255, 0.85);
        --lg-rim-low: rgba(255, 255, 255, 0.22);
        --lg-glow: rgba(255, 255, 255, 0.16);
        --lg-shadow: 0 1px 2px rgba(20, 30, 70, 0.06), 0 10px 30px -10px rgba(30, 45, 110, 0.22);
        --lg-shadow-lg: 0 2px 6px rgba(20, 30, 70, 0.06), 0 26px 60px -16px rgba(30, 45, 110, 0.34);
        --lg-accent: 72, 118, 255;
        --lg-radius: 22px;
        --lg-radius-lg: 28px;
        --lg-ease: cubic-bezier(0.2, 0.9, 0.25, 1.15);
        /* v0.3 clear glass: much thinner fills so content shows through */
        --lg-fill-ctl: rgba(255, 255, 255, 0.30);
        --lg-fill-sheet: rgba(248, 250, 255, 0.50);
        --lg-fill-piece: rgba(255, 255, 255, 0.42);
        --lg-fill-card: rgba(255, 255, 255, 0.30);
        --lg-blur-ctl: 3px;
        --lg-blur-sheet: 24px;
        /* specular rim + inner highlight: box-shadow only, no gradient */
        --lg-rim-glass:
          inset 0 0 0 0.5px rgba(255, 255, 255, 0.70),
          inset 1.5px 1.5px 0 -0.5px rgba(255, 255, 255, 1),
          inset -1px -1px 0 -0.25px rgba(255, 255, 255, 0.55),
          inset 0 0 6px 0 rgba(255, 255, 255, 0.28),
          inset 0 -1px 3px 0 rgba(30, 40, 80, 0.06);
        --lg-rim-piece:
          inset 0 0 0 0.5px rgba(255, 255, 255, 0.75),
          inset 1px 1px 0 -0.25px rgba(255, 255, 255, 1),
          inset 0 0 6px 0 rgba(255, 255, 255, 0.35);
        /* composer: thin top highlight + hairline only, no glow (T14) */
        --lg-rim-ctl: inset 0 1px 0 rgba(255, 255, 255, 0.95), inset 0 0 0 0.5px rgba(255, 255, 255, 0.55);
        --lg-depth: 0 1px 2px rgba(20, 30, 70, 0.08), 0 8px 24px -6px rgba(20, 30, 70, 0.22);
        --lg-depth-lg: 0 2px 6px rgba(20, 30, 70, 0.08), 0 22px 50px -12px rgba(20, 30, 70, 0.32);
        --lg-depth-sm: 0 1px 2px rgba(20, 30, 70, 0.10), 0 4px 10px -4px rgba(20, 30, 70, 0.18);
        --lg-depth-ctl: 0 1px 2px rgba(20, 30, 70, 0.06), 0 8px 24px -8px rgba(30, 45, 110, 0.24);
        /* tone applied after the frost (or the refraction) */
        --lg-tone-ctl: brightness(1.04);
        --lg-tone-sheet: brightness(1);
        --lg-halo: rgba(240, 244, 252, 0.95);
      }`,

      /* Edge refraction (Chromium only). The skin script sets
       * html.lg-refract and mounts <svg id="lg-svg-defs"> only where
       * backdrop-filter: url() renders; frost and saturation live inside
       * the SVG filters, so this replaces the blur-only value. Used on
       * three fixed surfaces: title pill, composer, settings sheet. */
      `html.${NAMESPACE}.lg-refract body {
        --lg-refract-ctl: url(#lg-refract) var(--lg-tone-ctl);
        --lg-refract-sheet: url(#lg-refract-wide) var(--lg-tone-sheet);
      }`,

      /* App tokens: the broad lever. Anything painted from these goes
       * translucent without an element-specific rule. */
      `html.${NAMESPACE} {
        --dsw-specific-sidebar-fill: transparent;
        --dsw-alias-bg-layer-1: rgba(255, 255, 255, 0.34);
        --dsw-alias-bg-layer-2: rgba(255, 255, 255, 0.46);
        --dsw-alias-bg-layer-3: rgba(255, 255, 255, 0.60);
        --dsw-alias-bg-module-platform: rgba(255, 255, 255, 0.42);
        --dsw-alias-border-l1: rgba(255, 255, 255, 0.40);
        --dsw-alias-border-l2: rgba(255, 255, 255, 0.50);
        --dsw-alias-border-l3: rgba(255, 255, 255, 0.60);
        --dsw-alias-interactive-bg-hover: rgba(255, 255, 255, 0.36);
        --dsh-scrollbar-thumb: rgba(90, 105, 150, 0.30);
        --dsh-scrollbar-thumb-hover: rgba(90, 105, 150, 0.50);
      }`,

      /* Secondary text sits directly on the translucent glass and the
       * wallpaper, where the app's light grays (caption #adb2b8,
       * tertiary #81858c) fall below 2.5:1. Darken the label ramp in
       * light mode only so every step stays >= 4.5:1. Dark mode keeps
       * the app's own values. !important because theme plugins such as
       * ds-bot write their own label tokens inline on <body>, which
       * would otherwise win (rgba(20,20,20,.6) is ~4.2:1 on glass). */
      `html.${NAMESPACE} body:not([data-ds-dark-theme]) {
        --dsw-alias-label-secondary: #2d333c !important;
        --dsw-alias-label-tertiary: #343a44 !important;
        --dsw-alias-label-caption: #434a56 !important;
      }
      html.${NAMESPACE} body:not([data-ds-dark-theme]) button:is([class$="_tabActive"], [class*="_tabActive "]) {
        color: #2a56c6;
      }`,

      /* ---- wallpaper ------------------------------------------ */
      /* One flat color, no gradients. Fixed, so scrolling never
       * repaints it (WebView-friendly). The frosting shows over the
       * content that scrolls under the sidebar, composer and menus. */
      `html.${NAMESPACE} body::before {
        content: "";
        position: fixed;
        inset: 0;
        z-index: -1;
        pointer-events: none;
        background: #dce3ee;
      }`,

      /* ---- structure ------------------------------------------- */
      /* Opaque app layers step aside so the wallpaper shows through. */
      `html.${NAMESPACE} body,
      html.${NAMESPACE} [class*="_frame"],
      html.${NAMESPACE} [class*="centerCol"],
      html.${NAMESPACE} [class*="rightbarCol"],
      html.${NAMESPACE} [class*="sidebarCol"] [class*="_root"],
      html.${NAMESPACE} [class*="_root"][data-phase],
      html.${NAMESPACE} [data-slot="main"],
      html.${NAMESPACE} [data-slot="main.conversation"],
      html.${NAMESPACE} [data-conversation-scroll],
      html.${NAMESPACE} [data-dockkit-empty] {
        background: transparent;
      }`,

      /* Native-style title bar (Windows desktop build) and the
       * conversation header: no paint of their own, the content area
       * reads as one sheet of glass under the wallpaper. */
      `html.${NAMESPACE} [class*="titlebar"],
      html.${NAMESPACE} header[class*="_header"] {
        background: transparent;
        border-color: transparent;
      }`,

      /* Shared frosting for every glass surface. */
      `html.${NAMESPACE} [data-composer-card],
      html.${NAMESPACE} [data-cordis-panel],
      html.${NAMESPACE} [role="dialog"][aria-modal="true"],
      html.${NAMESPACE} [role="dialog"][class*="_dialog"],
      html.${NAMESPACE} [data-menu-material],
      html.${NAMESPACE} [role="menu"],
      html.${NAMESPACE} [role="listbox"] {
        -webkit-backdrop-filter: blur(var(--lg-blur)) saturate(var(--lg-saturate));
        backdrop-filter: blur(var(--lg-blur)) saturate(var(--lg-saturate));
      }`,

      /* ---- sidebar: no slab, floating pieces only ------------- */
      /* The sidebar sits on the flat wallpaper, where blur and refraction
       * have nothing to show, so it draws no panel at all (same box and
       * margins as before, so nothing moves). Its controls and the
       * selected row are the glass pieces (see controls / ds-bot). */
      `html.${NAMESPACE} [class*="sidebarCol"] {
        margin: 10px 4px 10px 10px;
        border-radius: var(--lg-radius);
        background: transparent;
        border: 1px solid transparent;
        box-shadow: none;
        -webkit-backdrop-filter: none;
        backdrop-filter: none;
        overflow: hidden;
      }
      html.${NAMESPACE} [class*="sidebarCol"] [class*="_root"] {
        --dsh-sidebar-inline-padding: 8px;
        max-width: 100%;
      }
      html.${NAMESPACE} [class*="sidebarCol"] [class*="_collapsed"] {
        padding-inline: 5px;
      }
      html.${NAMESPACE} [class*="sidebarCol"] [class*="_fade"] {
        display: none;
      }`,

      /* ---- no gradients ------------------------------------------ */
      /* The app paints gradients of its own: the session-list fade
       * (transparent into the sidebar fill, which is transparent here
       * anyway), fade masks on scrollers such as the @ picker, and the
       * chat width handle, a bar that fades out above and below the
       * pointer. Flatten them: no fade, and a solid 36px bar centered
       * on the pointer. */
      `html.${NAMESPACE} :is([class$="_fade"], [class*="_fade "]) {
        background: none;
      }
      html.${NAMESPACE} :is([class$="_fadeTop"], [class*="_fadeTop "], [class$="_fadeBottom"], [class*="_fadeBottom "]) {
        -webkit-mask-image: none;
        mask-image: none;
      }
      html.${NAMESPACE} [class*="_widthHandle"]::after {
        background: var(--dsw-alias-scrollbar-bg-l1);
        top: calc(var(--dsh-width-handle-pointer-y, 50%) - 18px);
        bottom: auto;
        height: 36px;
      }`,

      /* ---- composer: clear floating glass, the hero ------------ */
      /* Conversation text scrolls underneath it and shows through, lightly
       * frosted (refracted at the edges on Chromium). No outer or inner
       * glow and no focus ring at any width: a thin top highlight, a
       * tight soft shadow, and a tinted border on focus. */
      `html.${NAMESPACE} [data-composer-card] {
        border-radius: var(--lg-radius-lg);
        background: var(--lg-fill-ctl);
        border: 1px solid transparent;
        -webkit-backdrop-filter: blur(var(--lg-blur-ctl)) saturate(var(--lg-saturate)) var(--lg-tone-ctl);
        backdrop-filter: blur(var(--lg-blur-ctl)) saturate(var(--lg-saturate)) var(--lg-tone-ctl);
        box-shadow: var(--lg-rim-ctl), var(--lg-depth-ctl);
        transition: border-color 160ms ease, transform 260ms var(--lg-ease);
      }
      html.${NAMESPACE} [data-composer-card]:focus-within {
        border-color: rgba(var(--lg-accent), 0.35);
        box-shadow: var(--lg-rim-ctl), var(--lg-depth-ctl);
      }`,

      /* Scroll edge: the app paints an opaque band behind the composer.
       * Drop it; the composer's own frosted glass covers the edge. */
      `html.${NAMESPACE} [data-phase] [data-composer-seat][data-conversation-region] {
        background: none;
      }`,

      /* ---- messages -------------------------------------------- */
      /* User bubble: thin glass tinted with the accent, like a
       * prominent glass control. Assistant text stays on the sheet.
       * Bubbles and code blocks repeat once per message inside the
       * scroller, so they get fill + rim but no backdrop-filter:
       * one compositing layer per message makes long chats stutter in
       * Android WebView, and the wallpaper behind them is a flat
       * color that looks the same blurred or not. */
      `html.${NAMESPACE} [data-chat-flow-kind="user"] [class*="_bubble"] {
        background: rgba(var(--lg-accent), 0.13);
        border: 1px solid rgba(255, 255, 255, 0.55);
        box-shadow:
          inset 1px 1px 0 var(--lg-rim),
          inset -1px -1px 0 var(--lg-rim-low),
          var(--lg-shadow);
      }`,

      /* Code blocks and tables: thin glass cards inside the answer. */
      `html.${NAMESPACE} .md-code-block {
        background: var(--lg-fill-thin);
        border: 1px solid var(--lg-edge);
        border-radius: 18px;
        box-shadow: inset 1px 1px 0 var(--lg-rim), inset -1px -1px 0 var(--lg-rim-low);
      }
      html.${NAMESPACE} .md-code-block [data-code-block-banner],
      html.${NAMESPACE} .md-code-block [data-code-block-banner] * ,
      html.${NAMESPACE} .md-code-block > div {
        background: transparent;
      }
      html.${NAMESPACE} .md-code-block [data-code-block-banner] {
        border-bottom: 1px solid var(--dsw-alias-border-l1);
      }
      html.${NAMESPACE} [class*="_markdown"] :not(pre) > code {
        background: var(--lg-fill);
        border: 1px solid var(--lg-edge);
      }
      html.${NAMESPACE} [class*="_markdown"] th,
      html.${NAMESPACE} [class*="_markdown"] td {
        border-color: var(--dsw-alias-border-l2);
      }`,

      /* Semantic-suffix cards (hash-prefixed, e.g. .k74WwW_card). Match
       * only a class that ends in _card, never _cardTitle, _cardIcon or
       * the _cards container, so plan cards don't nest glass in glass. */
      `html.${NAMESPACE} :is([class$="_card"], [class*="_card "]):not([data-composer-card]):not(.md-code-block) {
        background: var(--lg-fill-thin);
        border: 1px solid var(--lg-edge);
        border-radius: 16px;
      }`,

      /* ---- controls: interactive glass ------------------------- */
      /* Pills that lift on hover and press in on touch, like
       * .glassEffect(.interactive()). */
      `html.${NAMESPACE} button[class*="_newSession"] {
        background: var(--lg-fill);
        border: 1px solid var(--lg-edge);
        border-radius: 999px;
        box-shadow: inset 1px 1px 0 var(--lg-rim), inset -1px -1px 0 var(--lg-rim-low), var(--lg-shadow);
      }
      html.${NAMESPACE} [class*="_collapsed"] button[class*="_newSession"] {
        background: none;
        border-color: transparent;
        box-shadow: none;
      }
      html.${NAMESPACE} button[class*="_newSession"],
      html.${NAMESPACE} button[class*="_panelRow"],
      html.${NAMESPACE} button[class*="_iconButton"],
      html.${NAMESPACE} [role="treeitem"],
      html.${NAMESPACE} [role="tab"],
      html.${NAMESPACE} [data-composer-card] button {
        transition: transform 220ms var(--lg-ease), background-color 160ms ease, box-shadow 160ms ease;
      }
      html.${NAMESPACE} button[class*="_newSession"]:hover,
      html.${NAMESPACE} button[class*="_panelRow"]:hover,
      html.${NAMESPACE} button[class*="_iconButton"]:hover {
        background-color: rgba(255, 255, 255, 0.30);
        box-shadow: inset 1px 1px 0 var(--lg-rim), inset -1px -1px 0 var(--lg-rim-low), var(--lg-shadow);
      }
      html.${NAMESPACE} button[class*="_newSession"]:active,
      html.${NAMESPACE} button[class*="_panelRow"]:active,
      html.${NAMESPACE} button[class*="_iconButton"]:active,
      html.${NAMESPACE} [role="treeitem"]:active,
      html.${NAMESPACE} [data-composer-card] button:active {
        transform: scale(0.96);
      }`,

      /* ---- overlays: menus, dialogs, panels -------------------- */
      /* They float over arbitrary content and carry a lot of text, so
       * they are the most frosted sheet of glass: half-clear fill, heavy
       * blur, rim light and a deep floating shadow. */
      `html.${NAMESPACE} [data-cordis-panel],
      html.${NAMESPACE} [role="dialog"][aria-modal="true"],
      html.${NAMESPACE} [role="dialog"][class*="_dialog"],
      html.${NAMESPACE} [data-menu-material],
      html.${NAMESPACE} [role="menu"],
      html.${NAMESPACE} [role="listbox"] {
        border-radius: var(--lg-radius);
        background: var(--lg-fill-sheet);
        border: 1px solid transparent;
        -webkit-backdrop-filter: blur(var(--lg-blur-sheet)) saturate(var(--lg-saturate)) var(--lg-tone-sheet);
        backdrop-filter: blur(var(--lg-blur-sheet)) saturate(var(--lg-saturate)) var(--lg-tone-sheet);
        box-shadow: var(--lg-rim-glass), var(--lg-depth-lg);
      }`,

      /* A listbox nested in a menu or dialog (the @ picker's scroller,
       * a search dialog's results) is already inside one sheet of glass:
       * no second fill, rim or blur. */
      `html.${NAMESPACE} :is([data-menu-material], [role="menu"], [role="dialog"]) [role="listbox"] {
        background: none;
        border: 0;
        border-radius: 0;
        box-shadow: none;
        -webkit-backdrop-filter: none;
        backdrop-filter: none;
      }`,

      /* ---- edge refraction (Chromium, html.lg-refract) ------------ */
      /* Only fixed-count surfaces: the composer and the settings sheet
       * here, ds-bot's title pill and settings sheet below. Never a
       * message, row or card. */
      `html.${NAMESPACE}.lg-refract [data-composer-card] {
        -webkit-backdrop-filter: var(--lg-refract-ctl);
        backdrop-filter: var(--lg-refract-ctl);
      }
      html.${NAMESPACE}.lg-refract [data-shortcut-modal="settings"] {
        -webkit-backdrop-filter: var(--lg-refract-sheet);
        backdrop-filter: var(--lg-refract-sheet);
      }`,

      /* ---- ds-bot (multi-bot workspace) ------------------------- */
      /* ds-bot (npm "ds-bot") repaints the shell as a team of Bots: its
       * own sidebar, header pill, chat bubbles, details drawer, memory
       * and settings dialogs, menus and the Usage page. It sets
       * body[data-bt-motion] while its interface is on, so every rule
       * here is keyed on that and stays inert on plain DSH (and in
       * ds-bot's classic Agent mode). Its classes are plain, unhashed
       * .bt-* names, matched exactly.
       *
       * Tokens first: ds-bot paints almost everything from --bt-* (set
       * by its theme on "html body"); turning those translucent makes its
       * surfaces glass without per-element rules. Secondary inks are
       * darkened like the app's label ramp: rgba(text,.36) is ~2.4:1. */
      `html.${NAMESPACE} body[data-bt-motion] {
        --bt-main: var(--lg-fill-thick);
        --bt-sidebar: transparent;
        --bt-card: var(--lg-fill);
        --bt-bubble: var(--lg-fill-bubble);
        --bt-ink-2: #383e49;
        --bt-ink-3: #474e5b;
        --bt-tag-ink: #383e49;
        --bt-user: rgba(var(--lg-accent), 0.14);
        --bt-user-ink: var(--bt-ink);
        --dsw-specific-sidebar-fill: transparent !important;
        /* ds-bot's own inks, captured here before the text overrides
         * below, so a mention's icon can get them back. */
        --lg-bot-deepseek: var(--bt-ink-deepseek);
        --lg-bot-rose: var(--bt-ink-rose);
        --lg-bot-sky: var(--bt-ink-sky);
        --lg-bot-tangerine: var(--bt-ink-tangerine);
        --lg-bot-cobalt: var(--bt-ink-cobalt);
        --lg-bot-brown: var(--bt-ink-brown);
        --lg-bot-red: var(--bt-ink-red);
        --lg-bot-orange: var(--bt-ink-orange);
        --lg-bot-yellow: var(--bt-ink-yellow);
        --lg-bot-green: var(--bt-ink-green);
        --lg-bot-cyan: var(--bt-ink-cyan);
        --lg-bot-blue: var(--bt-ink-blue);
        --lg-bot-violet: var(--bt-ink-violet);
        --lg-bot-magenta: var(--bt-ink-magenta);
        --lg-bot-gray: var(--bt-ink-gray);
        --lg-bot-aurora: var(--bt-ink-aurora);
      }`,

      /* Text in a Bot's own color (group sender names, @mentions) uses
       * ds-bot's mid-tone inks (#ff5eb1, #a97efe, ...), 2-3:1 on light
       * glass. Override the inks on those text elements only: the same
       * custom property still paints the avatars elsewhere at full
       * color. A mention's icon is its ::before, painted from the same
       * custom property, so it is handed ds-bot's original ink back:
       * only the text gets darker, the Bot's color stays as drawn. */
      `html.${NAMESPACE} body[data-bt-motion]:not([data-ds-dark-theme]) :is(.bt-group-name, .bt-bubble a[href^="https://bots.local/"]) {
        --bt-ink-deepseek: #2b44c2;
        --bt-ink-rose: #b5184e;
        --bt-ink-sky: #066580;
        --bt-ink-tangerine: #a04000;
        --bt-ink-cobalt: #0725d6;
        --bt-ink-brown: #7d5a39;
        --bt-ink-red: #b80d29;
        --bt-ink-orange: #a04500;
        --bt-ink-yellow: #7d5100;
        --bt-ink-green: #006b43;
        --bt-ink-cyan: #006a60;
        --bt-ink-blue: #0a5ab4;
        --bt-ink-violet: #5b33c2;
        --bt-ink-magenta: #b0156e;
        --bt-ink-gray: #5c6170;
        --bt-ink-aurora: #006680;
      }`,
      `html.${NAMESPACE} body[data-bt-motion] .bt-bubble a[href^="https://bots.local/"]::before {
        --bt-ink-deepseek: var(--lg-bot-deepseek);
        --bt-ink-rose: var(--lg-bot-rose);
        --bt-ink-sky: var(--lg-bot-sky);
        --bt-ink-tangerine: var(--lg-bot-tangerine);
        --bt-ink-cobalt: var(--lg-bot-cobalt);
        --bt-ink-brown: var(--lg-bot-brown);
        --bt-ink-red: var(--lg-bot-red);
        --bt-ink-orange: var(--lg-bot-orange);
        --bt-ink-yellow: var(--lg-bot-yellow);
        --bt-ink-green: var(--lg-bot-green);
        --bt-ink-cyan: var(--lg-bot-cyan);
        --bt-ink-blue: var(--lg-bot-blue);
        --bt-ink-violet: var(--lg-bot-violet);
        --bt-ink-magenta: var(--lg-bot-magenta);
        --bt-ink-gray: var(--lg-bot-gray);
        --bt-ink-aurora: var(--lg-bot-aurora);
      }`,

      /* Gradients ds-bot paints itself, flattened: the fade under the
       * floating header, the exchange sheet's footer fade, the drawer
       * grip, the default ("none") swatch, the theme preview chips,
       * the loading skeletons, the "working..." shimmer and the radial
       * cut-outs between overlapping group avatars. A Bot's own color is
       * left exactly as ds-bot paints it, including Aurora's gradient
       * (avatar, swatch, mention mark, usage ring and bars), and so is
       * the rainbow custom-color swatch in Bot settings. */
      `html.${NAMESPACE} body[data-bt-motion] header:is([class$="_header"], [class*="_header "])::before,
      html.${NAMESPACE} body[data-bt-motion] .bt-exchange .bt-dialog-foot::before {
        background: none;
      }
      html.${NAMESPACE} body[data-bt-motion] .bt-panel-grip:hover,
      html.${NAMESPACE} body[data-bt-motion] .bt-panel[data-dragging] .bt-panel-grip {
        box-sizing: border-box;
        padding: 0 2px 0 4px;
        background: var(--bt-line-2);
        background-clip: content-box;
      }
      html.${NAMESPACE} body[data-bt-motion] .bt-swatch-default {
        position: relative;
        background: var(--bt-card);
      }
      html.${NAMESPACE} body[data-bt-motion] .bt-swatch-default::after {
        content: "";
        position: absolute;
        left: 50%;
        top: 2px;
        bottom: 2px;
        width: 2px;
        margin-left: -1px;
        background: var(--bt-line-2);
        transform: rotate(45deg);
      }
      html.${NAMESPACE} body[data-bt-motion] .bt-theme-chip {
        background: var(--lb);
        box-shadow: inset 0 0 0 1px var(--bt-line-2), inset calc(46px * 0.36) 0 0 var(--ls);
      }
      html.${NAMESPACE} body[data-bt-motion] :is(.bt-mem-skel-block span, .bt-us-skel) {
        background: var(--bt-hover);
        animation: lg-breathe 1.4s ease-in-out infinite;
      }
      html.${NAMESPACE} body[data-bt-motion] .bt-shimmer {
        background: none;
        color: var(--bt-ink-2);
        animation: lg-breathe 2.2s ease-in-out infinite;
      }
      @keyframes lg-breathe {
        50% { opacity: 0.72; }
      }
      html.${NAMESPACE} body[data-bt-motion] .bt-cluster > span {
        -webkit-mask-image: none !important;
        mask-image: none !important;
      }
      html.${NAMESPACE} body[data-bt-motion] .bt-ptabs-in {
        -webkit-mask-image: none;
        mask-image: none;
      }
      html.${NAMESPACE} body[data-bt-motion] .bt-bcard-preview {
        background: var(--bt-main);
      }`,

      /* Collapsed sidebar (the phone layout): ds-bot's rail holds 36px
       * avatars and moves the account button into the foot row, which
       * the floating sidebar's inset leaves too narrow; the button
       * spilled out on the left. Give the rail its full width and center
       * the foot. */
      `html.${NAMESPACE} body[data-bt-motion] [class*="sidebarCol"] [class*="_collapsed"] {
        padding-inline: 0;
      }
      html.${NAMESPACE} body[data-bt-motion] [class*="sidebarCol"] [class*="_collapsed"] :is([class$="_footArea"], [class*="_footArea "]) {
        justify-content: center;
        gap: 0;
        padding-inline: 0 !important;
      }`,

      /* Header: ds-bot floats a pill over the transcript. Make it a
       * clear glass control (one element, so it can afford the blur and,
       * on Chromium, the refraction). */
      `html.${NAMESPACE} body[data-bt-motion] .bt-pill {
        background: var(--lg-fill-ctl);
        border: 1px solid transparent;
        -webkit-backdrop-filter: blur(var(--lg-blur-ctl)) saturate(var(--lg-saturate)) var(--lg-tone-ctl);
        backdrop-filter: blur(var(--lg-blur-ctl)) saturate(var(--lg-saturate)) var(--lg-tone-ctl);
        box-shadow: var(--lg-rim-glass), var(--lg-depth);
      }
      html.${NAMESPACE} body[data-bt-motion] .bt-pill:hover {
        background: var(--lg-fill-sheet);
      }`,

      /* Composer: ds-bot restyles [data-composer-card] with !important
       * (opaque fill, hairline border, flat shadow), so the hero glass
       * needs !important to come back. Its radius morph stays. The new
       * chat composer gets the same clear glass. No glow and no focus
       * ring at any width: a thin top highlight, a tight soft shadow and
       * a tinted border on focus. */
      `html.${NAMESPACE} body[data-bt-motion] [data-composer-card],
      html.${NAMESPACE} body[data-bt-motion] .bt-nc-card {
        background: var(--lg-fill-ctl) !important;
        border: 1px solid transparent !important;
        -webkit-backdrop-filter: blur(var(--lg-blur-ctl)) saturate(var(--lg-saturate)) var(--lg-tone-ctl);
        backdrop-filter: blur(var(--lg-blur-ctl)) saturate(var(--lg-saturate)) var(--lg-tone-ctl);
        box-shadow: var(--lg-rim-ctl), var(--lg-depth-ctl) !important;
      }
      html.${NAMESPACE} body[data-bt-motion] [data-composer-card]:focus-within,
      html.${NAMESPACE} body[data-bt-motion] .bt-nc-card:focus-within {
        border-color: rgba(var(--lg-accent), 0.35) !important;
        box-shadow: var(--lg-rim-ctl), var(--lg-depth-ctl) !important;
      }
      html.${NAMESPACE} body[data-bt-motion] .bt-mem-ask {
        background: var(--lg-fill-thick);
        border: 1px solid var(--lg-edge);
        box-shadow: inset 1px 1px 0 var(--lg-rim), inset -1px -1px 0 var(--lg-rim-low), var(--lg-shadow);
      }`,

      /* Details drawer and full-height panes: floating glass sheets,
       * inset from the window edge, frosted like the dialogs. */
      `html.${NAMESPACE} body[data-bt-motion] .bt-panel,
      html.${NAMESPACE} body[data-bt-motion] .bt-pane {
        top: calc(var(--dsh-frame-chrome-top, 0px) + 10px);
        right: 10px;
        bottom: 10px;
        border-radius: var(--lg-radius);
        border: 1px solid transparent;
        overflow: hidden;
        box-shadow: var(--lg-rim-glass), var(--lg-depth-lg);
      }
      html.${NAMESPACE} body[data-bt-motion] .bt-panel {
        background: var(--lg-fill-sheet);
        -webkit-backdrop-filter: blur(var(--lg-blur-sheet)) saturate(var(--lg-saturate)) var(--lg-tone-sheet);
        backdrop-filter: blur(var(--lg-blur-sheet)) saturate(var(--lg-saturate)) var(--lg-tone-sheet);
      }
      html.${NAMESPACE} body[data-bt-motion] .bt-panel[data-leaving] {
        transform: translateX(calc(100% + 12px));
      }
      html.${NAMESPACE} body[data-bt-motion] .bt-pane {
        margin-left: 6px;
        background: var(--lg-fill-sheet);
        -webkit-backdrop-filter: blur(var(--lg-blur-sheet)) saturate(var(--lg-saturate)) var(--lg-tone-sheet);
        backdrop-filter: blur(var(--lg-blur-sheet)) saturate(var(--lg-saturate)) var(--lg-tone-sheet);
      }`,

      /* Popovers ds-bot draws without a menu/dialog role (the role ones
       * already get the overlay glass above): the recipient dropdown,
       * the avatar editor, tooltips, the date-range picker, the update
       * popover. Their inner listboxes sit inside one sheet of glass
       * and must not draw a second one. */
      `html.${NAMESPACE} body[data-bt-motion] :is(.bt-drop, .bt-avedit, .bt-connect-tip, .bt-us-pick, .bt-update-pop, .bt-mic-note, .bt-us-tip) {
        background: var(--lg-fill-sheet);
        border: 1px solid transparent;
        color: var(--bt-ink);
        -webkit-backdrop-filter: blur(var(--lg-blur-sheet)) saturate(var(--lg-saturate)) var(--lg-tone-sheet);
        backdrop-filter: blur(var(--lg-blur-sheet)) saturate(var(--lg-saturate)) var(--lg-tone-sheet);
        box-shadow: var(--lg-rim-glass), var(--lg-depth-lg);
      }
      html.${NAMESPACE} body[data-bt-motion] .bt-drop-list[role="listbox"] {
        background: none;
        border: 0;
        border-radius: 0;
        box-shadow: none;
        -webkit-backdrop-filter: none;
        backdrop-filter: none;
      }`,

      /* Repeated content (bubbles, cards, rows): fill and rim only, no
       * backdrop-filter, same as DSH's own messages. */
      `html.${NAMESPACE} body[data-bt-motion] :is(.bt-bubble, .bt-q, .bt-ububble) {
        box-shadow: inset 1px 1px 0 var(--lg-rim), inset -1px -1px 0 var(--lg-rim-low);
      }
      html.${NAMESPACE} body[data-bt-motion] :is(.bt-set-card, .bt-us-card, .bt-us-stats, .bt-create-looks, .bt-create-inline, .bt-mem-row, .bt-addlist, .bt-q-list) {
        border-color: var(--lg-edge);
        box-shadow: inset 1px 1px 0 var(--lg-rim), inset -1px -1px 0 var(--lg-rim-low);
      }
      /* The sidebar has no panel: its controls and the selected item are
       * small glass pieces (fill + rim only; repeated, so no blur). */
      html.${NAMESPACE} body[data-bt-motion] :is(.bt-row, .bt-tile, .bt-settings-item)[aria-current="page"],
      html.${NAMESPACE} body[data-bt-motion] .bt-settings-nav > .bt-thumb {
        background: var(--lg-fill-piece);
        box-shadow: var(--lg-rim-piece), var(--lg-depth-sm);
      }
      html.${NAMESPACE} body[data-bt-motion] :is(.bt-round, .bt-you, .bt-connect-foot, .bt-plus) {
        background: var(--lg-fill-piece);
        border-color: transparent;
        box-shadow: var(--lg-rim-piece), var(--lg-depth-sm);
      }

      /* Settings sheet: one sheet of glass. ds-bot paints a white nav
       * column and a grey detail pane inside it; both step aside, and the
       * cards inside become thin glass. The dim behind it is lighter so
       * the sheet has something to show. */
      html.${NAMESPACE} body[data-bt-motion] .bt-settings {
        --bt-main: transparent;
        --bt-sidebar: transparent;
      }
      html.${NAMESPACE} body[data-bt-motion] .bt-settings-nav {
        background: transparent;
      }
      html.${NAMESPACE} body[data-bt-motion] .bt-settings :is(.bt-set-card, .bt-us-card, .bt-us-stats) {
        background: var(--lg-fill-card);
        border-color: transparent;
        box-shadow: var(--lg-rim-piece);
      }
      html.${NAMESPACE} body[data-bt-motion] .bt-scrim {
        background: rgba(10, 16, 40, 0.14);
      }

      /* Edge refraction on ds-bot's two fixed surfaces (Chromium).
       * :where() keeps the selector scoped like every ds-bot rule and
       * adds no specificity; source order makes it win. */
      html.${NAMESPACE} body[data-bt-motion] .bt-pill:where(.lg-refract *) {
        -webkit-backdrop-filter: var(--lg-refract-ctl);
        backdrop-filter: var(--lg-refract-ctl);
      }
      html.${NAMESPACE} body[data-bt-motion] .bt-settings:where(.lg-refract *) {
        -webkit-backdrop-filter: var(--lg-refract-sheet);
        backdrop-filter: var(--lg-refract-sheet);
      }
      html.${NAMESPACE} body[data-bt-motion] .bt-mem-send {
        color: #ffffff;
      }

      /* Filled accent buttons: white on ds-bot's #4d6bfe is 4.3:1.
       * Deepen whatever accent the theme picked by a fixed share of
       * black, so the label clears 4.5:1 in both themes. */
      html.${NAMESPACE} body[data-bt-motion] :is(.bt-send, .bt-q-submit):not(:disabled) {
        background: color-mix(in srgb, var(--bt-accent) 80%, #000000);
        color: #ffffff;
      }`,


      /* ---- scrollbars ------------------------------------------- */
      /* Mouse and trackpad only. A custom ::-webkit-scrollbar turns the
       * overlay scrollbars of touch WebViews into always-painted ones
       * (the stray grey pill next to the composer's mic on Android). */
      `@media (hover: hover) and (pointer: fine) {
        html.${NAMESPACE} ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        html.${NAMESPACE} ::-webkit-scrollbar-thumb {
          background: var(--dsh-scrollbar-thumb);
          border-radius: 8px;
        }
        html.${NAMESPACE} ::-webkit-scrollbar-thumb:hover {
          background: var(--dsh-scrollbar-thumb-hover);
        }
      }`,

      /* The turns/steps line under the composer sits on scrolling
       * content: a soft halo of the wallpaper color keeps it legible. */
      `html.${NAMESPACE} [data-composer-seat] [class*="_stats"] {
        text-shadow: 0 0 6px var(--lg-halo), 0 0 2px var(--lg-halo);
      }`,

      /* ---- dark theme ------------------------------------------- */
      /* [data-ds-dark-theme] is set on <body> by the app itself. Dark
       * glass is smoked rather than milky, with a dimmer rim. */
      `html.${NAMESPACE} [data-ds-dark-theme] {
        --lg-fill-thin: rgba(30, 36, 58, 0.30);
        --lg-fill: rgba(26, 31, 50, 0.44);
        --lg-fill-thick: rgba(22, 27, 44, 0.60);
        --lg-fill-overlay: rgba(22, 26, 42, 0.80);
        --lg-fill-bubble: rgba(58, 66, 98, 0.42);
        --lg-fill-ctl: rgba(22, 27, 44, 0.56);
        --lg-fill-sheet: rgba(20, 24, 40, 0.58);
        --lg-fill-piece: rgba(255, 255, 255, 0.10);
        --lg-fill-card: rgba(255, 255, 255, 0.06);
        --lg-rim-glass:
          inset 0 0 0 0.5px rgba(255, 255, 255, 0.16),
          inset 1.5px 1.5px 0 -0.5px rgba(255, 255, 255, 0.42),
          inset -1px -1px 0 -0.25px rgba(255, 255, 255, 0.14),
          inset 0 0 12px 0 rgba(170, 190, 255, 0.07);
        --lg-rim-piece:
          inset 0 0 0 0.5px rgba(255, 255, 255, 0.16),
          inset 1px 1px 0 -0.25px rgba(255, 255, 255, 0.36);
        --lg-rim-ctl: inset 0 1px 0 rgba(255, 255, 255, 0.26), inset 0 0 0 0.5px rgba(255, 255, 255, 0.12);
        --lg-depth: 0 1px 2px rgba(0, 0, 0, 0.35), 0 10px 28px -6px rgba(0, 0, 0, 0.55);
        --lg-depth-lg: 0 2px 6px rgba(0, 0, 0, 0.40), 0 24px 56px -12px rgba(0, 0, 0, 0.70);
        --lg-depth-sm: 0 1px 2px rgba(0, 0, 0, 0.35), 0 4px 10px -4px rgba(0, 0, 0, 0.45);
        --lg-depth-ctl: 0 1px 2px rgba(0, 0, 0, 0.30), 0 10px 28px -8px rgba(0, 0, 0, 0.55);
        --lg-tone-ctl: brightness(0.92);
        --lg-tone-sheet: brightness(0.9);
        --lg-halo: rgba(12, 16, 32, 0.95);
        --lg-edge: rgba(255, 255, 255, 0.13);
        --lg-rim: rgba(255, 255, 255, 0.26);
        --lg-rim-low: rgba(255, 255, 255, 0.05);
        --lg-glow: rgba(140, 170, 255, 0.06);
        --lg-shadow: 0 1px 2px rgba(0, 0, 0, 0.30), 0 12px 32px -10px rgba(0, 0, 0, 0.55);
        --lg-shadow-lg: 0 2px 6px rgba(0, 0, 0, 0.35), 0 28px 64px -16px rgba(0, 0, 0, 0.70);
        --lg-accent: 110, 150, 255;
        --dsw-alias-bg-layer-1: rgba(34, 40, 62, 0.36);
        --dsw-alias-bg-layer-2: rgba(38, 44, 68, 0.50);
        --dsw-alias-bg-layer-3: rgba(42, 48, 74, 0.64);
        --dsw-alias-bg-module-platform: rgba(34, 40, 62, 0.46);
        --dsw-alias-border-l1: rgba(255, 255, 255, 0.08);
        --dsw-alias-border-l2: rgba(255, 255, 255, 0.11);
        --dsw-alias-border-l3: rgba(255, 255, 255, 0.15);
        --dsw-alias-interactive-bg-hover: rgba(255, 255, 255, 0.08);
        --dsh-scrollbar-thumb: rgba(180, 190, 230, 0.22);
        --dsh-scrollbar-thumb-hover: rgba(180, 190, 230, 0.38);
      }`,

      `html.${NAMESPACE} [data-ds-dark-theme] button[class*="_newSession"]:hover,
      html.${NAMESPACE} [data-ds-dark-theme] button[class*="_panelRow"]:hover,
      html.${NAMESPACE} [data-ds-dark-theme] button[class*="_iconButton"]:hover {
        background-color: rgba(255, 255, 255, 0.08);
      }
      html.${NAMESPACE} [data-ds-dark-theme] [data-composer-card] [class*="_placeholder"] {
        color: #b4bccb;
      }
      html.${NAMESPACE} [data-ds-dark-theme] [data-chat-flow-kind="user"] [class*="_bubble"] {
        border-color: rgba(255, 255, 255, 0.14);
        background: rgba(var(--lg-accent), 0.20);
      }`,

      `html.${NAMESPACE} body[data-ds-dark-theme]::before {
        background: #0c1020;
      }`,

      /* ds-bot, dark: lighter secondary inks, lifted Bot inks for names
       * and mentions, and its dark theme-chip variant flattened. */
      `html.${NAMESPACE} body[data-bt-motion][data-ds-dark-theme] {
        --bt-ink-2: #b9c0cd;
        --bt-ink-3: #a7aebc;
        --bt-tag-ink: #b9c0cd;
        --bt-user: rgba(var(--lg-accent), 0.22);
      }
      html.${NAMESPACE} body[data-bt-motion][data-ds-dark-theme] :is(.bt-group-name, .bt-bubble a[href^="https://bots.local/"]) {
        --bt-ink-deepseek: #8aa0ff;
        --bt-ink-rose: #ff7a93;
        --bt-ink-cobalt: #8296ff;
        --bt-ink-brown: #c49a72;
        --bt-ink-red: #ff6b78;
        --bt-ink-orange: #ff8c40;
        --bt-ink-yellow: #ffb547;
        --bt-ink-green: #2fd08a;
        --bt-ink-cyan: #2fd3c0;
        --bt-ink-blue: #5aa8ff;
        --bt-ink-violet: #b896ff;
        --bt-ink-magenta: #ff74bd;
        --bt-ink-gray: #a3a8b4;
      }
      html.${NAMESPACE} body[data-bt-motion][data-ds-dark-theme] .bt-theme-chip {
        background: var(--db);
        box-shadow: inset 0 0 0 1px var(--bt-line-2), inset calc(46px * 0.36) 0 0 var(--ds);
      }
      html.${NAMESPACE} body[data-bt-motion][data-ds-dark-theme] .bt-mem-send {
        color: #10131c;
      }
      html.${NAMESPACE} body[data-bt-motion][data-ds-dark-theme] .bt-scrim {
        background: rgba(0, 0, 0, 0.30);
      }
      html.${NAMESPACE} body[data-bt-motion][data-ds-dark-theme] .bt-danger {
        color: #ff6b78;
      }`,

      /* ---- phone layout (<= 480px) ------------------------------ */
      /* Phones only; nothing here applies on desktop. Assistant replies
       * run full width without a bubble (user bubbles keep the accent
       * glass), the bot rail is tighter, the settings dialogs (ds-bot and
       * DSH Harness) become full-screen sheets with a top tab strip, the
       * details drawer becomes a full-width sheet, Usage stat tiles go
       * 2x2, and the composer's text scroller shows no scrollbar. */
      `@media (max-width: 480px) {
        html.${NAMESPACE} [data-composer-card] [data-input-scroll] {
          scrollbar-width: none;
        }
        html.${NAMESPACE} [data-composer-card] [data-input-scroll]::-webkit-scrollbar {
          display: none;
        }

        html.${NAMESPACE} [class*="sidebarCol"] {
          margin: 6px 0 6px 6px;
        }
        html.${NAMESPACE} body[data-bt-motion] :is([class$="_scroll"], [class*="_scroll "]):has(> [data-chat-flow]) {
          padding-left: 10px !important;
          padding-right: 8px !important;
        }
        html.${NAMESPACE} body[data-bt-motion] .bt-astack > .bt-msg,
        html.${NAMESPACE} body[data-bt-motion] .bt-astack[data-lead] > .bt-msg {
          max-width: 100%;
          width: 100%;
        }
        html.${NAMESPACE} body[data-bt-motion] .bt-astack .bt-bubble {
          max-width: none;
          width: 100%;
          background: transparent;
          box-shadow: none;
          padding-left: 4px;
          padding-right: 4px;
        }
        html.${NAMESPACE} body[data-bt-motion] .bt-ububble {
          max-width: 85%;
        }

        html.${NAMESPACE} body[data-bt-motion] .bt-settings {
          --bt-set-w: calc(100vw - 16px);
          --bt-set-h: calc(100dvh - 16px);
          flex-direction: column;
        }
        html.${NAMESPACE} body[data-bt-motion] .bt-settings-nav {
          width: auto;
          flex-direction: row;
          flex-wrap: nowrap;
          overflow-x: auto;
          scrollbar-width: none;
          padding: 52px 8px 8px;
          gap: 4px;
          border-right: 0;
          border-bottom: 0.5px solid var(--bt-line);
        }
        html.${NAMESPACE} body[data-bt-motion] .bt-settings-nav > .bt-thumb {
          display: none;
        }
        html.${NAMESPACE} body[data-bt-motion] .bt-settings-item {
          flex: none;
          white-space: nowrap;
          padding: 6px 10px;
          border-radius: 999px;
        }
        html.${NAMESPACE} body[data-bt-motion] .bt-settings-shell {
          margin-top: 0 !important;
        }
        html.${NAMESPACE} body[data-bt-motion] .bt-settings-main {
          width: 100%;
          flex: 1 1 auto;
          height: auto;
          min-height: 0;
        }
        html.${NAMESPACE} body[data-bt-motion] .bt-settings-head {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          padding: 14px 56px 0 20px;
          pointer-events: none;
        }
        html.${NAMESPACE} body[data-bt-motion] .bt-settings-head > * {
          pointer-events: auto;
        }
        html.${NAMESPACE} body[data-bt-motion] .bt-settings-scroll {
          padding: 12px 14px 20px;
        }
        html.${NAMESPACE} body[data-bt-motion] .bt-set-row {
          flex-wrap: wrap;
        }
        html.${NAMESPACE} body[data-bt-motion] .bt-set-copy {
          flex: 1 1 180px;
        }
        html.${NAMESPACE} body[data-bt-motion] .bt-us-stats {
          grid-template-columns: 1fr 1fr;
        }
        html.${NAMESPACE} body[data-bt-motion] .bt-us-stat:nth-child(odd) {
          border-left: 0;
        }
        html.${NAMESPACE} body[data-bt-motion] .bt-us-stat:nth-child(n + 3) {
          border-top: 1px solid var(--bt-line);
        }

        html.${NAMESPACE} [data-shortcut-modal="settings"] {
          flex-direction: column;
          width: calc(100vw - 16px) !important;
          max-width: none;
          height: calc(100dvh - 16px) !important;
        }
        html.${NAMESPACE} [data-shortcut-modal="settings"] > nav {
          width: auto;
          flex: none;
          flex-direction: row;
          align-items: center;
          padding: 8px 48px 8px 12px;
          border-right: 0;
          overflow-x: auto;
          scrollbar-width: none;
        }
        html.${NAMESPACE} [data-shortcut-modal="settings"] > nav > div {
          display: flex;
          flex-direction: row;
          flex: none;
          width: auto;
          gap: 4px;
          margin: 0;
          padding: 0;
        }
        html.${NAMESPACE} [data-shortcut-modal="settings"] > nav button {
          width: auto;
          flex: none;
          white-space: nowrap;
        }
        html.${NAMESPACE} [data-shortcut-modal="settings"] > nav > div:first-child {
          margin-right: 8px;
        }
        html.${NAMESPACE} [data-shortcut-modal="settings"] > div {
          width: 100%;
          flex: 1 1 auto;
          min-height: 0;
        }

        html.${NAMESPACE} body[data-bt-motion] .bt-panel {
          --bt-panel-w: calc(100vw - 16px);
          left: 8px;
          right: 8px;
          top: 8px;
          bottom: 8px;
          width: auto;
        }
        html.${NAMESPACE} body[data-bt-motion] .bt-pane {
          left: 8px;
          right: 8px;
          top: 8px;
          bottom: 8px;
          margin-left: 0;
        }
      }`,

      /* ---- accessibility + graceful degradation ----------------- */
      /* Users who ask for less transparency, and engines without
       * backdrop-filter, get near-opaque surfaces so text stays
       * readable over the wallpaper. */
      `@media (prefers-reduced-transparency: reduce) {
        html.${NAMESPACE} {
          --lg-fill-thin: rgba(255, 255, 255, 0.88);
          --lg-fill: rgba(255, 255, 255, 0.92);
          --lg-fill-thick: rgba(255, 255, 255, 0.96);
          --lg-fill-overlay: rgba(255, 255, 255, 0.98);
          --lg-fill-bubble: rgba(255, 255, 255, 0.94);
          --lg-fill-ctl: rgba(255, 255, 255, 0.94);
          --lg-fill-sheet: rgba(255, 255, 255, 0.97);
          --lg-fill-piece: rgba(255, 255, 255, 0.92);
          --lg-fill-card: rgba(255, 255, 255, 0.92);
        }
        html.${NAMESPACE} [data-ds-dark-theme] {
          --lg-fill-thin: rgba(24, 28, 42, 0.90);
          --lg-fill: rgba(24, 28, 42, 0.94);
          --lg-fill-thick: rgba(22, 26, 40, 0.97);
          --lg-fill-overlay: rgba(22, 26, 40, 0.98);
          --lg-fill-bubble: rgba(40, 46, 66, 0.96);
          --lg-fill-ctl: rgba(22, 26, 40, 0.97);
          --lg-fill-sheet: rgba(22, 26, 40, 0.98);
          --lg-fill-piece: rgba(40, 46, 66, 0.96);
          --lg-fill-card: rgba(40, 46, 66, 0.96);
        }
        html.${NAMESPACE}.lg-refract body {
          --lg-refract-ctl: blur(var(--lg-blur-ctl)) saturate(var(--lg-saturate)) var(--lg-tone-ctl);
          --lg-refract-sheet: blur(var(--lg-blur-sheet)) saturate(var(--lg-saturate)) var(--lg-tone-sheet);
        }
      }`,
      `@media (prefers-reduced-motion: reduce) {
        html.${NAMESPACE} * {
          transition: none !important;
        }
      }`,
      `@supports not ((-webkit-backdrop-filter: blur(1px)) or (backdrop-filter: blur(1px))) {
        html.${NAMESPACE} {
          --lg-fill-thin: rgba(255, 255, 255, 0.88);
          --lg-fill: rgba(255, 255, 255, 0.92);
          --lg-fill-thick: rgba(255, 255, 255, 0.96);
          --lg-fill-overlay: rgba(255, 255, 255, 0.98);
          --lg-fill-bubble: rgba(255, 255, 255, 0.94);
          --lg-fill-ctl: rgba(255, 255, 255, 0.94);
          --lg-fill-sheet: rgba(255, 255, 255, 0.97);
          --lg-fill-piece: rgba(255, 255, 255, 0.92);
          --lg-fill-card: rgba(255, 255, 255, 0.92);
        }
        html.${NAMESPACE} [data-ds-dark-theme] {
          --lg-fill-thin: rgba(24, 28, 42, 0.90);
          --lg-fill: rgba(24, 28, 42, 0.94);
          --lg-fill-thick: rgba(22, 26, 40, 0.97);
          --lg-fill-overlay: rgba(22, 26, 40, 0.98);
          --lg-fill-bubble: rgba(40, 46, 66, 0.96);
          --lg-fill-ctl: rgba(22, 26, 40, 0.97);
          --lg-fill-sheet: rgba(22, 26, 40, 0.98);
          --lg-fill-piece: rgba(40, 46, 66, 0.96);
          --lg-fill-card: rgba(40, 46, 66, 0.96);
        }
      }`,
    ].join("\n");

    /**
     * Edge refraction filters for backdrop-filter: url(#…) (Chromium).
     * The displacement map is derived from the filter region itself:
     * flood -> blur gives a ramp at the edges, offset differences give
     * its x/y slope (R/G), and feDisplacementMap bends the frosted
     * backdrop along it, like the rim of a lens. Works for any element
     * size with no image and no per-frame JS. Frost and saturation live
     * inside the filter (mixing CSS blur() with url() blurs twice).
     *   lg-refract       small controls: title pill, composer
     *   lg-refract-wide  sheets: settings dialogs
     */
    const SVG =
      '<svg xmlns="http://www.w3.org/2000/svg" id="' + SVG_ID + '" width="0" height="0" aria-hidden="true" focusable="false" ' +
      'style="position:absolute;width:0;height:0;overflow:hidden;pointer-events:none">' +
      '<filter id="lg-refract" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">' +
      '<feFlood flood-color="#fff" result="fl"/>' +
      '<feGaussianBlur in="fl" stdDeviation="6" edgeMode="none" result="ramp"/>' +
      '<feColorMatrix in="ramp" type="matrix" values="0 0 0 1 0  0 0 0 1 0  0 0 0 0 0  0 0 0 0 1" result="a"/>' +
      '<feComponentTransfer in="a" result="inv"><feFuncR type="table" tableValues="1 0"/><feFuncG type="table" tableValues="1 0"/></feComponentTransfer>' +
      '<feOffset in="a" dx="3" result="xa"/><feOffset in="inv" dx="-3" result="xb"/>' +
      '<feComposite in="xa" in2="xb" operator="arithmetic" k2="0.5" k3="0.5" result="dx"/>' +
      '<feOffset in="a" dy="3" result="ya"/><feOffset in="inv" dy="-3" result="yb"/>' +
      '<feComposite in="ya" in2="yb" operator="arithmetic" k2="0.5" k3="0.5" result="dy"/>' +
      '<feColorMatrix in="dx" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0 1" result="dxr"/>' +
      '<feColorMatrix in="dy" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 0 1" result="dyg"/>' +
      '<feComposite in="dxr" in2="dyg" operator="arithmetic" k2="1" k3="1" result="map0"/>' +
      '<feComponentTransfer in="map0" result="map"><feFuncR type="linear" slope="4" intercept="-1.5"/><feFuncG type="linear" slope="4" intercept="-1.5"/></feComponentTransfer>' +
      '<feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="frost"/>' +
      '<feColorMatrix in="frost" type="saturate" values="1.9" result="frost2"/>' +
      '<feDisplacementMap in="frost2" in2="map" scale="-24" xChannelSelector="R" yChannelSelector="G"/>' +
      '</filter>' +
      '<filter id="lg-refract-wide" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">' +
      '<feFlood flood-color="#fff" result="fl"/>' +
      '<feGaussianBlur in="fl" stdDeviation="10" edgeMode="none" result="ramp"/>' +
      '<feColorMatrix in="ramp" type="matrix" values="0 0 0 1 0  0 0 0 1 0  0 0 0 0 0  0 0 0 0 1" result="a"/>' +
      '<feComponentTransfer in="a" result="inv"><feFuncR type="table" tableValues="1 0"/><feFuncG type="table" tableValues="1 0"/></feComponentTransfer>' +
      '<feOffset in="a" dx="4" result="xa"/><feOffset in="inv" dx="-4" result="xb"/>' +
      '<feComposite in="xa" in2="xb" operator="arithmetic" k2="0.5" k3="0.5" result="dx"/>' +
      '<feOffset in="a" dy="4" result="ya"/><feOffset in="inv" dy="-4" result="yb"/>' +
      '<feComposite in="ya" in2="yb" operator="arithmetic" k2="0.5" k3="0.5" result="dy"/>' +
      '<feColorMatrix in="dx" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0 1" result="dxr"/>' +
      '<feColorMatrix in="dy" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 0 1" result="dyg"/>' +
      '<feComposite in="dxr" in2="dyg" operator="arithmetic" k2="1" k3="1" result="map0"/>' +
      '<feComponentTransfer in="map0" result="map"><feFuncR type="linear" slope="3" intercept="-1"/><feFuncG type="linear" slope="3" intercept="-1"/></feComponentTransfer>' +
      '<feGaussianBlur in="SourceGraphic" stdDeviation="11" result="frost"/>' +
      '<feColorMatrix in="frost" type="saturate" values="1.9" result="frost2"/>' +
      '<feDisplacementMap in="frost2" in2="map" scale="-36" xChannelSelector="R" yChannelSelector="G"/>' +
      '</filter>' +
      '</svg>';

    let observer = null;
    let reducedQuery = null;

    /** Engines that render SVG filters in backdrop-filter: Chromium
     * (Chrome, Edge, Android WebView, Samsung Internet, ...). Firefox and
     * Safari parse url() there but draw nothing, so they keep blur(). */
    function isChromium() {
      const nav = window.navigator;
      if (!nav) return false;
      const brands = nav.userAgentData && nav.userAgentData.brands;
      if (Array.isArray(brands) && brands.length) {
        return brands.some((b) => /Chromium/i.test(String(b && b.brand)));
      }
      return /\b(?:Chrome|Chromium)\/\d/.test(String(nav.userAgent || ""));
    }

    function reducesTransparency() {
      return Boolean(
        typeof window.matchMedia === "function" &&
          window.matchMedia("(prefers-reduced-transparency: reduce)").matches,
      );
    }

    function wantsRefraction() {
      return isChromium() && !reducesTransparency();
    }

    /** True when the refraction class / <svg> don't match what we want. */
    function refractionOutOfSync() {
      const on = document.documentElement.classList.contains(REFRACT);
      const svg = Boolean(document.getElementById(SVG_ID));
      return wantsRefraction() ? !on || !svg : on || svg;
    }

    /** Mount or remove the refraction <svg> and html.lg-refract.
     * Idempotent: writes only what is missing or stale. */
    function mountRefraction() {
      const root = document.documentElement;
      const svg = document.getElementById(SVG_ID);
      if (wantsRefraction()) {
        if (!svg && document.body) {
          document.body.insertAdjacentHTML("beforeend", SVG);
        }
        if (!root.classList.contains(REFRACT)) root.classList.add(REFRACT);
      } else {
        if (svg) svg.remove();
        if (root.classList.contains(REFRACT)) root.classList.remove(REFRACT);
      }
    }

    /**
     * Mount (or re-mount) the stylesheet and namespace class. Idempotent:
     * safe to call on every mutation tick.
     */
    function mount() {
      const root = document.documentElement;
      if (!root.classList.contains(NAMESPACE)) {
        root.classList.add(NAMESPACE);
      }
      let style = document.getElementById(STYLE_ID);
      if (!style) {
        style = document.createElement("style");
        style.id = STYLE_ID;
        document.head.appendChild(style);
      }
      if (style.textContent !== CSS) {
        style.textContent = CSS;
      }
      mountRefraction();
    }

    /**
     * Keep the skin alive. Re-mounts when the <style> tag is removed (e.g.
     * HMR in dev profiles) or when the app rewrites html.className (e.g. on
     * a theme switch) and drops the namespace class. Also re-mounts the
     * refraction <svg> if a re-render drops it from <body>, and follows
     * the reduced-transparency setting live. mount() only writes when
     * something is missing, so re-adding the class doesn't loop.
     */
    function observe() {
      if (observer) return;
      observer = new MutationObserver(() => {
        if (
          !document.getElementById(STYLE_ID) ||
          !document.documentElement.classList.contains(NAMESPACE) ||
          refractionOutOfSync()
        ) {
          mount();
        }
      });
      observer.observe(document.head, { childList: true });
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"],
      });
      if (document.body) observer.observe(document.body, { childList: true });
      if (typeof window.matchMedia === "function") {
        reducedQuery = window.matchMedia("(prefers-reduced-transparency: reduce)");
        if (reducedQuery && typeof reducedQuery.addEventListener === "function") {
          reducedQuery.addEventListener("change", mountRefraction);
        }
      }
    }

    /** Undo everything apply() did (plugin unload). */
    function dispose() {
      if (observer) {
        observer.disconnect();
        observer = null;
      }
      if (reducedQuery && typeof reducedQuery.removeEventListener === "function") {
        reducedQuery.removeEventListener("change", mountRefraction);
      }
      reducedQuery = null;
      const svg = document.getElementById(SVG_ID);
      if (svg) svg.remove();
      const style = document.getElementById(STYLE_ID);
      if (style) style.remove();
      const root = document.documentElement;
      if (root.classList.contains(REFRACT)) root.classList.remove(REFRACT);
      if (root.classList.contains(NAMESPACE)) root.classList.remove(NAMESPACE);
    }

    /** Client plugin entry point. With a cordis context, the skin is
     * torn down when the plugin is disposed (unload / reload). */
    function apply(ctx) {
      const start = () => {
        mount();
        observe();
        return dispose;
      };
      if (ctx && typeof ctx.effect === "function") {
        ctx.effect(start, "dsh-glass-skin: mount");
      } else {
        start();
      }
    }

    exports.apply = apply;
    exports.dispose = dispose;
    return module.exports;
  },
});
