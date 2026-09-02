# 旅卡排版室 · Travel Card Studio

本地优先的旅行规划 PWA。旅行、地点、票据、账目、图片和对话保存在当前浏览器的 IndexedDB 中。

## 直接打开

- 只想快速查看界面：双击 `index.html`，它会自动进入单文件预览。
- 使用行程助手、地图连接和完整离线能力：双击 `打开旅卡排版室.command`，保持终端窗口开启。

单文件预览可以浏览和编辑本地内容，但外部服务可能拒绝来自 `file://` 页面的连接；完整使用时请通过启动器打开。

## 本地运行

```bash
npm install
npm run dev
```

## 行程助手

打开“设置 → 行程助手”，填写服务地址、访问密钥和模型。默认地址为：

```text
https://api.deepseek.com/chat/completions
```

连接信息保存在当前浏览器，不需要额外服务。

## 构建

```bash
npm run build
npm run preview
```

`dist/` 可以放在任意静态网站，也可以通过项目中的 GitHub Pages workflow 部署。

## 备份

浏览器存储仍可能被系统清理。请在“设置 → 旅行资料”定期导出完整 JSON 备份。
