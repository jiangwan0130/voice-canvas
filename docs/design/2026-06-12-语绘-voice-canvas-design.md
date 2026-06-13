# 语绘 (Voice Canvas) — 设计文档

> 七牛云 × XEngineer 暑期实训营 · 题目二：AI 语音绘图工具
>
> 版本 v3.0 · 2026-06-13（新增：前端 UI 布局、错误处理 & 降级策略，设计文档主体完成）

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

## 五、JSON 指令集完整定义

这是前后端之间的**唯一协议**——后端不管走本地规则还是 LLM，最终都输出这套指令，前端 renderer.js 只认这一种格式。

### 5.1 指令总览

**绘图指令（有动画）：**

| action | 参数 | 说明 |
|--------|------|------|
| `circle` | `cx, cy, r, fill?, fillGradient?, stroke?, strokeWidth?, mode?, brush?, fillAngle?, fillDensity?, duration` | 画圆 |
| `rect` | `x, y, w, h, fill?, fillGradient?, stroke?, strokeWidth?, mode?, brush?, fillAngle?, fillDensity?, duration` | 画矩形 |
| `line` | `x1, y1, x2, y2, stroke?, strokeWidth?, mode?, duration` | 画直线 |
| `curve` | `points: [[x,y],...], stroke?, strokeWidth?, mode?, duration` | 贝塞尔曲线 / 手绘路径 |
| `arc` | `cx, cy, r, startAngle, endAngle, fill?, fillGradient?, stroke?, mode?, duration` | 圆弧 |
| `polygon` | `points: [[x,y],...], fill?, fillGradient?, stroke?, strokeWidth?, mode?, brush?, fillAngle?, fillDensity?, duration` | 多边形 |
| `ellipse` | `cx, cy, rx, ry, fill?, fillGradient?, stroke?, strokeWidth?, mode?, brush?, fillAngle?, fillDensity?, duration` | 椭圆 |
| `text` | `x, y, content, fontSize?, fill?, duration` | 文字 |

**控制指令（即时执行，无动画）：**

| action | 参数 | 说明 |
|--------|------|------|
| `setColor` | `value: "#FF0000", duration: 0` | 设置后续绘图颜色 |
| `setWidth` | `value: 3, duration: 0` | 设置线条粗细 |
| `setBrush` | `type: "pencil"\|"paint", fillAngle?, fillDensity?, duration: 0` | 切换画笔类型 |
| `clear` | `duration: 0` | 清空整个画布 |
| `undo` | `duration: 0` | 撤销最近一步 |
| `redo` | `duration: 0` | 重做被撤销的步骤 |
| `pause` | `duration: 0` | 暂停渲染动画 |
| `resume` | `duration: 0` | 恢复渲染 |
| `wait` | `duration: 500` | 暂停指定毫秒（控制动画节奏） |

### 5.2 mode 参数（绘制阶段控制）

| mode | 效果 |
|------|------|
| `"stroke"` | 只画轮廓线，不填充（勾线阶段） |
| `"fill"` | 只填充颜色，不画轮廓（上色阶段） |
| `"both"` | 默认，同时描边 + 填充（一次性完成） |

设计意图：支持 **先轮廓 → 后上色** 的两阶段绘制体验，模仿真人作画过程。

### 5.3 画笔系统

| brush | 效果 | 关键参数 |
|-------|------|----------|
| `"pencil"` | 彩铅排线填充 — 平行斜线，间距均匀，线条略微抖动模拟手绘 | `fillAngle`（角度，默认45°）、`fillDensity`（密度1-10，默认5） |
| `"paint"` | 颜料笔触填充 — 半透明色带，笔触间有重叠和偏移，边缘有手绘纹理 | `fillAngle`（笔触方向，默认45°） |

实现原理：
- **彩铅**：Canvas `clip()` 限定形状区域 → 循环画平行斜线（1px 细线 + 随机微小偏移）
- **颜料笔**：Canvas `clip()` 限定形状区域 → 循环画稍宽半透明色带（`globalAlpha` 0.3-0.5），笔触间存在重叠和偏移

