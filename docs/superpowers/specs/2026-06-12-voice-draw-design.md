# AI 语音绘图工具 — 设计文档

> 七牛云 × XEngineer 暑期实训营 2026 — 题目二  
> 开发周期：2026-06-12 ~ 2026-06-14

---

## 0. 项目背景

### 竞赛信息

| 项目 | 说明 |
|------|------|
| 赛事 | 七牛云 × XEngineer 暑期实训营 |
| 批次 | 最后一批（2026-06-12 00:00 ~ 06-14 23:59） |
| 题目 | 题目二：AI 语音绘图工具 |
| 队伍 | 个人参赛 |
| 提交截止 | 2026-06-14 23:59 |
| 仓库公开时间 | 2026-06-15 00:00 起 |

### 题目要求（原文）

> 请开发一款**纯语音控制**的绘图工具。
>
> 要求：用户不能使用鼠标或键盘，仅通过语音指令完成绘图创作。请综合考虑：
> - 指令理解的**准确性与容错性**
> - 语音到绘图操作的**响应延迟**
> - 复杂指令的**拆解与执行能力**
>
> 实现应用的同时，请额外提交一份**设计文档**，记录：
> 1. 计划支持哪些指令能力
> 2. 最终实现了哪些
> 3. 未完成部分的原因说明

### 作品提交要求

- **持续提交**：开发周期内保持每日 commit + PR，严禁最后一天突击提交
- **PR 规范**：每个 PR 只做一件事，标题 + 功能描述 + 实现思路 + 测试方式
- **Demo 视频**：需语音讲解、覆盖核心功能，上传至 bilibili 等平台，链接放 README 显眼位置
- **代码仓库**：6/14 前可私有，6/15 起需公开；不上传 API Key
- **学术诚信**：代码重复率 > 50% 取消资格，列入黑名单

### 技术约束

- API Key 等敏感信息全部在后端处理，不暴露于前端代码
- 纯语音交互，无鼠标/键盘操作
- 3 天内完成开发 + Demo 录制
- 优先集成七牛云语音能力，贴合主办方技术栈

---

## 1. 产品定位

本项目设计一款**纯语音控制的 AI Canvas 绘图工具**。系统优先集成七牛云短语音听写能力，将用户语音转写为文本，再结合规则解析与 Qwen 文本模型，将自然语言绘图意图转换为**结构化 Canvas 指令**。前端 Canvas 引擎根据指令完成基础图形绘制、组合对象生成、对象编辑、撤销与清空操作，并通过浏览器语音合成进行反馈。

### 核心定位

> **不是"语音命令执行器"，而是"AI 绘图伙伴"**

用户用自然语言表达意图（"画一个太阳"），系统自主拆解为可执行的 Canvas 指令并回馈语音确认，无需用户报坐标参数。

### 核心理念对比

| 传统做法 | 我们的做法 |
|----------|-----------|
| "画圆 x=100 y=100 r=50 红色" | "画一个太阳" |
| 用户像程序员报参数 | 用户自然表达意图，系统翻译为绘图操作 |
| 每次操作独立、无上下文 | 系统持有画布对象列表，理解"把它变大"中的"它" |

---

## 2. 题目要求对应关系

### 2.1 指令理解的准确性与容错性

| 设计手段 | 对应效果 |
|----------|----------|
| 七牛云短语音听写将语音转写为文本 | 降低前端浏览器识别不稳定的风险 |
| Qwen 文本模型理解自然语言绘图意图 | 将模糊的自然语言转换为精确的结构化 JSON |
| LLM 输出修复管道（去 markdown 包裹、截断修复、字段校验、逐条丢弃） | 处理 LLM 返回非 JSON、格式错误、截断等高频问题 |
| Rules Parser 处理固定指令 + 失败兜底 | LLM 不可用时系统依然可用 |
| Command Parser 对 AI 输出进行 6 项校验 | AI 幻觉输出不会直接到达 Canvas |
| 模糊对象匹配（label / 颜色 / 位置 / 最近创建 四级匹配） | 用户说"那个红色的"也能定位对象 |
| 识别失败 / 指令非法时返回友好语音提示 | 用户体验不中断 |

### 2.2 语音到绘图操作的响应延迟

| 设计手段 | 对应效果 |
|----------|----------|
| 能量检测 VAD（静音 2s 自动截断 + 60s 上限） | 前端自动判断句子边界，无需等待额外事件 |
| 句子级 HTTP 请求（非 WebSocket 音频流） | 避免音频分片、流控等额外延迟源 |
| Canvas 在前端本地执行 commands | 无远程渲染等待，指令到达即绘制 |
| 浏览器 SpeechSynthesis 本地 TTS | 无后端语音合成耗时 |

### 2.3 复杂指令的拆解与执行能力

