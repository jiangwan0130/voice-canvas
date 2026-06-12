# 语绘 (Voice Canvas) — 设计文档

> 七牛云 × XEngineer 暑期实训营 · 题目二：AI 语音绘图工具
>
> 版本 v1.0 · 2026-06-12

---

## 一、项目概述

### 1.1 项目名称

**语绘 (Voice Canvas)**

### 1.2 一句话描述

一款纯语音控制的 Web 绘图工具 — 用户说出「画一朵简笔花」，AI 理解语义后在 Canvas 上一笔一笔画出图形。

### 1.3 核心约束

- 用户 **不能** 使用鼠标或键盘，仅通过语音指令完成所有绘图操作
- 截止时间：2026 年 6 月 14 日 23:59（开发周期约 2.5 天）

### 1.4 技术栈

| 层 | 技术 | 说明 |
|----|------|------|
| **前端** | React + Vite | Vite 秒级启动、零配置 |
| **画布** | HTML5 Canvas API | 通过 React ref 直接操作，无第三方库 |
| **录音** | MediaRecorder API | 浏览器原生 |
| **后端** | Python Flask | 轻量 HTTP 服务 |
| **语音识别** | 七牛云短语音听写 API | 主方案；Web Speech API 兜底 |
| **大模型** | 七牛云 MaaS 平台 | DeepSeek-V3，兼容 OpenAI SDK |
| **签名** | qiniu SDK (Python) | 后端签名叫七牛云 API |

---

## 二、架构设计

### 2.1 架构总览

```
┌─────────────── 浏览器 (React 前端) ───────────────┐
│                                                   │
│  麦克风 ──→ MediaRecorder ──→ 音频 blob           │
│                                    │              │
│              POST /api/asr ────────┘              │
│              POST /api/generate ───┘              │
│                    │                              │
│              ←── JSON 指令序列 ──┘                │
│                    │                              │
│              Canvas 渲染引擎                      │
│              (renderer.js — 逐笔动画)             │
│                                                   │
│  UI: [🎤 录音按钮] [画布] [状态提示] [指令历史]     │
└──────────────────────┬────────────────────────────┘
                       │
       ┌───────────────▼──────────────┐
       │         Flask 后端            │
       │                              │
       │  POST /api/asr               │
       │    └→ 七牛云 ASR 签名 → 文本  │
       │    └→ 兜底: Web Speech API   │
       │                              │
       │  POST /api/generate          │
       │    └→ 指令路由器              │
       │         ├→ 简单指令 → 本地规则引擎        │
       │         └→ 复杂指令 → 七牛云 MaaS LLM     │
       │    └→ instruction_parser → JSON 指令序列  │
       └──────────────────────────────┘
```

### 2.2 核心设计原则

- **后端是「大脑」**：所有业务逻辑——语音识别、指令路由、规则匹配、LLM 调用——全部在后端
- **前端是「手」**：负责录音采集、发送请求、执行 Canvas 动画、展示 UI
- **renderer.js 不懂业务**：只接收标准 JSON 指令序列并逐笔渲染，不关心指令来源

### 2.3 方案选择：混合路由（方案 B）

| 指令类型 | 处理方式 | 延迟 | 示例 |
|----------|----------|------|------|
| **简单指令** | 后端本地规则引擎 | ~50ms | 「换成红色」「撤销」「清除画布」 |
| **复杂指令** | 七牛云 MaaS LLM | ~2-5s | 「画一朵简笔花」「在右边画一棵树」 |

方案 A（全走 LLM）作为技术兜底。

---

## 三、项目文件结构

```
voice-canvas/
├── server.py                  # Flask 入口
├── requirements.txt           # flask, qiniu, httpx
├── backend/
│   ├── __init__.py
│   ├── asr.py                 # 七牛云语音识别（签名 + 调用）
│   ├── router.py              # 指令路由器（简单 vs 复杂分发）
│   ├── local_rules.py         # 本地规则引擎
│   ├── llm.py                 # 七牛云 MaaS 调用（prompt + 解析）
│   └── instruction_parser.py  # 标准化 JSON 指令序列输出
├── src/                       # React 前端
│   ├── main.jsx
│   ├── App.jsx                # 主组件（状态管理 + 布局）
│   ├── components/
│   │   ├── Canvas.jsx         # 画布组件（ref → Canvas API）
│   │   ├── VoiceBar.jsx       # 底部录音控制栏
│   │   └── CommandHistory.jsx # 指令历史 / 状态提示
│   ├── services/
│   │   └── api.js             # fetch 封装（纯通信，无业务逻辑）
│   ├── engine/
│   │   └── renderer.js        # Canvas 逐笔动画渲染引擎
│   └── hooks/
│       └── useVoice.js        # 录音 hook
├── index.html
├── vite.config.js
├── package.json
├── .env                       # 七牛云 API Key（不提交 git）
└── docs/
    └── design/
        └── 2026-06-12-语绘-voice-canvas-design.md
```