### 5.4 渐变系统

#### fillGradient 参数

绘图指令新增可选参数 `fillGradient`，与 `fill` 互斥（`fillGradient` 优先级更高）。支持两种渐变类型：

**线性渐变：**

| 参数 | 说明 |
|------|------|
| `type: "linear"` | 线性渐变 |
| `stops` | 色标数组 `[{offset: 0.0-1.0, color: "#hex"}]` |
| `x0, y0` | 渐变起点 |
| `x1, y1` | 渐变终点 |

**径向渐变：**

| 参数 | 说明 |
|------|------|
| `type: "radial"` | 径向渐变 |
| `stops` | 色标数组 `[{offset: 0.0-1.0, color: "#hex"}]` |
| `cx, cy` | 渐变圆心 |
| `r0` | 起始半径（通常为 0） |
| `r1` | 终止半径（覆盖整个形状） |

#### 渐变与画笔的协同工作

```
渐变方向 → 每个位置的排线从渐变色中取样
花瓣根部(深粉) ──────────────→ 花瓣尖端(浅粉)
     ╲╲╲╲╲╲  ╲╲╲╲╲╲  ╲╲╲╲╲╲  ╱╱╱╱╱╱  ╱╱╱╱╱╱  ╱╱╱╱╱╱
      深粉排线    中粉排线    中浅粉排线    浅粉排线    极浅粉排线
```

渲染实现：
```javascript
// 每根排线的颜色从 Canvas 渐变中动态取样
_pencilFillWithGradient(inst) {
  const gradient = this._createGradient(inst.fillGradient); // Canvas createLinearGradient / createRadialGradient
  // ...
  for (each hatching line) {
    const midX = ..., midY = ...;           // 排线中点坐标
    ctx.strokeStyle = this._sampleGradient(gradient, midX, midY); // 取该位置的渐变色
    // 画排线（带手绘抖动）
  }
}
```

#### 示例：线性渐变

```json
{ "action": "circle", "cx": 200, "cy": 200, "r": 80,
  "fillGradient": {
    "type": "linear",
    "stops": [
      { "offset": 0.0, "color": "#FF4444" },
      { "offset": 1.0, "color": "#FFCC00" }
    ],
    "x0": 120, "y0": 120, "x1": 280, "y1": 280
  },
  "mode": "fill", "brush": "pencil", "duration": 600
}
```

#### 示例：彩铅渐变桃花（径向渐变模拟花瓣自然深浅）

```json
{ "action": "circle", "cx": 200, "cy": 180, "r": 35,
  "fillGradient": {
    "type": "radial",
    "stops": [
      { "offset": 0.0, "color": "#EE5588" },
      { "offset": 0.6, "color": "#FF99BB" },
      { "offset": 1.0, "color": "#FFDDE8" }
    ],
    "cx": 200, "cy": 155, "r0": 0, "r1": 35
  },
  "mode": "fill", "brush": "pencil", "fillAngle": 45, "duration": 600
}
```

> 花瓣根部（靠近花蕊）渐变为深粉 #EE5588，边缘渐变为浅粉 #FFDDE8，模拟真实桃花色素分布。

### 5.5 完整示例："用彩铅画一朵红色简笔花"

