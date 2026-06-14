# 语绘 (Voice Canvas)

> 🎨 纯语音控制 AI 绘图工具 — 说话就能画画  
> 七牛云 × XEngineer 暑期实训营 · 题目二 · 2026/06/12 ~ 06/14

---

## 🎥 演示

<video src="demo-video.mp4" controls width="100%" style="max-width:800px"></video>

---

## ✨ 效果演示

对着麦克风说：

```
"画一棵树，树冠是绿色的圆形，树干是棕色的长方形"
"把树变大一点"
"在旁边画一个红色的太阳"
"撤销"
```

AI 逐笔渲染，所见即所得。画完还会**自己看图检查**，发现问题自动修复。

---

## 🏗️ 技术架构

```
用户语音 → [MediaRecorder 采集] → [阿里云 Paraformer ASR]
                                          ↓ 文本
        ┌─────────────────────────────────┐
        │   FastAPI 后端                    │
        │   ├─ 本地规则引擎（简单指令直达）    │
        │   ├─ Qwen3.7-Plus（复杂绘图理解）   │
        │   │   + JSON 修复管道              │
        │   │   + Command Parser 安全校验    │
        │   └─ Qwen3-VL（视觉自验证）         │
        │       └─ 截图审核 → 自动修复循环    │
        └───────────────┬───────────────────┘
                        ↓ JSON 指令序列
        ┌─────────────────────────────────┐
        │   React 前端 Canvas 渲染引擎       │
        │   ├─ 逐笔动画渲染器               │
        │   ├─ pencil/paint 画笔系统        │
        │   ├─ linear/radial 渐变系统       │
        │   ├─ ObjectStore 空间网格管理      │
        │   ├─ HistoryManager 撤销/重做     │
        │   ├─ FuzzyMatcher 四级模糊匹配     │
        │   └─ TTS 语音反馈                 │
        └─────────────────────────────────┘
```

---

## 🛠️ 技术栈

| 层 | 技术 | 说明 |
|----|------|------|
| 前端框架 | React 18 + TypeScript + Vite | SPA 开发 |
| 画布渲染 | Canvas 2D API | 逐笔动画 + 双画笔 + 渐变 |
| 语音识别 | 阿里云百炼 Paraformer（主）/ Web Speech API（降级） | 实时语音转文字 |
| 文本模型 | Qwen3.7-Plus（阿里云百炼 DashScope 兼容模式） | 自然语言 → 绘图指令 |
| 视觉模型 | Qwen3-VL-Plus（阿里云百炼 DashScope 兼容模式） | 截图审核 + 自动修复建议 |
| 后端 | FastAPI + httpx | 异步 HTTP 网关 |
| 语音反馈 | 浏览器 SpeechSynthesis API | TTS 播报 |

---

## 🚀 快速启动

### 前提

