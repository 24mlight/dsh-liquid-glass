# dsh-glass-skin

An Apple-style **Liquid Glass** skin for [DeepSeek Harness](https://www.npmjs.com/package/@deepseek-ai/dsh) (DSH).
It restyles the Harness web UI, and it is adapted for the [ds-bot](https://www.npmjs.com/package/ds-bot) multi-bot plugin, so DSH and ds-bot look like one app. Light and dark themes, desktop browsers and Android WebView.

一个给 DeepSeek Harness（DSH）用的苹果「液态玻璃」风格皮肤插件：它会修改 Harness 的界面，并针对 ds-bot（多 Bot 群聊插件）做了适配。支持亮色和暗色，桌面浏览器和安卓 WebView 都能用。

## What it looks like (v0.3.0)

- **Clear, thin glass.** Much thinner fills, so content shows through. The wallpaper is one flat color.
- **Floating pieces, no slabs.** The sidebar draws no panel: only its buttons and the selected item are small glass pieces. The title pill and the composer float over the conversation.
- **Edge refraction (Chromium, incl. Android WebView).** The title pill, the plain-DSH composer and the settings sheets bend what is behind them at their edges, like a lens. Firefox and Safari keep the blur-only look, and so does anyone who asks for reduced transparency. It is never used on messages or the sidebar.
- **No gradients of its own.** All of the skin's colors are flat. ds-bot's own bot colors (gradient avatars, color blocks, usage bars) are left exactly as ds-bot paints them.
- **Phone layout (480px and below).** Assistant replies run full width without a bubble, the settings dialogs (ds-bot and DSH Harness) become full-screen sheets with a top tab strip, the details drawer is a full-width sheet, and the composer's text box shows no scrollbar.
- **Light and dark.** Dark mode follows the app's own theme switch. The skin's text colors are tuned to stay readable on glass in both themes.

## Screenshots

### v0.3.0 on the web (desktop browser, light)

ds-bot's group chat: a sidebar with no panel, glass buttons, the floating title pill and composer over the conversation. Bot colors are ds-bot's own.

![ds-bot chat on the web, v0.3.0](https://raw.githubusercontent.com/24mlight/dsh-liquid-glass/main/docs/screenshots/web-v030-dsbot-chat.png)

Plain DSH home: the New Session button and the composer are the glass pieces.

![DSH home on the web, v0.3.0](https://raw.githubusercontent.com/24mlight/dsh-liquid-glass/main/docs/screenshots/web-v030-dsh-home.png)

### v0.3.0: ds-bot group chat on a phone (Android app, light)

Panel-free glass sidebar, the floating title pill (Chief), and the composer, with the conversation scrolling underneath. Bot colors are ds-bot's own.

![ds-bot chat on a phone, v0.3.0](https://raw.githubusercontent.com/24mlight/dsh-liquid-glass/main/docs/screenshots/phone-chat-v030.png)

### v0.3.0: settings sheet on a phone (390px), light and dark, edge refraction on

![settings sheet on a phone, light and dark](https://raw.githubusercontent.com/24mlight/dsh-liquid-glass/main/docs/screenshots/settings-sheet-390.png)

### Web (desktop browser, v0.2.0 look)

Plain DSH, then ds-bot's details drawer, memory dialog and Usage page. These are older, v0.2.0 captures: v0.3.0 has no sidebar panel and adds edge refraction (see above).

| Light | Dark |
|---|---|
| ![plain DSH, light](https://raw.githubusercontent.com/24mlight/dsh-liquid-glass/main/docs/screenshots/web-dsh-light.png) | ![plain DSH, dark](https://raw.githubusercontent.com/24mlight/dsh-liquid-glass/main/docs/screenshots/web-dsh-dark.png) |
| ![ds-bot memory dialog, light](https://raw.githubusercontent.com/24mlight/dsh-liquid-glass/main/docs/screenshots/web-dsbot-memory-light.png) | ![ds-bot details drawer, dark](https://raw.githubusercontent.com/24mlight/dsh-liquid-glass/main/docs/screenshots/web-dsbot-drawer-dark.png) |

![ds-bot usage stats, dark](https://raw.githubusercontent.com/24mlight/dsh-liquid-glass/main/docs/screenshots/web-dsbot-usage-dark.png)

### Early preview with ds-bot (the v0.2.0 look)

v0.3.0 adds edge refraction, the panel-free sidebar and the phone layout above; more v0.3.0 screenshots will follow.

| Light | Dark |
|---|---|
| ![ds-bot group chat, light](https://raw.githubusercontent.com/24mlight/dsh-liquid-glass/main/docs/screenshots/dsbot-group-light.png) | ![ds-bot group chat, dark](https://raw.githubusercontent.com/24mlight/dsh-liquid-glass/main/docs/screenshots/dsbot-group-dark.png) |
| ![ds-bot group chat, phone, light](https://raw.githubusercontent.com/24mlight/dsh-liquid-glass/main/docs/screenshots/dsbot-group-mobile-light.png) | ![ds-bot group chat, phone, dark](https://raw.githubusercontent.com/24mlight/dsh-liquid-glass/main/docs/screenshots/dsbot-group-mobile-dark.png) |

## Works with ds-bot

The skin supports the [ds-bot](https://www.npmjs.com/package/ds-bot) plugin
(multi-bot workspace: bot list, Chief, group chats, memory, usage stats, bot
settings). Install both plugins in the same profile, in any order; when
ds-bot's interface is on (`body[data-bt-motion]`), the skin re-points
ds-bot's `--bt-*` tokens at the glass material, floats its details drawer
and side panes as glass sheets, flattens ds-bot's own fades (header fade,
skeletons, theme chips, group-avatar masks) and adjusts bot name colors and
secondary text for readability on glass. Bot colors themselves are kept.
Switching ds-bot to classic Agent mode falls back to the plain DSH skin.

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