```json
{
  "instructions": [
    { "action": "setBrush", "type": "pencil", "fillAngle": 45, "fillDensity": 6, "duration": 0 },
    { "action": "setColor", "value": "#228B22", "duration": 0 },

    { "action": "line", "x1": 200, "y1": 280, "x2": 200, "y2": 380, "stroke": "#228B22", "strokeWidth": 3, "mode": "stroke", "duration": 300 },

    { "action": "setColor", "value": "#CC0000", "duration": 0 },
    { "action": "circle", "cx": 200, "cy": 180, "r": 35, "stroke": "#CC0000", "strokeWidth": 2, "mode": "stroke", "duration": 500 },
    { "action": "circle", "cx": 155, "cy": 210, "r": 30, "stroke": "#CC0000", "strokeWidth": 2, "mode": "stroke", "duration": 400 },
    { "action": "circle", "cx": 245, "cy": 210, "r": 30, "stroke": "#CC0000", "strokeWidth": 2, "mode": "stroke", "duration": 400 },
    { "action": "circle", "cx": 170, "cy": 150, "r": 28, "stroke": "#CC0000", "strokeWidth": 2, "mode": "stroke", "duration": 400 },
    { "action": "circle", "cx": 230, "cy": 150, "r": 28, "stroke": "#CC0000", "strokeWidth": 2, "mode": "stroke", "duration": 400 },

    { "action": "setColor", "value": "#CC9900", "duration": 0 },
    { "action": "circle", "cx": 200, "cy": 130, "r": 20, "stroke": "#CC9900", "strokeWidth": 2, "mode": "stroke", "duration": 350 },

    { "action": "wait", "duration": 300 },

    { "action": "setColor", "value": "#FF4444", "duration": 0 },
    { "action": "circle", "cx": 200, "cy": 180, "r": 35, "fill": "#FF4444", "mode": "fill", "brush": "pencil", "fillAngle": 45, "duration": 600 },
    { "action": "circle", "cx": 155, "cy": 210, "r": 30, "fill": "#FF4444", "mode": "fill", "brush": "pencil", "fillAngle": 45, "duration": 500 },
    { "action": "circle", "cx": 245, "cy": 210, "r": 30, "fill": "#FF4444", "mode": "fill", "brush": "pencil", "fillAngle": 45, "duration": 500 },
    { "action": "circle", "cx": 170, "cy": 150, "r": 28, "fill": "#FF4444", "mode": "fill", "brush": "pencil", "fillAngle": 45, "duration": 500 },
    { "action": "circle", "cx": 230, "cy": 150, "r": 28, "fill": "#FF4444", "mode": "fill", "brush": "pencil", "fillAngle": 45, "duration": 500 },

    { "action": "setColor", "value": "#FFCC00", "duration": 0 },
    { "action": "circle", "cx": 200, "cy": 130, "r": 20, "fill": "#FFCC00", "mode": "fill", "brush": "pencil", "fillAngle": 45, "duration": 400 }
  ]
}
```

---

## 六、本地规则引擎

### 6.1 核心原则

- **本地只处理原子操作**：不可再分、不需要语义理解、参数明确的指令
- **不确定就走 LLM**：宁可慢一点，不要误判
- **字符串长度哨兵**：≤10 字 + 匹配关键词 → 本地；长指令即使含关键词也可能包含绘图意图 → LLM

### 6.2 指令路由总览

```
用户语音文本
    │
    ▼
┌─────────── 指令路由器 (backend/router.py) ──────────┐
│                                                      │
├─ 本地规则引擎（~50ms）                                │
│  ├─ 画布操作: 清除 / 撤销 / 重做                      │
│  ├─ 画笔控制: 切换画笔 / 换颜色 / 粗细                │
│  └─ 系统指令: 暂停 / 继续                            │
│                                                      │
├─ LLM（2-5s）                                        │
│  ├─ 所有绘图请求: "画一朵花" / "画棵树"               │
│  ├─ 多对象场景: "画太阳和云朵和草地"                  │
│  ├─ 相对位置: "在花的右边画蝴蝶"                      │
│  └─ 修改请求: "把花变大一点" / "删掉那棵树"           │
│                                                      │
└─ 不确定 → 默认走 LLM（安全策略）                       │
```

### 6.3 本地指令清单

**画布操作：**

| 用户可以说 | 触发 |
|-----------|------|
| 清除 / 清空 / 清屏 / 全部清除 | `clear` |
| 撤销 / 回退 / 上一步 / 返回 | `undo` |
| 重做 / 恢复 | `redo` |

**画笔控制：**

| 用户可以说 | 触发 |
|-----------|------|
| 彩铅 / 用彩铅 / 换成彩铅 | `setBrush("pencil")` |
| 颜料笔 / 用颜料 / 换成颜料笔 | `setBrush("paint")` |
| 粗一点 / 细一点 | `setWidth(±1)` |
| 线条粗细设为N | `setWidth(N)` |

