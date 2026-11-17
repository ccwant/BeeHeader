# BeeHeader

**English** · [中文](README.zh-CN.md)

Lightweight Chrome extension (Vite + Vue 3 + TypeScript + `@crxjs/vite-plugin`) for multi-URL rules, Declarative Net Request header injection, and global pause/resume.

## Development

```bash
npm install
npm run dev    # watch build
npm run build  # production build
npm test       # unit tests (ConfigService / DNR rules)
```

## Load the extension

1. Run `npm run build`
2. Open `chrome://extensions/` and enable Developer mode
3. Load unpacked and select this project’s `dist` folder

## Project layout

```
src/
├── background/          # Service worker: DNR sync, messaging, badge
├── content/             # beeheader.com share page postMessage bridge
├── shared/              # Config model, storage, validation, ConfigService
├── ui/popup/            # Vue 3 popup UI
└── i18n/                # vue-i18n strings (zh-CN / en)
```

## Internationalization

- Popup uses [vue-i18n](https://vue-i18n.intlify.dev/); default locale follows the browser (`zh-CN` for Chinese, otherwise `en`).
- Switch manually under **Setting → Global → Language**; choice is stored in `chrome.storage.local` (`beeheader_locale`).
- Copy lives in `src/i18n/locales/`; `@intlify/unplugin-vue-i18n` pre-compiles messages at build time (MV3 CSP, no runtime `eval`).
- Validation and import errors use `validation.*` / `import.*` keys translated in the UI.

## License

MIT