| 设计手段 | 对应效果 |
|----------|----------|
| commands 数组表达多步绘图步骤 | 一条自然语言 → 多个原子绘图操作 |
| groupId + role 管理组合对象 | "房子"包含墙体+屋顶+门，作为一个语义单位 |
| 空间网格索引（3×2 cells） | LLM 从空间摘要中理解布局，推算坐标时自然避开已有对象 |
| LLM 语义拆解 | "画一座房子"→ 自动拆解为 rect + triangle + rect |
| last_action 上下文传递 | "再大一点" → LLM 知道上一轮改的是哪个对象 |
| 对象级编辑（移动、改色、删除） | label/颜色/位置/最近 四级模糊匹配定位目标 |
| undo 撤销历史 | 每次操作前保存对象快照，支持回退 |

---

## 3. 技术架构

### 3.1 主链路

```
用户语音
    ↓
┌─────────────────────────────┐
│    前端 音频采集 + VAD       │
│  MediaRecorder 录音          │
│  能量检测: 静音 2s 截断       │
│  最大 60s 强制截断            │
│  (调试期保留隐藏文本入口)      │
└─────────────┬───────────────┘
              ↓ 音频文件
┌─────────────────────────────┐
│         ASRProvider          │  抽象层
│  ┌───────────────────────┐  │
│  │ 七牛云短语音听写 (主)   │  │
│  │ Web Speech API  (备用) │  │
│  │ Qwen-ASR       (扩展)  │  │
│  └───────────────────────┘  │
└─────────────┬───────────────┘
              ↓ 文本
┌─────────────────────────────┐
│      Rules Parser (兜底)     │  LLM 不可用时保底
│  太阳/树/房子/撤销/清空/你好  │
└─────────────┬───────────────┘
              ↓ 未命中
┌─────────────────────────────┐
│   LLM Client (Qwen 文本)     │  复杂语义解析
│   文本 + 空间摘要 → commands  │
└─────────────┬───────────────┘
              ↓ 原始输出
┌─────────────────────────────┐
│     LLM 输出修复管道         │  容错处理
│  去markdown→截断修复→字段校验 │
└─────────────┬───────────────┘
              ↓ 合法 JSON
┌─────────────────────────────┐
│     Command Parser           │  安全校验层
│  白名单+参数+坐标+颜色+target │
└─────────────┬───────────────┘
              ↓ 安全指令
┌─────────────────────────────┐
│   Canvas CommandExecutor     │  前端执行
│  ObjectStore / HistoryManager │
└─────────────┬───────────────┘
              ↓
┌─────────────────────────────┐
│  浏览器 SpeechSynthesis      │  语音反馈
│  (含空间描述: "在画布中下方   │
│   画了一座黄色房子")          │
└─────────────────────────────┘
```

### 3.2 交互流程（含 VAD）

```
🟢 等待语音
    ↓ 检测到音量超过阈值
🔵 录音中（能量 RMS 持续检测）
    ↓ 静音超过 2 秒 → 自动截断发送
    ↓ 或录音超过 60 秒 → 强制截断发送
🟡 处理中（ASR → LLM → 校验 → 执行）
    ↓ 收到 reply + commands → Canvas 执行 + TTS 播报
🟢 等待下一句
```

### 3.3 技术选型

| 层 | 技术 | 说明 |
|----|------|------|
| 前端框架 | React 18 + TypeScript | Canvas 生态成熟，类型安全 |
| 绘图 | Canvas 2D API | 原生高性能，无需额外库 |
| 语音采集 | MediaRecorder + AnalyserNode | 录音 + 能量检测 VAD |
| 主语音识别 | **七牛云短语音听写 API** | 后端调用，贴合主办方能力，API Key 不暴露前端 |
| 备用语音识别 | Web Speech API | 七牛云接口不可用时保底 |
| 可扩展 ASR | Qwen-ASR / Qwen-Audio | 后续增强，不作为首版关键路径 |
| 通信协议 | HTTP (POST) | 句子级请求，简单可靠 |
| 后端框架 | FastAPI | 异步高性能，Python 生态 |
| 指令理解 | Qwen 文本模型 + Rules Parser | Qwen 具备较好的中文语义理解和 JSON 生成能力 |
| TTS | 浏览器 SpeechSynthesis | 零成本，即时反馈 |

### 3.4 纯语音交互说明

用户进入页面后，系统请求麦克风权限；授权完成后自动进入监听状态。系统通过能量检测自动判断用户是否在说话：检测到静音超过 2 秒时自动截断当前录音并发送，单次录音最长 60 秒强制截断。整个绘图过程不需要鼠标或键盘参与，用户仅通过语音完成绘图、编辑、撤销和清空操作。

> 开发调试阶段保留隐藏文本输入入口，便于测试指令解析；正式 Demo 与提交说明中不展示该入口，保证用户交互过程符合纯语音要求。

---

## 4. 画布状态管理（空间索引）

### 4.1 核心思路

将画布划分为空间网格，LLM 看到的永远是**固定大小的空间摘要**，与画布上对象数量无关。

### 4.2 空间网格结构

Canvas 1200×800，划分为 3 列 × 2 行（6 个格子，每格 400×400）：