**颜色映射表（12色）：**

| 中文 | hex | 中文 | hex |
|------|-----|------|-----|
| 红/红色 | `#FF4444` | 蓝/蓝色 | `#4488FF` |
| 绿/绿色 | `#228B22` | 黄/黄色 | `#FFCC00` |
| 橙/橙色 | `#FF8800` | 紫/紫色 | `#9944FF` |
| 黑/黑色 | `#000000` | 白/白色 | `#FFFFFF` |
| 灰/灰色 | `#888888` | 粉/粉色 | `#FF88AA` |
| 棕/棕色 | `#8B4513` | 青/青色 | `#00CCCC` |

**系统指令：**

| 用户可以说 | 触发 |
|-----------|------|
| 暂停 / 停一下 | `pause` |
| 继续 / 接着画 | `resume` |

### 6.4 路由逻辑（Python）

```python
# backend/local_rules.py

LOCAL_KEYWORDS = {
    "清除": "clear", "清空": "clear", "清屏": "clear",
    "撤销": "undo", "回退": "undo", "上一步": "undo",
    "重做": "redo", "恢复": "redo",
    "彩铅": ("setBrush", "pencil"),
    "颜料笔": ("setBrush", "paint"), "颜料": ("setBrush", "paint"),
    "暂停": "pause", "继续": "resume",
}

COLOR_MAP = {
    "红": "#FF4444", "蓝": "#4488FF", "绿": "#228B22",
    "黄": "#FFCC00", "橙": "#FF8800", "紫": "#9944FF",
    "黑": "#000000", "白": "#FFFFFF", "灰": "#888888",
    "粉": "#FF88AA", "棕": "#8B4513", "青": "#00CCCC",
}

def is_local_command(text: str) -> bool:
    for color_key in COLOR_MAP:
        if color_key in text and len(text) <= 10:
            return True
    for keyword in LOCAL_KEYWORDS:
        if keyword in text and len(text) <= 10:
            return True
    return False
```

---

## 七、LLM Prompt 设计

### 7.1 System Prompt（完整）

```
你是一个语音绘图助手。用户用自然语言描述想画的内容，你需要将其转换为 JSON 绘图指令序列。

## 画布参数
- 尺寸：800 × 600
- 坐标原点在左上角
- 建议绘图区域居中，留出边距

## 输出格式
严格输出以下 JSON，不要包含任何解释文字：
{ "instructions": [...] }

## 指令类型

### 绘图指令（mode 控制绘制阶段）
{ "action": "circle",   "cx": 200, "cy": 150, "r": 30, "stroke": "#CC0000", "fill": "#FF4444", "strokeWidth": 2, "mode": "stroke", "brush": "pencil", "duration": 500 }
{ "action": "rect",     "x": 100, "y": 100, "w": 80, "h": 60, "stroke": "#000", "fill": "#FFF", "strokeWidth": 2, "mode": "both", "duration": 400 }
{ "action": "line",     "x1": 0, "y1": 0, "x2": 100, "y2": 100, "stroke": "#000", "strokeWidth": 2, "mode": "stroke", "duration": 300 }
{ "action": "curve",    "points": [[0,0],[50,30],[100,0]], "stroke": "#000", "strokeWidth": 2, "mode": "stroke", "duration": 400 }
{ "action": "polygon",  "points": [[200,100],[250,50],[300,100],[250,150]], "stroke": "#000", "fill": "#FFF", "mode": "both", "duration": 500 }
{ "action": "ellipse",  "cx": 200, "cy": 150, "rx": 40, "ry": 25, "stroke": "#000", "fill": "#FFF", "mode": "both", "duration": 400 }

### 控制指令
{ "action": "setColor",  "value": "#FF4444", "duration": 0 }
{ "action": "setWidth",  "value": 3, "duration": 0 }
{ "action": "setBrush",  "type": "pencil", "fillAngle": 45, "fillDensity": 5, "duration": 0 }
{ "action": "wait",      "duration": 300 }

## mode 说明
- "stroke"：只画轮廓线（勾线阶段）
- "fill"：只填充内部（上色阶段）
- "both"：同时描边和填充（适用于一次性完成的简单形状）

## brush 说明
- "pencil"：彩铅效果，填充时使用排线（平行斜线），支持 fillAngle（角度）和 fillDensity（密度1-10）
- "paint"：颜料笔效果，填充时展示笔触纹理

## duration 说明
- 简单线条：200-400ms · 中等形状：400-600ms · 复杂形状：600-1000ms · 控制指令：0ms

## 绘制原则
1. 如果用户指定了画笔类型，在第一条指令前插入 setBrush
2. 如果用户指定了颜色，在第一条绘图指令前插入 setColor
3. **两阶段绘制**：先全部用 mode:"stroke" 画出所有轮廓 → 然后用 mode:"fill" 逐一填充
4. 形状的坐标要合理分布，避免重叠混乱
5. 保持指令简洁，不要过度拆分——一片花瓣就是一个 circle 指令
6. 花朵的花瓣围绕花蕊均匀分布
7. 树由矩形树干 + 圆形/三角形树冠组成
8. 太阳在画布上方，带光芒线

现在请等待用户输入绘图指令。
```

