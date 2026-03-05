# Usage Center Bar

在 VS Code 状态栏展示“当前用量剩余”的进度条。

## 功能

- 定时轮询用量接口（默认 `60s`）
- 状态栏同时展示周窗口与 5h 窗口两个剩余进度条
- 点击状态栏可手动刷新
- 可配置 base URL、endpoint、API key、JSON 路径

## 配置项

- `usageCenterBar.baseUrl`：默认 `http://127.0.0.1:8317`
- `usageCenterBar.endpoint`：默认 `/api/codex/usage`
- `usageCenterBar.apiKey`：Bearer Key
- `usageCenterBar.usedPercentPath`：默认 `rate_limit.primary_window.used_percent`
- `usageCenterBar.accountNamePath`：可选，从用量响应中提取账号名的 JSON 路径
- `usageCenterBar.accountSummaryEndpoint`：默认 `/v0/management/codex-usage-summary`
- `usageCenterBar.managementKey`：访问 management summary 的 key（用于解析当前选中账号）
- `usageCenterBar.pollIntervalSec`：默认 `60`
- `usageCenterBar.requestTimeoutMs`：默认 `15000`
- `usageCenterBar.barLength`：默认 `10`
- `usageCenterBar.title`：默认 `Usage`
- `usageCenterBar.alignment`：`left` 或 `right`
- `usageCenterBar.priority`：状态栏优先级

## 关于“居中”

VS Code API 目前只支持状态栏 `left/right` 两侧，不支持绝对居中。
本扩展通过 `alignment + priority` 提供“尽量靠中间”的布局调节。

## 悬浮显示账号名

- 若 `usage` 响应中本身含有账号字段，可通过 `usageCenterBar.accountNamePath` 指定路径。
- 否则可配置 `usageCenterBar.managementKey`，插件会请求 `accountSummaryEndpoint`，
  从当前 `selected_auth_id` 对应条目中提取邮箱/账号名，显示在悬浮提示里。

## 本地调试

1. 用 VS Code 打开本目录
2. 按 `F5` 启动 Extension Development Host
3. 在新窗口配置 `Usage Center Bar` 设置

## 打包发布（可选）

```bash
npm i -g @vscode/vsce
vsce package
```