---

## 四、API 接口设计

### 4.1 POST /api/asr

语音识别接口。

| 项 | 说明 |
|----|------|
| **请求** | `multipart/form-data`，字段 `audio`（.wav blob） |
| **响应** | `{ "text": "画一朵红色的花", "source": "qiniu" \| "webspeech" }` |
| **逻辑** | 后端调七牛云短语音听写 API；失败则返回错误，前端降级使用 Web Speech API |

### 4.2 POST /api/generate

绘图指令生成接口。

| 项 | 说明 |
|----|------|
| **请求** | `{ "text": "画一朵红色的花" }` |
| **响应** | `{ "instructions": [...], "source": "local" \| "llm", "raw_text": "..." }` |
| **逻辑** | 指令路由器判断分发 → 本地规则引擎或 LLM → 统一返回 JSON 指令序列 |

---

## 五、JSON 指令序列设计（待细化）

统一绘图指令格式，无论本地规则还是 LLM 都输出此格式：

```json
{
  "instructions": [
    { "action": "circle",   "cx": 200, "cy": 150, "r": 30, "fill": "#FF4444", "stroke": "#000", "duration": 300 },
    { "action": "line",     "x1": 200, "y1": 180, "x2": 200, "y2": 280, "stroke": "#228B22", "duration": 200 },
    { "action": "curve",    "points": [[200,280],[180,320],[150,300]], "stroke": "#228B22", "duration": 250 },
    { "action": "clear",    "duration": 0 },
    { "action": "undo",     "duration": 0 },
    { "action": "setColor", "value": "#FF0000", "duration": 0 },
    { "action": "setWidth", "value": 5, "duration": 0 }
  ]
}
```

每条指令都携带 `duration`（毫秒），前端 renderer.js 据此控制逐笔动画速度。

---

## 六、语音交互流程

```
1. 用户按住录音按钮（或点击开始）
2. MediaRecorder 采集音频 → 停止后生成 .wav blob
3. POST /api/asr → 七牛云 ASR → 返回文本
   （失败时前端降级 Web Speech API）
4. 文本显示在状态栏 → POST /api/generate
5. 后端指令路由器分发：
   - 简单指令 → 本地规则引擎 50ms 返回
   - 复杂指令 → 七牛云 MaaS LLM 2-5s 返回
6. 返回 JSON 指令序列
7. 前端 renderer.js 逐条执行指令，每条按 duration 控速
8. 完成后语音播报或状态提示
```

---

## 七、设计原则

### 7.1 指令理解准确性 & 容错性

- LLM prompt 中明确 JSON 指令格式约束，要求只输出有效 JSON
- 后端 `instruction_parser.py` 做二次校验，JSON 解析失败时返回错误提示而非崩溃
- 本地规则引擎支持模糊匹配：「红色」「红的」「红颜色」→ 同一处理

### 7.2 语音到绘图响应延迟

- 简单指令本地处理，毫秒级响应
- 复杂指令流式返回？待评估 — V1 先走完整响应模式
- 录音结束后立即显示识别文本，让用户知道系统在「听」

### 7.3 复杂指令拆解

- LLM 负责将「在画布中央画三个间距相等的红色圆形」拆解为多条基本指令
- 本地规则引擎只处理不可再分的原子操作

---

## 八、待细化事项

以下内容需要在后续讨论中确定：

- [ ] JSON 指令集完整定义（所有 action 类型及其参数）
- [ ] 本地规则引擎覆盖的指令清单
- [ ] LLM prompt 详细设计
- [ ] Canvas 渲染引擎逐笔动画方案
- [ ] 前端 UI 布局设计
- [ ] 错误处理 & 降级策略细节
- [ ] 设计文档（提交物）大纲

---

## 九、提交物清单

根据题目要求，需提交：

| 提交物 | 说明 |
|--------|------|
| **代码仓库** | GitHub 公开（6月15日起），含前后端全部代码 |
| **Demo 视频** | 展示语音绘图完整流程 |
| **设计文档** | 计划支持 vs 实际支持的指令能力，未完成部分原因说明 |
| **作品提交** | hr.qiniu.com 填写仓库信息（24小时内！） |

---

*本文档持续更新，记录设计演进过程。*