### 7.2 后端调用逻辑

```python
# backend/llm.py

import httpx
import json

SYSTEM_PROMPT = """..."""  # 上面的完整 prompt

async def generate_instructions(user_text: str) -> dict:
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.qnaigc.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": "deepseek-v3",
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_text}
                ],
                "temperature": 0.3,
                "max_tokens": 4096,
                "response_format": {"type": "json_object"}
            },
            timeout=15.0
        )
        data = response.json()
        return parse_llm_response(data)
```

### 7.3 容错设计（三道防线）

```python
# backend/instruction_parser.py

def parse_llm_response(data: dict) -> dict:
    # 防线1: JSON 解析
    try:
        content = data["choices"][0]["message"]["content"]
        result = json.loads(content)
    except (KeyError, json.JSONDecodeError):
        return {"error": "LLM 返回格式异常，请重试"}

    # 防线2: 结构校验
    if "instructions" not in result:
        return {"error": "缺少 instructions 字段"}
    if not isinstance(result["instructions"], list):
        return {"error": "instructions 应为数组"}

    # 防线3: 逐条指令 action 校验
    VALID_ACTIONS = {
        "circle","rect","line","curve","polygon","ellipse","arc","text",
        "setColor","setWidth","setBrush","clear","undo","redo","wait","pause","resume"
    }
    for i, inst in enumerate(result["instructions"]):
        if inst.get("action") not in VALID_ACTIONS:
            return {"error": f"第{i}条指令 action 无效: {inst.get('action')}"}

    return result
```

---

## 八、语音交互流程

```
1. 用户按住录音按钮（或点击开始）
2. MediaRecorder 采集音频 → 停止后生成 .wav blob
3. POST /api/asr → 七牛云 ASR → 返回文本
   （失败时前端降级 Web Speech API）
4. 文本显示在状态栏 → POST /api/generate
5. 后端指令路由器分发：
   - 简单指令 → 本地规则引擎 ~50ms 返回
   - 复杂指令 → 七牛云 MaaS LLM 2-5s 返回
6. 返回 JSON 指令序列
7. 前端 renderer.js 逐条执行指令，每条按 duration 控速
8. 完成后语音播报或状态提示
```

---

## 九、设计原则

### 9.1 指令理解准确性 & 容错性

- LLM prompt 中明确 JSON 指令格式约束，要求只输出有效 JSON
- 后端 `instruction_parser.py` 做三道防线校验（JSON 解析 → 结构校验 → 逐条 action 校验），失败时返回错误提示而非崩溃
- 本地规则引擎支持模糊匹配：「红色」「红的」「红颜色」→ 同一处理

### 9.2 语音到绘图响应延迟

- 简单指令本地处理，毫秒级响应
- 复杂指令走 LLM，2-5s 完整响应
- 录音结束后立即显示识别文本，让用户知道系统在「听」

### 9.3 复杂指令拆解

