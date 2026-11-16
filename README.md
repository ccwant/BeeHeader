# BeeHeader

基于（Vite + Vue 3 + TypeScript + `@crxjs/vite-plugin`），多 URL 规则、Declarative Net Request 注入请求头、全局暂停/恢复。

## 开发

```bash
npm install
npm run dev    # 监听构建
npm run build  # 生产构建
npm test       # 单元测试（ConfigService / DNR 规则）
```

## 加载扩展

1. 执行 `npm run build`
2. 打开 `chrome://extensions/`，开启开发者模式
3. 加载已解压的扩展程序，选择本项目 `dist` 目录

## 目录结构

```
src/
├── background/          # Service Worker：DNR 同步、消息、徽章
├── content/             # beeheader.com 分享页 postMessage 桥
├── shared/              # Config 模型、存储、校验、ConfigService
└── ui/popup/            # Vue 3 弹窗 UI
```

## License

MIT
