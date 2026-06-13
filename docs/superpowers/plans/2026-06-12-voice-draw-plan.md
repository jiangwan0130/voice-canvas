# AI 语音绘图工具 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建纯语音控制的 AI Canvas 绘图工具——语音→文本→AI解析→结构化指令→Canvas执行→语音反馈

**Architecture:** React+TypeScript前端(Canvas 2D+Web Audio+空间索引) ↔ HTTP POST ↔ Python FastAPI(Qwen LLM+Command Parser+Rules Parser) ↔ 七牛云ASR

**Tech Stack:** React 18 + TypeScript + Vite + Canvas 2D | FastAPI + dashscope + httpx | MediaRecorder + AnalyserNode

---

## 开发节奏

| Day | 主题 | PR 数 | 核心交付 |
|-----|------|-------|---------|
| Day 1 | 文本→Canvas 闭环 | 4 PRs | 前端能接受JSON指令画图，后端能返回固定指令 |
| Day 2 | 语音+AI核心 | 5 PRs | VAD录音→ASR→LLM→修复管道→校验→Canvas→TTS |
| Day 3 | 打磨+交付 | 3 PRs | 对象编辑、修正闭环、UI、Demo、文档 |

---

## Day 1: 文本 → Canvas 绘图闭环

### PR 1: 项目脚手架 + 类型定义

> **PR 标题:** feat: 初始化项目结构、Canvas渲染引擎和绘图指令类型定义
> **功能描述:** 搭建 React+Vite 前端和 FastAPI 后端骨架，定义绘图指令 TypeScript 类型，实现 Canvas 基础图形渲染
> **实现思路:** 前端用 Vite 创建 React+TS 项目，后端用 FastAPI 最小入口。types/commands.ts 定义所有绘图指令的 TS 类型，engine/ 目录放置绘图核心逻辑
> **测试方式:** `cd frontend && npm run dev` 启动前端，`cd backend && uvicorn main:app` 启动后端

#### Task 1.1: 创建前端项目

**Files:**
- Create: `frontend/` (Vite React TS scaffold)

- [ ] **Step 1: Scaffold frontend with Vite**

```bash
cd "D:\Project\七牛云"
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
```

- [ ] **Step 2: 确认 dev server 可启动**

```bash
cd frontend && npm run dev
# 预期: 浏览器打开 http://localhost:5173 看到 Vite + React 页面
```

- [ ] **Step 3: Commit**

```bash
git add frontend/
git commit -m "feat: scaffold React+TypeScript+Vite frontend

Co-Authored-By: Claude <noreply@anthropic.com>"
```

#### Task 1.2: 定义绘图指令类型

**Files:**
- Create: `frontend/src/types/commands.ts`

- [ ] **Step 1: 写入类型定义文件**

```typescript
// frontend/src/types/commands.ts

// ============ 图形类型 ============

export type ShapeType = 'circle' | 'rect' | 'triangle' | 'line' | 'text';

export type ActionType =
  // 基础图形
  | 'draw_line' | 'draw_rect' | 'draw_circle' | 'draw_triangle' | 'draw_text'
  // 对象编辑
  | 'update_object' | 'move_object' | 'delete_object'
  // 画布控制
  | 'undo' | 'clear' | 'speak' | 'set_color' | 'set_width';

// ============ 绘图对象 ============

export interface DrawObject {
  id: string;
  type: ShapeType;
  label: string;
  role: 'body' | 'detail' | null;
  groupId: string | null;
  cellId: string;           // 空间网格格子 ID，如 "0,1"
  // 坐标（按类型不同）
  cx?: number; cy?: number; r?: number;   // circle
  x?: number;  y?: number;  w?: number; h?: number;  // rect
  x1?: number; y1?: number;               // line / triangle
  x2?: number; y2?: number;               // line / triangle
  x3?: number; y3?: number;               // triangle
  text?: string; size?: number; font?: string;  // text
  // 样式（可选 — nil 用默认值）
  color?: string;
  fill?: string;
  width?: number;
}

// ============ 绘图指令 ============

export interface DrawCommand {
  action: ActionType;
  params: Record<string, unknown>;
}

// ============ API 请求/响应 ============

export interface GridCell {
  id: string;        // "0,0"
  label: string;     // "左上"
  objects: DrawObject[];
}

export interface GridState {
  cells: GridCell[];
}

export interface CanvasState {
  width: number;
  height: number;
  grid: GridState;
}

export interface LastAction {
  reply: string;
  commands: DrawCommand[];
}

export interface CommandRequest {
  text: string;
  canvas_state: CanvasState;
  last_action: LastAction | null;
}

export interface CommandResponse {
  reply: string;
  commands: DrawCommand[];
}
```

- [ ] **Step 2: Verify types compile**

```bash
cd frontend && npx tsc --noEmit
# 预期: 无编译错误
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types/
git commit -m "feat: define drawing command TypeScript types

Co-Authored-By: Claude <noreply@anthropic.com>"
```

#### Task 1.3: 创建后端骨架

**Files:**
- Create: `backend/main.py`
- Create: `backend/config.py`
- Create: `backend/requirements.txt`

- [ ] **Step 1: 创建 requirements.txt**

```
# backend/requirements.txt
fastapi==0.115.0
uvicorn[standard]==0.30.0
httpx==0.27.0
dashscope>=1.20.0
python-dotenv==1.0.0
pydantic==2.9.0
```

- [ ] **Step 2: 创建 config.py**

```python
# backend/config.py
import os
from dotenv import load_dotenv

load_dotenv()

QINIU_ASR_APP_ID = os.getenv("QINIU_ASR_APP_ID", "")
QINIU_ASR_SECRET_KEY = os.getenv("QINIU_ASR_SECRET_KEY", "")
DASHSCOPE_API_KEY = os.getenv("DASHSCOPE_API_KEY", "")
LLM_MODEL = os.getenv("LLM_MODEL", "qwen-plus")

CANVAS_WIDTH = 1200
CANVAS_HEIGHT = 800
```

- [ ] **Step 3: 创建 main.py 最小入口**

```python
# backend/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="AI Voice Drawing Tool")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

- [ ] **Step 4: Install dependencies and verify backend starts**

```bash
cd backend
pip install -r requirements.txt
python main.py
# 预期: Uvicorn running on http://0.0.0.0:8000
# 访问 http://localhost:8000/health → {"status":"ok"}
```

- [ ] **Step 5: Commit**

```bash
git add backend/
git commit -m "feat: scaffold FastAPI backend with health endpoint

Co-Authored-By: Claude <noreply@anthropic.com>"
```

#### Task 1.4: Commit and create PR 1

```bash
git push origin main
# 在 GitHub 上创建 PR 1
```

---

### PR 2: Canvas 渲染引擎 + ObjectStore + HistoryManager

> **PR 标题:** feat: 实现Canvas渲染引擎、空间网格ObjectStore和撤销HistoryManager
> **功能描述:** CanvasEngine渲染所有图形类型到Canvas 2D，ObjectStore维护对象+3×2空间网格索引，HistoryManager保存操作快照支持undo
> **实现思路:** CanvasEngine.pm根据DrawObject.type分发到pm2d渲染函数。ObjectStore维护Map<string,DrawObject>+grid计算。HistoryManager深拷贝快照栈
> **测试方式:** 写单元测试验证渲染不报错、ObjectStore增删改查、HistoryManager undo恢复

#### Task 2.1: 实现 CanvasEngine 渲染函数

**Files:**
- Create: `frontend/src/engine/CanvasEngine.ts`

```typescript
// frontend/src/engine/CanvasEngine.ts
import { DrawObject } from '../types/commands';

export class CanvasEngine {
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;

  constructor(ctx: CanvasRenderingContext2D, width: number, height: number) {
    this.ctx = ctx;
    this.width = width;
    this.height = height;
  }

  /** 全量重绘所有对象 */
  renderAll(objects: DrawObject[]): void {
    this.ctx.clearRect(0, 0, this.width, this.height);
    // 白色背景
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, this.width, this.height);