- LLM 负责将「在画布中央画三个间距相等的红色圆形」拆解为多条基本指令
- 两阶段绘制：所有轮廓先画完 → 然后逐一填充
- 本地规则引擎只处理不可再分的原子操作

### 9.4 成本控制策略

- **本地优先**：简单指令走本地规则引擎，零 API 调用
- **两阶段复用**：画布操作和画笔控制走本地，仅绘图请求走 LLM
- **兜底降级**：七牛云 ASR 不可用时自动降级 Web Speech API
- **指令缓存**：同一句指令短时间内重复 → 直接复用上次结果

---

## 十、前端 UI 布局设计

### 10.1 页面布局

```
┌──────────────────────────────────────────┐
│              语绘 Voice Canvas            │ ← 顶栏（36px）
│  🖌 彩铅 │ 🎨 #FF4444 │ 📏 3px │ ↩ 撤销  │ ← 状态指示条（32px）
├──────────────────────────────────────────┤
│                                          │
│              Canvas 画布                  │
│             800 × 500                    │
│             (浅灰背景 #F5F5F5)             │
│                                          │
│      "画一朵简笔花"  ← 等等我帮你画...      │ ← 内嵌提示（半透明叠加）
│                                          │
├──────────────────────────────────────────┤
│  🟡 识别中... | 刚刚听到："画一朵简笔花"   │ ← 状态栏（28px）
├──────────────────────────────────────────┤
│           [ 🎤 按住说话 ]                 │ ← 录音按钮（48px，主交互区）
│      点击开始录音 · 再次点击结束           │
└──────────────────────────────────────────┘
```

### 10.2 React 组件树

```
App.jsx
├── Canvas.jsx          # 画布组件
│   └── canvas ref      # Renderer 实例挂载点
├── VoiceBar.jsx        # 底部控制区
│   ├── 状态指示        # 当前画笔/颜色/线宽
│   ├── 识别文本显示    # "刚刚听到：..."
│   └── 录音按钮        # 按住/点击触发录音
└── CommandHistory.jsx  # 可折叠指令历史面板
```

### 10.3 组件职责

| 组件 | 职责 | 关键 Props/State |
|------|------|------------------|
| `App.jsx` | 全局状态管理，协调前后端通信 | `status`, `history`, `currentBrush` |
| `Canvas.jsx` | 管理 `<canvas>` ref，初始化 Renderer 实例 | `width=800`, `height=500` |
| `VoiceBar.jsx` | 录音控制、状态显示、识别文本回显 | `isRecording`, `statusText` |
| `CommandHistory.jsx` | 指令列表展示，最新指令高亮 | `instructions[]` |

### 10.4 交互状态机

```
                    ┌── 点击录音按钮 ──→ RECORDING
                    │                      │
                    │              再次点击/松开 ──→ TRANSCRIBING
                    │                      │
                    │            POST /api/asr 完成 ──→ GENERATING (复杂指令)
                    │            POST /api/generate ──→ DRAWING    (简单指令直达)
                    │                      │
                    ▼                      ▼
                  IDLE ←──────────── 动画播放完毕
                    ▲
                    │
              PAUSED ←── "暂停"指令
                    │
                    └── "继续"指令 ──→ DRAWING
```

### 10.5 状态与 UI 映射

| 状态 | 录音按钮 | 状态栏文字 | Canvas 内提示 |
|------|----------|------------|---------------|
| IDLE | 🎤 按住说话 | 准备就绪 | — |
| RECORDING | 🔴 松开结束 | 正在聆听... | — |
| TRANSCRIBING | ⏳ | 识别中... | — |
| GENERATING | ⏳ | AI 正在理解... | "等等我帮你想..." |
| DRAWING | ⏳ (禁用) | 正在绘制... | 当前识别的文本 |
| PAUSED | ▶ 继续 | 已暂停 | "已暂停，说'继续'恢复" |
| ERROR | 🎤 重试 | 错误信息 | — |

---

## 十一、错误处理 & 降级策略

### 11.1 分层错误处理