```
┌──────────┬──────────┬──────────┐
│  [0,0]   │  [0,1]   │  [0,2]   │  上半区
│  左上    │  中上    │  右上    │
├──────────┼──────────┼──────────┤
│  [1,0]   │  [1,1]   │  [1,2]   │  下半区
│  左下    │  中下    │  右下    │
└──────────┴──────────┴──────────┘
```

每个对象按其中心坐标落入一个格子，格子内记录对象的精简信息。

### 4.3 发给 LLM 的空间摘要（始终 ~500 字符）

```json
{
  "canvas": { "width": 1200, "height": 800 },
  "grid": {
    "cells": [
      { "id": "0,0", "label": "左上", "objects": [] },
      { "id": "0,1", "label": "中上", "objects": [
          { "id": "obj_1", "label": "太阳", "type": "circle", "cx": 600, "cy": 120, "r": 50, "fill": "#ff4d4f", "role": "body" }
      ]},
      { "id": "0,2", "label": "右上", "objects": [] },
      { "id": "1,0", "label": "左下", "objects": [
          { "id": "obj_4", "label": "树干", "type": "rect", "groupId": "tree_1", "x": 120, "y": 500, "w": 30, "h": 120 }
      ]},
      { "id": "1,1", "label": "中下", "objects": [
          { "id": "obj_2", "label": "墙体", "type": "rect", "groupId": "house_1", "role": "body", "x": 450, "y": 450, "w": 200, "h": 150, "fill": "#ffe58f" },
          { "id": "obj_3", "label": "屋顶", "type": "triangle", "groupId": "house_1", "role": "detail" }
      ]},
      { "id": "1,2", "label": "右下", "objects": [] }
    ]
  }
}
```

### 4.4 对象完整结构（前端 ObjectStore 维护）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 唯一标识 |
| `type` | string | circle / rect / triangle / line / text |
| `label` | string | 语义标签，如 "太阳"、"树冠" |
| `role` | string \| null | `"body"` 为主体（改色时优先命中），`"detail"` 为装饰细节 |
| `groupId` | string \| null | 组合所属，如多个图形组成"房子"时共享同一 groupId |
| `cellId` | string | 所属格子，如 `"1,1"` |
| 坐标参数 | number | 根据 type 不同 |
| 样式 | — | color / fill / width 等 |

### 4.5 空间索引的设计收益

| 能力 | 效果 |
|------|------|
| Prompt 体积恒定 | 无论画了多少对象，空间摘要始终 ~500 字符 |
| LLM 理解布局 | 从格子标签（左上/中下等）快速判断画布占用情况 |
| 坐标推算 | LLM 看到格子占用情况，自然避开已有对象 |
| 位置匹配 | 用户说"左边的那个" → 前端优先在左侧格子搜索 |

### 4.6 组合对象编辑规则

| 用户说 | 系统行为 |
|--------|----------|
| "把房子改成蓝色" | 找到 groupId="house_1" 中 role="body" 的对象（墙体）改色 |
| "把树改成绿色" | 修改树冠（role="body"），保留树干 |
| "把太阳变大" | 找到 label="太阳"，增大 r |
| "把房子往右移" | 找到 groupId="house_1" 的全部对象 → 批量调整 x |
| "删除房子" | 移除 groupId="house_1" 全部对象 |

---

## 5. 绘图指令协议

### 5.1 核心原则

自然语言不直接控制 Canvas，先转成结构化 commands。commands 经过修复管道 + 安全校验后，再由前端 CommandExecutor 逐条执行。

```text
自然语言 → LLM / Rules 生成 JSON → 修复管道 → Command Parser 校验 → CommandExecutor → Canvas
```

### 5.2 请求格式

```http
POST /api/command
Content-Type: application/json

{
  "text": "画一个红色的太阳",
  "canvas_state": { "width": 1200, "height": 800, "grid": {...} },
  "last_action": { "reply": "...", "commands": [...] }
}
```

### 5.3 响应格式

```json
{
  "reply": "好的，我在画布中上方画了一个红色的太阳",
  "commands": [
    { "action": "draw_circle", "params": { "cx": 600, "cy": 150, "r": 60, "fill": "#ff4d4f", "label": "太阳", "role": "body", "cellId": "0,1" } }
  ]
}
```

### 5.4 基础图形指令

| action | 关键参数 | 说明 |
|--------|----------|------|
| `draw_line` | x1, y1, x2, y2, color, width | 画直线 |
| `draw_rect` | x, y, w, h, color, fill, width | 画矩形 |
| `draw_circle` | cx, cy, r, color, fill, width | 画圆 |
| `draw_triangle` | x1, y1, x2, y2, x3, y3, color, fill | 画三角形 |
| `draw_text` | x, y, text, size, color | 写文字 |

### 5.5 对象编辑指令

| action | 关键参数 | 说明 |
|--------|----------|------|
| `update_object` | target: "obj_id", params: {...} | 修改指定对象的任意属性 |
| `move_object` | target: "obj_id", dx, dy | 相对移动对象 |
| `delete_object` | target: "obj_id" | 删除指定对象 |