- Python 3.10+
- Node.js 18+
- 阿里云百炼 API Key（[dashscope.aliyun.com](https://dashscope.aliyun.com)）— ASR + LLM + VL 共用同一个 Key

### 1. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`，填入 API Key：

```env
# 阿里云百炼 API Key（ASR / LLM / VL 共用）
DASHSCOPE_API_KEY=sk-your-dashscope-key

# LLM 模型（DashScope OpenAI 兼容模式）
LLM_API_BASE=https://dashscope.aliyuncs.com/compatible-mode/v1
LLM_MODEL=qwen3.7-plus

# 视觉自验证模型
VISUAL_MODEL=qwen3-vl-plus
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

访问 **http://localhost:5173**，输入昵称进入画布，允许麦克风权限，点击 🎤 开始说话。

---

## 📡 API

| 端点 | 方法 | 说明 |
|------|------|------|
| `/health` | GET | 健康检查 |
| `/api/asr` | POST | 语音识别（上传音频，返回文本） |
| `/api/generate` | POST | 绘图指令生成（文本 + 画布状态 → JSON 指令序列） |
| `/api/visual-verify` | POST | 视觉自验证（Canvas 截图 + 原始意图 → 审核反馈） |

### `/api/generate` 请求示例

```json
{
  "text": "画一个红色的圆",
  "canvas_state": {
    "width": 750,
    "height": 500,
    "grid": { "cells": [...] }
  },
  "conversation_history": []
}
```

### 响应示例

```json
{
  "reply": "好的，在画布中央画了一个红色圆形",
  "instructions": [
    {
      "action": "circle",
      "cx": 375, "cy": 250, "r": 80,
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
      "cx": 375, "cy": 250, "r": 80,
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

## 🧠 核心设计

### 双引擎路由

- **本地规则引擎**：撤销、重做、清屏、切换颜色/画笔 等高频操作走本地关键词匹配，响应 < 1ms
- **LLM 引擎**：复杂绘图意图路由到 Qwen3.7-Plus，配合系统提示词中的 10 种物体配方（树/花/房子/太阳等）生成结构化指令

### 空间网格系统

画布 750×500 划分为 3×2 网格，每个格子附带中文标签（左上/中上/右上/左下/中下/右下）和坐标范围。每次请求摘要化网格状态发给 LLM，相比直接 dump 减少 60-70% token 消耗。

### 四级模糊匹配

编辑时无需记住对象 ID，通过自然语言指代：
1. **标签匹配** — "太阳"/"云"/"树" → 精确找到
2. **颜色匹配** — "红色的那个" → 按填充色查找
3. **位置匹配** — "左边的"/"上面的" → 按空间方位查找
4. **最近对象** — 以上都不匹配 → 返回最后画的对象

### 三层 JSON 修复 + 七项安全校验

LLM 输出经过：
1. Markdown 剥离 → 括号栈补全 → 字段校验退化
2. action 白名单 / 必填参数检查 / 默认值补全 / 坐标钳位 / 颜色校验 / target 存在性 / 数值类型强制

不合规指令逐条丢弃，不影响批次中其他合法指令。

### 视觉自验证闭环

「画 → 看 → 修」自动循环：
1. 绘图完成后，前端截取 Canvas 画面（base64）
2. 后端调用 Qwen3-VL 多模态模型，对比用户原始意图审核画面
3. 发现问题 → 自动生成修复指令 → 重新绘图 → 再次验证
4. 最多修复 2 轮（初绘 + 2 次修复）

---

## 📁 项目结构

```
voice-canvas/
├── backend/                     # FastAPI 后端
│   ├── main.py                  # 入口 + API 端点
│   ├── config.py                # 环境变量配置
│   ├── router.py                # 指令路由（本地 / LLM）
│   ├── local_rules.py           # 本地规则引擎
│   ├── llm_client.py            # LLM 客户端 + visual_verify
│   ├── json_repair.py           # LLM 输出修复管道
│   ├── command_parser.py        # 指令安全校验
│   └── asr/
│       ├── paraformer_asr.py    # 阿里云 Paraformer ASR
│       └── qwen_asr.py          # Qwen ASR（预留）
├── frontend/                    # React + Vite 前端
│   └── src/
│       ├── App.tsx              # 主应用（含视觉自验证修复循环）
│       ├── App.css              # 全局样式
│       ├── config.ts            # 画布常量
│       ├── components/
│       │   ├── Canvas.tsx       # 画布组件
│       │   ├── LoginPage.tsx    # 登录页（水彩背景 + 海浪动画）
│       │   ├── VoiceBar.tsx     # 语音控制栏
│       │   ├── PaletteBar.tsx   # 调色板
│       │   ├── CommandHistory.tsx # 命令历史
│       │   └── ErrorBoundary.tsx # 错误边界
│       ├── engine/
│       │   ├── renderer.ts      # 逐笔动画渲染器
│       │   ├── brush.ts         # 画笔系统（铅笔排线 + 颜料水彩）
│       │   ├── ObjectStore.ts   # 对象管理 + 空间网格
│       │   ├── HistoryManager.ts # 撤销历史
│       │   ├── FuzzyMatcher.ts  # 四级模糊对象匹配
│       │   └── CommandExecutor.ts # 指令分发执行器
│       ├── hooks/
│       │   ├── useVoice.ts      # 录音 + VAD
│       │   └── useSpeechFeedback.ts # TTS
│       ├── services/
│       │   └── api.ts           # HTTP 通信（含 visualVerify）
│       └── types/
│           └── commands.ts      # 指令 TS 类型定义
├── .env.example                 # 环境变量模板
├── docs/                        # 设计文档 + 演示稿
│   ├── demo_script.md           # Demo 演示脚本
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