```
┌──────────────────────────────────────────────────┐
│                   错误分类 & 对策                  │
├──────────┬─────────────────┬─────────────────────┤
│   层级    │      场景        │        处理          │
├──────────┼─────────────────┼─────────────────────┤
│  网络层   │ 后端不可达        │ 前端显示"网络异常"    │
│          │ 请求超时          │ 3秒超时 + 重试按钮    │
├──────────┼─────────────────┼─────────────────────┤
│  语音层   │ 七牛云 ASR 失败   │ 自动降级 Web Speech   │
│          │ Web Speech 也失败 │ "未识别到语音，请重试" │
│          │ 识别结果为空       │ "请再说一遍"          │
├──────────┼─────────────────┼─────────────────────┤
│  LLM 层  │ API 超时(15s)    │ "AI 思考超时，请简化指令"│
│          │ API 异常/欠费     │ 降级方案 A: 纯 LLM 重试 │
│          │ JSON 解析失败     │ parser 三道防线兜底    │
│          │ 指令 action 非法  │ 跳过非法指令，执行合法的  │
├──────────┼─────────────────┼─────────────────────┤
│  渲染层   │ 单条指令执行异常   │ catch → 跳过，记录日志 │
│          │ Canvas 上下文丢失  │ 重建 Renderer 实例    │
└──────────┴─────────────────┴─────────────────────┘
```

### 11.2 降级链路

```
语音识别降级链:
  七牛云 ASR ──失败──→ Web Speech API ──失败──→ 提示"请重试"
       │                    │
       └── source: "qiniu"  └── source: "webspeech"

绘图指令降级链:
  LLM (方案B混合路由) ──失败──→ 方案A纯LLM重试 ──失败──→ 提示"请换个说法"
```

### 11.3 前端错误处理（api.js）

```javascript
// src/services/api.js
const ASR_TIMEOUT = 5000;
const LLM_TIMEOUT = 15000;

async function apiCall(url, options, timeout) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('请求超时');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function transcribe(audioBlob) {
  try {
    return await apiCall('/api/asr', { method: 'POST', body: formData }, ASR_TIMEOUT);
  } catch {
    // 降级 Web Speech API
    return await webSpeechFallback(audioBlob);
  }
}

export async function generate(text) {
  return await apiCall('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  }, LLM_TIMEOUT);
}
```

### 11.4 用户可见的错误提示

| 错误 | 用户看到 |
|------|----------|
| 麦克风权限未授权 | "请允许浏览器使用麦克风" + 引导按钮 |
| 未识别到语音 | "没有听清，请重试" |
| LLM 超时 | "AI 想得太久了，试试说得简单一点？" |
| LLM 返回异常 | "AI 画不出来，换个说法试试？" |
| 网络断开 | "网络连接异常，请检查网络" |

### 11.5 兜底保底原则

1. **永不白屏**：任何错误都展示具体提示，不崩溃
2. **画布状态保持**：错误不影响已绘制内容，用户可继续操作
3. **3 次连续失败 → 明确提示**：建议用户检查网络/API Key/重试
4. **所有错误记录日志**：`console.error` + 错误时间戳，方便 debug demo 时排查

---

## 十二、待细化事项

- [x] JSON 指令集完整定义（所有 action 类型及其参数 + 渐变系统）
- [x] 本地规则引擎覆盖的指令清单
- [x] LLM prompt 详细设计
- [x] Canvas 渲染引擎逐笔动画方案
- [x] 前端 UI 布局设计
- [x] 错误处理 & 降级策略细节
- [ ] 设计文档（提交物）大纲

---

## 十三、提交物清单

根据题目要求，需提交：

| 提交物 | 说明 |
|--------|------|
| **代码仓库** | GitHub 公开（6月15日起），含前后端全部代码 |
| **Demo 视频** | 展示语音绘图完整流程 |
| **设计文档** | 计划支持 vs 实际支持的指令能力，未完成部分原因说明 |
| **作品提交** | hr.qiniu.com 填写仓库信息（24小时内！） |

---

*本文档持续更新，记录设计演进过程。*
