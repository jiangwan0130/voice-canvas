# 语绘 (Voice Canvas)

> 🎨 纯语音控制 AI 绘图工具 — 说话就能画画  
> 七牛云 × XEngineer 暑期实训营 · 题目二 · 2026/06/12 ~ 06/14

---

## ✨ 效果演示

对着麦克风说：

```
"画一棵树，树冠是绿色的圆形，树干是棕色的长方形"
"把树变大一点"
"在旁边画一个红色的太阳"
"撤销"
```

AI 逐笔渲染，所见即所得。

---

## 🏗️ 技术架构

```
用户语音 → [MediaRecorder 采集] → [阿里云 Paraformer ASR]
                                          ↓ 文本
        ┌─────────────────────────────────┐
        │   FastAPI 后端                    │
        │   ├─ 本地规则引擎（简单指令直达）    │
        │   └─ DeepSeek V4（复杂绘图理解）    │
        │       + JSON 修复管道              │
        │       + Command Parser 安全校验    │
        └───────────────┬───────────────────┘
                        ↓ JSON 指令序列
        ┌─────────────────────────────────┐
        │   React 前端 Canvas 渲染引擎       │
        │   ├─ 逐笔动画渲染器               │
        │   ├─ pencil/paint 画笔系统        │
        │   ├─ linear/radial 渐变系统       │
        │   ├─ ObjectStore 空间网格管理      │
        │   ├─ HistoryManager 撤销/重做     │
        │   └─ TTS 语音反馈                 │
        └─────────────────────────────────┘
```

---

## 🛠️ 技术栈

| 层 | 技术 | 说明 |
|----|------|------|
| 前端框架 | React 18 + TypeScript + Vite | SPA 开发 |
| 画布渲染 | Canvas 2D API | 逐笔动画 + 画笔 + 渐变 |
| 语音识别 | 阿里云百炼 Paraformer (主) / Web Speech API (降级) | 实时语音转文字 |
| 大模型 | DeepSeek V4-Flash (官方直连) | 自然语言 → 绘图指令 |
| 后端 | FastAPI + httpx | 异步 HTTP 网关 |
| 语音反馈 | 浏览器 SpeechSynthesis API | TTS 播报 |

---

## 🚀 快速启动

### 前提