### 5.6 画布控制指令

| action | 参数 | 说明 |
|--------|------|------|
| `undo` | — | 撤销上一步 |
| `clear` | — | 清空所有对象 |
| `speak` | text | 纯 TTS 反馈（无绘图操作） |
| `set_color` | color | 设置默认画笔颜色（尽量实现） |
| `set_width` | width | 设置默认线宽（尽量实现） |

---

## 6. Command Parser 安全执行层

> AI 输出不直接执行，必须经过安全校验层。

### 6.1 校验规则

| 校验项 | 规则 | 失败处理 |
|--------|------|----------|
| action 白名单 | 必须在已注册的 action 列表中 | 丢弃该条 command |
| 必填参数缺失 | 每种 action 有定义的必填字段 | 丢弃该条 command |
| 可选参数缺失 | 非必填字段 | 用默认值补全 |
| 坐标边界 | x/y ≥ 0 且不超过画布尺寸 | 钳位到边界内 |
| 颜色格式 | 合法 hex（#xxx / #xxxxxx）或 CSS 颜色名 | 改为默认黑色 |
| target 存在性 | update/delete 操作的 obj_id 必须在当前 objects 中 | 丢弃该条 command |
| 参数类型 | 数字字段必须是 number，字符串必须是 string | 类型转换或丢弃 |

### 6.2 逐条丢弃策略

不因一条 command 非法而丢弃整批。例如 LLM 返回 3 条 commands，其中 1 条 action 不在白名单 → 执行其余 2 条，TTS 仍然反馈 reply。

### 6.3 容错输出

当所有 commands 经校验后为空时：

```json
{
  "reply": "抱歉，我没有理解那个操作，请再说一遍",
  "commands": []
}
```

---

## 7. LLM 输出修复管道

> LLM 返回格式异常（markdown 包裹、截断、字段缺失）的频率远高于坐标越界。在进入 Command Parser 之前，先经过修复管道。

### 7.1 管道流程

```
LLM 原始输出
    ↓
① 去 markdown 包裹：正则提取第一个 { 到最后一个 }
    ↓
② 截断修复：括号栈匹配，补全缺失的 } ] "
    ↓
③ JSON.parse → 检查 reply + commands 字段存在
    ↓ 合法?
④ 进入 Command Parser 逐条校验
    ↓
    ├── 全部通过 → 返回
    ├── 部分通过 → 丢弃非法 commands，保留合法的
    └── 全部失败 → 重试 1 次（强化 Prompt: "YOU MUST RETURN ONLY JSON"）
                   → 再失败 → Rules Parser 兜底
```

### 7.2 各层策略

**① 剥离 markdown 包裹**

```python
# LLM 最常见的脏输出
raw = '''```json\n{"reply": "好的", "commands": [...]}\n```'''

import re
match = re.search(r'\{.*\}', raw, re.DOTALL)
if match:
    raw = match.group(0)
```

**② 截断修复**

```python
def repair_truncated_json(s: str) -> str:
    """括号栈匹配，逆向补全"""
    stack = []
    in_string = False
    for i, ch in enumerate(s):
        if ch == '"' and (i == 0 or s[i-1] != '\\\\'):
            in_string = not in_string
        if in_string:
            continue
        if ch in '{[':
            stack.append(ch)
        elif ch == '}':
            if stack and stack[-1] == '{':
                stack.pop()
        elif ch == ']':
            if stack and stack[-1] == '[':
                stack.pop()
    closer = {'{': '}', '[': ']'}
    return s + ''.join(closer[c] for c in reversed(stack) if c in closer)
```

**③ 字段校验 + 退化**

```python
result = json.loads(raw)
if 'reply' not in result:
    result['reply'] = '好的'
if 'commands' not in result:
    result['commands'] = [
        {'action': 'speak', 'params': {'text': result.get('reply', '好的')}}
    ]
if not isinstance(result['commands'], list):
    result['commands'] = []
```

### 7.3 源头防护：Qwen JSON Mode

```python
response = dashscope.Generation.call(
    model="qwen-plus",
    messages=[...],
    response_format={"type": "json_object"},  # 从源头降低格式错误率
)
```

---

## 8. Rules Parser（规则兜底）

> Rules Parser 的核心价值是**可靠性兜底**，而非延迟优化。当 Qwen API 不可用时，系统仍能响应基础指令。

### 8.1 触发条件

- LLM API 调用超时（> 8 秒）
- LLM 返回修复管道全部失败
- 连续 2 次 LLM 重试均失败

### 8.2 规则匹配表