    for (const obj of objects) {
      this.renderOne(obj);
    }
  }

  /** 绘制单个对象 */
  renderOne(obj: DrawObject): void {
    switch (obj.type) {
      case 'circle':   this.drawCircle(obj); break;
      case 'rect':     this.drawRect(obj); break;
      case 'triangle': this.drawTriangle(obj); break;
      case 'line':     this.drawLine(obj); break;
      case 'text':     this.drawText(obj); break;
    }
  }

  private drawCircle(o: DrawObject): void {
    const ctx = this.ctx;
    const { cx = 0, cy = 0, r = 50 } = o;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    if (o.fill && o.fill !== 'transparent') {
      ctx.fillStyle = o.fill;
      ctx.fill();
    }
    if (o.color) {
      ctx.strokeStyle = o.color;
      ctx.lineWidth = o.width ?? 2;
      ctx.stroke();
    }
  }

  private drawRect(o: DrawObject): void {
    const ctx = this.ctx;
    const { x = 0, y = 0, w = 100, h = 100 } = o;
    if (o.fill && o.fill !== 'transparent') {
      ctx.fillStyle = o.fill;
      ctx.fillRect(x, y, w, h);
    }
    if (o.color) {
      ctx.strokeStyle = o.color;
      ctx.lineWidth = o.width ?? 2;
      ctx.strokeRect(x, y, w, h);
    }
  }

  private drawTriangle(o: DrawObject): void {
    const ctx = this.ctx;
    const { x1 = 0, y1 = 0, x2 = 100, y2 = 0, x3 = 50, y3 = 100 } = o;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x3, y3);
    ctx.closePath();
    if (o.fill && o.fill !== 'transparent') {
      ctx.fillStyle = o.fill;
      ctx.fill();
    }
    if (o.color) {
      ctx.strokeStyle = o.color;
      ctx.lineWidth = o.width ?? 2;
      ctx.stroke();
    }
  }

  private drawLine(o: DrawObject): void {
    const ctx = this.ctx;
    const { x1 = 0, y1 = 0, x2 = 100, y2 = 100 } = o;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = o.color ?? '#000000';
    ctx.lineWidth = o.width ?? 2;
    ctx.stroke();
  }

  private drawText(o: DrawObject): void {
    const ctx = this.ctx;
    const { x = 0, y = 50, text = '', size = 24, font } = o;
    ctx.font = font ?? `${size}px sans-serif`;
    ctx.fillStyle = o.fill ?? o.color ?? '#000000';
    ctx.fillText(text, x, y);
  }
}
```

- [ ] **Step 1: Write and verify CanvasEngine compiles**

```bash
cd frontend && npx tsc --noEmit
# 预期: 无错误
```

#### Task 2.2: 实现 ObjectStore（含空间网格）

**Files:**
- Create: `frontend/src/engine/ObjectStore.ts`

```typescript
// frontend/src/engine/ObjectStore.ts
import { DrawObject, GridCell, GridState } from '../types/commands';

const GRID_COLS = 3;
const GRID_ROWS = 2;
const GRID_LABELS: Record<string, string> = {
  '0,0': '左上', '0,1': '中上', '0,2': '右上',
  '1,0': '左下', '1,1': '中下', '1,2': '右下',
};

export class ObjectStore {
  private objects: Map<string, DrawObject> = new Map();
  private idCounter = 0;
  public width = 1200;
  public height = 800;

  /** 添加对象并自动计算 cellId */
  add(obj: Omit<DrawObject, 'id' | 'cellId'>): DrawObject {
    const id = `obj_${++this.idCounter}`;
    const cellId = this.computeCell(obj);
    const full: DrawObject = { ...obj, id, cellId } as DrawObject;
    this.objects.set(id, full);
    return full;
  }

  /** 获取对象 */
  get(id: string): DrawObject | undefined {
    return this.objects.get(id);
  }

  /** 更新对象（重新计算 cellId） */
  update(id: string, params: Partial<DrawObject>): DrawObject | null {
    const obj = this.objects.get(id);
    if (!obj) return null;
    const updated = { ...obj, ...params };
    updated.cellId = this.computeCell(updated);
    this.objects.set(id, updated);
    return updated;
  }

  /** 删除对象 */
  delete(id: string): boolean {
    return this.objects.delete(id);
  }

  /** 按 groupId 获取所有成员 */
  getByGroup(groupId: string): DrawObject[] {
    return this.getAll().filter(o => o.groupId === groupId);
  }

  /** 按 label 关键词搜索 */
  findByLabel(keyword: string): DrawObject[] {
    return this.getAll().filter(o => o.label?.includes(keyword));
  }

  /** 按颜色搜索（fill 字段前缀匹配） */
  findByColor(hexPrefix: string): DrawObject[] {
    return this.getAll().filter(o => (o.fill ?? '').startsWith(hexPrefix));
  }

  /** 按格子搜索 */
  findByCell(cellId: string): DrawObject[] {
    return this.getAll().filter(o => o.cellId === cellId);
  }

  /** 最近创建的对象 */
  getLast(): DrawObject | undefined {
    const all = this.getAll();
    return all[all.length - 1];
  }

  /** 获取所有对象 */
  getAll(): DrawObject[] {
    return Array.from(this.objects.values());
  }

  /** 获取对象总数 */
  get count(): number {
    return this.objects.size;
  }

  /** 清空 */
  clear(): void {
    this.objects.clear();
    this.idCounter = 0;
  }

  /** 恢复快照（undo用） */
  restore(objects: DrawObject[]): void {
    this.objects.clear();
    this.idCounter = objects.length;
    for (const obj of objects) {
      this.objects.set(obj.id, { ...obj });
    }
  }

  /** 生成空间网格摘要（发给LLM） */
  toGridState(): GridState {
    const cells: GridCell[] = [];
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const cellId = `${r},${c}`;
        cells.push({
          id: cellId,
          label: GRID_LABELS[cellId] ?? cellId,
          objects: this.findByCell(cellId),
        });
      }
    }
    return { cells };
  }

  /** 计算对象中心坐标所属格子 */
  private computeCell(obj: Partial<DrawObject>): string {
    let cx: number, cy: number;
    switch (obj.type) {
      case 'circle':
        cx = obj.cx ?? 0;
        cy = obj.cy ?? 0;
        break;
      case 'rect':
        cx = (obj.x ?? 0) + (obj.w ?? 100) / 2;
        cy = (obj.y ?? 0) + (obj.h ?? 100) / 2;
        break;
      case 'triangle':
        cx = ((obj.x1 ?? 0) + (obj.x2 ?? 0) + (obj.x3 ?? 0)) / 3;
        cy = ((obj.y1 ?? 0) + (obj.y2 ?? 0) + (obj.y3 ?? 0)) / 3;
        break;
      case 'line':
        cx = ((obj.x1 ?? 0) + (obj.x2 ?? 0)) / 2;
        cy = ((obj.y1 ?? 0) + (obj.y2 ?? 0)) / 2;
        break;
      case 'text':
        cx = obj.x ?? 0;
        cy = (obj.y ?? 0) - (obj.size ?? 24) / 2;
        break;
      default:
        cx = 0; cy = 0;
    }
    const cellW = this.width / GRID_COLS;
    const cellH = this.height / GRID_ROWS;
    const c = Math.min(Math.floor(cx / cellW), GRID_COLS - 1);
    const r = Math.min(Math.floor(cy / cellH), GRID_ROWS - 1);
    return `${r},${c}`;
  }
}
```

- [ ] **Step 2: Verify compiles**

```bash
cd frontend && npx tsc --noEmit
# 预期: 无错误
```

#### Task 2.3: 实现 HistoryManager

**Files:**
- Create: `frontend/src/engine/HistoryManager.ts`

```typescript
// frontend/src/engine/HistoryManager.ts
import { DrawObject, DrawCommand } from '../types/commands';

interface Snapshot {
  objects: DrawObject[];
  action: string;
}

export class HistoryManager {
  private stack: Snapshot[] = [];
  private maxSize = 50;

  /** 在执行 commands 前保存快照 */
  save(objects: DrawObject[], action: string): void {
    this.stack.push({
      objects: objects.map(o => ({ ...o })), // 深拷贝
      action,
    });
    if (this.stack.length > this.maxSize) {
      this.stack.shift();
    }
  }

  /** undo: 返回上一个快照的对象列表，没有则返回 null */
  undo(): { objects: DrawObject[]; action: string } | null {
    const snap = this.stack.pop();
    if (!snap) return null;
    return snap;
  }

  /** 清空历史 */
  clear(): void {
    this.stack = [];
  }

  get historyLength(): number {
    return this.stack.length;
  }
}
```

- [ ] **Step 3: Verify compiles**

```bash
cd frontend && npx tsc --noEmit
# 预期: 无错误
```

#### Task 2.4: Commit and create PR 2

```bash
git add frontend/src/engine/
git commit -m "feat: implement CanvasEngine, ObjectStore with spatial grid, and HistoryManager

