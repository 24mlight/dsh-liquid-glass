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
- **Phone: collapsible Bot rail (ds-bot).** On a phone ds-bot shows its bots as a rail that takes width from the conversation. A small 32px glass button in the top-left corner, inside the rail's column, shows and hides it. The rail is shown by default and only that button closes it (picking a bot or the DSH Agent leaves it open); the choice is remembered. The button lines up with the title pill's top edge and the rail icons' centre line, measured in the page.
- **Bot list you can pull out (ds-bot rail).** The narrow rail shows only avatars, so with many bots you can't see names.
  - **Opening:** a slim glass pull tab on the rail's right edge opens ds-bot's full list (names, last message, time, unread, pins) over the screen, leaving a strip of the dimmed chat on the right. Drag it out and the list follows your finger, then springs open past 40% or back to the rail; a tap opens it too.
  - **Closing:** the back button (top left), the Android back key, a leftward swipe, a tap on the dimmed strip, or picking a chat closes it.
  - **How:** the skin opens DSH's own sidebar and lays it over the chat, so the conversation behind stays put. It works wherever ds-bot shows its rail, foldables and narrow windows included.
- **Phone: DSH Agent title centred (ds-bot 0.1.2+).** A DSH Agent session shows DSH's own conversation header, whose title sat at the left edge, under the rail button once the rail was closed. It is now a centred glass pill, the same height as the button and level with it.
- **Phone: message tools under the reply (ds-bot).** React, reply and more sit under each reply instead of off the right edge, so the conversation never scrolls sideways. They are always shown under the last message of a reply and appear on tap for earlier ones.
- **Steady Bot rail at any width (ds-bot).** The narrow rail is styled by its own presence, not a screen-width breakpoint, so phones, unfolded foldables and narrow windows all get the same fit: no tile cut off at the edge, and when the keyboard opens and the bot list has to scroll, it scrolls by touch with no scrollbar, so the icons never shift.
- **Phone: bot avatar next to its name (ds-bot).** In group chats the avatar sits on the same line as the bot's name instead of at the bottom of a long reply.
- **No flash on a just-sent message.** A message sent while a bot is still working (steering, or not yet admitted) gets the same accent glass as a sent one, instead of ds-bot's theme color, which flashed near-white in dark mode.
- **Readable trajectory details.** The event panel DSH opens from the trajectory view (over the table on a phone) is near-solid frosted glass, so the table behind it no longer shows through its text.
- **Light and dark.** Dark mode follows the app's own theme switch. Dark is true black, like X's "Lights out": a pure black wallpaper with neutral grey glass (no navy tint) that still reads as raised surfaces, and only the accent stays blue.

## Screenshots

**Web (desktop browser)**

![ds-bot chat on the web](https://raw.githubusercontent.com/24mlight/dsh-liquid-glass/main/docs/screenshots/web-v030-dsbot-chat.png)

![DSH home on the web](https://raw.githubusercontent.com/24mlight/dsh-liquid-glass/main/docs/screenshots/web-v030-dsh-home.png)

**Phone (Android app)**

![ds-bot chat on a phone](https://raw.githubusercontent.com/24mlight/dsh-liquid-glass/main/docs/screenshots/phone-chat-v030.png)

Settings sheet on a phone, light and dark:

![settings sheet on a phone, light and dark](https://raw.githubusercontent.com/24mlight/dsh-liquid-glass/main/docs/screenshots/settings-sheet-390.png)

## Install

No npm account or registry is needed: DSH's `dsh plugin` command hands its arguments to pnpm in the profile directory, and pnpm can install straight from this GitHub repository. Run these on the machine that runs your DSH web profile (it needs `git`):

```bash
# optional: the ds-bot multi-bot plugin (the skin is adapted for it)
dsh plugin --profile web add ds-bot

# the skin, straight from GitHub
dsh plugin --profile web add github:24mlight/dsh-liquid-glass
systemctl restart dsh-web
```

Replace `web` with your profile's name, and restart however you normally restart DSH (`systemctl restart dsh-web` is what a systemd setup uses). After the restart, reload the page.

Prefer a local copy? Clone the repository and add the folder instead:

```bash
git clone https://github.com/24mlight/dsh-liquid-glass
dsh plugin --profile web add ./dsh-liquid-glass
```

The skin works with or without ds-bot, and the two can be installed in any order. When ds-bot's interface is on (`body[data-bt-motion]`), the skin re-skins its sidebar, header pill, bubbles, details drawer, memory and settings dialogs and the Usage page, flattens ds-bot's own fades (header fade, loading skeletons, theme preview chips), and adjusts bot name colors and secondary text for readability on glass. Bot colors themselves are kept. In ds-bot's classic Agent mode the plain DSH skin applies.

The plugin's package name is `dsh-glass-skin`, so that is the name `update` and `remove` use (the GitHub repository is `dsh-liquid-glass`):

```bash
dsh plugin --profile web update dsh-glass-skin && systemctl restart dsh-web
dsh plugin --profile web remove dsh-glass-skin && systemctl restart dsh-web
```

Removing the plugin removes the whole skin: its stylesheet, the refraction filters, the phone rail button and its class names.

## How it works

```
lib/client.js    browser half: injects one <style> (and, on Chromium, one hidden
                 <svg> of refraction filters) and a MutationObserver that
                 re-mounts them if the app wipes them. The only element it adds
                 besides those is the phone rail button; no DOM restructuring.
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

Bundled fonts, under the SIL Open Font License 1.1: Inter (The Inter Project Authors, see `LICENSE-Inter.txt`) and Be Vietnam Pro (The Be Vietnam Pro Project Authors, see `LICENSE-BeVietnamPro.txt`).