| 用户说（包含关键词） | 生成指令 |
|---------------------|----------|
| "太阳" | draw_circle(cx≈画布中上, cy≈顶部1/4, r=60, fill="#ff4d4f", label="太阳", role="body") |
| "树" / "一棵树" | draw_rect(树干) + draw_circle(树冠, role="body") → 共享 groupId |
| "房子" / "一座房子" | draw_rect(墙体, role="body") + draw_triangle(屋顶, role="detail") + draw_rect(门, role="detail") |
| "花" | draw_circle(花心, role="body") + 5×draw_circle(花瓣, role="detail") |
| "清空" / "删除全部" | [clear] |
| "撤销" / "回退" / "上一步" | [undo] |
| "你好" | [speak("你好，我是语音绘图助手，请告诉我你想画什么")] |

### 8.3 局限性（明确标注）

- 坐标固定，无画布上下文感知。连续两次"画太阳"会偏右偏移 120px，不保证不重叠
- 不支持增量编辑（"把太阳变大"等需要对象匹配的指令在规则模式下不支持）
- 定位为**保底方案**，正常流程应走 LLM

---

## 9. 语音修正闭环

> 纯语音交互下，用户发现 LLM 推算的坐标跑偏时，需要通过自然的语音指令完成修正，而非"撤销→重试"。

### 9.1 三层修正机制

**第 1 层：TTS 空间反馈**

每次执行后，TTS 描述做了什么以及在哪里：

```
"好的，在画布中下方画了一座黄色房子"
"好的，在房子左边画了一棵绿色树"
"我把太阳的半径从 50 增大到了 80"
```

用户听完就知道结果对不对。

**第 2 层：模糊对象匹配**

修正时不需要精确说出 label，系统支持四级匹配（前端本地执行，不调 LLM）：

```python
def find_object(user_text: str, objects: list, grid: dict) -> list:
    """四级模糊匹配，返回候选对象列表"""
    
    # Level 1: label 关键词匹配
    #   "把太阳变大" → label 含"太阳"
    known_labels = ["太阳","树","树干","树冠","房子","墙体","屋顶","门","窗","花","山","海","船","星星","云"]
    matched = [l for l in known_labels if l in user_text]
    if matched:
        return [o for o in objects if any(m in o.get('label','') for m in matched)]
    
    # Level 2: 颜色匹配
    #   "把红色的那个变大" → fill 含 red/#ff
    colors_map = {"红":"#ff","蓝":"#00f","绿":"#0f0","黄":"#ff0","紫":"#80f","橙":"#fa0","黑":"#000","白":"#fff"}
    for name, hex_prefix in colors_map.items():
        if name in user_text:
            return [o for o in objects if o.get('fill','').startswith(hex_prefix)]
    
    # Level 3: 位置匹配
    #   "把左边的删掉"、"上面那个" → 对应格子
    position_map = {"左": ["0,0","1,0"], "右": ["0,2","1,2"], 
                    "上": ["0,0","0,1","0,2"], "下": ["1,0","1,1","1,2"],
                    "中间": ["0,1","1,1"]}
    for pos, cell_ids in position_map.items():
        if pos in user_text:
            return [o for o in objects if o.get('cellId') in cell_ids]
    
    # Level 4: 最近对象
    #   "太大了"、"删掉它"
    return [objects[-1]] if objects else []
```

**第 3 层：last_action 上下文**

每次请求附带上一轮的简短上下文，LLM 理解指代词：

```json
{
  "text": "太大了，改成小一点的",
  "canvas_state": { ... },
  "last_action": {
    "reply": "我把太阳的半径设为 50",
    "commands": [
      { "action": "update_object", "target": "obj_1", "params": { "r": 50 } }
    ]
  }
}
```

LLM 根据 `last_action` 知道上一轮改的是 obj_1，将"太大了"翻译为缩小半径。

### 9.2 完整修正交互示例

```
用户："在房子旁边画一棵树"
系统：在房子左侧 200px 处画树
     TTS："在房子左边画了一棵绿色树"            ← 第 1 层反馈

用户："太远了，往右移一点"                      ← 位置修正
系统：[fuzzy L4: 最近对象 → tree_1, L3: "右"→右移]   ← 第 2 层匹配

用户："太大了"                                    ← 指代词
系统：[last_action → tree_1] → 缩小 30%        ← 第 3 层上下文

用户："颜色改深一点"
系统：[last_action → tree_1] → 树冠 fill 加深
```

---

## 10. 前端设计

### 10.1 模块架构

```
App
├── VoiceInput          ← MediaRecorder 录音 + AnalyserNode 能量检测 VAD
├── CanvasEngine        ← Canvas 2D 渲染，根据 JSON 指令绘制图形
├── CommandExecutor     ← 接收后端 JSON commands，逐条执行
├── ObjectStore         ← 维护画布对象列表 + 空间网格索引
├── FuzzyMatcher        ← 四级模糊对象匹配（label/颜色/位置/最近）
├── HistoryManager      ← 操作历史栈，每次 commands 执行前保存快照
└── SpeechFeedback      ← SpeechSynthesis TTS，含空间描述
```

### 10.2 界面布局