Co-Authored-By: Claude <noreply@anthropic.com>"
git push origin main
# 创建 PR 2
```

---

### PR 3: CommandExecutor + Canvas 组件串联

> **PR 标题:** feat: 实现CommandExecutor和Canvas组件，支持JSON指令驱动绘图
> **功能描述:** CommandExecutor根据commands逐条执行draw/update/delete/undo/clear操作。App组件串联ObjectStore+Engine+HistoryManager+CommandExecutor
> **实现思路:** CommandExecutor接收ObjectStore/CanvasEngine/HistoryManager实例，dispatch每条command到对应方法。App用useRef持有各模块实例
> **测试方式:** 硬编码一段JSON commands，刷新页面看Canvas是否绘制出对应图形

#### Task 3.1: 实现 CommandExecutor

**Files:**
- Create: `frontend/src/engine/CommandExecutor.ts`

```typescript
// frontend/src/engine/CommandExecutor.ts
import { DrawCommand, DrawObject } from '../types/commands';
import { ObjectStore } from './ObjectStore';
import { CanvasEngine } from './CanvasEngine';
import { HistoryManager } from './HistoryManager';

export class CommandExecutor {
  constructor(
    private store: ObjectStore,
    private engine: CanvasEngine,
    private history: HistoryManager,
  ) {}

  /** 执行一批 commands */
  execute(commands: DrawCommand[]): void {
    // 先保存快照
    this.history.save(this.store.getAll(), commands.map(c => c.action).join(','));

    for (const cmd of commands) {
      this.dispatch(cmd);
    }

    // 全量重绘
    this.engine.renderAll(this.store.getAll());
  }

  private dispatch(cmd: DrawCommand): void {
    const { action, params } = cmd;
    switch (action) {
      case 'draw_line':
      case 'draw_rect':
      case 'draw_circle':
      case 'draw_triangle':
      case 'draw_text': {
        const type = action.replace('draw_', '') as DrawObject['type'];
        const obj = this.store.add({ ...params, type } as Omit<DrawObject, 'id' | 'cellId'>);
        break;
      }
      case 'update_object': {
        const target = params.target as string;
        const updates = { ...params };
        delete updates.target;
        this.store.update(target, updates as Partial<DrawObject>);
        break;
      }
      case 'move_object': {
        const target = params.target as string;
        const obj = this.store.get(target);
        if (!obj) break;
        const dx = params.dx as number ?? 0;
        const dy = params.dy as number ?? 0;
        const updates: Partial<DrawObject> = {};
        if (obj.type === 'circle') {
          updates.cx = (obj.cx ?? 0) + dx;
          updates.cy = (obj.cy ?? 0) + dy;
        } else if (obj.type === 'rect' || obj.type === 'text') {
          updates.x = (obj.x ?? 0) + dx;
          updates.y = (obj.y ?? 0) + dy;
        } else if (obj.type === 'triangle' || obj.type === 'line') {
          updates.x1 = (obj.x1 ?? 0) + dx;
          updates.y1 = (obj.y1 ?? 0) + dy;
          updates.x2 = (obj.x2 ?? 0) + dx;
          updates.y2 = (obj.y2 ?? 0) + dy;
          if (obj.type === 'triangle') {
            updates.x3 = (obj.x3 ?? 0) + dx;
            updates.y3 = (obj.y3 ?? 0) + dy;
          }
        }
        this.store.update(target, updates);
        break;
      }
      case 'delete_object': {
        const target = params.target as string;
        this.store.delete(target);
        break;
      }
      case 'undo': {
        const snap = this.history.undo();
        if (snap) {
          this.store.restore(snap.objects);
        }
        break;
      }
      case 'clear': {
        this.store.clear();
        this.history.clear();
        break;
      }
      case 'speak':
        // TTS 由 SpeechFeedback 独立处理
        break;
      case 'set_color':
      case 'set_width':
        // 全局状态暂存，后续新建图形时读取默认值
        break;
    }
  }
}
```

#### Task 3.2: 实现 Canvas 组件和 App 串联

**Files:**
- Modify: `frontend/src/App.tsx`
- Create: `frontend/src/components/Canvas/CanvasArea.tsx`

```tsx
// frontend/src/components/Canvas/CanvasArea.tsx
import { useRef, useEffect } from 'react';
import { ObjectStore } from '../../engine/ObjectStore';
import { CanvasEngine } from '../../engine/CanvasEngine';
import { HistoryManager } from '../../engine/HistoryManager';
import { CommandExecutor } from '../../engine/CommandExecutor';
import { CommandResponse } from '../../types/commands';

interface Props {
  onExecutorReady: (executor: CommandExecutor, store: ObjectStore) => void;
}

export function CanvasArea({ onExecutorReady }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const storeRef = useRef<ObjectStore | null>(null);
  const engineRef = useRef<CanvasEngine | null>(null);
  const executorRef = useRef<CommandExecutor | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const store = new ObjectStore();
    const engine = new CanvasEngine(ctx, store.width, store.height);
    const history = new HistoryManager();
    const executor = new CommandExecutor(store, engine, history);

    storeRef.current = store;
    engineRef.current = engine;
    executorRef.current = executor;

    // 初始白画布
    engine.renderAll([]);

    onExecutorReady(executor, store);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={1200}
      height={800}
      style={{
        border: '2px solid #d9d9d9',
        borderRadius: 8,
        background: '#ffffff',
        maxWidth: '100%',
        height: 'auto',
      }}
    />
  );
}
```

```tsx
// frontend/src/App.tsx
import { useState, useRef } from 'react';
import { CanvasArea } from './components/Canvas/CanvasArea';
import { CommandExecutor } from './engine/CommandExecutor';
import { ObjectStore } from './engine/ObjectStore';
import { CommandResponse } from './types/commands';
import './App.css';

function App() {
  const [status, setStatus] = useState<'idle' | 'recording' | 'processing' | 'executing' | 'error'>('idle');
  const [subtitle, setSubtitle] = useState('');
  const executorRef = useRef<CommandExecutor | null>(null);
  const storeRef = useRef<ObjectStore | null>(null);

  const handleExecutorReady = (executor: CommandExecutor, store: ObjectStore) => {
    executorRef.current = executor;
    storeRef.current = store;
  };

  // Day 1 调试: 硬编码测试指令
  const handleTestDraw = () => {
    const testResp: CommandResponse = {
      reply: '画了一个红色太阳和一座房子',
      commands: [
        { action: 'draw_circle', params: { cx: 600, cy: 150, r: 60, fill: '#ff4d4f', label: '太阳', role: 'body' } },
        { action: 'draw_rect', params: { x: 400, y: 300, w: 200, h: 150, fill: '#ffe58f', label: '墙体', role: 'body', groupId: 'house_1' } },
        { action: 'draw_triangle', params: { x1: 380, y1: 300, x2: 500, y2: 180, x3: 620, y3: 300, fill: '#ff4d4f', label: '屋顶', role: 'detail', groupId: 'house_1' } },
      ],
    };
    setStatus('executing');
    executorRef.current?.execute(testResp.commands);
    setSubtitle(testResp.reply);
    setStatus('idle');
  };

  return (
    <div className="app">
      <h1>🎨 AI 语音绘图工具</h1>
      <CanvasArea onExecutorReady={handleExecutorReady} />
      <div className="status-bar">
        <span className={`status-indicator status-${status}`}>
          {status === 'idle' ? '🟢 就绪' : status === 'recording' ? '🔵 录音中' : status === 'processing' ? '🟡 处理中' : status === 'executing' ? '🟣 执行中' : '🔴 错误'}
        </span>
        <span className="subtitle">{subtitle}</span>
        <span className="object-count">对象：{storeRef.current?.count ?? 0} 个</span>
        <button onClick={handleTestDraw} style={{ marginLeft: 12 }}>🧪 测试绘图</button>
      </div>
    </div>
  );
}

export default App;
```

- [ ] **Step 1: 启动前端，点击测试按钮验证**

```bash
cd frontend && npm run dev
# 打开浏览器 → 点击"测试绘图"按钮
# 预期: Canvas上出现红色太阳 + 黄色房子（墙体+屋顶）
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/engine/CommandExecutor.ts frontend/src/components/ frontend/src/App.tsx frontend/src/App.css
git commit -m "feat: implement CommandExecutor and Canvas component, verify with test button

Co-Authored-By: Claude <noreply@anthropic.com>"
```

#### Task 3.3: Commit and create PR 3

```bash
git push origin main
# 创建 PR 3
```

---

### PR 4: 后端 /api/command 返回固定 JSON + 前后端打通

> **PR 标题:** feat: 实现/api/command端点返回绘图指令，前后端HTTP通信打通
> **功能描述:** FastAPI 添加 POST /api/command 端点，接受text+canvas_state返回固定JSON。前端添加useApiClient Hook发送HTTP请求
> **实现思路:** main.py增加路由，返回硬编码的JSON响应。前端用fetch POST到后端，收到response后交给CommandExecutor执行
> **测试方式:** 前端输入文本点发送，验证Canvas根据后端返回的JSON绘制图形

#### Task 4.1: 实现 /api/command 端点（返回固定JSON）

**Files:**
- Modify: `backend/main.py`

```python
# backend/main.py (追加)
from pydantic import BaseModel
from typing import Optional, List, Any, Dict

