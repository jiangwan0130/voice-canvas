# 贡献指南

感谢你对 **Voice Canvas** 的关注！我们欢迎任何形式的贡献，包括 Bug 报告、功能建议、文档改进和代码提交。

---

## 📋 目录

- [行为准则](#行为准则)
- [如何贡献](#如何贡献)
- [本地开发环境搭建](#本地开发环境搭建)
- [Commit 提交规范](#commit-提交规范)
- [Pull Request 流程](#pull-request-流程)
- [代码风格](#代码风格)

---

## 行为准则

参与本项目即表示你同意遵守我们的行为准则：保持友善、包容、专业，尊重每一位贡献者。

---

## 如何贡献

### 🐛 报告 Bug

1. 先搜索 [已有 Issue](https://github.com/jiangwan0130/voice-canvas/issues)，确认问题未被报告
2. 使用 [Bug 报告模板](.github/ISSUE_TEMPLATE/bug_report.md) 创建新 Issue
3. 提供清晰的复现步骤、截图和环境信息

### ✨ 提出新功能

1. 先在 [讨论区](https://github.com/jiangwan0130/voice-canvas/discussions) 讨论你的想法
2. 使用 [功能请求模板](.github/ISSUE_TEMPLATE/feature_request.md) 提交 Issue

### 🔧 提交代码

1. Fork 本仓库
2. 基于 `main` 分支创建功能分支（见下方命名规范）
3. 编写代码并提交（遵循 Commit 规范）
4. 提交 Pull Request

---

## 本地开发环境搭建

### 前置要求

| 工具 | 版本要求 |
|------|---------|
| Node.js | >= 20.x |
| Python | >= 3.11 |
| Git | >= 2.x |

### 前端（React + TypeScript + Vite）

```bash
cd frontend
npm install
npm run dev
```

前端默认运行在 `http://localhost:5173`

### 后端（Python）

```bash
cd backend
# 建议使用虚拟环境
python -m venv .venv
.venv\Scripts\activate      # Windows
source .venv/bin/activate   # macOS / Linux

pip install -r requirements.txt
# 启动命令（按实际情况调整）
python main.py
```

---

## Commit 提交规范

本项目遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范，详见 [commit-convention.md](commit-convention.md)。

### 格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

### 分支命名

| 类型 | 格式 | 示例 |
|------|------|------|
| 新功能 | `feat/<描述>` | `feat/voice-recording` |
| Bug 修复 | `fix/<描述>` | `fix/audio-playback-crash` |
| 文档 | `docs/<描述>` | `docs/update-readme` |
| 重构 | `refactor/<描述>` | `refactor/canvas-renderer` |

---

## Pull Request 流程

1. 确保本地代码可以正常编译运行
2. 使用 PR 模板填写完整描述
3. 每个 PR **只做一件事**，保持小粒度
4. PR 必须关联对应的 Issue（`Closes #<issue-number>`）
5. 等待 Code Review，按反馈修改后合并

---

## 代码风格

### 前端

- 使用 **TypeScript**，禁止使用 `any`（除非有充分理由）
- 组件文件名使用 **PascalCase**（如 `VoiceRecorder.tsx`）
- 工具函数使用 **camelCase**
- 保持单个组件职责单一

### 后端

- 遵循 **PEP 8** 风格规范
- 函数和变量使用 **snake_case**
- 类名使用 **PascalCase**
- 重要逻辑必须有注释说明

---

如有任何问题，欢迎在 [讨论区](https://github.com/jiangwan0130/voice-canvas/discussions) 提问 🙌
