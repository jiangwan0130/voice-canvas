// ============================================================
// 语绘 (Voice Canvas) — 合并版指令类型定义
// 合并来源: 芝士番薯(渲染指令+画笔+渐变) + 月栖白(对象管理+编辑+空间索引)
// ============================================================

// ============ 图形类型 ============

export type ShapeType =
  | 'circle'
  | 'rect'
  | 'line'
  | 'curve'
  | 'polygon'
  | 'ellipse'
  | 'arc'
  | 'text';

// ============ 绘制模式 ============

export type DrawMode = 'stroke' | 'fill' | 'both';

// ============ 画笔类型 ============

export type BrushType = 'pencil' | 'paint';

// ============ 渐变类型 ============

export type GradientType = 'linear' | 'radial';

export interface GradientStop {
  offset: number; // 0.0 ~ 1.0
  color: string;
}

export interface FillGradient {
  type: GradientType;
  stops: GradientStop[];
  // linear
  x0?: number;
  y0?: number;
  x1?: number;
  y1?: number;
  // radial
  cx?: number;
  cy?: number;
  r0?: number;
  r1?: number;
}

// ============ 绘图对象 ============

/**
 * 画布上的每个图形都是一个 DrawObject。
 * 前端 ObjectStore 维护，支持增删改查和空间索引。
 */
export interface DrawObject {
  // --- 对象标识 (月栖白) ---
  id: string; // 唯一 ID，ObjectStore 自动分配 "obj_N"
  label: string; // 中文语义标签，如 "太阳"、"花瓣1"
  role: 'body' | 'detail' | null; // 组合对象中的角色: body=主体(改色优先), detail=装饰
  groupId: string | null; // 组合对象共享 ID，如 "house_1"
  cellId: string; // 空间网格格子 ID，如 "0,1"

  // --- 图形类型 ---
  type: ShapeType;

  // --- 坐标 (按 type 不同) ---
  // circle / ellipse / arc
  cx?: number;
  cy?: number;
  r?: number;
  rx?: number;
  ry?: number;
  startAngle?: number;
  endAngle?: number;
  // rect
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  // line / triangle
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  // triangle
  x3?: number;
  y3?: number;
  // curve / polygon
  points?: Array<[number, number]>;
  // text
  content?: string;
  fontSize?: number;
  font?: string;

  // --- 样式 ---
  color?: string; // stroke color (legacy alias for fill in some cases)
  fill?: string; // 填充色
  stroke?: string; // 描边色
  strokeWidth?: number; // 线宽
  duration?: number; // 动画时长 ms

  // --- 画笔 & 渐变 (芝士番薯) ---
  mode?: DrawMode; // stroke / fill / both
  brush?: BrushType; // pencil / paint
  fillAngle?: number; // 彩铅排线角度 (0-360)
  fillDensity?: number; // 彩铅密度 (1-10)
  fillGradient?: FillGradient; // 渐变填充
}

// ============ Action 类型 ============

export type ActionType =
  // 绘图指令 (芝士番薯)
  | 'circle'
  | 'rect'
  | 'line'
  | 'curve'
  | 'polygon'
  | 'ellipse'
  | 'arc'
  | 'text'
  // 对象编辑指令 (月栖白)
  | 'update_object'
  | 'move_object'
  | 'delete_object'
  // 控制指令 (合并)
  | 'setColor'
  | 'setWidth'
  | 'setBrush'
  | 'clear'
  | 'undo'
  | 'redo'
  | 'pause'
  | 'resume'
  | 'wait'
  | 'speak';

// ============ 绘图指令 ============

/**
 * 单条指令 — 后端返回的 instructions 数组元素
 */
export interface DrawInstruction {
  action: ActionType;
  // 绘图参数 — 与 DrawObject 的坐标/样式字段一致
  [key: string]: unknown;
}

// ============ 空间网格 ============

export interface GridCell {
  id: string; // "0,0"
  label: string; // "左上"
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

// ============ API 请求/响应 ============

export interface LastAction {
  reply: string;
  instructions: DrawInstruction[];
}

export interface GenerateRequest {
  text: string;
  canvas_state: CanvasState;
  last_action: LastAction | null;
}

export interface GenerateResponse {
  reply: string;
  instructions: DrawInstruction[];
  source: 'local' | 'llm';
}

export interface AsrResponse {
  text: string;
  source: 'qiniu' | 'webspeech';
}