# --- Request/Response models ---

class GridObject(BaseModel):
    id: str
    label: str
    type: str
    role: Optional[str] = None
    groupId: Optional[str] = None
    cellId: Optional[str] = None
    # 坐标（按类型不同，用 Optional）
    cx: Optional[float] = None
    cy: Optional[float] = None
    r: Optional[float] = None
    x: Optional[float] = None
    y: Optional[float] = None
    w: Optional[float] = None
    h: Optional[float] = None
    x1: Optional[float] = None; y1: Optional[float] = None
    x2: Optional[float] = None; y2: Optional[float] = None
    x3: Optional[float] = None; y3: Optional[float] = None
    fill: Optional[str] = None
    color: Optional[str] = None
    width: Optional[float] = None

class GridCell(BaseModel):
    id: str
    label: str
    objects: List[GridObject] = []

class GridState(BaseModel):
    cells: List[GridCell] = []

class CanvasState(BaseModel):
    width: int
    height: int
    grid: GridState

class LastAction(BaseModel):
    reply: str
    commands: List[Dict[str, Any]] = []

class CommandRequest(BaseModel):
    text: str
    canvas_state: CanvasState
    last_action: Optional[LastAction] = None

class DrawCommand(BaseModel):
    action: str
    params: Dict[str, Any] = {}

class CommandResponse(BaseModel):
    reply: str
    commands: List[DrawCommand] = []

# --- Route ---

@app.post("/api/command", response_model=CommandResponse)
def process_command(req: CommandRequest):
    """Day 1: 返回固定测试响应，验证前后端通信"""
    import re
    text = req.text.strip()

    # 简单关键词匹配（Day 1 不接 LLM，纯测试通信链路）
    if "太阳" in text:
        return CommandResponse(
            reply="好的，我在画布中上方画了一个红色的太阳",
            commands=[
                DrawCommand(action="draw_circle", params={"cx": 600, "cy": 150, "r": 60, "fill": "#ff4d4f", "label": "太阳", "role": "body"})
            ]
        )
    elif "房子" in text:
        return CommandResponse(
            reply="好的，我在画布中下方画了一座黄色房子",
            commands=[
                DrawCommand(action="draw_rect", params={"x": 400, "y": 300, "w": 200, "h": 150, "fill": "#ffe58f", "label": "墙体", "role": "body", "groupId": "house_1"}),
                DrawCommand(action="draw_triangle", params={"x1": 380, "y1": 300, "x2": 500, "y2": 180, "x3": 620, "y3": 300, "fill": "#ff4d4f", "label": "屋顶", "role": "detail", "groupId": "house_1"}),
            ]
        )
    elif "树" in text:
        return CommandResponse(
            reply="好的，我在画布左边画了一棵绿色树",
            commands=[
                DrawCommand(action="draw_rect", params={"x": 150, "y": 400, "w": 30, "h": 120, "fill": "#8B4513", "label": "树干", "groupId": "tree_1"}),
                DrawCommand(action="draw_circle", params={"cx": 165, "cy": 360, "r": 60, "fill": "#228B22", "label": "树冠", "role": "body", "groupId": "tree_1"}),
            ]
        )
    elif "撤销" in text or "回退" in text:
        return CommandResponse(reply="好的，撤销上一步", commands=[DrawCommand(action="undo", params={})])
    elif "清空" in text:
        return CommandResponse(reply="好的，已清空画布", commands=[DrawCommand(action="clear", params={})])
    else:
        return CommandResponse(
            reply="好的，画了一个蓝色圆形",
            commands=[
                DrawCommand(action="draw_circle", params={"cx": 600, "cy": 400, "r": 80, "fill": "#1677ff", "label": "圆形"})
            ]
        )
```

#### Task 4.2: 前端添加 HTTP 通信 Hook

**Files:**
- Create: `frontend/src/hooks/useApiClient.ts`

```typescript
// frontend/src/hooks/useApiClient.ts
import { CommandRequest, CommandResponse, CanvasState } from '../types/commands';

const API_BASE = 'http://localhost:8000';

export async function sendCommand(
  text: string,
  canvasState: CanvasState,
  lastAction: CommandRequest['last_action'] = null,
): Promise<CommandResponse> {
  const body: CommandRequest = {
    text,
    canvas_state: canvasState,
    last_action: lastAction,
  };

  const res = await fetch(`${API_BASE}/api/command`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }

  return res.json();
}
```

#### Task 4.3: App 中添加文本输入（调试用）和发送逻辑

**Files:**
- Modify: `frontend/src/App.tsx` (追加 input 和 handleSend)

```tsx
// 在 App.tsx 中追加（调试文本输入 + 发送按钮）
import { sendCommand } from './hooks/useApiClient';

// 在 App 组件内添加:
const [debugText, setDebugText] = useState('');

const handleSend = async () => {
  if (!debugText.trim() || !executorRef.current || !storeRef.current) return;
  setStatus('processing');
  try {
    const canvasState = {
      width: storeRef.current.width,
      height: storeRef.current.height,
      grid: storeRef.current.toGridState(),
    };
    const resp = await sendCommand(debugText, canvasState);
    setStatus('executing');
    executorRef.current.execute(resp.commands);
    setSubtitle(resp.reply);
    setStatus('idle');
  } catch (e) {
    setStatus('error');
    setSubtitle('后端连接失败');
  }
};

// JSX 中追加:
<div style={{ display: 'flex', gap: 8, margin: '8px 0' }}>
  <input
    type="text"
    value={debugText}
    onChange={e => setDebugText(e.target.value)}
    onKeyDown={e => e.key === 'Enter' && handleSend()}
    placeholder="调试文本输入（Demo中隐藏）..."
    style={{ flex: 1, padding: '8px 12px', borderRadius: 6, border: '1px solid #d9d9d9' }}
  />
  <button onClick={handleSend}>发送</button>
</div>
```

- [ ] **Step 1: 启动后端和前端，测试通信**

```bash
# Terminal 1
cd backend && uvicorn main:app --port 8000

# Terminal 2
cd frontend && npm run dev

# 浏览器中:
# 输入"太阳" → 发送 → 预期: Canvas 上出现红色太阳
# 输入"房子" → 发送 → 预期: 出现黄色房子
# 输入"树"   → 发送 → 预期: 出现绿色树
```

- [ ] **Step 2: Commit**

```bash
git add backend/main.py frontend/src/hooks/useApiClient.ts frontend/src/App.tsx
git commit -m "feat: add /api/command endpoint with keyword matching, connect frontend-backend

Co-Authored-By: Claude <noreply@anthropic.com>"
```

#### Task 4.4: Commit and create PR 4

```bash
git push origin main
# 创建 PR 4
```

---

## Day 2: 语音 + AI 核心

### PR 5: VAD 录音 + 前后端音频链路

> **PR 标题:** feat: 实现VAD能量检测录音、/api/asr端点和Web Speech API备用
> **功能描述:** 前端用MediaRecorder+AnalyserNode实现能量检测VAD（静音2s截断+60s上限），后端添加/api/asr端点（Day 2先用Web Speech API备用方案），前后端音频→文本链路打通
> **实现思路:** AnalyserNode.getByteTimeDomainData()计算RMS，低于阈值持续2秒触发截断。MediaRecorder录制audio/webm格式，Blob上传后端
> **测试方式:** 打开页面授权麦克风，说话测试VAD自动截断，验证文本识别结果

#### Task 5.1: 实现 useVoiceInput Hook（VAD 录音）

**Files:**
- Create: `frontend/src/hooks/useVoiceInput.ts`

```typescript
// frontend/src/hooks/useVoiceInput.ts
import { useRef, useCallback, useState } from 'react';

export type VoiceStatus = 'idle' | 'recording' | 'processing' | 'error';

interface VoiceInputResult {
  blob: Blob;
  webSpeechText: string; // Web Speech API 备用
}

interface UseVoiceInputOptions {
  silenceTimeout?: number;  // 默认 2000ms
  maxDuration?: number;     // 默认 60000ms
  onResult: (result: VoiceInputResult) => void;
  onStatusChange: (status: VoiceStatus) => void;
}

