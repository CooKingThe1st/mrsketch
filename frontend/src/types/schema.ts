export interface MacroDefinition {
  command: string;      // ex: "\\zcontactnormal"
  argsCount: number;    // ex: 1
  template: string;     // ex: "\\hat{\\boldsymbol{n}}_{#1}"
}

export type PrimitiveType = 'circle' | 'rect' | 'poly' | 'line' | 'vector' | 'super_vector' | 'super_line' | 'mega_line' | 'mega_vector' | 'triangle' | 'diamond';

export interface PrimitiveConfig {
  id?: string;
  type?: PrimitiveType;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  radius?: number;
  triangleType?: 'right_isosceles' | 'equilateral';
  vertices?: Array<[number, number]>;
  points?: number[]; // [x1, y1, x2, y2, ...]
  controlPoint?: [number, number];
  lineShape?: 'straight' | 'curve';
  doubleArrow?: boolean;
  arrowSize?: number;
  strokeColor?: string;
  fillColor?: string;
  strokeOpacity?: number;
  fillOpacity?: number;
  strokeWidth?: number;
  strokeStyle?: StrokeStyleType;
}

export interface PrimitiveDefinition {
  id?: string;
  type: PrimitiveType;
  config: PrimitiveConfig;
}

export interface RobotDefinition {
  id: string;
  name: string;
  primitives: PrimitiveDefinition[];
}

export type SceneNodeType = 'alias' | 'obstacle' | 'rect' | 'circle' | 'vector' | 'line' | 'text' | 'super_vector' | 'super_line' | 'mega_line' | 'mega_vector' | 'triangle' | 'diamond';

export type StrokeStyleType = 'solid' | 'dashed' | 'dashdot' | 'dotted' | '-' | '--' | '-.' | ':';

export interface NodeStyle {
  strokeWidth: number;
  strokeStyle: StrokeStyleType;
  color: string;
  fillColor?: string;
  strokeOpacity?: number;
  fillOpacity?: number;
}

export interface PointBinding {
  nodeId: string;
  pointKey: string;
}

export interface SceneNode {
  id: string;
  name?: string;
  type: SceneNodeType;
  definitionId?: string; // Reference to RobotDefinition if type === 'alias'
  x: number; // Scientific coordinate X
  y: number; // Scientific coordinate Y
  scale?: number; // General scale factor (default 1.0)
  scaleX?: number;
  scaleY?: number;
  rotation?: number; // Degrees (default 0)
  width?: number; // For obstacles / shapes
  height?: number; // For obstacles / shapes
  radius?: number;
  triangleType?: 'right_isosceles' | 'equilateral';
  points?: number[]; // [x1, y1, x2, y2] for vectors/lines
  controlPoint?: number[]; // [cx, cy] guidance point for super vector/line
  lineShape?: 'straight' | 'curve'; // Shape mode for super vector/line
  doubleArrow?: boolean; // Double-ended arrow (head at start and end)
  arrowSize?: number; // Arrowhead scale factor (default 1.0)
  vertices?: Array<[number, number]>; // For poly relative to node (x, y)
  startBinding?: PointBinding;
  endBinding?: PointBinding;
  controlBinding?: PointBinding;
  megaBindings?: Record<number, PointBinding>;
  label?: string; // LaTeX annotation string e.g. "\zcontactnormal{1}"
  labelOffsetX?: number;
  labelOffsetY?: number;
  labelFillTransparent?: boolean;
  labelFillColor?: string;
  labelTextColor?: string; // Color of LaTeX annotation text itself
  textAlign?: 'left' | 'center' | 'right'; // Alignment of LaTeX annotation / text (default 'center')
  fontSize?: number; // Per-node / text font size in pt (default 12)
  edgeSnapPoints?: number; // Number of guidance snap points per edge (1-6, default 3)
  style: NodeStyle;
}

export interface ExportBounds {
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
}

export interface PlotOptions {
  showGrid: boolean;
  gridStyle: 'solid' | 'dashed' | 'dashdot' | 'dotted' | '-' | '--' | '-.' | ':';
  gridResolution?: number; // 0.25 (Ultra-Fine), 0.5 (Fine), 1.0 (Standard), 2.0 (Coarse)
  showAxis: boolean;
  showAxisLabels: boolean;
  xLabel?: string;
  yLabel?: string;
  title?: string;
  fontSize?: number;
  backgroundColor: string;
  bgOpacity?: number;
  labelBoxOpacity?: number; // Opacity of label background bounding box (0.0 transparent to 1.0)
  scaleLabelsWithZoom?: boolean; // Whether label font size scales with canvas zoom level
  marginPadding?: number; // pad_inches in Matplotlib savefig
  showPlotBorder?: boolean; // whether outer axis spine borders are visible
  grabHandleRadius?: number; // Radius of dashed circle grab handles on stage (default 14)
  cropToContent?: boolean; // Whether to automatically crop export boundary to scene content
  cropPadding?: number; // Padding around cropped content in scientific units (default 0.2)
  renderMathOnCanvas?: boolean; // Whether to render LaTeX math formulas directly on the canvas using KaTeX
  activeWorkspaceTab?: 'main_scene' | 'robot_designer';
  showLeftSidebar?: boolean;
  showRightPanel?: boolean;
  autoSaveInterval?: number;
}

export interface ProjectLayout {
  macros: Record<string, MacroDefinition>;
  definitions: Record<string, RobotDefinition>;
  scene: SceneNode[];
  exportBounds: ExportBounds;
  plotOptions: PlotOptions;
}

export type DrawingMode =
  | 'select'
  | 'draw_vector'
  | 'draw_line'
  | 'draw_label'
  | 'draw_poly'
  | 'draw_super_vector'
  | 'draw_super_line'
  | 'draw_mega_vector'
  | 'draw_mega_line'
  | 'add_shape';

export interface PendingShapeToAdd {
  type: SceneNodeType;
  definitionId?: string;
}