- Python 3.10+
- Node.js 18+
- DeepSeek API Key（[platform.deepseek.com](https://platform.deepseek.com)）
- 阿里云百炼 API Key（可选，[dashscope.aliyun.com](https://dashscope.aliyun.com)）

### 1. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`，填入 API Key：

```env
# 阿里云百炼 ASR（可选，不填会降级浏览器语音识别）
DASHSCOPE_API_KEY=sk-your-dashscope-key

# DeepSeek LLM（必须）
LLM_API_KEY=sk-your-deepseek-key
LLM_API_BASE=https://api.deepseek.com/v1
LLM_MODEL=deepseek-v4-flash
```

### 2. 启动后端

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

验证：`curl http://localhost:8000/health` → `{"status":"ok"}`

### 3. 启动前端

```bash
cd frontend
npm install
npm run dev
```

### 4. 打开浏览器

访问 **http://localhost:5173**，允许麦克风权限，点击 🎤 开始说话。

---

## 📡 API

| 端点 | 方法 | 说明 |
|------|------|------|
| `/health` | GET | 健康检查 |
| `/api/asr` | POST | 语音识别（上传音频，返回文本） |
| `/api/generate` | POST | 绘图指令生成（文本 + 画布状态 → JSON 指令序列） |

### `/api/generate` 请求示例

```json
{
  "text": "画一个红色的圆",
  "canvas_state": {
    "width": 1200,
    "height": 800,
    "grid": { "cells": [...] }
  },
  "last_action": { "reply": "", "instructions": [] }
}
```

### 响应示例

```json
{
  "reply": "好的，在画布中央画了一个红色圆形",
  "instructions": [
    {
      "action": "circle",
      "cx": 600, "cy": 400, "r": 80,
      "fill": "#FF4444",
      "stroke": "#CC0000",
      "strokeWidth": 2,
      "mode": "stroke",
      "brush": "paint",
      "duration": 500,
      "id": "obj_1",
      "label": "红色圆形"
    },
    {
      "action": "circle",
      "cx": 600, "cy": 400, "r": 80,
      "fill": "#FF4444",
      "mode": "fill",
      "brush": "paint",
      "duration": 300,
      "id": "obj_1"
    }
  ],
  "source": "llm"
}
```

---

## 🎨 支持的绘图指令

### 图形
| 指令 | 说明 |
|------|------|
| `circle` | 圆形 |
| `rect` | 矩形 |
| `line` | 直线 |
| `curve` | 曲线 |
| `polygon` | 多边形 |
| `ellipse` | 椭圆 |
| `arc` | 圆弧 |
| `text` | 文字 |

### 编辑
| 指令 | 说明 |
|------|------|
| `update_object` | 修改对象属性 |
| `move_object` | 移动对象位置 |
| `delete_object` | 删除对象 |

### 控制
| 指令 | 说明 |
|------|------|
| `setColor` | 切换颜色 |
| `setWidth` | 切换线宽 |
| `setBrush` | 切换画笔 (pencil/paint) |
| `clear` | 清空画布 |
| `undo` | 撤销 |
| `wait` | 暂停（动画节奏） |
| `speak` | TTS 语音反馈 |

---

## 📁 项目结构

```
voice-canvas/
├── backend/                     # FastAPI 后端
│   ├── main.py                  # 入口 + API 端点
│   ├── config.py                # 环境变量配置
│   ├── router.py                # 指令路由（本地 / LLM）
│   ├── local_rules.py           # 本地规则引擎
│   ├── llm_client.py            # DeepSeek 客户端
│   ├── json_repair.py           # LLM 输出修复管道
│   ├── command_parser.py        # 指令安全校验
│   └── asr/
│       ├── paraformer_asr.py    # 阿里云 Paraformer ASR
│       └── qwen_asr.py          # Qwen ASR（预留）
├── frontend/                    # React + Vite 前端
│   └── src/
│       ├── App.tsx              # 主应用组件
│       ├── App.css              # 全局样式
│       ├── components/
│       │   ├── Canvas.tsx       # 画布组件
│       │   └── ErrorBoundary.tsx # 错误边界
│       ├── engine/
│       │   ├── renderer.ts      # 逐笔动画渲染器
│       │   ├── brush.ts         # 画笔系统
│       │   ├── ObjectStore.ts   # 对象管理 + 空间网格
│       │   ├── HistoryManager.ts # 撤销历史
│       │   ├── FuzzyMatcher.ts  # 模糊对象匹配
│       │   └── CommandExecutor.ts # 指令分发执行器
│       ├── hooks/
│       │   ├── useVoice.ts      # 录音 + VAD
│       │   └── useSpeechFeedback.ts # TTS
│       ├── services/
│       │   └── api.ts           # HTTP 通信
│       └── types/
│           └── commands.ts      # 指令 TS 类型定义
├── .env.example                 # 环境变量模板
├── docs/                        # 设计文档
│   └── design/
│       ├── 2026-06-12-语绘-voice-canvas-design.md
│       ├── 2026-06-13-语绘-统一项目计划.md
│       ├── 2026-06-13-语绘-PR分工.md
│       ├── 2026-06-13-语绘-甘特图.md
│       └── 2026-06-14-语绘-计划vs实际.md
└── README.md
```

---

## 👥 作者

| 团队成员 | PR |
|----------|-----|
| 芝士番薯 | PR #1-4 设计文档 · PR #7 渲染引擎 · PR #9 后端 ASR/路由 · PR #12 UI 打磨 |
| 月栖白 | PR #5-6 脚手架 · PR #8 对象管理 · PR #9 后端 LLM/修复/校验 · PR #10 前端串联 · PR #11 对象编辑 |

---

## 📄 License

MIT