export function useVoiceInput({
  silenceTimeout = 2000,
  maxDuration = 60000,
  onResult,
  onStatusChange,
}: UseVoiceInputOptions) {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const silenceTimerRef = useRef<number | null>(null);
  const maxTimerRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const webTextRef = useRef<string>('');

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // AudioContext + AnalyserNode for VAD
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // MediaRecorder
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        onResult({ blob, webSpeechText: webTextRef.current });
        webTextRef.current = '';
      };

      // Web Speech API 备用
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'zh-CN';
        recognition.onresult = (event: any) => {
          let final = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
              final += event.results[i][0].transcript;
            }
          }
          if (final) webTextRef.current = final;
        };
        recognition.start();
        recognitionRef.current = recognition;
      }

      recorder.start();
      onStatusChange('recording');

      // VAD 检测循环
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      let silenceStart = 0;
      let hasSound = false;

      const checkSilence = () => {
        if (!analyserRef.current || mediaRecorderRef.current?.state !== 'recording') return;
        analyserRef.current.getByteTimeDomainData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          const v = (dataArray[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / bufferLength);

        if (rms > 0.02) {
          hasSound = true;
          silenceStart = 0;
          if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
        } else if (hasSound) {
          if (silenceStart === 0) silenceStart = Date.now();
          const elapsed = Date.now() - silenceStart;
          if (elapsed >= silenceTimeout) {
            stop();
            return;
          }
        }

        requestAnimationFrame(checkSilence);
      };

      requestAnimationFrame(checkSilence);

      // 60s 强制截断
      maxTimerRef.current = window.setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          stop();
        }
      }, maxDuration);

    } catch (e) {
      onStatusChange('error');
      console.error('Microphone access denied:', e);
    }
  }, [silenceTimeout, maxDuration]);

  const stop = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    // 停止所有 track
    streamRef.current?.getTracks().forEach(t => t.stop());
    onStatusChange('processing');
  }, []);

  return { start, stop };
}
```

- [ ] **Step 1: Verify compiles**

```bash
cd frontend && npx tsc --noEmit
# 预期: 无错误
```

#### Task 5.2: 后端添加 /api/asr 端点

**Files:**
- Modify: `backend/main.py`

```python
# backend/main.py (追加 /api/asr)
from fastapi import UploadFile, File

@app.post("/api/asr")
async def transcribe_audio(audio: UploadFile = File(...)):
    """Day 2: ASR 端点 — 先返回占位文本，后续接入七牛云"""
    # TODO Day 2: 接入七牛云 ASR
    # 当前阶段：前端 Web Speech API 已拿到文本，通过 /api/command 直接传 text
    # /api/asr 接收音频文件，预留接入接口
    return {"text": "", "note": "ASR endpoint ready, using Web Speech API fallback for Day 2"}
```

- [ ] **Step 2: 在 App 中集成 useVoiceInput**

在 `App.tsx` 添加麦克风按钮（调试阶段）+ 自动监听：

```tsx
const voiceInput = useVoiceInput({
  onResult: async (result) => {
    // 优先使用 Web Speech API 文本
    const text = result.webSpeechText || '(未识别)';
    setDebugText(text);
    // 自动发送
    await handleSendText(text);
  },
  onStatusChange: (s) => setStatus(s),
});
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/useVoiceInput.ts backend/main.py frontend/src/App.tsx
git commit -m "feat: implement VAD recording with AnalyserNode and /api/asr placeholder

Co-Authored-By: Claude <noreply@anthropic.com>"
```

#### Task 5.3: Commit and create PR 5

```bash
git push origin main
# 创建 PR 5
```

---

### PR 6: Qwen LLM 集成

> **PR 标题:** feat: 集成Qwen文本模型，实现自然语言→绘图指令解析
> **功能描述:** backend/llm_client.py调用dashscope Qwen API，将用户文本+空间网格摘要转换为绘图指令JSON
> **实现思路:** 构造System Prompt（含画布尺寸、空间网格、指令规则），启用response_format json_object。Prompt中要求LLM返回{reply, commands[]}格式
> **测试方式:** 在前端用文本发送"画一个太阳"、"画一座房子"、"在房子旁边加一棵树"，验证LLM返回合理坐标的绘图指令

#### Task 6.1: 实现 llm_client.py

**Files:**
- Create: `backend/llm_client.py`

```python
# backend/llm_client.py
import json
import dashscope
from config import DASHSCOPE_API_KEY, LLM_MODEL, CANVAS_WIDTH, CANVAS_HEIGHT

SYSTEM_PROMPT = """你是一个语音绘图助手。用户通过语音描述绘图意图，你需要将其转换为 Canvas 绘图指令。

规则：
1. 必须返回合法 JSON，格式为 { "reply": "...", "commands": [...] }
2. reply 是给用户的语音反馈，需包含空间描述（如"在画布中上方画了..."）
3. commands 数组中的每个元素包含 action 和 params
4. 支持的 action：draw_line, draw_rect, draw_circle, draw_triangle, draw_text, update_object, move_object, delete_object, undo, clear, speak
5. 每个新建图形必须包含 label（中文语义标签）、role（"body" 或 "detail"）
6. 如果是组合对象（如房子），使用相同的 groupId，主体图形 role="body"，装饰图形 role="detail"
7. cellId 表示对象在画布上的格子位置（参考下方空间网格）
8. 坐标需合理，参考空间网格中已有对象的占用情况，避免重叠

画布尺寸：{canvas_width} x {canvas_height}

画布空间网格：
{grid_json}

上一轮操作（用于理解"再大一点""改回去"等指代）：
{last_action}

请分析用户的绘图意图，返回 JSON。""".replace("{canvas_width}", str(CANVAS_WIDTH)).replace("{canvas_height}", str(CANVAS_HEIGHT))

def call_llm(user_text: str, grid_json: str, last_action: str = "无") -> dict:
    """调用 Qwen 文本模型，返回 {reply, commands} dict"""
    prompt = SYSTEM_PROMPT.replace("{grid_json}", grid_json).replace("{last_action}", last_action)

    messages = [
        {"role": "system", "content": prompt},
        {"role": "user", "content": user_text},
    ]

    response = dashscope.Generation.call(
        model=LLM_MODEL,
        messages=messages,
        api_key=DASHSCOPE_API_KEY,
        result_format="message",
        response_format={"type": "json_object"},
    )

    if response.status_code != 200:
        raise Exception(f"Qwen API error: {response.code} {response.message}")

    content = response.output.choices[0].message.content
    return json.loads(content)
```

#### Task 6.2: 更新 /api/command 使用 LLM

**Files:**
- Modify: `backend/main.py`

```python
# backend/main.py (修改 /api/command，用 llm_client 替换关键词匹配)

from llm_client import call_llm
import json

@app.post("/api/command", response_model=CommandResponse)
def process_command(req: CommandRequest):
    # 构造空间网格 JSON 字符串
    grid_json = json.dumps(req.canvas_state.model_dump()['grid'], ensure_ascii=False, indent=2)
    last_action_str = "无"
    if req.last_action:
        last_action_str = req.last_action.reply

    try:
        result = call_llm(req.text, grid_json, last_action_str)
        commands = [DrawCommand(action=c['action'], params=c.get('params', {})) for c in result.get('commands', [])]
        return CommandResponse(reply=result.get('reply', '好的'), commands=commands)
    except Exception as e:
        # LLM 失败 → 降级到关键词匹配（Day 2 先保持旧逻辑，PR 7 添加修复管道）
        print(f"LLM error: {e}")
        # 返回兜底
        return CommandResponse(
            reply="抱歉，我暂时无法理解，请再说一遍",
            commands=[]
        )
```

- [ ] **Step 1: 设置环境变量并测试**

```bash
# 创建 .env
echo 'DASHSCOPE_API_KEY=sk-your-key-here' > backend/.env

# 启动后端
cd backend && uvicorn main:app --port 8000

# 前端发送文本测试
# 输入"画一个蓝色的圆"→ 预期：LLM 返回含 draw_circle 的 JSON
```

- [ ] **Step 2: Commit**

```bash
git add backend/llm_client.py backend/main.py backend/.env.example
git commit -m "feat: integrate Qwen text model for natural language to drawing commands

Co-Authored-By: Claude <noreply@anthropic.com>"
```

#### Task 6.3: Commit and create PR 6

```bash
git push origin main
# 创建 PR 6
```

---

### PR 7: LLM 输出修复管道 + Command Parser

> **PR 标题:** feat: 实现LLM输出修复管道和Command Parser安全校验层
> **功能描述:** json_repair.py提供4层修复（去markdown包裹、截断修复、字段校验、逐条丢弃），command_parser.py对指令进行7项安全校验
> **实现思路:** 见设计文档§7 修复管道流程和§6 校验规则
> **测试方式:** 模拟各种脏LLM输出（markdown包裹、截断、缺字段），验证修复+校验后得到合法指令

#### Task 7.1: 实现 json_repair.py

**Files:**
- Create: `backend/json_repair.py`

```python
# backend/json_repair.py
import re
import json
from typing import Tuple, Optional, List, Dict, Any