```
┌──────────────────────────────────────────────┐
│  🎨 AI 语音绘图工具                          │
├──────────────────────────────────────────────┤
│                                              │
│              Canvas 画布区域                  │
│           (自适应尺寸，白色背景)               │
│                                              │
├──────────────────────────────────────────────┤
│  🟢 正在听...  │ 💬 "好的，画好了"            │
│                │ 🎨 对象：3 个 | 太阳、房子    │
└──────────────────────────────────────────────┘
```

### 10.3 状态指示器

| 状态 | 视觉 | 含义 |
|------|------|------|
| 等待语音 | 🟢 绿色脉冲 | 等待用户开始说话 |
| 录音中 | 🔵 蓝色闪烁 | 检测到音量，正在录音 |
| 处理中 | 🟡 黄色旋转 | 后端处理中 |
| 执行中 | 🟣 紫色 | 正在执行绘图指令 |
| 错误 | 🔴 红色 | 连接断开或识别失败 |

### 10.4 关键实现细节

- **VAD**：`AnalyserNode.getByteTimeDomainData()` 计算 RMS，阈值校准用前 2 秒环境噪音均值 + 偏移
- **ObjectStore**：`useRef` 维护对象 Map + 空间网格。每次绘制后更新网格
- **HistoryManager**：每次 commands 执行前深拷贝 objects 快照，undo 时恢复
- **CanvasEngine**：根据 object type 分发到对应渲染函数，全量重绘

---

## 11. 后端设计

### 11.1 API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/command` | POST | 核心：接收文本 + 空间摘要 + last_action → 返回绘图指令 |
| `/api/asr` | POST | 接收音频文件 → 调用七牛云 ASR → 返回转写文本 |
| `/health` | GET | 健康检查 |

### 11.2 后端模块

| 文件 | 职责 |
|------|------|
| `main.py` | FastAPI 入口，路由注册 |
| `asr/base.py` | ASRProvider 抽象接口 |
| `asr/qiniu_asr.py` | 七牛云短语音听写实现 |
| `llm_client.py` | Qwen 文本模型调用，Prompt 构造，JSON mode 启用 |
| `json_repair.py` | LLM 输出修复管道（去 markdown、截断修复、字段校验） |
| `rules_parser.py` | LLM 失败时的规则兜底 |
| `command_parser.py` | 指令白名单+参数+坐标+颜色+target 校验 |
| `config.py` | 从环境变量读取 API Key 等配置 |

### 11.3 LLM Prompt 设计

```text
System: 你是一个语音绘图助手。用户通过语音描述绘图意图，你需要将其转换为 Canvas 绘图指令。

规则：
1. 必须返回合法 JSON，格式为 { "reply": "...", "commands": [...] }
2. reply 是给用户的语音反馈，需包含空间描述（如"在画布中上方画了..."）
3. commands 数组中的每个元素包含 action 和 params
4. 支持的 action：draw_line, draw_rect, draw_circle, draw_triangle, draw_text, update_object, move_object, delete_object, undo, clear, speak
5. 每个新建图形必须包含 label、role（"body"/"detail"）、groupId（组合对象）、cellId（根据坐标落入的格子）
6. role="body" 标记组合对象的主体，改色时优先修改 body
7. 坐标需合理，参考空间网格中已有对象的占用情况，避免重叠

画布尺寸：{canvas_width} x {canvas_height}
画布空间网格：
{grid_json}

上一轮操作（用于理解"再大一点""改回去"等指代）：
{last_action}
```

### 11.4 配置管理

```bash
# .env (不提交到 git)
QINIU_ASR_APP_ID=xxx
QINIU_ASR_SECRET_KEY=xxx
DASHSCOPE_API_KEY=sk-xxx
LLM_MODEL=qwen-plus
```

---

## 12. 功能分级

### 必须实现

| 功能 | 说明 |
|------|------|
| ✅ VAD 句子边界检测 | 静音 2s 截断 + 60s 上限 |
| ✅ 语音输入识别 | 七牛云 ASR 主方案 + Web Speech API 备用 |
| ✅ 基础图形绘制 | draw_line, draw_rect, draw_circle, draw_triangle, draw_text |
| ✅ 自然语义绘图 | "太阳""树""房子" → 自动拆解为图形组合 |
| ✅ 组合对象管理 | groupId + role 标记，批量操作和智能改色 |
| ✅ 对象编辑 | move_object, update_object, delete_object |
| ✅ 撤销 + 清空 | undo / clear |
| ✅ 语音反馈 | 浏览器 TTS，含空间描述 |
| ✅ 空间网格索引 | 3×2 分块，Prompt 恒定为 ~500 字符 |
| ✅ LLM 输出修复管道 | 去 markdown + 截断修复 + 字段校验 + 逐条丢弃 |
| ✅ JSON 指令校验 | Command Parser 安全层 |
| ✅ 模糊对象匹配 | label/颜色/位置/最近 四级匹配 |
| ✅ last_action 上下文 | 支持"再大一点"等指代修正 |
| ✅ Rules Parser 兜底 | LLM 不可用时保底 |

