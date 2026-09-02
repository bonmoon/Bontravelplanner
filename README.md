# Bontrip · 旅卡排版室

本地优先的旅行规划 PWA。城市卡片、每日路线、地点图片、票据、二维码、账目和旅行助手对话保存在浏览器中，并支持导出 HTML、PNG 与完整 JSON 备份。

## 在线预览

当前构建版本发布在仓库的 `gh-pages` 分支：

<https://bonmoon.github.io/Bontrip/>

线上版本可以浏览、编辑和离线保存旅行资料。DeepSeek 密钥不会上传到 GitHub；需要旅行助手时，请使用下方的本地启动方式。

## 本地启动

macOS 可以直接双击：

```text
启动旅卡.command
```

也可以在终端运行：

```bash
npm install
npm run local
```

打开“设置 → DeepSeek 旅行助手”，填入自己的 API Key。请求通过本机 `/api/deepseek` 转发，密钥只保存在当前浏览器。

## 开发与构建

```bash
npm install
npm run dev
npm run build
```

生产文件输出到 `dist/`。更新源码后重新构建，并把 `dist/` 发布到 `gh-pages` 分支即可迭代线上版本。

## 数据安全

旅行资料主要保存在浏览器 IndexedDB。请定期在“设置 → 旅行资料”中导出完整备份；更换浏览器或清理网站数据前尤其需要备份。