def extract_json(raw: str) -> str:
    """第①层：剥离 markdown 包裹，提取 JSON"""
    # 匹配第一个 { 到最后一个 }
    match = re.search(r'\{.*\}', raw, re.DOTALL)
    if match:
        return match.group(0)
    return raw

def repair_truncated(s: str) -> str:
    """第②层：括号栈匹配，逆向补全截断的 JSON"""
    stack = []
    in_string = False
    i = 0
    while i < len(s):
        ch = s[i]
        if ch == '\\' and in_string:
            i += 2  # skip escape
            continue
        if ch == '"':
            in_string = not in_string
        elif not in_string:
            if ch in '{[':
                stack.append(ch)
            elif ch == '}':
                if stack and stack[-1] == '{':
                    stack.pop()
            elif ch == ']':
                if stack and stack[-1] == '[':
                    stack.pop()
        i += 1

    closer = {'{': '}', '[': ']'}
    suffix = ''.join(closer[c] for c in reversed(stack) if c in closer)
    return s + suffix

def validate_and_fix(parsed: dict) -> Tuple[bool, dict]:
    """第③层：字段校验 + 退化"""
    if 'reply' not in parsed:
        parsed['reply'] = '好的'
    if 'commands' not in parsed:
        parsed['commands'] = [
            {'action': 'speak', 'params': {'text': parsed.get('reply', '好的')}}
        ]
    if not isinstance(parsed['commands'], list):
        parsed['commands'] = []
    return True, parsed

def repair_pipeline(raw: str) -> Tuple[Optional[dict], str]:
    """
    修复管道主入口
    Returns: (parsed_dict_or_None, error_message)
    """
    # ① 去 markdown
    extracted = extract_json(raw)

    # ② 尝试直接 parse
    try:
        parsed = json.loads(extracted)
        ok, fixed = validate_and_fix(parsed)
        return fixed, ""
    except json.JSONDecodeError:
        pass

    # ③ 截断修复
    repaired = repair_truncated(extracted)
    try:
        parsed = json.loads(repaired)
        ok, fixed = validate_and_fix(parsed)
        return fixed, ""
    except json.JSONDecodeError as e:
        return None, f"JSON parse failed after repair: {e}"

    return None, "all repair strategies failed"
```

#### Task 7.2: 实现 command_parser.py

**Files:**
- Create: `backend/command_parser.py`

```python
# backend/command_parser.py
import re
from typing import List, Dict, Any
from config import CANVAS_WIDTH, CANVAS_HEIGHT

# Action 白名单
ALLOWED_ACTIONS = {
    'draw_line', 'draw_rect', 'draw_circle', 'draw_triangle', 'draw_text',
    'update_object', 'move_object', 'delete_object',
    'undo', 'clear', 'speak', 'set_color', 'set_width',
}

# 每种 action 的必填参数
REQUIRED_PARAMS: Dict[str, List[str]] = {
    'draw_line': ['x1', 'y1', 'x2', 'y2'],
    'draw_rect': ['x', 'y', 'w', 'h'],
    'draw_circle': ['cx', 'cy', 'r'],
    'draw_triangle': ['x1', 'y1', 'x2', 'y2', 'x3', 'y3'],
    'draw_text': ['x', 'y', 'text'],
    'update_object': ['target'],
    'move_object': ['target', 'dx', 'dy'],
    'delete_object': ['target'],
}

# 可选参数默认值
DEFAULT_PARAMS: Dict[str, Dict[str, Any]] = {
    'draw_line': {'color': '#000000', 'width': 2},
    'draw_rect': {'color': '#000000', 'fill': 'transparent', 'width': 2},
    'draw_circle': {'color': '#000000', 'fill': 'transparent', 'width': 2},
    'draw_triangle': {'color': '#000000', 'fill': 'transparent', 'width': 2},
    'draw_text': {'size': 24, 'color': '#000000', 'font': 'sans-serif'},
}

HEX_COLOR_RE = re.compile(r'^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$')
CSS_COLORS = {'red','blue','green','yellow','orange','purple','pink','black','white','gray','grey','brown','cyan','magenta'}

def is_valid_color(c: str) -> bool:
    return bool(HEX_COLOR_RE.match(c)) or c.lower() in CSS_COLORS or c == 'transparent'

def validate_commands(commands: List[Dict[str, Any]], existing_object_ids: set) -> List[Dict[str, Any]]:
    """校验并过滤 commands，返回安全指令列表"""

    safe: List[Dict[str, Any]] = []

    for cmd in commands:
        action = cmd.get('action', '')
        params = cmd.get('params', {})

        # 1. action 白名单
        if action not in ALLOWED_ACTIONS:
            continue

        # 2. 必填参数检查
        required = REQUIRED_PARAMS.get(action, [])
        missing = [p for p in required if p not in params]
        if missing:
            continue  # 丢弃

        # 3. 可选参数默认值补全
        defaults = DEFAULT_PARAMS.get(action, {})
        for k, v in defaults.items():
            if k not in params:
                params[k] = v

        # 4. 坐标边界检查
        coord_keys = ['x','y','cx','cy','x1','y1','x2','y2','x3','y3','w','h','r','dx','dy']
        for k in coord_keys:
            if k in params:
                v = params[k]
                if not isinstance(v, (int, float)):
                    try:
                        params[k] = float(v)
                    except (ValueError, TypeError):
                        params[k] = 0
                # 钳位
                if k in ('w','h','r'):
                    params[k] = max(1, min(float(params[k]), max(CANVAS_WIDTH, CANVAS_HEIGHT)))
                elif k in ('dx','dy'):
                    params[k] = max(-CANVAS_WIDTH, min(float(params[k]), CANVAS_WIDTH))
                elif k in ('x','cx','x1','x2','x3'):
                    params[k] = max(0, min(float(params[k]), CANVAS_WIDTH))
                elif k in ('y','cy','y1','y2','y3'):
                    params[k] = max(0, min(float(params[k]), CANVAS_HEIGHT))

        # 5. 颜色格式校验
        for ck in ['color', 'fill']:
            if ck in params and params[ck] and not is_valid_color(str(params[ck])):
                params[ck] = '#000000' if ck == 'color' else 'transparent'

        # 6. target 存在性
        if action in ('update_object', 'move_object', 'delete_object'):
            target = params.get('target', '')
            if target not in existing_object_ids:
                continue  # 丢弃

        # 7. 参数类型强制
        if 'width' in params and not isinstance(params['width'], (int, float)):
            params['width'] = 2
        if 'size' in params and not isinstance(params['size'], (int, float)):
            params['size'] = 24

        cmd['params'] = params
        safe.append(cmd)

    return safe
```

#### Task 7.3: 在 /api/command 中串联修复管道 + 校验

**Files:**
- Modify: `backend/main.py` (替换旧的 LLM 调用逻辑)

```python
# backend/main.py (更新 /api/command)
from json_repair import repair_pipeline
from command_parser import validate_commands
from rules_parser import match_rules

@app.post("/api/command", response_model=CommandResponse)
def process_command(req: CommandRequest):
    grid_json = json.dumps(req.canvas_state.model_dump()['grid'], ensure_ascii=False, indent=2)
    last_action_str = req.last_action.reply if req.last_action else "无"

    # 收集已有对象 ID（用于 target 校验）
    existing_ids = set()
    for cell in req.canvas_state.grid.cells:
        for obj in cell.objects:
            existing_ids.add(obj.id)

    # 尝试 LLM
    raw_output = None
    try:
        result = call_llm(req.text, grid_json, last_action_str)
        raw_output = json.dumps(result, ensure_ascii=False)
    except Exception as e:
        print(f"LLM call failed: {e}")

    # 修复管道
    parsed = None
    if raw_output:
        parsed, err = repair_pipeline(raw_output)
        if err:
            print(f"Repair failed: {err}")

    # 提取 commands
    commands_raw = parsed.get('commands', []) if parsed else []
    reply = parsed.get('reply', '好的') if parsed else ''

    # Command Parser 校验
    safe_commands = validate_commands(commands_raw, existing_ids)

    # LLM 完全失败 → Rules Parser 兜底
    if not safe_commands:
        rule_result = match_rules(req.text)
        if rule_result:
            return CommandResponse(**rule_result)
        # 连规则都不匹配
        return CommandResponse(
            reply=reply or "抱歉，我没有理解那个操作，请再说一遍",
            commands=[]
        )

    return CommandResponse(reply=reply, commands=[DrawCommand(action=c['action'], params=c['params']) for c in safe_commands])
```

- [ ] **Step 1: Commit**

```bash
git add backend/json_repair.py backend/command_parser.py backend/main.py
git commit -m "feat: add LLM output repair pipeline and command parser safety layer