### 尽量实现

| 功能 | 说明 |
|------|------|
| 🔶 复杂场景构图 | "海边日落" → 多元素自主构图 |
| 🔶 多步复合指令 | "画一座房子并在旁边加一棵树" |
| 🔶 简单风格控制 | set_color, set_width |

### 暂不实现（竞赛后扩展）

| 功能 | 原因 |
|------|------|
| ❌ Canvas 截图视觉理解 | 多模态调试成本高，首版优先保证文本链路 |
| ❌ WebSocket 实时音频流 | 句子级 HTTP + VAD 已满足需求 |
| ❌ 自由涂鸦 | 语音难以精确描述连续路径点 |
| ❌ AI 主动创作建议 | 锦上添花，不阻塞主链路 |
| ❌ 后端 TTS | 浏览器 SpeechSynthesis 已满足需求 |
| ❌ 多 ASR 通道自动切换 | 首版优先保证一个通道稳定，架构预留 ASRProvider |

---

## 13. Demo 脚本（3-5 分钟主线）

```
1. [开场 30s]   展示页面，说明纯语音控制绘图工具
2. [30s]       "画一个红色的太阳"        → 太阳出现，TTS 描述位置
3. [30s]       "在下面画一座房子"        → 墙体+屋顶+门组合出现
4. [30s]       "在房子旁边加一棵树"      → 树干+树冠出现
5. [30s]       "把太阳变大一点"          → 太阳半径增大，验证对象编辑
6. [30s]       "把房子改成蓝色"          → 墙体变蓝（屋顶和门保留原色）
7. [20s]       "太大了，改小一点"         → last_action 上下文理解指代
8. [20s]       "撤销上一步"             → 房子恢复原色
9. [20s]       "清空画布"              → 全部消失
10. [30s]      总结架构亮点
```

---

## 14. 计划 vs 实际（设计文档占位）

> 此章节在开发完成后填写。

### 计划支持的指令能力

| 类别 | 计划指令 |
|------|---------|
| 基础图形 | draw_line, draw_rect, draw_circle, draw_triangle, draw_text |
| 对象编辑 | update_object, move_object, delete_object |
| 画布控制 | undo, clear, speak |
| 语义理解 | 太阳、树、房子、花、山、海、船等 |
| ASR | 七牛云短语音听写 (主) + Web Speech API (备用) |
| 容错 | 修复管道 + 规则兜底 + 模糊匹配 |

### 最终实现情况

*（Day 3 填写）*

### 未完成部分及原因

*（Day 3 填写）*

---

## 15. 未完成功能原因说明（预设计）

### 15.1 Canvas 截图视觉理解

**原因**：多模态截图理解链路调试成本较高。首版优先保证文本链路的稳定闭环。空间网格 + label + role 已覆盖核心编辑需求。

### 15.2 WebSocket 实时音频流

**原因**：句子级 HTTP + VAD 已满足 Demo 需求。WebSocket 增加连接管理、音频分片和流控复杂度。

### 15.3 自由路径绘制

**原因**：语音难以精确描述连续路径点坐标。后续可结合 AI 自动路径生成实现。

### 15.4 多 ASR 通道自动切换

**原因**：首版优先保证一个通道稳定可用。系统通过 ASRProvider 抽象预留切换能力，当前采用配置级切换。

### 15.5 七牛云 ASR 完整接入（如适用）

**原因**：七牛云短语音听写涉及权限开通和接口鉴权。若开发周期内接口权限或调试时间不足，使用 Web Speech API 完成 Demo，七牛云 ASR 保留为主设计方案。

---

## 16. 后续增强方案

| 增强项 | 思路 | 预期收益 |
|--------|------|----------|
| WebSocket 实时流 | 替换 HTTP 为 WS，支持流式音频 | 更低延迟 |
| 端到端多模态 | 音频直接入模型，跳过独立 ASR | 减少一跳延迟 |
| Canvas 截图视觉感知 | 截图 + 空间网格混合输入 | AI 视觉理解画面 |
| 多 ASR 动态切换 | 运行时监控 + 自动 fallback | 生产级可用性 |

---

## 17. 项目结构

