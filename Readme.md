## Prompt Templates 浏览器扩展

一个用于快速管理与应用 Prompt 模板的浏览器扩展（v2.4.6）。支持模板参数化、侧边栏面板、JSON 导入、以及在 ChatGPT/Kimi/DeepSeek 等站点的稳健注入与可选一键发送。

### 核心功能
- **模板库与搜索**: 弹出页展示模板卡片，支持搜索与点击进入填充。
- **模板编辑器**: 编辑标题与正文，自动识别占位符 {{key}} 并高亮展示。
- **字段设计器**: 图形化定义字段（Text/Textarea/Select），支持默认值、必填与“自定义”选项。
- **JSON 导入**: 粘贴 JSON 一键解析并填充模板与字段。
- **结果预览/生成**: 实时预览替换后的 Prompt，自动去除未赋值占位符与多余空行；支持按场景过滤“若为 …”分支语句。
- **一键插入/发送**: 将生成文本自动写入目标站点输入框，可选择直接发送；支持打开临时会话。
- **侧边栏支持**: 优先打开 Edge/Chrome 侧边面板；若不可用自动回退为独立弹窗。
- **主题与提供商设置**: 切换 ChatGPT/Kimi/DeepSeek 预设与常规/临时会话 URL，自定义主题（系统/浅色/深色）。

### 适用站点
- ChatGPT: `https://chatgpt.com/*`、`https://chat.openai.com/*`
- Kimi: `https://www.kimi.com/*`、`https://kimi.moonshot.cn/*`
- DeepSeek: `https://chat.deepseek.com/*`

### 使用方式（本地开发/调试）
1. 浏览器打开“扩展程序”页面，开启“开发者模式”。
2. 选择“加载已解压的扩展程序”，指向目录 `edge-prompt-templates`（内含 `manifest.json`）。
3. 通过工具栏图标打开弹出页，或从菜单打开侧边栏面板进行使用。

### 权限说明（Manifest V3）
- `permissions`: `storage`、`activeTab`、`scripting`、`tabs`
- `host_permissions`: ChatGPT/Kimi/DeepSeek 站点 URL
- `content_scripts`: 在上述站点空闲阶段注入 `scripts/content.js`
- `background`: `scripts/background.js`（Service Worker）
- `content_security_policy.extension_pages`: `script-src 'self'; object-src 'self'`

### 目录结构（关键文件）
- `edge-prompt-templates/manifest.json`: 扩展清单
- `edge-prompt-templates/popup.html`: 弹出页 UI
- `edge-prompt-templates/panel.html`: 侧边栏 UI（或弹窗回退）
- `edge-prompt-templates/scripts/popup.js`: 模板管理、渲染与注入调用逻辑
- `edge-prompt-templates/scripts/background.js`: 标签页管理与跨页注入
- `edge-prompt-templates/scripts/content.js`: 站点内查找输入框并写入/触发发送

### 版本
- 当前版本：`2.4.8.2`

### 截图（示例尺寸与说明）
- 弹出页尺寸：宽 560px（以下截图均按真实弹窗宽度）
- 首页（模板库/搜索）：560×860 PNG
- 模板详情页（填充/预览/插入按钮）：560×980 PNG
- 新建/编辑页面（字段设计器）：560×980 PNG
- 设置页（提供商与主题）：560×900 PNG

#### 示例截图（弹窗尺寸）
- 首页：`assets/home-popup.png`
- 模板详情页：`assets/detail-popup.png`
- 新建/编辑页：`assets/edit-popup.png`
- 设置页：`assets/settings-popup.png`

<div>
  <p><strong>首页（弹窗）</strong></p>
  <img src="assets/home-popup.png" alt="首页（模板库/搜索，弹窗尺寸）" width="560">
  <p><strong>模板详情页（弹窗）</strong></p>
  <img src="assets/detail-popup.png" alt="模板详情页（弹窗尺寸）" width="560">
  <p><strong>新建/编辑页（弹窗）</strong></p>
  <img src="assets/edit-popup.png" alt="新建/编辑页（弹窗尺寸）" width="560">
  <p><strong>设置页（弹窗）</strong></p>
  <img src="assets/settings-popup.png" alt="设置页（弹窗尺寸）" width="560">
</div>
