# dsh-glass-skin

An Apple-style **Liquid Glass** skin for [DeepSeek Harness](https://www.npmjs.com/package/@deepseek-ai/dsh) (DSH).
It restyles the Harness web UI, and it is adapted for the [ds-bot](https://www.npmjs.com/package/ds-bot) multi-bot plugin, so DSH and ds-bot look like one app. Light and dark themes, desktop browsers and Android WebView.

一个给 DeepSeek Harness（DSH）用的苹果「液态玻璃」风格皮肤插件：它会修改 Harness 的界面，并针对 ds-bot（多 Bot 群聊插件）做了适配。支持亮色和暗色，桌面浏览器和安卓 WebView 都能用。

## What it changes

- **Harness UI.** Translucent floating title pill and composer, glass menus and dialogs, a sidebar with no panel (only small glass pieces), flat solid colors with no gradients, and controls that press in on touch.
- **ds-bot.** When ds-bot's interface is on, the skin re-skins its sidebar, header pill, bubbles, details drawer, memory and settings dialogs and the Usage page. ds-bot's own bot colors (including gradient avatars and usage bars) are left exactly as ds-bot paints them. Details below.
- **Phones.** Below 480px the settings dialogs become full-screen sheets with a top tab strip, assistant replies run full width, and the details drawer is a full-width sheet.
- **Accessibility.** Reduced-transparency users get near-opaque surfaces, and secondary text stays at 4.5:1 or better in light mode.

## Screenshots

| Light | Dark |
|---|---|
| ![desktop light](https://raw.githubusercontent.com/24mlight/dsh-liquid-glass/main/docs/screenshots/desktop-light.png) | ![desktop dark](https://raw.githubusercontent.com/24mlight/dsh-liquid-glass/main/docs/screenshots/desktop-dark.png) |
| ![mobile light](https://raw.githubusercontent.com/24mlight/dsh-liquid-glass/main/docs/screenshots/mobile-light.png) | ![mobile dark](https://raw.githubusercontent.com/24mlight/dsh-liquid-glass/main/docs/screenshots/mobile-dark.png) |

### With ds-bot

| Light | Dark |
|---|---|
| ![ds-bot group chat, light](https://raw.githubusercontent.com/24mlight/dsh-liquid-glass/main/docs/screenshots/dsbot-group-light.png) | ![ds-bot group chat, dark](https://raw.githubusercontent.com/24mlight/dsh-liquid-glass/main/docs/screenshots/dsbot-group-dark.png) |
| ![ds-bot group chat, phone, light](https://raw.githubusercontent.com/24mlight/dsh-liquid-glass/main/docs/screenshots/dsbot-group-mobile-light.png) | ![ds-bot group chat, phone, dark](https://raw.githubusercontent.com/24mlight/dsh-liquid-glass/main/docs/screenshots/dsbot-group-mobile-dark.png) |

### Before / after

| ds-bot group chat (light) | ds-bot group chat (dark) |
|---|---|
| ![compare group chat light](https://raw.githubusercontent.com/24mlight/dsh-liquid-glass/main/docs/screenshots/dsbot-compare-group-desk-light.png) | ![compare group chat dark](https://raw.githubusercontent.com/24mlight/dsh-liquid-glass/main/docs/screenshots/dsbot-compare-group-desk-dark.png) |
| ![compare memory dialog](https://raw.githubusercontent.com/24mlight/dsh-liquid-glass/main/docs/screenshots/dsbot-compare-memory-desk-light.png) | ![compare usage stats](https://raw.githubusercontent.com/24mlight/dsh-liquid-glass/main/docs/screenshots/dsbot-compare-usage-desk-dark.png) |
| ![compare details drawer](https://raw.githubusercontent.com/24mlight/dsh-liquid-glass/main/docs/screenshots/dsbot-compare-drawer-desk-dark.png) | ![compare group chat on a phone](https://raw.githubusercontent.com/24mlight/dsh-liquid-glass/main/docs/screenshots/dsbot-compare-group-mob-light.png) |

### v0.3.0

- **Edge refraction (Chromium, incl. Android WebView).** The title pill, the composer and the settings sheets bend what is behind them at their edges, like a lens. The skin script adds one hidden `<svg id="lg-svg-defs">` with two SVG filters and sets `html.lg-refract` (only when the engine is Chromium and the user hasn't asked for reduced transparency). It is mounted once, re-mounted by the existing MutationObserver if the app drops it, and removed when the plugin is disposed. Firefox and Safari keep the blur-only look. Never used on messages.
- **Clearer glass, smaller pieces.** Much thinner fills. The sidebar draws no panel: only its controls and the selected item are small glass pieces. Wallpaper is one flat, slightly deeper color (`#dce3ee` light).
- **Composer without glow.** No outer or inner glow and no focus ring at any width: a thin top highlight, a soft shadow, and a tinted border on focus.
- **Phone layout (≤ 480px).** Assistant replies run full width without a bubble, the settings dialogs (ds-bot and DSH Harness) become full-screen sheets with a top tab strip, the details drawer is a full-width sheet, Usage tiles go 2×2, and the composer's text box shows no scrollbar. Custom scrollbars apply to mouse/trackpad only.

### Works with ds-bot

The skin supports the [ds-bot](https://www.npmjs.com/package/ds-bot) plugin
(multi-bot workspace: bot list, Chief, group chats, memory, usage stats, bot
settings). Install both plugins in the same profile, in any order; when
ds-bot's interface is on (`body[data-bt-motion]`), the skin re-points
ds-bot's `--bt-*` tokens at the glass material, floats its details drawer
and side panes as glass sheets, flattens ds-bot's own gradients (header
fade, skeletons, theme chips, color swatches, group-avatar masks) and
darkens bot name colors and secondary text so every label reaches 4.5:1 in
light and dark. Switching ds-bot to classic Agent mode falls back to the
plain DSH skin.

```bash
dsh plugin --profile web add ds-bot
dsh plugin --profile web add github:24mlight/dsh-liquid-glass
systemctl restart dsh-web
```

Not published to npm; install it from GitHub as shown below.

## Install

```bash
# from this git repo (server)
dsh plugin --profile web add github:24mlight/dsh-liquid-glass
systemctl restart dsh-web

# from a local checkout (development)
dsh plugin --profile web add /mnt/dsh-glass-skin
systemctl restart dsh-web
```

## Upgrade / remove

```bash
dsh plugin --profile web update dsh-glass-skin && systemctl restart dsh-web
dsh plugin --profile web remove dsh-glass-skin && systemctl restart dsh-web
```

## Architecture

```
lib/client.js   browser half — injects one <style> (and, on Chromium, one hidden
                <svg> of refraction filters) + a MutationObserver that
                re-mounts them if the app wipes them. No DOM restructuring.
lib/index.js    host half — no-op (pure client skin).
cordis.patch.yml mounts the plugin entry into the profile tree.
```

### Selector strategy (resilience to upstream updates)

The DSH web app is rebuilt frequently and its CSS-module class hashes churn
(`.k74WwW_card` → `.xYz12a_card`). The skin therefore relies on four tiers,
in order of preference:

1. **Official data attributes** — `[data-composer-card]`,
   `[data-cordis-panel]`, `[data-conversation-scroll]`, `[data-chat-flow-kind]`,
   `[class*='titlebar']`, `[class*='sidebarCol']`, `[class*='centerCol']`.
   These are the app's own stable hooks.
2. **Design-token overrides** — `--dsw-alias-bg-*`, `--dsw-alias-border-*`
   are redefined to translucent values, turning every token consumer glass
   without touching a single element rule.
3. **Semantic-suffix matching** — exact-suffix matches such as
   `:is([class$="_card"], [class*="_card "])` survive hash churn without
   catching `_cardTitle` or `_cards`.
4. **Third-party plugin hooks** — ds-bot's own `--bt-*` tokens and `.bt-*`
   classes, always scoped under `body[data-bt-motion]` so they only apply
   while ds-bot's interface is on.

All rules are namespaced under `html.glass-skin`, which also acts as a kill
switch: `document.documentElement.classList.remove('glass-skin')` disables
the skin live, without a restart.

### Theme handling

Dark mode is pure CSS keyed on the app's own `[data-ds-dark-theme]`
attribute. No JS state tracking.

## Maintenance after DSH upgrades

If the look breaks after a DSH upgrade, check in this order:

1. `curl -b <cookies> http://127.0.0.1:3080/ | grep titlebar` — did the app
   rename its semantic suffixes? (Tier 3 breakage)
2. Did `--dsw-alias-*` tokens get renamed? (Tier 2 breakage)
3. Did data attributes change? (Tier 1 breakage — unlikely, they are the
   plugin API surface)

Fix by editing the CSS template literal in `lib/client.js`, then reinstall
from the local path, verify, and push.

## License

MIT