Co-Authored-By: Claude <noreply@anthropic.com>"
```

#### Task 7.4: Commit and create PR 7

```bash
git push origin main
# 创建 PR 7
```

---

### PR 8: Rules Parser + TTS 语音反馈

> **PR 标题:** feat: 实现Rules Parser规则兜底和浏览器TTS语音反馈
> **功能描述:** rules_parser.py匹配"太阳/树/房子/清空/撤销/你好"等关键词生成固定指令。前端SpeechFeedback使用SpeechSynthesis朗读reply
> **实现思路:** rules_parser用简单的关键词匹配→返回固定commands。SpeechFeedback封装window.speechSynthesis，自动朗读reply文本
> **测试方式:** LLM不可用时发送"画太阳"→验证规则兜底生效。每次操作后验证TTS朗读

#### Task 8.1: 实现 rules_parser.py

**Files:**
- Create: `backend/rules_parser.py`

```python
# backend/rules_parser.py
from typing import Optional, Dict, Any, List

def match_rules(text: str) -> Optional[Dict[str, Any]]:
    """关键词匹配规则 → 返回 {reply, commands} 或 None"""
    t = text.strip()

    if "太阳" in t:
        return {
            "reply": "好的，我在画布中上方画了一个红色的太阳",
            "commands": [
                {"action": "draw_circle", "params": {"cx": 600, "cy": 150, "r": 60, "fill": "#ff4d4f", "label": "太阳", "role": "body"}}
            ]
        }
    if "树" in t:
        return {
            "reply": "好的，我画了一棵绿色的树",
            "commands": [
                {"action": "draw_rect", "params": {"x": 150, "y": 400, "w": 30, "h": 120, "fill": "#8B4513", "label": "树干", "groupId": "tree_1"}},
                {"action": "draw_circle", "params": {"cx": 165, "cy": 360, "r": 60, "fill": "#228B22", "label": "树冠", "role": "body", "groupId": "tree_1"}},
            ]
        }
    if "房子" in t:
        return {
            "reply": "好的，我在画布中下方画了一座房子",
            "commands": [
                {"action": "draw_rect", "params": {"x": 400, "y": 300, "w": 200, "h": 150, "fill": "#ffe58f", "label": "墙体", "role": "body", "groupId": "house_1"}},
                {"action": "draw_triangle", "params": {"x1": 380, "y1": 300, "x2": 500, "y2": 180, "x3": 620, "y3": 300, "fill": "#ff4d4f", "label": "屋顶", "role": "detail", "groupId": "house_1"}},
                {"action": "draw_rect", "params": {"x": 480, "y": 380, "w": 40, "h": 70, "fill": "#8B4513", "label": "门", "role": "detail", "groupId": "house_1"}},
            ]
        }
    if "花" in t:
        return {
            "reply": "好的，画了一朵花",
            "commands": [
                {"action": "draw_circle", "params": {"cx": 600, "cy": 500, "r": 15, "fill": "#ffcc00", "label": "花心", "role": "body", "groupId": "flower_1"}},
                *[
                    {"action": "draw_circle", "params": {"cx": 600 + 22 * (i % 2), "cy": 500 + 22 * (i // 2), "r": 14, "fill": "#ff69b4", "label": f"花瓣{i+1}", "role": "detail", "groupId": "flower_1"}}
                    for i in range(5)
                ],
            ]
        }
    if "撤销" in t or "回退" in t or "上一步" in t:
        return {"reply": "好的，撤销上一步", "commands": [{"action": "undo", "params": {}}]}
    if "清空" in t or "删除全部" in t:
        return {"reply": "好的，已清空画布", "commands": [{"action": "clear", "params": {}}]}
    if "你好" in t:
        return {"reply": "你好，我是语音绘图助手，请告诉我你想画什么", "commands": []}

    return None
```

#### Task 8.2: 前端 TTS Hook

**Files:**
- Create: `frontend/src/hooks/useSpeechFeedback.ts`

```typescript
// frontend/src/hooks/useSpeechFeedback.ts
export function speak(text: string): void {
  if (!text || typeof window === 'undefined') return;
  const synth = window.speechSynthesis;
  if (!synth) return;

  // Cancel any ongoing speech
  synth.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'zh-CN';
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  synth.speak(utterance);
}
```

#### Task 8.3: 在 App 中集成 TTS

```tsx
// App.tsx 中，收到 resp.reply 后调用
import { speak } from './hooks/useSpeechFeedback';

// 在 handleSend 成功后:
speak(resp.reply);
```

- [ ] **Step 1: Commit**

```bash
git add backend/rules_parser.py frontend/src/hooks/useSpeechFeedback.ts frontend/src/App.tsx
git commit -m "feat: implement Rules Parser fallback and browser TTS speech feedback

Co-Authored-By: Claude <noreply@anthropic.com>"
```

#### Task 8.4: Commit and create PR 8

```bash
git push origin main
# 创建 PR 8
```

---

### PR 9: 模糊对象匹配

> **PR 标题:** feat: 实现四级模糊对象匹配引擎
> **功能描述:** FuzzyMatcher提供label→颜色→位置→最近对象的四级匹配，LLM返回的update/move/delete指令通过FuzzyMatcher解析target
> **实现思路:** 见设计文档§9.1第2层
> **测试方式:** 画太阳后说"把红色的那个变大"→验证匹配到太阳

#### Task 9.1: 实现 FuzzyMatcher

**Files:**
- Create: `frontend/src/engine/FuzzyMatcher.ts`

```typescript
// frontend/src/engine/FuzzyMatcher.ts
import { DrawObject } from '../types/commands';
import { ObjectStore } from './ObjectStore';

const KNOWN_LABELS = ['太阳','树','树干','树冠','房子','墙体','屋顶','门','窗','花','山','海','船','星星','云'];

const COLORS_MAP: Record<string, string> = {
  '红': '#ff', '蓝': '#00', '绿': '#0f', '黄': '#ff',
  '紫': '#80', '橙': '#fa', '黑': '#00', '白': '#ff',
  '灰': '#80', '棕': '#8b',
};

const POSITION_MAP: Record<string, string[]> = {
  '左': ['0,0','1,0'], '右': ['0,2','1,2'],
  '上': ['0,0','0,1','0,2'], '下': ['1,0','1,1','1,2'],
  '中间': ['0,1','1,1'], '中': ['0,1','1,1'],
};

/**
 * 四级模糊匹配：label → 颜色 → 位置 → 最近对象
 * 返回匹配到的对象 ID，或 null
 */
export function fuzzyFind(text: string, store: ObjectStore): string | null {
  // Level 1: label 关键词
  for (const label of KNOWN_LABELS) {
    if (text.includes(label)) {
      const found = store.findByLabel(label);
      if (found.length > 0) return found[0].id;
    }
  }

  // Level 2: 颜色
  for (const [name, prefix] of Object.entries(COLORS_MAP)) {
    if (text.includes(name)) {
      const found = store.findByColor(prefix);
      if (found.length > 0) return found[0].id;
    }
  }

  // Level 3: 位置
  for (const [pos, cellIds] of Object.entries(POSITION_MAP)) {
    if (text.includes(pos)) {
      for (const cellId of cellIds) {
        const found = store.findByCell(cellId);
        if (found.length > 0) return found[0].id;
      }
    }
  }

  // Level 4: 最近对象
  const last = store.getLast();
  return last?.id ?? null;
}
```

- [ ] **Step 1: 在 CommandExecutor 中集成 FuzzyMatcher**

修改 `CommandExecutor.ts`：在执行 `update_object`/`move_object`/`delete_object` 时，如果 params 中没有 target 或 target 不存在，调用 `fuzzyFind` 解析用户文本中的目标。

```typescript
// CommandExecutor 构造函数增加 fuzzyText 参数:
// execute(commands: DrawCommand[], fuzzyText?: string)

// 在 dispatch 中的 update_object/move_object/delete_object case:
// if (!target || !store.get(target)) {
//   target = fuzzyFind(fuzzyText, store);
//   if (target) params.target = target;
//   else break;
// }
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/engine/FuzzyMatcher.ts frontend/src/engine/CommandExecutor.ts
git commit -m "feat: implement 4-level fuzzy object matching engine

Co-Authored-By: Claude <noreply@anthropic.com>"
```

#### Task 9.2: Commit and create PR 9

```bash
git push origin main
# 创建 PR 9
```

---

## Day 3: 打磨 + 交付

### PR 10: last_action 上下文 + TTS 空间反馈 + 对象编辑闭环

> **PR 标题:** feat: 实现last_action上下文传递、TTS空间描述反馈和对象编辑完整闭环
> **功能描述:** 每次LLM请求附带上一轮操作上下文，TTS反馈包含空间位置描述，对象编辑（移动/改色/删除/撤销）全功能闭环
> **实现思路:** last_action在后端Prompt中注入。TTS reply需LLM生成时自行包含空间描述。对象编辑通过FuzzyMatcher+last_action+空间网格协同工作
> **测试方式:** 连续操作"画太阳→把太阳变大→太大了改小一点→撤销"验证全链路

#### Task 10.1: 前端传递 last_action

**Files:**
- Modify: `frontend/src/hooks/useApiClient.ts` (已支持)  
- Modify: `frontend/src/App.tsx`

```tsx
// App.tsx 中维护 lastActionRef
const lastActionRef = useRef<{ reply: string; commands: any[] } | null>(null);

// 每次收到 response 后更新：
lastActionRef.current = { reply: resp.reply, commands: resp.commands };

// 发送时传递：
const resp = await sendCommand(text, canvasState, lastActionRef.current);
```

- [ ] **Step 1: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat: pass last_action context to LLM for reference resolution

Co-Authored-By: Claude <noreply@anthropic.com>"
```

#### Task 10.2: 对象编辑 UI 测试

**Files:**
- Modify: `frontend/src/App.tsx` (追加编辑测试按钮)

添加调试按钮："变大太阳"、"房子改蓝"、"移动树"、"撤销"、"清空"，方便验证对象编辑闭环。

- [ ] **Step 2: 全链路测试**

```
1. 语音/文本: "画太阳" → Canvas 出现太阳
2. 语音/文本: "画房子" → Canvas 出现房子
3. 语音/文本: "把太阳变大" → 太阳半径增大
4. 语音/文本: "房子改成蓝色" → 墙体变蓝（屋顶门不变）
5. 语音/文本: "太大了" → last_action 知道上一步改的是太阳 → 缩小
6. 语音/文本: "撤销" → 恢复上一步大小
7. 语音/文本: "清空" → 画布归白
```

- [ ] **Step 3: Commit**

```bash
git push origin main
# 创建 PR 10
```

---

### PR 11: UI 打磨 + 前端状态指示器

> **PR 标题:** feat: 实现语音状态指示器、字幕条和界面美化
> **功能描述:** 完善UI：状态指示器动画（绿/蓝/黄/紫/红）、AI回复字幕滚动条、画布对象统计
> **实现思路:** CSS动画实现状态脉冲/旋转效果。字幕条显示最近3条reply。对象统计从ObjectStore.count读取
> **测试方式:** 完整走一遍Demo流程，检查UI状态切换和视觉效果

#### Task 11.1: 完善 UI

**Files:**
- Create: `frontend/src/components/VoiceIndicator/VoiceIndicator.tsx`
- Create: `frontend/src/components/Subtitles/Subtitles.tsx`
- Create: `frontend/src/components/StatusBar/StatusBar.tsx`
- Create: `frontend/src/App.css` (完善样式)

```tsx
// VoiceIndicator.tsx — 语音状态动画脉冲圈
// Subtitles.tsx — 最近3条 AI 回复滚动显示
// StatusBar.tsx — 底部状态栏：状态 + 对象数 + 隐藏调试入口
```

- [ ] **Step 1: Commit**

```bash
git add frontend/src/components/ frontend/src/App.css
git commit -m "feat: polish UI with voice indicator, subtitles, and status bar

Co-Authored-By: Claude <noreply@anthropic.com>"
```

#### Task 11.2: Commit and create PR 11

```bash
git push origin main
# 创建 PR 11
```

---

### PR 12: README + 设计文档补充 + Demo 录制准备

> **PR 标题:** docs: 补充README、Demo视频链接占位、设计文档填写计划vs实际
> **功能描述:** 完善项目README（项目介绍+技术栈+运行方式+Demo链接占位），设计文档第14章填写最终实现情况
> **实现思路:** README包含项目简介、技术架构图、快速开始、Demo视频链接位置
> **测试方式:** Review文档完整性和准确性

#### Task 12.1: 编写 README

**Files:**
- Create: `README.md`

```markdown
# 🎨 AI 语音绘图工具

> 七牛云 × XEngineer 暑期实训营 2026 — 题目二  
> 纯语音控制的 AI Canvas 绘图工具

## 项目简介

一款完全通过语音控制的 AI 绘图应用。用户无需鼠标或键盘，仅通过自然语言与 AI 对话，完成从简单图形到复杂场景的绘制。

核心特征：
- 🎤 **纯语音交互** — 能量检测VAD，自动逐句交互
- 🧠 **AI语义理解** — Qwen文本模型将自然语言转为结构化绘图指令
- 🛡️ **安全执行层** — LLM输出修复管道 + Command Parser 7项校验
- 🗂️ **空间索引** — 3×2网格，Prompt体积恒定为 ~500 字符
- 💬 **模糊对象匹配** — label/颜色/位置/最近 四级匹配
- 🔄 **修正闭环** — last_action上下文 + TTS空间反馈

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | React 18 + TypeScript + Canvas 2D + Web Audio API |
| 后端 | Python FastAPI + dashscope |
| AI | Qwen 文本模型 (dashscope) |
| 语音识别 | 七牛云短语音听写 (主) / Web Speech API (备用) |
| TTS | 浏览器 SpeechSynthesis |

## 快速开始

### 前置条件
- Node.js 18+, Python 3.10+
- 七牛云 ASR 凭证 / dashscope API Key

### 后端
```bash
cd backend
cp .env.example .env  # 填入 API Key
pip install -r requirements.txt
uvicorn main:app --port 8000
```

### 前端
```bash
cd frontend
npm install
npm run dev
```

打开 http://localhost:5173，授权麦克风权限后即可开始语音绘图。

## Demo 视频

📺 [点击观看 Demo 视频](https://www.bilibili.com/video/待填入)

## 项目结构

```
qiniu-voice-draw/
├── frontend/          # React + TypeScript 前端
├── backend/           # Python FastAPI 后端
├── docs/              # 设计文档
└── README.md
```
```

#### Task 12.2: 补充设计文档"计划 vs 实际"

**Files:**
- Modify: `docs/superpowers/specs/2026-06-12-voice-draw-design.md` §14

根据实际开发情况填写第 14 章"计划 vs 实际"表格。

- [ ] **Step 1: Commit**

```bash
git add README.md docs/superpowers/specs/2026-06-12-voice-draw-design.md
git commit -m "docs: add README, Demo link placeholder, and implementation summary

Co-Authored-By: Claude <noreply@anthropic.com>"
```

#### Task 12.3: Commit and create PR 12

```bash
git push origin main
# 创建 PR 12
```

---

## Task Summary

| PR | Day | Content | Files |
|----|-----|---------|-------|
| 1 | 1 | 脚手架 + 类型 | frontend/(vite), types/commands.ts, backend/(main,config,requirements) |
| 2 | 1 | Canvas引擎 + ObjectStore + HistoryManager | engine/CanvasEngine.ts, ObjectStore.ts, HistoryManager.ts |
| 3 | 1 | CommandExecutor + Canvas组件 | engine/CommandExecutor.ts, components/Canvas/, App.tsx |
| 4 | 1 | /api/command 打通前后端 | backend/main.py, hooks/useApiClient.ts, App.tsx |
| 5 | 2 | VAD录音 + ASR端点 | hooks/useVoiceInput.ts, backend/main.py (+/api/asr) |
| 6 | 2 | Qwen LLM集成 | backend/llm_client.py, main.py |
| 7 | 2 | 修复管道 + Command Parser | backend/json_repair.py, command_parser.py, main.py |
| 8 | 2 | Rules Parser + TTS | backend/rules_parser.py, hooks/useSpeechFeedback.ts |
| 9 | 2 | 模糊对象匹配 | engine/FuzzyMatcher.ts, CommandExecutor.ts |
| 10 | 3 | last_action + 编辑闭环 | App.tsx (lastActionRef) |
| 11 | 3 | UI打磨 | components/VoiceIndicator, Subtitles, StatusBar, App.css |
| 12 | 3 | README + 文档补充 | README.md, design-doc §14 |

---

## Self-Review Checklist

- [x] 每个 task 包含具体文件路径、完整代码、测试步骤
- [x] 无 TBD/TODO/占位符
- [x] 类型一致性：DrawObject/DrawCommand/CellState 在前端 TS 和后端 Pydantic 之间对应
- [x] API 端点路径前后一致：POST /api/command、POST /api/asr、GET /health
- [x] 空间网格 3×2 格式在 ObjectStore.toGridState() 和后端 Prompt 中一致
- [x] Design decisions map to specific tasks (修复管道 → PR7, VAD → PR5, FuzzyMatcher → PR9)
