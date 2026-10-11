# dsh-liquid-glass

An Apple-style **Liquid Glass** skin for [DeepSeek Harness](https://www.npmjs.com/package/@deepseek-ai/dsh) (DSH).
It restyles the Harness web UI, and it is adapted for the [ds-bot](https://www.npmjs.com/package/ds-bot) multi-bot plugin, so DSH and ds-bot look like one app. Light and dark themes, desktop browsers and Android WebView.

一个给 DeepSeek Harness（DSH）用的苹果「液态玻璃」风格皮肤插件：它会修改 Harness 的界面，并针对 ds-bot（多 Bot 群聊插件）做了适配。支持亮色和暗色，桌面浏览器和安卓 WebView 都能用。

## What it looks like

- **Clear, thin glass.** Thin fills, so content shows through. The wallpaper is one flat color.
- **Floating pieces, no slabs.** The sidebar draws no panel: only its buttons and the selected item are small glass pieces. The title pill and the composer float over the conversation.
- **Edge refraction (Chromium, incl. Android WebView).** The title pill, the plain-DSH composer and the settings sheets bend what is behind them at their edges, like a lens. Firefox and Safari keep the blur-only look, and so does anyone who asks for reduced transparency. It is never used on messages or the sidebar.
- **No gradients of its own.** All of the skin's colors are flat. ds-bot's own bot colors (gradient avatars, color blocks, usage bars) are left exactly as ds-bot paints them.
- **Phone layout (480px and below).** Assistant replies run full width without a bubble, the settings dialogs (ds-bot and DSH Harness) become full-screen sheets with a top tab strip, the details drawer is a full-width sheet, and the composer's text box shows no scrollbar.
- **Light and dark.** Dark mode follows the app's own theme switch.

## Screenshots

**Web (desktop browser)**

![ds-bot chat on the web](https://raw.githubusercontent.com/24mlight/dsh-liquid-glass/main/docs/screenshots/web-v030-dsbot-chat.png)

![DSH home on the web](https://raw.githubusercontent.com/24mlight/dsh-liquid-glass/main/docs/screenshots/web-v030-dsh-home.png)

**Phone (Android app)**

![ds-bot chat on a phone](https://raw.githubusercontent.com/24mlight/dsh-liquid-glass/main/docs/screenshots/phone-chat-v030.png)

Settings sheet on a phone, light and dark:

![settings sheet on a phone, light and dark](https://raw.githubusercontent.com/24mlight/dsh-liquid-glass/main/docs/screenshots/settings-sheet-390.png)

## Install

```bash
# optional: the ds-bot multi-bot plugin (the skin is adapted for it)
dsh plugin --profile web add ds-bot

dsh plugin --profile web add github:24mlight/dsh-liquid-glass
systemctl restart dsh-web
```

The skin works with or without ds-bot, and the two can be installed in any order. When ds-bot's interface is on (`body[data-bt-motion]`), the skin re-skins its sidebar, header pill, bubbles, details drawer, memory and settings dialogs and the Usage page, flattens ds-bot's own fades (header fade, loading skeletons, theme preview chips), and adjusts bot name colors and secondary text for readability on glass. Bot colors themselves are kept. In ds-bot's classic Agent mode the plain DSH skin applies.

The plugin's package name is `dsh-glass-skin`, so that is the name `update` and `remove` use (the GitHub repository is `dsh-liquid-glass`):

```bash
dsh plugin --profile web update dsh-glass-skin && systemctl restart dsh-web
dsh plugin --profile web remove dsh-glass-skin && systemctl restart dsh-web
```

Removing the plugin removes the whole skin: its stylesheet, the refraction filters and its class names.

## How it works

```
lib/client.js    browser half: injects one <style> (and, on Chromium, one hidden
                 <svg> of refraction filters) and a MutationObserver that
                 re-mounts them if the app wipes them. No DOM restructuring.
lib/index.js     host half: no-op (pure client skin).
cordis.patch.yml mounts the plugin entry into the profile tree.
```

DSH is rebuilt often and its CSS-module class hashes change, so the rules rely on the most stable hooks first:

1. **The app's own data attributes**, such as `[data-composer-card]`, `[data-cordis-panel]`, `[data-conversation-scroll]` and `[data-chat-flow-kind]`.
2. **Design-token overrides.** `--dsw-alias-bg-*` and `--dsw-alias-border-*` are redefined to translucent values, which turns everything painted from them into glass without per-element rules.
3. **Semantic class suffixes**, such as `[class*="titlebar"]` or `:is([class$="_card"], [class*="_card "])`, which survive hash changes.
4. **ds-bot's own `--bt-*` tokens and `.bt-*` classes**, always scoped under `body[data-bt-motion]`.

All rules live under `html.glass-skin`. Dark mode is pure CSS keyed on the app's `[data-ds-dark-theme]` attribute, with no JS state tracking.

If the look breaks after a DSH upgrade, check whether the app renamed its class suffixes (`titlebar`, `sidebarCol`, `centerCol`), its `--dsw-alias-*` tokens, or its data attributes, and update the CSS in `lib/client.js` accordingly. Tests run with `node --test`.

## License

MIT