```
qiniu-voice-draw/
├── frontend/                    # React + TypeScript
│   ├── src/
│   │   ├── components/
│   │   │   ├── Canvas/          # Canvas 画布 + 渲染函数
│   │   │   ├── VoiceIndicator/  # 语音状态指示
│   │   │   ├── Subtitles/       # AI 回复字幕条
│   │   │   └── StatusBar/       # 底部状态栏
│   │   ├── engine/
│   │   │   ├── CommandExecutor.ts   # 指令执行器
│   │   │   ├── ObjectStore.ts       # 对象状态 + 空间网格索引
│   │   │   ├── FuzzyMatcher.ts      # 四级模糊对象匹配
│   │   │   └── HistoryManager.ts    # 撤销历史
│   │   ├── hooks/
│   │   │   ├── useVoiceInput.ts     # MediaRecorder + AnalyserNode VAD
│   │   │   ├── useApiClient.ts      # HTTP 请求 + 错误处理
│   │   │   └── useSpeechFeedback.ts # 浏览器 TTS（含空间描述构造）
│   │   ├── types/
│   │   │   └── commands.ts          # 绘图指令 TS 类型
│   │   └── App.tsx
│   ├── package.json
│   └── vite.config.ts
├── backend/                     # Python FastAPI
│   ├── main.py                  # 入口 + POST /api/command + /api/asr
│   ├── asr/
│   │   ├── base.py              # ASRProvider 抽象接口
│   │   ├── qiniu_asr.py         # 七牛云短语音听写实现
│   │   └── qwen_asr.py          # Qwen-ASR 后续扩展占位
│   ├── llm_client.py            # Qwen 文本模型调用 + Prompt + JSON mode
│   ├── json_repair.py           # LLM 输出修复管道
│   ├── rules_parser.py          # LLM 失败时的规则兜底
│   ├── command_parser.py        # 指令白名单+参数+边界校验
│   ├── config.py                # 从环境变量读取 API Key
│   └── requirements.txt
├── docs/
│   └── design-doc.md            # 本设计文档
└── README.md                    # 含 Demo 视频链接
```

---

## 18. 开发计划（3天）

| 时间 | 重点 | 交付物 |
|------|------|--------|
| **Day 1**（6/12） | **文本 → Canvas 绘图闭环** | React 项目初始化、Canvas 基础图形渲染、ObjectStore + 空间网格索引、HistoryManager、CommandExecutor、FastAPI `/api/command` 返回固定 JSON 打通前后端、Rules Parser 基础版（太阳/树/房子/撤销/清空）、VAD 录音链路 |
| **Day 2**（6/13） | **语音 + AI 核心** | 七牛云 ASR 接入 + Web Speech API 备用、Qwen 文本模型集成 + Prompt 调优 + JSON mode、LLM 输出修复管道、Command Parser 校验层、语义绘图闭环验证、模糊对象匹配 |
| **Day 3**（6/14） | **打磨 + 交付** | 对象编辑闭环（move/update/delete）、last_action 上下文修正、TTS 空间反馈、UI 状态优化、Demo 脚本演练 + 录制、README + 视频链接、设计文档补充"计划 vs 实际"和"未完成原因" |

> **风险预案**：若七牛云 ASR 权限或接口调试受阻，切换 Web Speech API 完成 Demo，七牛云 ASR 保留为主设计方案，原因在设计文档中如实说明。
>
> ⚠️ 每日持续 commit，每个模块完成后提交独立 PR。

---

## 附录 A：设计决策记录

| 决策 | 选项 | 选择 | 理由 |
|------|------|------|------|
| 语音架构 | 端到端 vs ASR+LLM | **ASR + LLM** | 链路可独立调试，任一环节失败有降级方案 |
| 主 ASR | Web Speech API vs 七牛云 | **七牛云 (主) + Web Speech API (备用)** | 贴合主办方能力 + 保底可用 |
| 句子边界 | Web Speech 事件 vs 能量检测 VAD | **能量检测 VAD** | 简单可控，静音 2s 截断 + 60s 上限 |
| LLM 选型 | Qwen-Omni vs Qwen 文本 | **Qwen 文本 + JSON mode** | JSON 输出更稳定，从源头减少格式错误 |
| LLM 容错 | 重试 vs 修复管道 | **修复管道优先** | 去 markdown + 截断修复 + 字段校验 → 再重试 |
| 画布状态 | 全量 JSON vs 摘要 vs 空间索引 | **空间网格 3×2** | Prompt 体积恒定 ~500 字符，与对象数无关 |
| 规则策略 | LLM 优先 vs 规则兜底 | **规则兜底** | LLM 正常工作时走 LLM，LLM 不可用时规则保底 |
| 对象匹配 | 精确 label vs 模糊匹配 | **四级模糊匹配** | label → 颜色 → 位置 → 最近对象 |
| 修正闭环 | 撤销重试 vs 上下文修正 | **TTS 反馈 + last_action 上下文** | 自然修正，不需要用户重复描述 |
| 通信方式 | WebSocket vs HTTP | **HTTP 句子级** | 降低复杂度，首版够用 |
| 前端框架 | React vs Vue | **React** | Canvas 生态更成熟 |
| TTS | 后端 vs 浏览器 | **浏览器 SpeechSynthesis** | 零成本，即时反馈 |

## 附录 B：备选方案记录

| 方案 | 评估结论 | 后续启用条件 |
|------|----------|-------------|
| 端到端多模态 | 音频直达模型，延迟更低 | 多模态 API 稳定后切换 |
| WebSocket 实时流 | 连续对话体验更好 | 需要流式交互时升级 |
| Canvas 截图视觉感知 | AI 真正"看见"画面 | 首版稳定后叠加 |
| 多 ASR 动态切换 | 运行时自动 fallback | 生产级可用性需求时实现 |
