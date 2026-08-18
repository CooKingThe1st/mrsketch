import React, { useRef, useState, useEffect } from 'react';
import { Stage, Layer, Group, Rect, Circle, Line, Arrow, Text, Tag, Label } from 'react-konva';
import type { SceneNode, RobotDefinition, ExportBounds, PrimitiveDefinition, PointBinding, PlotOptions, DrawingMode, PendingShapeToAdd, MacroDefinition } from '../types/schema';
import { Sun, Moon, Check, Sparkles, X, Type, Square, Circle as CircleIcon, Triangle, MoveRight, CornerDownRight, ArrowRightLeft, ChevronsUp, ChevronUp, ChevronDown, ChevronsDown, Layers, Wand2, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import { syncBoundNodesForGroup } from '../App';
import katex from 'katex';

export function renderLatexToHtml(rawLabel: string, macros?: Record<string, MacroDefinition>): string {
  if (!rawLabel) return '';
  let text = rawLabel;

  if (macros) {
    Object.values(macros).forEach((macro) => {
      const cmd = macro.command.startsWith('\\') ? macro.command : `\\${macro.command}`;
      if (macro.argsCount === 0) {
        text = text.replaceAll(cmd, macro.template || '');
      } else {
        const escapedCmd = cmd.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escapedCmd + '(?:\\{([^{}]*)\\}){' + macro.argsCount + '}', 'g');
        text = text.replace(regex, (...args) => {
          let res = macro.template || '';
          for (let i = 1; i <= macro.argsCount; i++) {
            const argVal = args[i] !== undefined ? args[i] : '';
            res = res.replaceAll(`{#${i}}`, argVal).replaceAll(`#${i}`, argVal);
          }
          return res;
        });
      }
    });
  }

  // Expand \ifblank{#1}{then}{else}
  text = text.replace(/\\ifblank\{([^}]*)\}\{([^}]*)\}\{([^}]*)\}/g, (_m, arg, thenVal, elseVal) => {
    return arg.trim() === '' ? thenVal : elseVal;
  });
  text = text.replaceAll('\\bm{', '\\mathbf{').replaceAll('\\boldsymbol{', '\\mathbf{');

  const lines = text.split('\n');
  return lines
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return '<div class="katex-line" style="line-height: 1.15; height: 1em;"></div>';

      const renderSnippet = (mathSnippet: string) => {
        // Replace unescaped spaces with '\ ' so KaTeX preserves literal whitespace in math mode
        const spaced = mathSnippet.replace(/(?<!\\) /g, '\\ ');
        try {
          return katex.renderToString(spaced, {
            throwOnError: false,
            displayMode: false,
          });
        } catch {
          return mathSnippet;
        }
      };

      let lineHtml = '';
      if (trimmed.includes('$')) {
        const parts = trimmed.split('$');
        const resHtml: string[] = [];
        for (let i = 0; i < parts.length; i++) {
          const part = parts[i];
          if (!part) continue;
          if (i % 2 === 1) {
            // Inside $ ... $
            resHtml.push(renderSnippet(part));
          } else {
            // Outside $ ... $ plain text
            const safeText = part
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/ /g, '&nbsp;');
            resHtml.push(`<span>${safeText}</span>`);
          }
        }
        lineHtml = resHtml.join('');
      } else {
        lineHtml = renderSnippet(trimmed);
      }
      return `<div class="katex-line" style="line-height: 1.15; margin: 0; padding: 0;">${lineHtml}</div>`;
    })
    .join('');
}

interface CanvasStageProps {
  mode: 'main_scene' | 'robot_designer';
  scene: SceneNode[];
  definitions: Record<string, RobotDefinition>;
  activeRobotDefId: string | null;
  exportBounds: ExportBounds;
  plotOptions?: PlotOptions;
  macros?: Record<string, MacroDefinition>;
  selectedNodeId: string | null;
  selectedNodeIds: string[];
  selectedPrimitiveIdx: number | null;
  selectedPrimitiveIdxs: number[];
  drawingMode: DrawingMode;
  setDrawingMode?: (mode: DrawingMode) => void;
  pendingShapeToAdd?: PendingShapeToAdd | null;
  setPendingShapeToAdd?: (pending: PendingShapeToAdd | null) => void;
  fontSizePresets?: { small: number; med: number; large: number };
  onAddNode?: (type: SceneNode['type'], definitionId?: string, x?: number, y?: number) => void;
  onSelectNode: (id: string | null) => void;
  onSelectNodes: (ids: string[]) => void;
  onSelectPrimitive: (idx: number | null) => void;
  onSelectPrimitives: (idxs: number[]) => void;
  onUpdateNode: (updatedNode: SceneNode) => void;
  onUpdateNodes?: (updatedNodes: SceneNode[]) => void;
  onUpdateScene?: (newScene: SceneNode[]) => void;
  onUpdatePrimitive: (idx: number, updatedPrim: PrimitiveDefinition) => void;
  onUpdateExportBounds: (newBounds: ExportBounds) => void;
  onAddVectorOrLine: (
    type: SceneNode['type'],
    startSci: [number, number],
    endSci: [number, number],
    controlPointSci?: [number, number],
    startBinding?: PointBinding,
    endBinding?: PointBinding,
    controlBinding?: PointBinding
  ) => void;
  onAddMegaLine?: (
    type: 'mega_line' | 'mega_vector',
    pointsSci: Array<[number, number]>,
    megaBindings?: Record<number, PointBinding>
  ) => void;
  onAddTextEntity?: (x: number, y: number) => string | void;
  onAddPolygonPrimitive?: (vertices: Array<[number, number]>) => void;
  onDeleteNode?: (id: string) => void;
}

export const CanvasStage: React.FC<CanvasStageProps> = ({
  mode,
  scene,
  definitions,
  activeRobotDefId,
  exportBounds,
  plotOptions,
  macros,
  selectedNodeId,
  selectedNodeIds,
  selectedPrimitiveIdx,
  selectedPrimitiveIdxs,
  drawingMode,
  setDrawingMode,
  pendingShapeToAdd,
  setPendingShapeToAdd,
  fontSizePresets = { small: 18, med: 23, large: 30 },
  onAddNode,
  onSelectNode,
  onSelectNodes,
  onSelectPrimitive,
  onSelectPrimitives,
  onUpdateNode,
  onUpdateNodes,
  onUpdateScene,
  onUpdatePrimitive,
  onUpdateExportBounds,
  onAddVectorOrLine,
  onAddMegaLine,
  onAddTextEntity,
  onAddPolygonPrimitive,
  onDeleteNode,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isShiftRotating = useRef(false);
  const shiftRotateInitialScene = useRef<SceneNode[] | null>(null);
  const stageRef = useRef<any>(null);

  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [scale, setScale] = useState(40);
  const [canvasBgTheme, setCanvasBgTheme] = useState<'light' | 'dark'>('light');

  // Panning State (Right-Click Drag)
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const [showKonvaGrid, setShowKonvaGrid] = useState<boolean>(true);

  // Interactive vector/line drawing state
  const [drawStart, setDrawStart] = useState<[number, number] | null>(null);
  const [superDrawEnd, setSuperDrawEnd] = useState<[number, number] | null>(null);
  const [drawHover, setDrawHover] = useState<[number, number] | null>(null);

  // Mega Line / Mega Vector Multi-Vertex Drawing State
  const [megaPoints, setMegaPoints] = useState<Array<[number, number]>>([]);

  // Sheet 2 Chain-of-Segments Polygon Drawing State
  const [polyVertices, setPolyVertices] = useState<Array<[number, number]>>([]);

  // Right-click drag-selection state
  const [rightDragStart, setRightDragStart] = useState<{ x: number; y: number } | null>(null);
  const [rightDragEnd, setRightDragEnd] = useState<{ x: number; y: number } | null>(null);
  const dragInitialPositions = useRef<Record<string, { x: number; y: number }>>({});
  const lastClickTimeRef = useRef<number>(0);
  const lastClickPosRef = useRef<{ x: number; y: number } | null>(null);

  const originX = dimensions.width / 2 + panOffset.x;
  const originY = dimensions.height / 2 + panOffset.y;

  // Zoom Ratio relative to standard 40px/unit baseline scale
  const zoomRatio = scale / 40.0;

  const toPixelX = (x: number) => {
    if (mode === 'robot_designer') {
      return originX + x * zoomRatio;
    }
    return originX + x * scale;
  };

  const toPixelY = (y: number) => {
    if (mode === 'robot_designer') {
      return originY - y * zoomRatio;
    }
    return originY - y * scale;
  };

  const toSciX = (px: number) => {
    if (mode === 'robot_designer') {
      return (px - originX) / zoomRatio;
    }
    return (px - originX) / scale;
  };

  const toSciY = (py: number) => {
    if (mode === 'robot_designer') {
      return (originY - py) / zoomRatio;
    }
    return (originY - py) / scale;
  };

  const snapTo45Degrees = (x1: number, y1: number, x2: number, y2: number) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    const angleDeg = angle * (180 / Math.PI);
    const snappedDeg = Math.round(angleDeg / 45) * 45;
    const snappedRad = snappedDeg * (Math.PI / 180);
    return [
      x1 + len * Math.cos(snappedRad),
      y1 + len * Math.sin(snappedRad)
    ];
  };

  const isLight = canvasBgTheme === 'light';
  const bgColor = isLight ? '#f8fafc' : '#0f172a';
  const gridLineColor = isLight ? '#cbd5e1' : '#334155';
  const axisLineColor = isLight ? '#2563eb' : '#3b82f6';

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth || 800,
          height: containerRef.current.clientHeight || 600,
        });
      }
    };
    updateDimensions();

    const resizeObserver = new ResizeObserver(() => {
      updateDimensions();
    });
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    window.addEventListener('resize', updateDimensions);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateDimensions);
    };
  }, []);

  // Global ESC key listener to cancel midway drawing or shape placement
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || '').toUpperCase();
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;

      if (e.key === 'Escape') {
        setDrawStart(null);
        setSuperDrawEnd(null);
        setDrawHover(null);
        setMegaPoints([]);
        setPolyVertices([]);
        setDrawStartBinding(undefined);
        setSuperEndBinding(undefined);
        setMegaBindingsState({});
        setActiveSnapPreview(null);
        setPendingShapeToAdd?.(null);
        setDrawingMode?.('select');
        return;
      }

      // Arrow Key Precision Nudging for Selected Entities
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        const activeIds = selectedNodeIds.length > 0 ? selectedNodeIds : (selectedNodeId ? [selectedNodeId] : []);
        if (activeIds.length > 0) {
          e.preventDefault();
          const step = e.shiftKey ? 0.2 : 0.05; // 0.05 sci units for fine-tuning
          let dx = 0;
          let dy = 0;
          if (e.key === 'ArrowLeft') dx = -step;
          if (e.key === 'ArrowRight') dx = step;
          if (e.key === 'ArrowUp') dy = step;   // Sci Y points upwards
          if (e.key === 'ArrowDown') dy = -step;

          const updatedGroup: SceneNode[] = [];
          activeIds.forEach((id) => {
            const n = scene.find((item) => item.id === id);
            if (n) {
              updatedGroup.push({
                ...n,
                x: Math.round((n.x + dx) * 100) / 100,
                y: Math.round((n.y + dy) * 100) / 100,
              });
            }
          });

          let updatedScene = scene.map((n) => updatedGroup.find((u) => u.id === n.id) || n);
          updatedScene = syncBoundNodesForGroup(updatedScene, updatedGroup);

          if (onUpdateScene) {
            onUpdateScene(updatedScene);
          } else if (onUpdateNodes) {
            onUpdateNodes(updatedGroup);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setDrawingMode, setPendingShapeToAdd, selectedNodeIds, selectedNodeId, scene, onUpdateScene, onUpdateNodes]);

  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const zoomFactor = e.evt.deltaY < 0 ? 1.15 : 0.85;
    const oldScale = scale;
    const newScale = Math.min(260, Math.max(10, Math.round(oldScale * zoomFactor)));
    if (newScale === oldScale) return;

    const factor = newScale / oldScale;

    const currentOriginX = dimensions.width / 2 + panOffset.x;
    const currentOriginY = dimensions.height / 2 + panOffset.y;

    const newOriginX = pointer.x - (pointer.x - currentOriginX) * factor;
    const newOriginY = pointer.y - (pointer.y - currentOriginY) * factor;

    setPanOffset({
      x: newOriginX - dimensions.width / 2,
      y: newOriginY - dimensions.height / 2,
    });
    setScale(newScale);
  };

  // Global window listeners for Middle-Click Viewport Panning
  useEffect(() => {
    if (!isPanning) return;

    const handleGlobalMouseMove = (e: MouseEvent) => {
      setPanOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    };

    const handleGlobalMouseUp = (e: MouseEvent) => {
      if (e.button === 1 || isPanning) {
        setIsPanning(false);
      }
      if (e.button === 2) {
        setRightDragStart(null);
        setRightDragEnd(null);
      }
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isPanning, panStart]);

  const [quickMenuPos, setQuickMenuPos] = useState<{ x: number; y: number; sciX: number; sciY: number } | null>(null);
  const [activeSnapPreview, setActiveSnapPreview] = useState<{ sciX: number; sciY: number; type: 'shape' | 'grid' } | null>(null);
  const [editingLabelNodeId, setEditingLabelNodeId] = useState<string | null>(null);
  const [drawStartBinding, setDrawStartBinding] = useState<PointBinding | undefined>(undefined);
  const [superEndBinding, setSuperEndBinding] = useState<PointBinding | undefined>(undefined);
  const [megaBindingsState, setMegaBindingsState] = useState<Record<number, PointBinding>>({});

  const lastRightClickTimeRef = useRef<number>(0);
  const lastRightClickPosRef = useRef<{ x: number; y: number } | null>(null);
  const lastLabelClickRef = useRef<{ id: string; time: number }>({ id: '', time: 0 });

  const popoverContainerRef = useRef<HTMLDivElement>(null);
  const popoverTextareaRef = useRef<HTMLTextAreaElement>(null);
  const popoverOpenedAtRef = useRef<number>(0);

  useEffect(() => {
    if (editingLabelNodeId) {
      popoverOpenedAtRef.current = Date.now();
    }
  }, [editingLabelNodeId]);

  useEffect(() => {
    if (!editingLabelNodeId) return;

    const handleGlobalMouseDown = (e: MouseEvent) => {
      // Grace period to prevent double-click mouseup from triggering click-outside immediately
      if (Date.now() - popoverOpenedAtRef.current < 350) return;

      if (
        popoverContainerRef.current &&
        !popoverContainerRef.current.contains(e.target as Node)
      ) {
        const targetNode = scene.find((n) => n.id === editingLabelNodeId);
        if (targetNode) {
          const val = popoverTextareaRef.current?.value ?? '';
          if (targetNode.type === 'text' && (!val || !val.trim())) {
            onDeleteNode?.(targetNode.id);
          } else if (val !== (targetNode.label || '')) {
            onUpdateNode({ ...targetNode, label: val });
          }
        }
        setEditingLabelNodeId(null);
      }
    };

    document.addEventListener('mousedown', handleGlobalMouseDown, true);
    return () => {
      document.removeEventListener('mousedown', handleGlobalMouseDown, true);
    };
  }, [editingLabelNodeId, scene, onDeleteNode, onUpdateNode]);

  // Helper to compute all special guidance snap points for shapes in scientific coordinates
  const getGuidanceSnapPoints = (): Array<{ sciX: number; sciY: number; nodeId: string; pointKey: string }> => {
    const points: Array<{ sciX: number; sciY: number; nodeId: string; pointKey: string }> = [];

    scene.forEach((node) => {
      const rad = ((node.rotation || 0) * Math.PI) / 180;
      const cosR = Math.cos(rad);
      const sinR = Math.sin(rad);

      const rotatePoint = (dx: number, dy: number, pointKey: string) => {
        const rx = node.x + (dx * cosR - dy * sinR);
        const ry = node.y + (dx * sinR + dy * cosR);
        return { sciX: rx, sciY: ry, nodeId: node.id, pointKey };
      };

      const N = Math.max(1, Math.min(6, node.edgeSnapPoints ?? 3));

      const addEdgePoints = (p0: [number, number], p1: [number, number], edgePrefix: string) => {
        // Always include corner P0
        points.push(rotatePoint(p0[0], p0[1], `${edgePrefix}_start`));

        // Add N interior points between P0 and P1
        for (let k = 1; k <= N; k++) {
          const t = k / (N + 1);
          const px = p0[0] + t * (p1[0] - p0[0]);
          const py = p0[1] + t * (p1[1] - p0[1]);
          points.push(rotatePoint(px, py, `${edgePrefix}_int_${k}`));
        }
      };

      if (node.type === 'rect' || node.type === 'obstacle') {
        const w = node.width || 3;
        const h = node.height || 2;
        points.push({ sciX: node.x, sciY: node.y, nodeId: node.id, pointKey: 'center' });
        addEdgePoints([-w / 2, -h / 2], [w / 2, -h / 2], 'edge_t');
        addEdgePoints([w / 2, -h / 2], [w / 2, h / 2], 'edge_r');
        addEdgePoints([w / 2, h / 2], [-w / 2, h / 2], 'edge_b');
        addEdgePoints([-w / 2, h / 2], [-w / 2, -h / 2], 'edge_l');
      } else if (node.type === 'circle') {
        const r = node.radius || 1.5;
        points.push({ sciX: node.x, sciY: node.y, nodeId: node.id, pointKey: 'center' });
        const totalPoints = 4 * (N + 1);
        for (let i = 0; i < totalPoints; i++) {
          const angle = (i * 2 * Math.PI) / totalPoints;
          const px = r * Math.cos(angle);
          const py = r * Math.sin(angle);
          points.push(rotatePoint(px, py, `circle_p${i}`));
        }
      } else if (node.type === 'diamond') {
        const w = node.width || 3;
        const h = node.height || 2;
        points.push({ sciX: node.x, sciY: node.y, nodeId: node.id, pointKey: 'center' });
        addEdgePoints([0, h / 2], [w / 2, 0], 'edge_tr');
        addEdgePoints([w / 2, 0], [0, -h / 2], 'edge_br');
        addEdgePoints([0, -h / 2], [-w / 2, 0], 'edge_bl');
        addEdgePoints([-w / 2, 0], [0, h / 2], 'edge_tl');
      } else if (node.type === 'triangle') {
        const w = node.width || 3;
        const triType = node.triangleType || 'right_isosceles';
        points.push({ sciX: node.x, sciY: node.y, nodeId: node.id, pointKey: 'center' });

        if (triType === 'equilateral') {
          const h = w * 0.866;
          const v0: [number, number] = [0, h * 0.66];
          const v1: [number, number] = [-w / 2, -h * 0.33];
          const v2: [number, number] = [w / 2, -h * 0.33];
          addEdgePoints(v0, v1, 'edge_01');
          addEdgePoints(v1, v2, 'edge_12');
          addEdgePoints(v2, v0, 'edge_20');
        } else {
          const v0: [number, number] = [-w / 2, -w / 2];
          const v1: [number, number] = [-w / 2, w / 2];
          const v2: [number, number] = [w / 2, -w / 2];
          addEdgePoints(v0, v1, 'edge_01');
          addEdgePoints(v1, v2, 'edge_12');
          addEdgePoints(v2, v0, 'edge_20');
        }
      } else if (node.type === 'alias') {
        points.push({ sciX: node.x, sciY: node.y, nodeId: node.id, pointKey: 'center' });
      }
    });

    return points;
  };

  const getSnappedSciPoint = (
    pointerPixelX: number,
    pointerPixelY: number,
    forceEnable: boolean = false
  ): { sciX: number; sciY: number; isSnapped: boolean; binding?: PointBinding; snapType?: 'shape' | 'grid' } => {
    const rawSciX = Math.round(toSciX(pointerPixelX) * 10) / 10;
    const rawSciY = Math.round(toSciY(pointerPixelY) * 10) / 10;

    if (!forceEnable && drawingMode === 'select') {
      return { sciX: rawSciX, sciY: rawSciY, isSnapped: false };
    }

    const snapPoints = getGuidanceSnapPoints();
    let minDistance = Infinity;
    let bestSnapPoint: { sciX: number; sciY: number; nodeId: string; pointKey: string } | null = null;

    snapPoints.forEach((sp: { sciX: number; sciY: number; nodeId: string; pointKey: string }) => {
      const px = toPixelX(sp.sciX);
      const py = toPixelY(sp.sciY);
      const dist = Math.hypot(pointerPixelX - px, pointerPixelY - py);
      if (dist <= 16 && dist < minDistance) {
        minDistance = dist;
        bestSnapPoint = sp;
      }
    });

    const targetSnap = bestSnapPoint as { sciX: number; sciY: number; nodeId: string; pointKey: string } | null;
    if (targetSnap) {
      return {
        sciX: Math.round(targetSnap.sciX * 100) / 100,
        sciY: Math.round(targetSnap.sciY * 100) / 100,
        isSnapped: true,
        binding: { nodeId: targetSnap.nodeId, pointKey: targetSnap.pointKey },
        snapType: 'shape',
      };
    }

    // Grid snapping check (guidance without node binding)
    const unitStep = getAdaptiveGridStep(scale);
    const gridSciX = Math.round(rawSciX / unitStep) * unitStep;
    const gridSciY = Math.round(rawSciY / unitStep) * unitStep;
    const gridPx = toPixelX(gridSciX);
    const gridPy = toPixelY(gridSciY);
    const gridDist = Math.hypot(pointerPixelX - gridPx, pointerPixelY - gridPy);

    if (gridDist <= 14) {
      return {
        sciX: Math.round(gridSciX * 100) / 100,
        sciY: Math.round(gridSciY * 100) / 100,
        isSnapped: true,
        binding: undefined,
        snapType: 'grid',
      };
    }

    return { sciX: rawSciX, sciY: rawSciY, isSnapped: false };
  };

  const handleMouseDown = (e: any) => {
    // Dismiss quick menu on left click outside
    if (quickMenuPos && e.evt.button === 0) {
      setQuickMenuPos(null);
    }

    // Middle-click (button === 1) to pan canvas view
    if (e.evt.button === 1) {
      e.evt.preventDefault();
      e.evt.stopPropagation();
      setIsPanning(true);
      setPanStart({ x: e.evt.clientX - panOffset.x, y: e.evt.clientY - panOffset.y });
    }
    // Right-click (button === 2)
    if (e.evt.button === 2) {
      if (megaPoints.length >= 2) {
        e.evt.preventDefault();
        e.evt.stopPropagation();
        handleFinishMegaLine();
        return;
      }

      // Strict Right Double-Click detection for Quick Creation Popover Menu
      if (drawingMode === 'select') {
        const stage = e.target.getStage();
        const pointerPos = stage?.getPointerPosition();
        if (pointerPos) {
          const sciX = Math.round(toSciX(pointerPos.x) * 10) / 10;
          const sciY = Math.round(toSciY(pointerPos.y) * 10) / 10;
          const now = Date.now();
          const prevTime = lastRightClickTimeRef.current;
          const prevPos = lastRightClickPosRef.current;

          if (prevPos && now - prevTime <= 280) {
            const dist = Math.hypot(pointerPos.x - prevPos.x, pointerPos.y - prevPos.y);
            if (dist <= 6) {
              e.evt.preventDefault();
              e.evt.stopPropagation();
              setQuickMenuPos({ x: pointerPos.x, y: pointerPos.y, sciX, sciY });
              lastRightClickTimeRef.current = 0;
              lastRightClickPosRef.current = null;
              setRightDragStart(null);
              setRightDragEnd(null);
              return;
            }
          }
          lastRightClickTimeRef.current = now;
          lastRightClickPosRef.current = { x: pointerPos.x, y: pointerPos.y };
        }
      }

      const stage = e.target.getStage();
      const pointer = stage?.getPointerPosition();
      if (pointer) {
        setRightDragStart({ x: pointer.x, y: pointer.y });
        setRightDragEnd({ x: pointer.x, y: pointer.y });
      }
    }
  };

  const handleFinishMegaLine = () => {
    if (megaPoints.length >= 2 && onAddMegaLine) {
      const bindingsToSend = Object.keys(megaBindingsState).length > 0 ? megaBindingsState : undefined;
      onAddMegaLine(drawingMode === 'draw_mega_vector' ? 'mega_vector' : 'mega_line', megaPoints, bindingsToSend);
    }
    setMegaPoints([]);
    setMegaBindingsState({});
    setDrawHover(null);
  };

  const handleMouseMove = (e: any) => {
    if (isPanning) return;

    const stage = e.target.getStage();
    const pointerPos = stage?.getPointerPosition();
    if (!pointerPos) return;

    if (rightDragStart) {
      setRightDragEnd({ x: pointerPos.x, y: pointerPos.y });
      return;
    }

    if (e.evt.shiftKey && mode === 'main_scene' && selectedNodeIds.length > 0) {
      const anchorId = selectedNodeId || selectedNodeIds[0];
      const anchorNode = scene.find((n) => n.id === anchorId);
      if (anchorNode) {
        if (!isShiftRotating.current) {
          isShiftRotating.current = true;
          shiftRotateInitialScene.current = [...scene];
        }
        const nodePx = toPixelX(anchorNode.x);
        const nodePy = toPixelY(anchorNode.y);
        const dx = pointerPos.x - nodePx;
        const dy = pointerPos.y - nodePy;
        const angleRad = Math.atan2(-dy, dx);
        let angleDeg = Math.round((angleRad * 180) / Math.PI);
        const deltaAngle = angleDeg - (anchorNode.rotation || 0);
        if (deltaAngle !== 0) {
          const updatedNodes: SceneNode[] = [];
          selectedNodeIds.forEach((id) => {
            const n = scene.find((item) => item.id === id);
            if (n) {
              updatedNodes.push({
                ...n,
                rotation: ((n.rotation || 0) + deltaAngle) % 360,
              });
            }
          });

          // Live visual scene update
          const newScene = scene.map((n) => updatedNodes.find((u) => u.id === n.id) || n);
          if (onUpdateScene) {
            onUpdateScene(newScene);
          } else if (onUpdateNodes) {
            onUpdateNodes(updatedNodes);
          }
        }
      }
    }

    const snapResult = getSnappedSciPoint(pointerPos.x, pointerPos.y);
    let sciX = snapResult.sciX;
    let sciY = snapResult.sciY;

    if (snapResult.isSnapped && snapResult.snapType) {
      setActiveSnapPreview({ sciX, sciY, type: snapResult.snapType });
    } else {
      setActiveSnapPreview(null);
    }

    if (e.evt.ctrlKey) {
      if (drawStart) {
        const [sx, sy] = snapTo45Degrees(drawStart[0], drawStart[1], sciX, sciY);
        sciX = Math.round(sx * 10) / 10;
        sciY = Math.round(sy * 10) / 10;
      } else if (megaPoints.length > 0) {
        const lastPt = megaPoints[megaPoints.length - 1];
        const [sx, sy] = snapTo45Degrees(lastPt[0], lastPt[1], sciX, sciY);
        sciX = Math.round(sx * 10) / 10;
        sciY = Math.round(sy * 10) / 10;
      }
    }

    setDrawHover([sciX, sciY]);
  };

  const handleMouseUp = (e: any) => {
    if (isShiftRotating.current) {
      isShiftRotating.current = false;
      shiftRotateInitialScene.current = null;
      if (onUpdateScene) {
        onUpdateScene([...scene]);
      }
    }
    if (e.evt.button === 1 || isPanning) {
      setIsPanning(false);
    }
    if (e.evt.button === 2 && rightDragStart && rightDragEnd) {
      e.evt.preventDefault();
      const x1 = Math.min(rightDragStart.x, rightDragEnd.x);
      const y1 = Math.min(rightDragStart.y, rightDragEnd.y);
      const x2 = Math.max(rightDragStart.x, rightDragEnd.x);
      const y2 = Math.max(rightDragStart.y, rightDragEnd.y);

      // Only perform selection if the box is non-trivial to prevent click-clears
      const boxSize = Math.max(x2 - x1, y2 - y1);
      if (boxSize > 5) {
        if (mode === 'main_scene') {
          const ids = scene
            .filter((n) => {
              const px = originX + n.x * scale;
              const py = originY - n.y * scale;
              return px >= x1 && px <= x2 && py >= y1 && py <= y2;
            })
            .map((n) => n.id);

          onSelectNodes(ids);
          if (ids.length > 0) {
            onSelectNode(ids[0]);
          } else {
            onSelectNode(null);
          }
        } else if (mode === 'robot_designer' && activeRobotDefId && definitions[activeRobotDefId]) {
          const def = definitions[activeRobotDefId];
          const idxs: number[] = [];
          def.primitives.forEach((prim, idx) => {
            const px = originX + (prim.config.x || 0) * zoomRatio;
            const py = originY - (prim.config.y || 0) * zoomRatio;
            if (px >= x1 && px <= x2 && py >= y1 && py <= y2) {
              idxs.push(idx);
            }
          });
          onSelectPrimitives(idxs);
          if (idxs.length > 0) {
            onSelectPrimitive(idxs[0]);
          } else {
            onSelectPrimitive(null);
          }
        }
      }
      setRightDragStart(null);
      setRightDragEnd(null);
    }
  };

  const handleFinishPolygon = () => {
    if (polyVertices.length >= 3 && onAddPolygonPrimitive) {
      onAddPolygonPrimitive(polyVertices);
    }
    setPolyVertices([]);
  };

  const handleStageClick = (e: any) => {
    if (e.evt.button !== 0) return;

    const stage = e.target.getStage();
    const pointerPos = stage.getPointerPosition();
    if (!pointerPos) return;

    const snapResult = getSnappedSciPoint(pointerPos.x, pointerPos.y);
    let sciX = snapResult.sciX;
    let sciY = snapResult.sciY;

    if (e.evt.ctrlKey) {
      if (drawStart) {
        const [sx, sy] = snapTo45Degrees(drawStart[0], drawStart[1], sciX, sciY);
        sciX = Math.round(sx * 10) / 10;
        sciY = Math.round(sy * 10) / 10;
      } else if (megaPoints.length > 0) {
        const lastPt = megaPoints[megaPoints.length - 1];
        const [sx, sy] = snapTo45Degrees(lastPt[0], lastPt[1], sciX, sciY);
        sciX = Math.round(sx * 10) / 10;
        sciY = Math.round(sy * 10) / 10;
      }
    }

    // Strict double click check for quick text entity creation (ONLY allowed in 'select' mode)
    if (drawingMode === 'select' && e.evt.button === 0) {
      const targetName = typeof e.target.name === 'function' ? e.target.name() : '';
      const isBg = e.target === stage || targetName === 'bg_rect' || targetName === 'grid_layer';
      if (isBg) {
        const now = Date.now();
        const prevTime = lastClickTimeRef.current;
        const prevPos = lastClickPosRef.current;
        const timeDiff = now - prevTime;

        if (prevPos && timeDiff <= 280) {
          const dist = Math.hypot(pointerPos.x - prevPos.x, pointerPos.y - prevPos.y);
          if (dist <= 6) {
            // Valid strict double click at current pointer position!
            if (onAddTextEntity) {
              const createdId = onAddTextEntity(sciX, sciY);
              if (createdId && typeof createdId === 'string') {
                setEditingLabelNodeId(createdId);
              }
            }
            lastClickTimeRef.current = 0;
            lastClickPosRef.current = null;
            return;
          }
        }

        lastClickTimeRef.current = now;
        lastClickPosRef.current = { x: pointerPos.x, y: pointerPos.y };
      } else {
        lastClickTimeRef.current = 0;
        lastClickPosRef.current = null;
      }
    }

    if (mode === 'main_scene' && drawingMode === 'add_shape' && pendingShapeToAdd) {
      onAddNode?.(pendingShapeToAdd.type, pendingShapeToAdd.definitionId, sciX, sciY);
      setPendingShapeToAdd?.(null);
      setDrawingMode?.('select');
      setDrawHover(null);
      setActiveSnapPreview(null);
      return;
    }

    if (mode === 'main_scene' && drawingMode === 'draw_label') {
      if (onAddTextEntity) {
        onAddTextEntity(sciX, sciY);
      } else {
        onAddVectorOrLine('text', [sciX, sciY], [sciX, sciY]);
      }
      return;
    }

    if ((mode === 'main_scene' || mode === 'robot_designer') && (drawingMode === 'draw_vector' || drawingMode === 'draw_line')) {
      if (!drawStart) {
        setDrawStart([sciX, sciY]);
        setDrawStartBinding(snapResult.binding);
        setDrawHover([sciX, sciY]);
      } else {
        onAddVectorOrLine(
          drawingMode === 'draw_vector' ? 'vector' : 'line',
          drawStart,
          [sciX, sciY],
          undefined,
          drawStartBinding,
          snapResult.binding
        );
        setDrawStart(null);
        setDrawStartBinding(undefined);
        setDrawHover(null);
      }
      return;
    }

    if ((mode === 'main_scene' || mode === 'robot_designer') && (drawingMode === 'draw_super_vector' || drawingMode === 'draw_super_line')) {
      if (!drawStart) {
        setDrawStart([sciX, sciY]);
        setDrawStartBinding(snapResult.binding);
        setDrawHover([sciX, sciY]);
      } else if (!superDrawEnd) {
        setSuperDrawEnd([sciX, sciY]);
        setSuperEndBinding(snapResult.binding);
      } else {
        onAddVectorOrLine(
          drawingMode === 'draw_super_vector' ? 'super_vector' : 'super_line',
          drawStart,
          superDrawEnd,
          [sciX, sciY],
          drawStartBinding,
          superEndBinding,
          snapResult.binding
        );
        setDrawStart(null);
        setSuperDrawEnd(null);
        setDrawStartBinding(undefined);
        setSuperEndBinding(undefined);
        setDrawHover(null);
      }
      return;
    }

    if ((mode === 'main_scene' || mode === 'robot_designer') && (drawingMode === 'draw_mega_vector' || drawingMode === 'draw_mega_line')) {
      const nextIdx = megaPoints.length;
      if (snapResult.binding) {
        setMegaBindingsState((prev) => ({ ...prev, [nextIdx]: snapResult.binding! }));
      }
      setMegaPoints((prev) => [...prev, [sciX, sciY]]);
      setDrawHover([sciX, sciY]);
      return;
    }

    if (mode === 'robot_designer' && drawingMode === 'draw_poly') {
      const pxOffset = Math.round((pointerPos.x - originX) / zoomRatio);
      const pyOffset = Math.round((originY - pointerPos.y) / zoomRatio);

      if (polyVertices.length >= 3) {
        const [v0x, v0y] = polyVertices[0];
        const dist = Math.hypot(pxOffset - v0x, pyOffset - v0y);
        if (dist < 15) {
          handleFinishPolygon();
          return;
        }
      }

      setPolyVertices((prev) => [...prev, [pxOffset, pyOffset]]);
      return;
    }

    const clickedOnEmpty = e.target === e.target.getStage() || e.target.name() === 'bg_rect';
    if (clickedOnEmpty) {
      onSelectNode(null);
      onSelectPrimitive(null);
    }
  };

  const getStrokeDash = (style?: string) => {
    if (style === 'dashed' || style === '--') return [6, 4];
    if (style === 'dashdot' || style === '-.') return [8, 4, 2, 4];
    if (style === 'dotted' || style === ':') return [2, 3];
    return [];
  };

  const getAdaptiveGridStep = (scaleVal: number): number => {
    const resMultiplier = plotOptions?.gridResolution ?? 1.0;
    const steps = [0.05, 0.1, 0.2, 0.5, 1.0, 2.0, 5.0, 10.0, 20.0, 50.0];
    const targetPx = 30 * resMultiplier;
    for (const st of steps) {
      if (st * scaleVal >= targetPx) {
        return st;
      }
    }
    return 100.0;
  };

  const renderGrid = () => {
    const gridLines = [];
    const unitStep = getAdaptiveGridStep(scale);

    const minSciX = Math.floor(toSciX(0) / unitStep) * unitStep;
    const maxSciX = Math.ceil(toSciX(dimensions.width) / unitStep) * unitStep;
    const minSciY = Math.floor(toSciY(dimensions.height) / unitStep) * unitStep;
    const maxSciY = Math.ceil(toSciY(0) / unitStep) * unitStep;

    const showGrid = showKonvaGrid;
    const showAxis = plotOptions?.showAxis ?? true;

    const getGridDash = (style?: string) => {
      if (style === 'dashed' || style === '--') return [6, 4];
      if (style === 'dashdot' || style === '-.') return [8, 4, 2, 4];
      if (style === 'solid' || style === '-') return [];
      return [3, 3];
    };

    const gridDash = getGridDash(plotOptions?.gridStyle);

    // Vertical grid lines
    for (let sx = minSciX; sx <= maxSciX; sx += unitStep) {
      const roundedX = Math.round(sx * 100) / 100;
      const px = toPixelX(roundedX);
      const isAxis = Math.abs(roundedX) < 1e-5;
      const isMajor = Math.abs(roundedX % 1) < 1e-5 || Math.abs((roundedX % 1) - 1) < 1e-5;

      if (isAxis) {
        if (!showAxis) continue;
      } else {
        if (!showGrid) continue;
      }

      gridLines.push(
        <Line
          key={`v_${roundedX}`}
          points={[px, 0, px, dimensions.height]}
          stroke={isAxis ? axisLineColor : gridLineColor}
          strokeWidth={isAxis ? 2 : isMajor ? 1.2 : 0.8}
          dash={isAxis ? [] : gridDash}
          opacity={isAxis ? 1.0 : isMajor ? 0.85 : 0.45}
        />
      );
    }

    // Horizontal grid lines
    for (let sy = minSciY; sy <= maxSciY; sy += unitStep) {
      const roundedY = Math.round(sy * 100) / 100;
      const py = toPixelY(roundedY);
      const isAxis = Math.abs(roundedY) < 1e-5;
      const isMajor = Math.abs(roundedY % 1) < 1e-5 || Math.abs((roundedY % 1) - 1) < 1e-5;

      if (isAxis) {
        if (!showAxis) continue;
      } else {
        if (!showGrid) continue;
      }

      gridLines.push(
        <Line
          key={`h_${roundedY}`}
          points={[0, py, dimensions.width, py]}
          stroke={isAxis ? axisLineColor : gridLineColor}
          strokeWidth={isAxis ? 2 : isMajor ? 1.2 : 0.8}
          dash={isAxis ? [] : gridDash}
          opacity={isAxis ? 1.0 : isMajor ? 0.85 : 0.45}
        />
      );
    }
    return gridLines;
  };

  const renderExportBounds = () => {
    if (mode !== 'main_scene') return null;
    const left = toPixelX(exportBounds.xMin);
    const top = toPixelY(exportBounds.yMax);
    const right = toPixelX(exportBounds.xMax);
    const bottom = toPixelY(exportBounds.yMin);
    const width = (exportBounds.xMax - exportBounds.xMin) * scale;
    const height = (exportBounds.yMax - exportBounds.yMin) * scale;
    const isSelected = selectedNodeId === 'export_bounds';

    const handleSize = 10;

    return (
      <Group key="export_bounds_group">
        <Rect
          x={left}
          y={top}
          width={width}
          height={height}
          stroke={isSelected ? "#c084fc" : "#8b5cf6"}
          strokeWidth={isSelected ? 3 : 2}
          dash={[8, 6]}
          fill={isSelected ? "rgba(168, 85, 247, 0.15)" : "rgba(139, 92, 246, 0.05)"}
          listening={false}
        />

        {/* Interactive Border Frame for selecting and moving export_bounds */}
        <Rect
          x={left}
          y={top}
          width={width}
          height={height}
          stroke="transparent"
          strokeWidth={12}
          draggable={drawingMode === 'select'}
          onDragStart={(e) => {
            if (e.evt.button !== 0) {
              e.target.stopDrag();
            }
          }}
          onClick={(e) => {
            if (drawingMode === 'select') {
              e.cancelBubble = true;
              onSelectNode('export_bounds');
            }
          }}
          onDragMove={(e) => {
            e.cancelBubble = true;
            const currentSciX = toSciX(e.target.x());
            const currentSciY = toSciY(e.target.y());
            const dx = currentSciX - exportBounds.xMin;
            const dy = currentSciY - exportBounds.yMax;
            if (Math.abs(dx) >= 0.1 || Math.abs(dy) >= 0.1) {
              const w = exportBounds.xMax - exportBounds.xMin;
              const h = exportBounds.yMax - exportBounds.yMin;
              const newXMin = Math.round((exportBounds.xMin + dx) * 10) / 10;
              const newYMax = Math.round((exportBounds.yMax + dy) * 10) / 10;
              onUpdateExportBounds({
                xMin: newXMin,
                xMax: Math.round((newXMin + w) * 10) / 10,
                yMin: Math.round((newYMax - h) * 10) / 10,
                yMax: newYMax,
              });
            }
          }}
          onDragEnd={(e) => {
            e.cancelBubble = true;
            const dx = toSciX(e.target.x()) - exportBounds.xMin;
            const dy = toSciY(e.target.y()) - exportBounds.yMax;
            e.target.position({ x: left, y: top });
            const w = exportBounds.xMax - exportBounds.xMin;
            const h = exportBounds.yMax - exportBounds.yMin;
            const newXMin = Math.round((exportBounds.xMin + dx) * 10) / 10;
            const newYMax = Math.round((exportBounds.yMax + dy) * 10) / 10;
            onUpdateExportBounds({
              xMin: newXMin,
              xMax: Math.round((newXMin + w) * 10) / 10,
              yMin: Math.round((newYMax - h) * 10) / 10,
              yMax: newYMax,
            });
          }}
        />

        <Label
          x={left + 6}
          y={top + 6}
          onClick={(e) => {
            if (drawingMode === 'select') {
              e.cancelBubble = true;
              onSelectNode('export_bounds');
            }
          }}
        >
          <Tag fill={isSelected ? "#a855f7" : "#8b5cf6"} cornerRadius={4} opacity={0.9} />
          <Text text="Export Boundary" fill="#ffffff" fontSize={11} padding={4} fontStyle="bold" />
        </Label>

        {/* Interactive Corner Resizing Handles */}
        {isSelected && (
          <>
            {/* Top-Left Corner Handle */}
            <Rect
              x={left - handleSize / 2}
              y={top - handleSize / 2}
              width={handleSize}
              height={handleSize}
              fill="#c084fc"
              stroke="#ffffff"
              strokeWidth={1.5}
              draggable
              onMouseEnter={(e) => {
                const stage = e.target.getStage();
                if (stage) stage.container().style.cursor = 'nwse-resize';
              }}
              onMouseLeave={(e) => {
                const stage = e.target.getStage();
                if (stage) stage.container().style.cursor = 'default';
              }}
              onDragMove={(e) => {
                e.cancelBubble = true;
                const newXMin = Math.round(toSciX(e.target.x() + handleSize / 2) * 10) / 10;
                const newYMax = Math.round(toSciY(e.target.y() + handleSize / 2) * 10) / 10;
                if (newXMin !== exportBounds.xMin || newYMax !== exportBounds.yMax) {
                  onUpdateExportBounds({
                    ...exportBounds,
                    xMin: Math.min(newXMin, exportBounds.xMax - 1),
                    yMax: Math.max(newYMax, exportBounds.yMin + 1),
                  });
                }
              }}
              onDragEnd={(e) => {
                e.cancelBubble = true;
                const newXMin = Math.round(toSciX(e.target.x() + handleSize / 2) * 10) / 10;
                const newYMax = Math.round(toSciY(e.target.y() + handleSize / 2) * 10) / 10;
                onUpdateExportBounds({
                  ...exportBounds,
                  xMin: Math.min(newXMin, exportBounds.xMax - 1),
                  yMax: Math.max(newYMax, exportBounds.yMin + 1),
                });
              }}
            />

            {/* Top-Right Corner Handle */}
            <Rect
              x={right - handleSize / 2}
              y={top - handleSize / 2}
              width={handleSize}
              height={handleSize}
              fill="#c084fc"
              stroke="#ffffff"
              strokeWidth={1.5}
              draggable
              onMouseEnter={(e) => {
                const stage = e.target.getStage();
                if (stage) stage.container().style.cursor = 'nesw-resize';
              }}
              onMouseLeave={(e) => {
                const stage = e.target.getStage();
                if (stage) stage.container().style.cursor = 'default';
              }}
              onDragMove={(e) => {
                e.cancelBubble = true;
                const newXMax = Math.round(toSciX(e.target.x() + handleSize / 2) * 10) / 10;
                const newYMax = Math.round(toSciY(e.target.y() + handleSize / 2) * 10) / 10;
                if (newXMax !== exportBounds.xMax || newYMax !== exportBounds.yMax) {
                  onUpdateExportBounds({
                    ...exportBounds,
                    xMax: Math.max(newXMax, exportBounds.xMin + 1),
                    yMax: Math.max(newYMax, exportBounds.yMin + 1),
                  });
                }
              }}
              onDragEnd={(e) => {
                e.cancelBubble = true;
                const newXMax = Math.round(toSciX(e.target.x() + handleSize / 2) * 10) / 10;
                const newYMax = Math.round(toSciY(e.target.y() + handleSize / 2) * 10) / 10;
                onUpdateExportBounds({
                  ...exportBounds,
                  xMax: Math.max(newXMax, exportBounds.xMin + 1),
                  yMax: Math.max(newYMax, exportBounds.yMin + 1),
                });
              }}
            />

            {/* Bottom-Left Corner Handle */}
            <Rect
              x={left - handleSize / 2}
              y={bottom - handleSize / 2}
              width={handleSize}
              height={handleSize}
              fill="#c084fc"
              stroke="#ffffff"
              strokeWidth={1.5}
              draggable
              onMouseEnter={(e) => {
                const stage = e.target.getStage();
                if (stage) stage.container().style.cursor = 'nesw-resize';
              }}
              onMouseLeave={(e) => {
                const stage = e.target.getStage();
                if (stage) stage.container().style.cursor = 'default';
              }}
              onDragMove={(e) => {
                e.cancelBubble = true;
                const newXMin = Math.round(toSciX(e.target.x() + handleSize / 2) * 10) / 10;
                const newYMin = Math.round(toSciY(e.target.y() + handleSize / 2) * 10) / 10;
                if (newXMin !== exportBounds.xMin || newYMin !== exportBounds.yMin) {
                  onUpdateExportBounds({
                    ...exportBounds,
                    xMin: Math.min(newXMin, exportBounds.xMax - 1),
                    yMin: Math.min(newYMin, exportBounds.yMax - 1),
                  });
                }
              }}
              onDragEnd={(e) => {
                e.cancelBubble = true;
                const newXMin = Math.round(toSciX(e.target.x() + handleSize / 2) * 10) / 10;
                const newYMin = Math.round(toSciY(e.target.y() + handleSize / 2) * 10) / 10;
                onUpdateExportBounds({
                  ...exportBounds,
                  xMin: Math.min(newXMin, exportBounds.xMax - 1),
                  yMin: Math.min(newYMin, exportBounds.yMax - 1),
                });
              }}
            />

            {/* Bottom-Right Corner Handle */}
            <Rect
              x={right - handleSize / 2}
              y={bottom - handleSize / 2}
              width={handleSize}
              height={handleSize}
              fill="#c084fc"
              stroke="#ffffff"
              strokeWidth={1.5}
              draggable
              onMouseEnter={(e) => {
                const stage = e.target.getStage();
                if (stage) stage.container().style.cursor = 'nwse-resize';
              }}
              onMouseLeave={(e) => {
                const stage = e.target.getStage();
                if (stage) stage.container().style.cursor = 'default';
              }}
              onDragMove={(e) => {
                e.cancelBubble = true;
                const newXMax = Math.round(toSciX(e.target.x() + handleSize / 2) * 10) / 10;
                const newYMin = Math.round(toSciY(e.target.y() + handleSize / 2) * 10) / 10;
                if (newXMax !== exportBounds.xMax || newYMin !== exportBounds.yMin) {
                  onUpdateExportBounds({
                    ...exportBounds,
                    xMax: Math.max(newXMax, exportBounds.xMin + 1),
                    yMin: Math.min(newYMin, exportBounds.yMax - 1),
                  });
                }
              }}
              onDragEnd={(e) => {
                e.cancelBubble = true;
                const newXMax = Math.round(toSciX(e.target.x() + handleSize / 2) * 10) / 10;
                const newYMin = Math.round(toSciY(e.target.y() + handleSize / 2) * 10) / 10;
                onUpdateExportBounds({
                  ...exportBounds,
                  xMax: Math.max(newXMax, exportBounds.xMin + 1),
                  yMin: Math.min(newYMin, exportBounds.yMax - 1),
                });
              }}
            />
          </>
        )}
      </Group>
    );
  };

  const renderRobotPrimitives = (def: RobotDefinition, nodeStyle: SceneNode['style'], nodeScale: number = 1.0) => {
    const totalScale = nodeScale * zoomRatio;

    return def.primitives.map((prim, idx) => {
      const fill = prim.config.fillColor || nodeStyle.fillColor || '#cbd5e1';
      const stroke = prim.config.strokeColor || nodeStyle.color || '#475569';
      const strokeOpacity = prim.config.strokeOpacity ?? nodeStyle.strokeOpacity ?? 1.0;
      const ox = (prim.config.x || 0) * totalScale;
      const oy = -(prim.config.y || 0) * totalScale;
      const pw = (prim.config.strokeWidth ?? nodeStyle.strokeWidth) * zoomRatio * nodeScale;
      const dash = getStrokeDash(prim.config.strokeStyle || nodeStyle.strokeStyle);

      if (prim.type === 'circle') {
        const r = (prim.config.radius || 20) * totalScale;
        return <Circle key={idx} x={ox} y={oy} radius={r} fill={fill} stroke={stroke} opacity={strokeOpacity} strokeWidth={pw} dash={dash} />;
      }
      if (prim.type === 'rect') {
        const w = (prim.config.width || 30) * totalScale;
        const h = (prim.config.height || 20) * totalScale;
        return <Rect key={idx} x={ox - w / 2} y={oy - h / 2} width={w} height={h} fill={fill} stroke={stroke} opacity={strokeOpacity} strokeWidth={pw} dash={dash} />;
      }
      if (prim.type === 'triangle') {
        const w = (prim.config.width || 30) * totalScale;
        const triType = prim.config.triangleType || 'right_isosceles';
        let pts: number[] = [];
        if (triType === 'equilateral') {
          const h = w * 0.866;
          pts = [ox, oy - h * 0.66, ox - w / 2, oy + h * 0.33, ox + w / 2, oy + h * 0.33];
        } else {
          pts = [ox - w / 2, oy + w / 2, ox - w / 2, oy - w / 2, ox + w / 2, oy + w / 2];
        }
        return <Line key={idx} points={pts} closed fill={fill} stroke={stroke} opacity={strokeOpacity} strokeWidth={pw} dash={dash} />;
      }
      if (prim.type === 'diamond') {
        const w = (prim.config.width || 30) * totalScale;
        const h = (prim.config.height || 20) * totalScale;
        const pts = [ox, oy - h / 2, ox + w / 2, oy, ox, oy + h / 2, ox - w / 2, oy];
        return <Line key={idx} points={pts} closed fill={fill} stroke={stroke} opacity={strokeOpacity} strokeWidth={pw} dash={dash} />;
      }
      if (prim.type === 'poly' && prim.config.vertices) {
        const flatPoints = prim.config.vertices.flatMap(([vx, vy]) => [ox + vx * totalScale, oy - vy * totalScale]);
        return <Line key={idx} points={flatPoints} closed fill={fill} stroke={stroke} opacity={strokeOpacity} strokeWidth={pw} dash={dash} />;
      }
      if (prim.type === 'vector' && prim.config.points) {
        const [x1, y1, x2, y2] = prim.config.points;
        return <Arrow key={idx} points={[ox + x1 * totalScale, oy - y1 * totalScale, ox + x2 * totalScale, oy - y2 * totalScale]} stroke={stroke} fill={stroke} opacity={strokeOpacity} strokeWidth={pw} dash={dash} pointerLength={8 * zoomRatio} pointerWidth={8 * zoomRatio} />;
      }
      if (prim.type === 'line' && prim.config.points) {
        const [x1, y1, x2, y2] = prim.config.points;
        return <Line key={idx} points={[ox + x1 * totalScale, oy - y1 * totalScale, ox + x2 * totalScale, oy - y2 * totalScale]} stroke={stroke} opacity={strokeOpacity} strokeWidth={pw} dash={dash} />;
      }
      if ((prim.type === 'mega_vector' || prim.type === 'mega_line') && prim.config.points) {
        const pts = prim.config.points;
        const flatKonvaPoints: number[] = [];
        for (let i = 0; i < pts.length - 1; i += 2) {
          flatKonvaPoints.push(ox + pts[i] * totalScale);
          flatKonvaPoints.push(oy - pts[i + 1] * totalScale);
        }
        const isStraight = prim.config.lineShape === 'straight';
        const tensionVal = isStraight ? 0 : 0.4;
        if (prim.type === 'mega_line') {
          return <Line key={idx} points={flatKonvaPoints} tension={tensionVal} stroke={stroke} opacity={strokeOpacity} strokeWidth={pw} dash={dash} />;
        } else {
          const arrowPts = flatKonvaPoints.length >= 4 ? flatKonvaPoints.slice(-4) : flatKonvaPoints;
          return (
            <Group key={idx}>
              <Line points={flatKonvaPoints} tension={tensionVal} stroke={stroke} opacity={strokeOpacity} strokeWidth={pw} dash={dash} />
              {flatKonvaPoints.length >= 4 && (
                <Arrow points={arrowPts} stroke={stroke} fill={stroke} opacity={strokeOpacity} strokeWidth={pw} pointerLength={8 * zoomRatio} pointerWidth={8 * zoomRatio} />
              )}
            </Group>
          );
        }
      }
      if ((prim.type === 'super_vector' || prim.type === 'super_line') && prim.config.points) {
        const [x1, y1, x2, y2] = prim.config.points;
        const cpx = prim.config.controlPoint ? prim.config.controlPoint[0] : (x1 + x2) / 2;
        const cpy = prim.config.controlPoint ? prim.config.controlPoint[1] : (y1 + y2) / 2 + 20;
        const hcx = ox + cpx * totalScale;
        const hcy = oy - cpy * totalScale;
        const p1x = ox + x1 * totalScale;
        const p1y = oy - y1 * totalScale;
        const p2x = ox + x2 * totalScale;
        const p2y = oy - y2 * totalScale;

        const isStraight = prim.config.lineShape === 'straight';

        if (prim.type === 'super_line') {
          return isStraight ? (
            <Line
              key={idx}
              points={[p1x, p1y, hcx, hcy, p2x, p2y]}
              stroke={stroke}
              strokeWidth={pw}
              opacity={strokeOpacity}
              dash={dash}
            />
          ) : (
            <Line
              key={idx}
              points={[p1x, p1y, hcx, hcy, p2x, p2y]}
              bezier
              stroke={stroke}
              strokeWidth={pw}
              opacity={strokeOpacity}
              dash={dash}
            />
          );
        } else {
          return isStraight ? (
            <Group key={idx}>
              <Line
                points={[p1x, p1y, hcx, hcy]}
                stroke={stroke}
                strokeWidth={pw}
                opacity={strokeOpacity}
                dash={dash}
              />
              <Arrow
                points={[hcx, hcy, p2x, p2y]}
                stroke={stroke}
                fill={stroke}
                strokeWidth={pw}
                opacity={strokeOpacity}
                dash={dash}
                pointerLength={8 * zoomRatio}
                pointerWidth={8 * zoomRatio}
              />
            </Group>
          ) : (
            <Arrow
              key={idx}
              points={[p1x, p1y, hcx, hcy, p2x, p2y]}
              bezier
              stroke={stroke}
              fill={stroke}
              strokeWidth={pw}
              opacity={strokeOpacity}
              dash={dash}
              pointerLength={8 * zoomRatio}
              pointerWidth={8 * zoomRatio}
            />
          );
        }
      }
      return null;
    });
  };

  const renderSceneNode = (node: SceneNode, pass: 'body' | 'handles' = 'body') => {
    const isSelected = selectedNodeId === node.id;
    const px = toPixelX(node.x);
    const py = toPixelY(node.y);
    const nodeScale = node.scale || 1.0;
    const strokeDash = getStrokeDash(node.style.strokeStyle);
    const strokeOpacity = node.style.strokeOpacity ?? 1.0;
    const isLineFamily = node.type === 'vector' || node.type === 'line' || node.type === 'super_vector' || node.type === 'super_line' || node.type === 'mega_vector' || node.type === 'mega_line';
    const circleX = isLineFamily ? (node.points ? node.points[0] * scale * nodeScale : 0) : 0;
    const circleY = isLineFamily ? (node.points ? -node.points[1] * scale * nodeScale : 0) : 0;

    if (pass === 'handles') {
      if (!isSelected && !selectedNodeIds.includes(node.id)) return null;

      return (
        <Group key={`${node.id}_handles_overlay`} x={px} y={py} rotation={node.rotation}>
          {selectedNodeIds.includes(node.id) && !isSelected && (
            <Circle
              x={circleX}
              y={circleY}
              radius={(plotOptions?.grabHandleRadius ?? 14) * nodeScale * zoomRatio}
              stroke="#a855f7"
              strokeWidth={1.5}
              dash={[4, 4]}
              hitStrokeWidth={8}
              onClick={(e) => {
                if (drawingMode === 'select') {
                  e.cancelBubble = true;
                  if (e.evt.ctrlKey || e.evt.metaKey) {
                    if (selectedNodeIds.includes(node.id)) {
                      const newIds = selectedNodeIds.filter((id) => id !== node.id);
                      onSelectNodes(newIds);
                      onSelectNode(newIds.length > 0 ? newIds[newIds.length - 1] : null);
                    } else {
                      const newIds = [...selectedNodeIds, node.id];
                      onSelectNodes(newIds);
                      onSelectNode(node.id);
                    }
                  } else {
                    onSelectNode(node.id);
                    onSelectNodes([node.id]);
                  }
                }
              }}
            />
          )}

          {isSelected && (
            <>
              <Circle
                x={circleX}
                y={circleY}
                radius={(plotOptions?.grabHandleRadius ?? 14) * nodeScale * zoomRatio}
                stroke="#2563eb"
                strokeWidth={2}
                dash={[4, 4]}
                hitStrokeWidth={8}
                onClick={(e) => {
                  if (drawingMode === 'select') {
                    e.cancelBubble = true;
                    onSelectNode(node.id);
                    onSelectNodes([node.id]);
                  }
                }}
              />

              {/* Start Point Drag Handle for vector / line / super_vector / super_line */}
              {(node.type === 'vector' || node.type === 'line' || node.type === 'super_vector' || node.type === 'super_line') && (() => {
                const pts = node.points || [0, 0, 3, 2];
                const p1x = pts[0] * scale * nodeScale;
                const p1y = -pts[1] * scale * nodeScale;

                return (
                  <Circle
                    x={p1x}
                    y={p1y}
                    radius={6}
                    fill="#10b981"
                    stroke="#ffffff"
                    strokeWidth={2}
                    draggable
                    onMouseEnter={(e) => {
                      const stage = e.target.getStage();
                      if (stage) stage.container().style.cursor = 'crosshair';
                    }}
                    onMouseLeave={(e) => {
                      const stage = e.target.getStage();
                      if (stage) stage.container().style.cursor = 'default';
                      setActiveSnapPreview(null);
                    }}
                    onDragMove={(e) => {
                      const absPos = e.target.getAbsolutePosition();
                      const snap = getSnappedSciPoint(absPos.x, absPos.y, true);
                      if (snap.isSnapped && snap.snapType) {
                        setActiveSnapPreview({ sciX: snap.sciX, sciY: snap.sciY, type: snap.snapType });
                      } else {
                        setActiveSnapPreview(null);
                      }
                    }}
                    onDragEnd={(e) => {
                      e.cancelBubble = true;
                      setActiveSnapPreview(null);
                      const absPos = e.target.getAbsolutePosition();
                      const snap = getSnappedSciPoint(absPos.x, absPos.y, true);

                      let targetSciX = snap.isSnapped ? snap.sciX : toSciX(absPos.x);
                      let targetSciY = snap.isSnapped ? snap.sciY : toSciY(absPos.y);

                      const oldStartSciX = node.x + (pts[0] || 0);
                      const oldStartSciY = node.y + (pts[1] || 0);
                      const shiftX = targetSciX - oldStartSciX;
                      const shiftY = targetSciY - oldStartSciY;

                      const newX = Math.round((node.x + shiftX) * 100) / 100;
                      const newY = Math.round((node.y + shiftY) * 100) / 100;

                      const oldEndSciX = node.x + (pts[2] || 0);
                      const oldEndSciY = node.y + (pts[3] || 0);
                      const newP2x = Math.round((oldEndSciX - newX) * 100) / 100;
                      const newP2y = Math.round((oldEndSciY - newY) * 100) / 100;

                      let newCp = node.controlPoint;
                      if (node.controlPoint && node.controlPoint.length >= 2) {
                        const oldCpSciX = node.x + node.controlPoint[0];
                        const oldCpSciY = node.y + node.controlPoint[1];
                        newCp = [
                          Math.round((oldCpSciX - newX) * 100) / 100,
                          Math.round((oldCpSciY - newY) * 100) / 100,
                        ];
                      }

                      onUpdateNode({
                        ...node,
                        x: newX,
                        y: newY,
                        startBinding: snap.isSnapped ? snap.binding : undefined,
                        points: [0, 0, newP2x, newP2y],
                        controlPoint: newCp,
                      });
                    }}
                  />
                );
              })()}

              {/* End Point Drag Handle for vector / line / super_vector / super_line */}
              {(node.type === 'vector' || node.type === 'line' || node.type === 'super_vector' || node.type === 'super_line') && (() => {
                const pts = node.points || [0, 0, 3, 2];
                const p2x = pts[2] * scale * nodeScale;
                const p2y = -pts[3] * scale * nodeScale;

                return (
                  <Circle
                    x={p2x}
                    y={p2y}
                    radius={7}
                    fill="#38bdf8"
                    stroke="#ffffff"
                    strokeWidth={2}
                    draggable
                    onMouseEnter={(e) => {
                      const stage = e.target.getStage();
                      if (stage) stage.container().style.cursor = 'crosshair';
                    }}
                    onMouseLeave={(e) => {
                      const stage = e.target.getStage();
                      if (stage) stage.container().style.cursor = 'default';
                      setActiveSnapPreview(null);
                    }}
                    onDragMove={(e) => {
                      const absPos = e.target.getAbsolutePosition();
                      const snap = getSnappedSciPoint(absPos.x, absPos.y, true);
                      if (snap.isSnapped && snap.snapType) {
                        setActiveSnapPreview({ sciX: snap.sciX, sciY: snap.sciY, type: snap.snapType });
                      } else {
                        setActiveSnapPreview(null);
                      }

                      let targetSciX = snap.isSnapped ? snap.sciX : toSciX(absPos.x);
                      let targetSciY = snap.isSnapped ? snap.sciY : toSciY(absPos.y);

                      let newDx = Math.round((targetSciX - node.x) * 10) / 10;
                      let newDy = Math.round((targetSciY - node.y) * 10) / 10;

                      onUpdateNode({
                        ...node,
                        points: [pts[0], pts[1], newDx, newDy],
                      });
                    }}
                    onDragEnd={(e) => {
                      e.cancelBubble = true;
                      setActiveSnapPreview(null);
                      const absPos = e.target.getAbsolutePosition();
                      const snap = getSnappedSciPoint(absPos.x, absPos.y, true);

                      let targetSciX = snap.isSnapped ? snap.sciX : toSciX(absPos.x);
                      let targetSciY = snap.isSnapped ? snap.sciY : toSciY(absPos.y);

                      let newDx = Math.round((targetSciX - node.x) * 10) / 10;
                      let newDy = Math.round((targetSciY - node.y) * 10) / 10;

                      if (!snap.isSnapped && e.evt && (e.evt.ctrlKey || e.evt.metaKey)) {
                        const [sdnX, sdnY] = snapTo45Degrees(pts[0], pts[1], newDx, newDy);
                        newDx = Math.round(sdnX * 10) / 10;
                        newDy = Math.round(sdnY * 10) / 10;
                      }

                      onUpdateNode({
                        ...node,
                        endBinding: snap.isSnapped ? snap.binding : undefined,
                        points: [pts[0], pts[1], newDx, newDy],
                      });
                    }}
                  />
                );
              })()}

              {/* Guidance Control Point Drag Handle for super_vector / super_line */}
              {(node.type === 'super_vector' || node.type === 'super_line') && (() => {
                const pts = node.points || [0, 0, 3, 2];
                const p1x = pts[0] * scale * nodeScale;
                const p1y = -pts[1] * scale * nodeScale;
                const p2x = pts[2] * scale * nodeScale;
                const p2y = -pts[3] * scale * nodeScale;

                const cpx = node.controlPoint ? node.controlPoint[0] : (pts[0] + pts[2]) / 2;
                const cpy = node.controlPoint ? node.controlPoint[1] : (pts[1] + pts[3]) / 2 + 1.0;
                const hcx = cpx * scale * nodeScale;
                const hcy = -cpy * scale * nodeScale;

                return (
                  <Group key="super_guidance_handle_group">
                    {/* Dashed Guidance skeleton wire */}
                    <Line
                      points={[p1x, p1y, hcx, hcy, p2x, p2y]}
                      stroke="#f59e0b"
                      strokeWidth={1}
                      dash={[3, 3]}
                      opacity={0.6}
                    />

                    {/* Drag Handle Square for Guidance Point */}
                    <Rect
                      x={hcx - 5}
                      y={hcy - 5}
                      width={10}
                      height={10}
                      fill="#f59e0b"
                      stroke="#ffffff"
                      strokeWidth={2}
                      draggable
                      onMouseEnter={(e) => {
                        const stage = e.target.getStage();
                        if (stage) stage.container().style.cursor = 'grab';
                      }}
                      onMouseLeave={(e) => {
                        const stage = e.target.getStage();
                        if (stage) stage.container().style.cursor = 'default';
                        setActiveSnapPreview(null);
                      }}
                      onDragMove={(e) => {
                        const absPos = e.target.getAbsolutePosition();
                        const snap = getSnappedSciPoint(absPos.x + 5, absPos.y + 5, true);
                        if (snap.isSnapped && snap.snapType) {
                          setActiveSnapPreview({ sciX: snap.sciX, sciY: snap.sciY, type: snap.snapType });
                        } else {
                          setActiveSnapPreview(null);
                        }
                      }}
                      onDragEnd={(e) => {
                        e.cancelBubble = true;
                        setActiveSnapPreview(null);
                        const absPos = e.target.getAbsolutePosition();
                        const snap = getSnappedSciPoint(absPos.x + 5, absPos.y + 5, true);

                        let targetSciX = snap.isSnapped ? snap.sciX : toSciX(absPos.x + 5);
                        let targetSciY = snap.isSnapped ? snap.sciY : toSciY(absPos.y + 5);

                        let newCpx = Math.round((targetSciX - node.x) * 10) / 10;
                        let newCpy = Math.round((targetSciY - node.y) * 10) / 10;

                        onUpdateNode({
                          ...node,
                          controlBinding: snap.isSnapped ? snap.binding : undefined,
                          controlPoint: [newCpx, newCpy],
                        });
                      }}
                    />
                  </Group>
                );
              })()}

              {/* Waypoint Drag Handles for mega_vector / mega_line */}
              {(node.type === 'mega_vector' || node.type === 'mega_line') && (() => {
                const pts = node.points || [0, 0, 3, 2];
                const handles = [];
                for (let i = 0; i < pts.length; i += 2) {
                  const idx = i / 2;
                  const hx = pts[i] * scale * nodeScale;
                  const hy = -pts[i + 1] * scale * nodeScale;

                  handles.push(
                    <Circle
                      key={`mega_handle_${idx}`}
                      x={hx}
                      y={hy}
                      radius={6}
                      fill={idx === 0 ? "#10b981" : idx === pts.length / 2 - 1 ? "#f59e0b" : "#3b82f6"}
                      stroke="#ffffff"
                      strokeWidth={2}
                      draggable
                      onMouseEnter={(e) => {
                        const stage = e.target.getStage();
                        if (stage) stage.container().style.cursor = 'crosshair';
                      }}
                      onMouseLeave={(e) => {
                        const stage = e.target.getStage();
                        if (stage) stage.container().style.cursor = 'default';
                        setActiveSnapPreview(null);
                      }}
                      onDragMove={(e) => {
                        const absPos = e.target.getAbsolutePosition();
                        const snap = getSnappedSciPoint(absPos.x, absPos.y, true);
                        if (snap.isSnapped && snap.snapType) {
                          setActiveSnapPreview({ sciX: snap.sciX, sciY: snap.sciY, type: snap.snapType });
                        } else {
                          setActiveSnapPreview(null);
                        }
                      }}
                      onDragEnd={(e) => {
                        e.cancelBubble = true;
                        setActiveSnapPreview(null);
                        const absPos = e.target.getAbsolutePosition();
                        const snap = getSnappedSciPoint(absPos.x, absPos.y, true);

                        let targetSciX = snap.isSnapped ? snap.sciX : toSciX(absPos.x);
                        let targetSciY = snap.isSnapped ? snap.sciY : toSciY(absPos.y);

                        if (idx === 0) {
                          const oldStartSciX = node.x + (pts[0] || 0);
                          const oldStartSciY = node.y + (pts[1] || 0);
                          const shiftX = targetSciX - oldStartSciX;
                          const shiftY = targetSciY - oldStartSciY;
                          const newX = Math.round((node.x + shiftX) * 100) / 100;
                          const newY = Math.round((node.y + shiftY) * 100) / 100;

                          const newPts = [...pts];
                          newPts[0] = 0;
                          newPts[1] = 0;
                          for (let k = 2; k < newPts.length; k += 2) {
                            const ptSciX = node.x + pts[k];
                            const ptSciY = node.y + pts[k + 1];
                            newPts[k] = Math.round((ptSciX - newX) * 100) / 100;
                            newPts[k + 1] = Math.round((ptSciY - newY) * 100) / 100;
                          }

                          const currentMegaBindings = node.megaBindings ? { ...node.megaBindings } : {};
                          if (snap.isSnapped && snap.binding) {
                            currentMegaBindings[0] = snap.binding;
                          } else {
                            delete currentMegaBindings[0];
                          }

                          onUpdateNode({
                            ...node,
                            x: newX,
                            y: newY,
                            megaBindings: currentMegaBindings,
                            points: newPts,
                          });
                        } else {
                          let newDx = Math.round((targetSciX - node.x) * 10) / 10;
                          let newDy = Math.round((targetSciY - node.y) * 10) / 10;

                          const newPts = [...pts];
                          newPts[i] = newDx;
                          newPts[i + 1] = newDy;

                          const currentMegaBindings = node.megaBindings ? { ...node.megaBindings } : {};
                          if (snap.isSnapped && snap.binding) {
                            currentMegaBindings[idx] = snap.binding;
                          } else {
                            delete currentMegaBindings[idx];
                          }

                          onUpdateNode({
                            ...node,
                            megaBindings: currentMegaBindings,
                            points: newPts,
                          });
                        }
                      }}
                    />
                  );
                }
                return <Group key="mega_handles_group">{handles}</Group>;
              })()}

              {/* End Point Drag Handle for rect / obstacle scene nodes */}
              {(node.type === 'rect' || node.type === 'obstacle') && (() => {
                const w = (node.width || 2) * scale * nodeScale;
                const h = (node.height || 2) * scale * nodeScale;
                const rx = w / 2;
                const ry = h / 2;

                return (
                  <Circle
                    x={rx}
                    y={ry}
                    radius={7}
                    fill="#38bdf8"
                    stroke="#ffffff"
                    strokeWidth={2}
                    draggable
                    onMouseEnter={(e) => {
                      const stage = e.target.getStage();
                      if (stage) stage.container().style.cursor = 'nwse-resize';
                    }}
                    onMouseLeave={(e) => {
                      const stage = e.target.getStage();
                      if (stage) stage.container().style.cursor = 'default';
                    }}
                    onDragMove={(e) => {
                      const stage = e.target.getStage();
                      if (stage) {
                        const targetW = Math.max(0.5, (e.target.x() * 2) / (scale * nodeScale));
                        const targetH = Math.max(0.5, (e.target.y() * 2) / (scale * nodeScale));
                        onUpdateNode({
                          ...node,
                          width: Math.round(targetW * 10) / 10,
                          height: Math.round(targetH * 10) / 10,
                        });
                      }
                    }}
                    onDragEnd={(e) => {
                      e.cancelBubble = true;
                      const targetW = Math.max(0.5, (e.target.x() * 2) / (scale * nodeScale));
                      const targetH = Math.max(0.5, (e.target.y() * 2) / (scale * nodeScale));
                      onUpdateNode({
                        ...node,
                        width: Math.round(targetW * 10) / 10,
                        height: Math.round(targetH * 10) / 10,
                      });
                    }}
                  />
                );
              })()}

              {/* Radius Drag Handle for circle scene nodes */}
              {node.type === 'circle' && (() => {
                const r = (node.radius || 1.5) * scale * nodeScale;
                return (
                  <Circle
                    x={r}
                    y={0}
                    radius={7}
                    fill="#38bdf8"
                    stroke="#ffffff"
                    strokeWidth={2}
                    draggable
                    onMouseEnter={(e) => {
                      const stage = e.target.getStage();
                      if (stage) stage.container().style.cursor = 'ew-resize';
                    }}
                    onMouseLeave={(e) => {
                      const stage = e.target.getStage();
                      if (stage) stage.container().style.cursor = 'default';
                    }}
                    onDragMove={(e) => {
                      e.cancelBubble = true;
                      const dist = Math.hypot(e.target.x(), e.target.y());
                      const newR = Math.max(0.1, Math.round((dist / (scale * nodeScale)) * 10) / 10);
                      onUpdateNode({
                        ...node,
                        radius: newR,
                      });
                    }}
                    onDragEnd={(e) => {
                      e.cancelBubble = true;
                      const dist = Math.hypot(e.target.x(), e.target.y());
                      const newR = Math.max(0.1, Math.round((dist / (scale * nodeScale)) * 10) / 10);
                      onUpdateNode({
                        ...node,
                        radius: newR,
                      });
                    }}
                  />
                );
              })()}

              {/* Shape Guidance Drag Handle for diamond scene nodes */}
              {node.type === 'diamond' && (() => {
                const w = (node.width || 3) * scale * nodeScale;
                const h = (node.height || 2) * scale * nodeScale;
                const rx = w / 2;
                const ry = h / 2;

                return (
                  <Circle
                    x={rx}
                    y={ry}
                    radius={7}
                    fill="#c084fc"
                    stroke="#ffffff"
                    strokeWidth={2}
                    draggable
                    onMouseEnter={(e) => {
                      const stage = e.target.getStage();
                      if (stage) stage.container().style.cursor = 'nwse-resize';
                    }}
                    onMouseLeave={(e) => {
                      const stage = e.target.getStage();
                      if (stage) stage.container().style.cursor = 'default';
                    }}
                    onDragMove={(e) => {
                      e.cancelBubble = true;
                      const newW = Math.max(0.2, Math.round(((Math.abs(e.target.x()) * 2) / (scale * nodeScale)) * 10) / 10);
                      const newH = Math.max(0.2, Math.round(((Math.abs(e.target.y()) * 2) / (scale * nodeScale)) * 10) / 10);
                      onUpdateNode({
                        ...node,
                        width: newW,
                        height: newH,
                      });
                    }}
                    onDragEnd={(e) => {
                      e.cancelBubble = true;
                      const newW = Math.max(0.2, Math.round(((Math.abs(e.target.x()) * 2) / (scale * nodeScale)) * 10) / 10);
                      const newH = Math.max(0.2, Math.round(((Math.abs(e.target.y()) * 2) / (scale * nodeScale)) * 10) / 10);
                      onUpdateNode({
                        ...node,
                        width: newW,
                        height: newH,
                      });
                    }}
                  />
                );
              })()}

              {/* Shape Guidance Drag Handle for triangle scene nodes */}
              {node.type === 'triangle' && (() => {
                const w = (node.width || 3) * scale * nodeScale;
                const triType = node.triangleType || 'right_isosceles';
                const handleX = triType === 'equilateral' ? (w / 2) : ((2 * w) / 3);
                const handleY = triType === 'equilateral' ? (w * 0.866 * 0.33) : (w / 3);

                return (
                  <Circle
                    x={handleX}
                    y={handleY}
                    radius={7}
                    fill="#34d399"
                    stroke="#ffffff"
                    strokeWidth={2}
                    draggable
                    onMouseEnter={(e) => {
                      const stage = e.target.getStage();
                      if (stage) stage.container().style.cursor = 'nwse-resize';
                    }}
                    onMouseLeave={(e) => {
                      const stage = e.target.getStage();
                      if (stage) stage.container().style.cursor = 'default';
                    }}
                    onDragMove={(e) => {
                      e.cancelBubble = true;
                      const dist = Math.hypot(e.target.x(), e.target.y());
                      const newSize = Math.max(0.2, Math.round(((dist * 1.2) / (scale * nodeScale)) * 10) / 10);
                      onUpdateNode({
                        ...node,
                        width: newSize,
                        height: newSize,
                      });
                    }}
                    onDragEnd={(e) => {
                      e.cancelBubble = true;
                      const dist = Math.hypot(e.target.x(), e.target.y());
                      const newSize = Math.max(0.2, Math.round(((dist * 1.2) / (scale * nodeScale)) * 10) / 10);
                      onUpdateNode({
                        ...node,
                        width: newSize,
                        height: newSize,
                      });
                    }}
                  />
                );
              })()}

              {/* Draggable handle for Annotation Label */}
              {node.type !== 'text' && node.label && (() => {
                const isShape = node.type === 'rect' || node.type === 'circle' || node.type === 'triangle' || node.type === 'diamond' || node.type === 'obstacle';
                const defaultOffX = isShape ? 0.0 : 0.3;
                const defaultOffY = isShape ? 0.0 : 0.3;
                const lox = (node.labelOffsetX ?? defaultOffX) * scale * nodeScale;
                const loy = -(node.labelOffsetY ?? defaultOffY) * scale * nodeScale;
                return (
                  <Circle
                    x={lox}
                    y={loy}
                    radius={6}
                    fill="#c084fc"
                    stroke="#ffffff"
                    strokeWidth={1.5}
                    draggable
                    onMouseEnter={(e) => {
                      const stage = e.target.getStage();
                      if (stage) stage.container().style.cursor = 'move';
                    }}
                    onMouseLeave={(e) => {
                      const stage = e.target.getStage();
                      if (stage) stage.container().style.cursor = 'default';
                    }}
                    onDragStart={(e) => {
                      e.cancelBubble = true;
                    }}
                    onDragMove={(e) => {
                      e.cancelBubble = true;
                    }}
                    onDragEnd={(e) => {
                      e.cancelBubble = true;
                      const newOffsetX = Math.round((e.target.x() / (scale * nodeScale)) * 100) / 100;
                      const newOffsetY = Math.round((-e.target.y() / (scale * nodeScale)) * 100) / 100;
                      onUpdateNode({
                        ...node,
                        labelOffsetX: newOffsetX,
                        labelOffsetY: newOffsetY,
                      });
                    }}
                  />
                );
              })()}
            </>
          )}
        </Group>
      );
    }

    let nodeContent = null;

    if (node.type === 'alias' && node.definitionId && definitions[node.definitionId]) {
      const def = definitions[node.definitionId];
      nodeContent = renderRobotPrimitives(def, node.style, nodeScale);
    } else if (node.type === 'obstacle' || node.type === 'rect') {
      const w = (node.width || 2) * scale * nodeScale;
      const h = (node.height || 2) * scale * nodeScale;
      nodeContent = (
        <Rect
          x={-w / 2}
          y={-h / 2}
          width={w}
          height={h}
          fill={node.style.fillColor || '#fcd34d'}
          stroke={node.style.color}
          strokeWidth={node.style.strokeWidth}
          opacity={strokeOpacity}
          dash={strokeDash}
        />
      );
    } else if (node.type === 'circle') {
      const r = (node.radius || 1.5) * scale * nodeScale;
      nodeContent = (
        <Circle
          radius={r}
          fill={node.style.fillColor || '#fcd34d'}
          stroke={node.style.color}
          strokeWidth={node.style.strokeWidth}
          opacity={strokeOpacity}
          dash={strokeDash}
        />
      );
    } else if (node.type === 'triangle') {
      const w = (node.width || 3) * scale * nodeScale;
      const triType = node.triangleType || 'right_isosceles';
      if (triType === 'equilateral') {
        const h = w * 0.866;
        const pts = [0, -h * 0.66, -w / 2, h * 0.33, w / 2, h * 0.33];
        nodeContent = (
          <Line
            points={pts}
            closed
            fill={node.style.fillColor || '#fcd34d'}
            stroke={node.style.color}
            strokeWidth={node.style.strokeWidth}
            opacity={strokeOpacity}
            dash={strokeDash}
          />
        );
      } else {
        const pts = [-w / 3, -(2 * w) / 3, -w / 3, w / 3, (2 * w) / 3, w / 3];
        nodeContent = (
          <Line
            points={pts}
            closed
            fill={node.style.fillColor || '#fcd34d'}
            stroke={node.style.color}
            strokeWidth={node.style.strokeWidth}
            opacity={strokeOpacity}
            dash={strokeDash}
          />
        );
      }
    } else if (node.type === 'diamond') {
      const w = (node.width || 3) * scale * nodeScale;
      const h = (node.height || 2) * scale * nodeScale;
      const pts = [0, -h / 2, w / 2, 0, 0, h / 2, -w / 2, 0];
      nodeContent = (
        <Line
          points={pts}
          closed
          fill={node.style.fillColor || '#fcd34d'}
          stroke={node.style.color}
          strokeWidth={node.style.strokeWidth}
          opacity={strokeOpacity}
          dash={strokeDash}
        />
      );
    } else if (node.type === 'vector') {
      const pts = node.points || [0, 0, 3, 2];
      const p1x = pts[0] * scale * nodeScale;
      const p1y = -pts[1] * scale * nodeScale;
      const p2x = pts[2] * scale * nodeScale;
      const p2y = -pts[3] * scale * nodeScale;

      nodeContent = (
        <Arrow
          points={[p1x, p1y, p2x, p2y]}
          stroke={node.style.color}
          fill={node.style.color}
          strokeWidth={node.style.strokeWidth}
          opacity={strokeOpacity}
          dash={strokeDash}
          pointerLength={8 * zoomRatio}
          pointerWidth={8 * zoomRatio}
        />
      );
    } else if (node.type === 'line') {
      const pts = node.points || [0, 0, 3, 2];
      const p1x = pts[0] * scale * nodeScale;
      const p1y = -pts[1] * scale * nodeScale;
      const p2x = pts[2] * scale * nodeScale;
      const p2y = -pts[3] * scale * nodeScale;

      nodeContent = (
        <Line
          points={[p1x, p1y, p2x, p2y]}
          stroke={node.style.color}
          strokeWidth={node.style.strokeWidth}
          opacity={strokeOpacity}
          dash={strokeDash}
        />
      );
    } else if (node.type === 'super_vector' || node.type === 'super_line') {
      const pts = node.points || [0, 0, 3, 2];
      const p1x = pts[0] * scale * nodeScale;
      const p1y = -pts[1] * scale * nodeScale;
      const p2x = pts[2] * scale * nodeScale;
      const p2y = -pts[3] * scale * nodeScale;

      const cpx = node.controlPoint ? node.controlPoint[0] : (pts[0] + pts[2]) / 2;
      const cpy = node.controlPoint ? node.controlPoint[1] : (pts[1] + pts[3]) / 2 + 1.0;
      const hcx = cpx * scale * nodeScale;
      const hcy = -cpy * scale * nodeScale;

      const isStraight = node.lineShape === 'straight';

      if (node.type === 'super_line') {
        if (isStraight) {
          nodeContent = (
            <Line
              points={[p1x, p1y, hcx, hcy, p2x, p2y]}
              stroke={node.style.color}
              strokeWidth={node.style.strokeWidth}
              opacity={strokeOpacity}
              dash={strokeDash}
            />
          );
        } else {
          nodeContent = (
            <Line
              points={[p1x, p1y, hcx, hcy, p2x, p2y]}
              bezier
              stroke={node.style.color}
              strokeWidth={node.style.strokeWidth}
              opacity={strokeOpacity}
              dash={strokeDash}
            />
          );
        }
      } else {
        if (isStraight) {
          nodeContent = (
            <Group>
              <Line
                points={[p1x, p1y, hcx, hcy]}
                stroke={node.style.color}
                strokeWidth={node.style.strokeWidth}
                opacity={strokeOpacity}
                dash={strokeDash}
              />
              <Arrow
                points={[hcx, hcy, p2x, p2y]}
                stroke={node.style.color}
                fill={node.style.color}
                strokeWidth={node.style.strokeWidth}
                opacity={strokeOpacity}
                dash={strokeDash}
                pointerLength={8 * zoomRatio}
                pointerWidth={8 * zoomRatio}
              />
            </Group>
          );
        } else {
          nodeContent = (
            <Arrow
              points={[p1x, p1y, hcx, hcy, p2x, p2y]}
              bezier
              stroke={node.style.color}
              fill={node.style.color}
              strokeWidth={node.style.strokeWidth}
              opacity={strokeOpacity}
              dash={strokeDash}
              pointerLength={8 * zoomRatio}
              pointerWidth={8 * zoomRatio}
            />
          );
        }
      }
    } else if (node.type === 'mega_vector' || node.type === 'mega_line') {
      const pts = node.points || [0, 0, 3, 2];
      const konvaPoints: number[] = [];
      for (let i = 0; i < pts.length; i += 2) {
        konvaPoints.push(pts[i] * scale * nodeScale);
        konvaPoints.push(-pts[i + 1] * scale * nodeScale);
      }

      const isStraight = node.lineShape === 'straight';
      const tensionVal = isStraight ? 0 : 0.4;

      if (node.type === 'mega_line') {
        nodeContent = (
          <Line
            points={konvaPoints}
            tension={tensionVal}
            stroke={node.style.color}
            strokeWidth={node.style.strokeWidth}
            opacity={strokeOpacity}
            dash={strokeDash}
          />
        );
      } else {
        if (isStraight && konvaPoints.length >= 4) {
          const mainPoints = konvaPoints.slice(0, konvaPoints.length - 2);
          const pLastX = konvaPoints[konvaPoints.length - 4];
          const pLastY = konvaPoints[konvaPoints.length - 3];
          const pHeadX = konvaPoints[konvaPoints.length - 2];
          const pHeadY = konvaPoints[konvaPoints.length - 1];

          nodeContent = (
            <Group>
              <Line
                points={mainPoints}
                stroke={node.style.color}
                strokeWidth={node.style.strokeWidth}
                opacity={strokeOpacity}
                dash={strokeDash}
              />
              <Arrow
                points={[pLastX, pLastY, pHeadX, pHeadY]}
                stroke={node.style.color}
                fill={node.style.color}
                strokeWidth={node.style.strokeWidth}
                opacity={strokeOpacity}
                dash={strokeDash}
                pointerLength={8 * zoomRatio}
                pointerWidth={8 * zoomRatio}
              />
            </Group>
          );
        } else {
          nodeContent = (
            <Line
              points={konvaPoints}
              tension={tensionVal}
              stroke={node.style.color}
              strokeWidth={node.style.strokeWidth}
              opacity={strokeOpacity}
              dash={strokeDash}
            />
          );
        }
      }
    }

    return (
      <Group
        key={node.id}
        id={node.id}
        x={px}
        y={py}
        rotation={-(node.rotation || 0)}
        draggable={drawingMode === 'select'}
        onDragStart={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.evt.button !== 0) {
            e.target.stopDrag();
            return;
          }
          let activeIds = selectedNodeIds;
          if (!selectedNodeIds.includes(node.id)) {
            activeIds = [node.id];
            onSelectNodes([node.id]);
            onSelectNode(node.id);
          }
          const positions: Record<string, { x: number; y: number }> = {};
          activeIds.forEach((id) => {
            const n = scene.find((item) => item.id === id);
            if (n) {
              positions[id] = { x: n.x, y: n.y };
            }
          });
          dragInitialPositions.current = positions;
        }}
        onDragMove={(e) => {
          if (e.target !== e.currentTarget) return;
          let rawSciX = toSciX(e.target.x());
          let rawSciY = toSciY(e.target.y());

          const isShape = (node.type === 'rect' || node.type === 'circle' || node.type === 'triangle' || node.type === 'diamond' || node.type === 'obstacle');
          if (isShape) {
            const unitStep = getAdaptiveGridStep(scale);
            const gridSciX = Math.round(rawSciX / unitStep) * unitStep;
            const gridSciY = Math.round(rawSciY / unitStep) * unitStep;
            const gridPx = toPixelX(gridSciX);
            const gridPy = toPixelY(gridSciY);
            const gridDist = Math.hypot(e.target.x() - gridPx, e.target.y() - gridPy);

            if (gridDist <= 14) {
              rawSciX = Math.round(gridSciX * 100) / 100;
              rawSciY = Math.round(gridSciY * 100) / 100;
              e.target.x(toPixelX(rawSciX));
              e.target.y(toPixelY(rawSciY));
              setActiveSnapPreview({ sciX: rawSciX, sciY: rawSciY, type: 'grid' });
            } else {
              setActiveSnapPreview(null);
            }
          }

          const initPos = dragInitialPositions.current[node.id];
          if (initPos) {
            const dx = rawSciX - initPos.x;
            const dy = rawSciY - initPos.y;
            const activeIds = selectedNodeIds.includes(node.id) ? selectedNodeIds : [node.id];
            activeIds.forEach((id) => {
              if (id === node.id) return;
              const nInit = dragInitialPositions.current[id];
              if (nInit) {
                const stage = e.target.getStage();
                const targetNode = stage?.findOne('#' + id);
                if (targetNode) {
                  targetNode.x(toPixelX(nInit.x + dx));
                  targetNode.y(toPixelY(nInit.y + dy));
                }
              }
            });
          }
        }}
        onClick={(e) => {
          if (drawingMode === 'select') {
            e.cancelBubble = true;
            if (e.evt.ctrlKey || e.evt.metaKey) {
              if (selectedNodeIds.includes(node.id)) {
                const newIds = selectedNodeIds.filter((id) => id !== node.id);
                onSelectNodes(newIds);
                onSelectNode(newIds.length > 0 ? newIds[newIds.length - 1] : null);
              } else {
                const newIds = [...selectedNodeIds, node.id];
                onSelectNodes(newIds);
                onSelectNode(node.id);
              }
            } else {
              onSelectNode(node.id);
              onSelectNodes([node.id]);
            }
          }
        }}
        onDblClick={(e) => {
          if (drawingMode === 'select') {
            e.cancelBubble = true;
            if (selectedNodeId === node.id || selectedNodeIds.includes(node.id)) {
              setEditingLabelNodeId(node.id);
            }
          }
        }}
        onDragEnd={(e) => {
          if (e.target !== e.currentTarget) return;
          setActiveSnapPreview(null);
          let newSciX = toSciX(e.target.x());
          let newSciY = toSciY(e.target.y());

          const isShape = (node.type === 'rect' || node.type === 'circle' || node.type === 'triangle' || node.type === 'diamond' || node.type === 'obstacle' || node.type === 'alias');
          if (isShape) {
            const unitStep = getAdaptiveGridStep(scale);
            const gridSciX = Math.round(newSciX / unitStep) * unitStep;
            const gridSciY = Math.round(newSciY / unitStep) * unitStep;
            if (Math.hypot(newSciX - gridSciX, newSciY - gridSciY) < 0.25) {
              newSciX = Math.round(gridSciX * 100) / 100;
              newSciY = Math.round(gridSciY * 100) / 100;
            }
          }

          const initPos = dragInitialPositions.current[node.id];
          if (initPos) {
            const dx = newSciX - initPos.x;
            const dy = newSciY - initPos.y;
            const activeIds = selectedNodeIds.includes(node.id) ? selectedNodeIds : [node.id];
            const updatedGroup: SceneNode[] = [];
            activeIds.forEach((id) => {
              const n = scene.find((item) => item.id === id);
              const nInit = dragInitialPositions.current[id];
              if (n && nInit) {
                updatedGroup.push({
                  ...n,
                  x: Math.round((nInit.x + dx) * 100) / 100,
                  y: Math.round((nInit.y + dy) * 100) / 100,
                });
              }
            });

            let updatedScene = scene.map((n) => updatedGroup.find((u) => u.id === n.id) || n);
            updatedScene = syncBoundNodesForGroup(updatedScene, updatedGroup);

            if (onUpdateScene) {
              onUpdateScene(updatedScene);
            } else if (onUpdateNodes && updatedGroup.length > 0) {
              onUpdateNodes(updatedGroup);
            } else {
              updatedGroup.forEach(onUpdateNode);
            }
          } else {
            const updatedNode = {
              ...node,
              x: Math.round(newSciX * 100) / 100,
              y: Math.round(newSciY * 100) / 100,
            };
            let updatedScene = scene.map((n) => n.id === node.id ? updatedNode : n);
            updatedScene = syncBoundNodesForGroup(updatedScene, [updatedNode]);

            if (onUpdateScene) {
              onUpdateScene(updatedScene);
            } else {
              onUpdateNode(updatedNode);
            }
          }
        }}
      >
        {nodeContent}

        {/* Center of Mass (CoM) Marker for focused shape nodes */}
        {isSelected && (node.type === 'rect' || node.type === 'circle' || node.type === 'triangle' || node.type === 'diamond' || node.type === 'obstacle' || node.type === 'alias') && (
          <Group key="com_marker">
            <Circle radius={4} fill="#c084fc" stroke="#ffffff" strokeWidth={1} />
            <Line points={[-8, 0, 8, 0]} stroke="#c084fc" strokeWidth={1} />
            <Line points={[0, -8, 0, 8]} stroke="#c084fc" strokeWidth={1} />
          </Group>
        )}

        {/* Origin hit circle target for thin lines, vectors, and text nodes */}
        {(node.type === 'vector' || node.type === 'line' || node.type === 'super_vector' || node.type === 'super_line' || node.type === 'mega_line' || node.type === 'mega_vector' || node.type === 'text') && (
          <Circle
            radius={Math.max(14, 20 * nodeScale * zoomRatio)}
            fill="transparent"
            stroke="transparent"
            hitStrokeWidth={14}
            onClick={(e) => {
              if (drawingMode === 'select') {
                e.cancelBubble = true;
                if (e.evt.ctrlKey || e.evt.metaKey) {
                  if (selectedNodeIds.includes(node.id)) {
                    const newIds = selectedNodeIds.filter((id) => id !== node.id);
                    onSelectNodes(newIds);
                    onSelectNode(newIds.length > 0 ? newIds[newIds.length - 1] : null);
                  } else {
                    const newIds = [...selectedNodeIds, node.id];
                    onSelectNodes(newIds);
                    onSelectNode(node.id);
                  }
                } else {
                  onSelectNode(node.id);
                  onSelectNodes([node.id]);
                }
              }
            }}
          />
        )}

        {node.label && (() => {
          const isShape = node.type === 'rect' || node.type === 'circle' || node.type === 'triangle' || node.type === 'diamond' || node.type === 'obstacle' || node.type === 'text' || node.type === 'alias';
          const defaultOffX = isShape ? 0.0 : 0.3;
          const defaultOffY = isShape ? 0.0 : 0.3;
          const lox = (node.labelOffsetX ?? defaultOffX) * scale * nodeScale;
          const loy = -(node.labelOffsetY ?? defaultOffY) * scale * nodeScale;

          const baseFSize = node.fontSize || 12;
          const scaleWithZoom = plotOptions?.scaleLabelsWithZoom ?? false;
          const defaultScale = 72;
          const fSize = scaleWithZoom ? Math.max(4, Math.round(baseFSize * (scale / defaultScale))) : baseFSize;

          const lines = (node.label || '').split('\n');
          const maxLineChars = Math.max(...lines.map((l) => l.length), 1);
          const lineCount = lines.length;

          // Compute exact label width and height for alignment
          const estimatedTextWidth = maxLineChars * (fSize * 0.62) + 8;
          const estimatedTextHeight = lineCount * (fSize * 1.25) + 8;

          const align = node.textAlign || 'center';
          const labelOffX = estimatedTextWidth / 2;
          const labelOffY = estimatedTextHeight / 2;

          const trueTextColor = node.labelTextColor || node.style.color || (isLight ? '#0f172a' : '#f8fafc');
          const boxOpacity = plotOptions?.labelBoxOpacity ?? 0.0;
          const isTransparent = node.labelFillTransparent ?? (boxOpacity === 0.0);
          const tagOpacity = isTransparent ? boxOpacity : 0.85;

          const isMathMode = plotOptions?.renderMathOnCanvas ?? true;
          if (isMathMode) {
            return null;
          }

          return (
            <Label
              x={lox}
              y={loy}
              offsetX={labelOffX}
              offsetY={labelOffY}
              onClick={(e) => {
                if (drawingMode === 'select') {
                  e.cancelBubble = true;
                  if (e.evt.ctrlKey || e.evt.metaKey) {
                    if (selectedNodeIds.includes(node.id)) {
                      const newIds = selectedNodeIds.filter((id) => id !== node.id);
                      onSelectNodes(newIds);
                      onSelectNode(newIds.length > 0 ? newIds[newIds.length - 1] : null);
                    } else {
                      const newIds = [...selectedNodeIds, node.id];
                      onSelectNodes(newIds);
                      onSelectNode(node.id);
                    }
                  } else {
                    onSelectNode(node.id);
                    onSelectNodes([node.id]);
                  }
                }
              }}
              onDblClick={(e) => {
                if (drawingMode === 'select') {
                  e.cancelBubble = true;
                  setEditingLabelNodeId(node.id);
                }
              }}
            >
              {tagOpacity > 0 && (
                <Tag fill={node.labelFillColor || '#1e293b'} cornerRadius={4} opacity={tagOpacity} />
              )}
              <Text
                text={node.label}
                fill={trueTextColor}
                fontSize={fSize}
                padding={4}
                fontFamily="monospace"
                align={align}
                lineHeight={1.25}
              />
            </Label>
          );
        })()}
      </Group>
    );
  };

  const renderRobotDesignerPrimitives = () => {
    if (!activeRobotDefId || !definitions[activeRobotDefId]) return null;
    const def = definitions[activeRobotDefId];

    return def.primitives.map((prim, idx) => {
      const isSelected = selectedPrimitiveIdx === idx;
      const fill = prim.config.fillColor || '#dbeafe';
      const stroke = prim.config.strokeColor || '#3b82f6';
      const strokeOpacity = prim.config.strokeOpacity ?? 1.0;
      const pw = (prim.config.strokeWidth ?? (prim.type === 'circle' || prim.type === 'rect' || prim.type === 'poly' ? 2 : 2.5)) * zoomRatio;
      const dash = getStrokeDash(prim.config.strokeStyle);

      let primContent = null;
      let px = originX + (prim.config.x || 0) * zoomRatio;
      let py = originY - (prim.config.y || 0) * zoomRatio;

      if (prim.type === 'circle') {
        const r = (prim.config.radius || 25) * zoomRatio;
        primContent = <Circle radius={r} fill={fill} stroke={stroke} opacity={strokeOpacity} strokeWidth={pw} dash={dash} />;
      } else if (prim.type === 'rect') {
        const w = (prim.config.width || 30) * zoomRatio;
        const h = (prim.config.height || 30) * zoomRatio;
        primContent = <Rect x={-w / 2} y={-h / 2} width={w} height={h} fill={fill} stroke={stroke} opacity={strokeOpacity} strokeWidth={pw} dash={dash} />;
      } else if (prim.type === 'poly' && prim.config.vertices) {
        const flatPoints = prim.config.vertices.flatMap(([vx, vy]) => [vx * zoomRatio, -vy * zoomRatio]);
        primContent = <Line points={flatPoints} closed fill={fill} stroke={stroke} opacity={strokeOpacity} strokeWidth={pw} dash={dash} />;
      } else if (prim.type === 'vector' && prim.config.points) {
        const [x1, y1, x2, y2] = prim.config.points;
        primContent = <Arrow points={[x1 * zoomRatio, -y1 * zoomRatio, x2 * zoomRatio, -y2 * zoomRatio]} stroke={stroke} fill={stroke} opacity={strokeOpacity} strokeWidth={pw} dash={dash} pointerLength={8 * zoomRatio} pointerWidth={8 * zoomRatio} />;
      } else if (prim.type === 'line' && prim.config.points) {
        const [x1, y1, x2, y2] = prim.config.points;
        primContent = <Line points={[x1 * zoomRatio, -y1 * zoomRatio, x2 * zoomRatio, -y2 * zoomRatio]} stroke={stroke} opacity={strokeOpacity} strokeWidth={pw} dash={dash} />;
      } else if ((prim.type === 'super_vector' || prim.type === 'super_line') && prim.config.points) {
        const [x1, y1, x2, y2] = prim.config.points;
        const cpx = prim.config.controlPoint ? prim.config.controlPoint[0] : (x1 + x2) / 2;
        const cpy = prim.config.controlPoint ? prim.config.controlPoint[1] : (y1 + y2) / 2 + 20;
        const hcx = cpx * zoomRatio;
        const hcy = -cpy * zoomRatio;
        const p1x = x1 * zoomRatio;
        const p1y = -y1 * zoomRatio;
        const p2x = x2 * zoomRatio;
        const p2y = -y2 * zoomRatio;

        const isStraight = prim.config.lineShape === 'straight';

        if (prim.type === 'super_line') {
          primContent = isStraight ? (
            <Line
              points={[p1x, p1y, hcx, hcy, p2x, p2y]}
              stroke={stroke}
              strokeWidth={pw}
              opacity={strokeOpacity}
              dash={dash}
            />
          ) : (
            <Line
              points={[p1x, p1y, hcx, hcy, p2x, p2y]}
              bezier
              stroke={stroke}
              strokeWidth={pw}
              opacity={strokeOpacity}
              dash={dash}
            />
          );
        } else {
          primContent = isStraight ? (
            <Group>
              <Line
                points={[p1x, p1y, hcx, hcy]}
                stroke={stroke}
                strokeWidth={pw}
                opacity={strokeOpacity}
                dash={dash}
              />
              <Arrow
                points={[hcx, hcy, p2x, p2y]}
                stroke={stroke}
                fill={stroke}
                strokeWidth={pw}
                opacity={strokeOpacity}
                dash={dash}
                pointerLength={8 * zoomRatio}
                pointerWidth={8 * zoomRatio}
              />
            </Group>
          ) : (
            <Arrow
              points={[p1x, p1y, hcx, hcy, p2x, p2y]}
              bezier
              stroke={stroke}
              fill={stroke}
              strokeWidth={pw}
              opacity={strokeOpacity}
              dash={dash}
              pointerLength={8 * zoomRatio}
              pointerWidth={8 * zoomRatio}
            />
          );
        }
      }

      return (
        <Group
          key={idx}
          x={px}
          y={py}
          draggable
          onDragStart={(e) => {
            if (e.evt.button !== 0) {
              e.target.stopDrag();
              return;
            }
            const activeIdxs = selectedPrimitiveIdxs.includes(idx) ? selectedPrimitiveIdxs : [idx];
            dragInitialPositions.current = {};
            activeIdxs.forEach((i) => {
              const p = def.primitives[i];
              if (p) {
                dragInitialPositions.current[String(i)] = { x: p.config.x || 0, y: p.config.y || 0 };
              }
            });
          }}
          onClick={(e) => {
            e.cancelBubble = true;
            onSelectPrimitive(idx);
            onSelectPrimitives([idx]);
          }}
          onDragEnd={(e) => {
            const newOx = Math.round((e.target.x() - originX) / zoomRatio);
            const newOy = Math.round((originY - e.target.y()) / zoomRatio);
            const initPos = dragInitialPositions.current[String(idx)];
            if (initPos) {
              const dx = newOx - initPos.x;
              const dy = newOy - initPos.y;
              const activeIdxs = selectedPrimitiveIdxs.includes(idx) ? selectedPrimitiveIdxs : [idx];
              activeIdxs.forEach((i) => {
                const p = def.primitives[i];
                const pInit = dragInitialPositions.current[String(i)];
                if (p && pInit) {
                  onUpdatePrimitive(i, {
                    ...p,
                    config: {
                      ...p.config,
                      x: Math.round(pInit.x + dx),
                      y: Math.round(pInit.y + dy),
                    },
                  });
                }
              });
            } else {
              onUpdatePrimitive(idx, {
                ...prim,
                config: { ...prim.config, x: newOx, y: newOy },
              });
            }
          }}
        >
          {primContent}
          {selectedPrimitiveIdxs.includes(idx) && !isSelected && (
            <Circle radius={30 * zoomRatio} stroke="#f472b6" strokeWidth={1.5} dash={[4, 4]} />
          )}
          {isSelected && (
            <>
              <Circle radius={30 * zoomRatio} stroke="#ec4899" strokeWidth={2} dash={[4, 4]} />

              {/* End Point Drag Handle for vector / line / super_vector / super_line primitives */}
              {(prim.type === 'vector' || prim.type === 'line' || prim.type === 'super_vector' || prim.type === 'super_line') && (() => {
                const pts = prim.config.points || [0, 0, 40, 0];
                const p2x = pts[2] * zoomRatio;
                const p2y = -pts[3] * zoomRatio;

                return (
                  <Circle
                    x={p2x}
                    y={p2y}
                    radius={6}
                    fill="#f472b6"
                    stroke="#ffffff"
                    strokeWidth={1.5}
                    draggable
                    onMouseEnter={(e) => {
                      const stage = e.target.getStage();
                      if (stage) stage.container().style.cursor = 'crosshair';
                    }}
                    onMouseLeave={(e) => {
                      const stage = e.target.getStage();
                      if (stage) stage.container().style.cursor = 'default';
                    }}
                    onDragEnd={(e) => {
                      e.cancelBubble = true;
                      let newP2X = Math.round(e.target.x() / zoomRatio);
                      let newP2Y = Math.round(-e.target.y() / zoomRatio);

                      if (e.evt && (e.evt.ctrlKey || e.evt.metaKey)) {
                        const [sdnX, sdnY] = snapTo45Degrees(pts[0], pts[1], newP2X, newP2Y);
                        newP2X = Math.round(sdnX);
                        newP2Y = Math.round(sdnY);
                      }

                      onUpdatePrimitive(idx, {
                        ...prim,
                        config: {
                          ...prim.config,
                          points: [pts[0], pts[1], newP2X, newP2Y],
                        },
                      });
                    }}
                  />
                );
              })()}

              {/* Guidance Drag Handle for super_vector / super_line primitives */}
              {(prim.type === 'super_vector' || prim.type === 'super_line') && (() => {
                const pts = prim.config.points || [0, 0, 40, 0];
                const p1x = pts[0] * zoomRatio;
                const p1y = -pts[1] * zoomRatio;
                const p2x = pts[2] * zoomRatio;
                const p2y = -pts[3] * zoomRatio;

                const cpx = prim.config.controlPoint ? prim.config.controlPoint[0] : (pts[0] + pts[2]) / 2;
                const cpy = prim.config.controlPoint ? prim.config.controlPoint[1] : (pts[1] + pts[3]) / 2 + 20;
                const hcx = cpx * zoomRatio;
                const hcy = -cpy * zoomRatio;

                return (
                  <Group key={`prim_super_guidance_${idx}`}>
                    <Line
                      points={[p1x, p1y, hcx, hcy, p2x, p2y]}
                      stroke="#ec4899"
                      strokeWidth={1}
                      dash={[3, 3]}
                      opacity={0.6}
                    />
                    <Rect
                      x={hcx - 4}
                      y={hcy - 4}
                      width={8}
                      height={8}
                      fill="#f472b6"
                      stroke="#ffffff"
                      strokeWidth={1.5}
                      draggable
                      onMouseEnter={(e) => {
                        const stage = e.target.getStage();
                        if (stage) stage.container().style.cursor = 'grab';
                      }}
                      onMouseLeave={(e) => {
                        const stage = e.target.getStage();
                        if (stage) stage.container().style.cursor = 'default';
                      }}
                      onDragEnd={(e) => {
                        e.cancelBubble = true;
                        const newCpx = Math.round((e.target.x() + 4) / zoomRatio);
                        const newCpy = Math.round((-e.target.y() - 4) / zoomRatio);
                        onUpdatePrimitive(idx, {
                          ...prim,
                          config: {
                            ...prim.config,
                            controlPoint: [newCpx, newCpy],
                          },
                        });
                      }}
                    />
                  </Group>
                );
              })()}

              {/* End Point / Corner Drag Handle for rect primitive */}
              {prim.type === 'rect' && (() => {
                const w = (prim.config.width || 30) * zoomRatio;
                const h = (prim.config.height || 30) * zoomRatio;
                const rx = w / 2;
                const ry = h / 2;

                return (
                  <Circle
                    x={rx}
                    y={ry}
                    radius={6}
                    fill="#f472b6"
                    stroke="#ffffff"
                    strokeWidth={1.5}
                    draggable
                    onMouseEnter={(e) => {
                      const stage = e.target.getStage();
                      if (stage) stage.container().style.cursor = 'nwse-resize';
                    }}
                    onMouseLeave={(e) => {
                      const stage = e.target.getStage();
                      if (stage) stage.container().style.cursor = 'default';
                    }}
                    onDragEnd={(e) => {
                      e.cancelBubble = true;
                      const newW = Math.max(5, Math.round((e.target.x() * 2) / zoomRatio));
                      const newH = Math.max(5, Math.round((e.target.y() * 2) / zoomRatio));
                      onUpdatePrimitive(idx, {
                        ...prim,
                        config: {
                          ...prim.config,
                          width: newW,
                          height: newH,
                        },
                      });
                    }}
                  />
                );
              })()}

              {/* Radius Drag Handle for circle primitive */}
              {prim.type === 'circle' && (() => {
                const r = (prim.config.radius || 25) * zoomRatio;
                return (
                  <Circle
                    x={r}
                    y={0}
                    radius={6}
                    fill="#f472b6"
                    stroke="#ffffff"
                    strokeWidth={1.5}
                    draggable
                    onMouseEnter={(e) => {
                      const stage = e.target.getStage();
                      if (stage) stage.container().style.cursor = 'ew-resize';
                    }}
                    onMouseLeave={(e) => {
                      const stage = e.target.getStage();
                      if (stage) stage.container().style.cursor = 'default';
                    }}
                    onDragEnd={(e) => {
                      e.cancelBubble = true;
                      const dist = Math.hypot(e.target.x(), e.target.y());
                      const newR = Math.max(5, Math.round(dist / zoomRatio));
                      onUpdatePrimitive(idx, {
                        ...prim,
                        config: {
                          ...prim.config,
                          radius: newR,
                        },
                      });
                    }}
                  />
                );
              })()}
            </>
          )}
        </Group>
      );
    });
  };

  const renderInteractiveDrawingPreview = () => {
    if (drawingMode === 'draw_poly' && mode === 'robot_designer') {
      if (polyVertices.length === 0 && !drawHover) return null;
      const flatPoints = polyVertices.flatMap(([vx, vy]) => [originX + vx * zoomRatio, originY - vy * zoomRatio]);
      if (drawHover) {
        const hoverPx = toPixelX(drawHover[0]);
        const hoverPy = toPixelY(drawHover[1]);
        flatPoints.push(hoverPx, hoverPy);
      }

      return (
        <Group key="poly_preview">
          <Line points={flatPoints} stroke="#ec4899" strokeWidth={2.5} dash={[4, 4]} />
          {polyVertices.map(([vx, vy], i) => (
            <Circle key={i} x={originX + vx * zoomRatio} y={originY - vy * zoomRatio} radius={5} fill={i === 0 ? '#10b981' : '#ec4899'} />
          ))}
        </Group>
      );
    }

    if ((drawingMode === 'draw_mega_line' || drawingMode === 'draw_mega_vector') && megaPoints.length > 0) {
      const allPts = [...megaPoints];
      if (drawHover) allPts.push(drawHover);
      const flatPoints = allPts.flatMap(([x, y]) => [toPixelX(x), toPixelY(y)]);

      return (
        <Group key="mega_preview">
          <Line
            points={flatPoints}
            tension={0.4}
            stroke={drawingMode === 'draw_mega_vector' ? '#f43f5e' : '#06b6d4'}
            strokeWidth={2.5}
            dash={[4, 4]}
          />
          {drawingMode === 'draw_mega_vector' && flatPoints.length >= 4 && (
            <Arrow
              points={flatPoints.slice(-4)}
              stroke="#f43f5e"
              fill="#f43f5e"
              strokeWidth={2.5}
              pointerLength={10}
              pointerWidth={10}
            />
          )}
          {megaPoints.map(([x, y], idx) => (
            <Circle key={idx} x={toPixelX(x)} y={toPixelY(y)} radius={4} fill={drawingMode === 'draw_mega_vector' ? '#f43f5e' : '#06b6d4'} />
          ))}
        </Group>
      );
    }

    if (drawingMode === 'add_shape' && pendingShapeToAdd && drawHover) {
      const px = toPixelX(drawHover[0]);
      const py = toPixelY(drawHover[1]);
      const type = pendingShapeToAdd.type;

      if (type === 'rect' || type === 'obstacle') {
        const w = 2 * scale;
        const h = 2 * scale;
        return (
          <Group key="shape_cursor_preview" x={px} y={py}>
            <Rect
              x={-w / 2}
              y={-h / 2}
              width={w}
              height={h}
              fill={type === 'obstacle' ? "rgba(245, 158, 11, 0.25)" : "rgba(56, 189, 248, 0.25)"}
              stroke={type === 'obstacle' ? "#f59e0b" : "#38bdf8"}
              strokeWidth={2}
              dash={[4, 4]}
            />
            <Circle radius={4} fill="#38bdf8" />
          </Group>
        );
      }

      if (type === 'circle') {
        const r = 1.5 * scale;
        return (
          <Group key="shape_cursor_preview" x={px} y={py}>
            <Circle
              radius={r}
              fill="rgba(56, 189, 248, 0.25)"
              stroke="#38bdf8"
              strokeWidth={2}
              dash={[4, 4]}
            />
            <Circle radius={4} fill="#38bdf8" />
          </Group>
        );
      }

      if (type === 'triangle') {
        const w = 3 * scale;
        const pts = [-w / 2, w / 2, -w / 2, -w / 2, w / 2, w / 2];
        return (
          <Group key="shape_cursor_preview" x={px} y={py}>
            <Line
              points={pts}
              closed
              fill="rgba(56, 189, 248, 0.25)"
              stroke="#38bdf8"
              strokeWidth={2}
              dash={[4, 4]}
            />
            <Circle radius={4} fill="#38bdf8" />
          </Group>
        );
      }

      if (type === 'diamond') {
        const w = 3 * scale;
        const h = 2 * scale;
        const pts = [0, -h / 2, w / 2, 0, 0, h / 2, -w / 2, 0];
        return (
          <Group key="shape_cursor_preview" x={px} y={py}>
            <Line
              points={pts}
              closed
              fill="rgba(56, 189, 248, 0.25)"
              stroke="#38bdf8"
              strokeWidth={2}
              dash={[4, 4]}
            />
            <Circle radius={4} fill="#38bdf8" />
          </Group>
        );
      }

      if (type === 'alias' && pendingShapeToAdd.definitionId && definitions[pendingShapeToAdd.definitionId]) {
        const def = definitions[pendingShapeToAdd.definitionId];
        return (
          <Group key="shape_cursor_preview" x={px} y={py} opacity={0.65}>
            {def.primitives.map((prim, idx) => {
              const stroke = prim.config.strokeColor || '#3b82f6';
              const fill = prim.config.fillColor || '#dbeafe';
              const pw = (prim.config.strokeWidth || 2) * zoomRatio;

              if (prim.type === 'rect') {
                const w = (prim.config.width || 30) * zoomRatio;
                const h = (prim.config.height || 20) * zoomRatio;
                return (
                  <Rect
                    key={idx}
                    x={(prim.config.x || 0) * zoomRatio - w / 2}
                    y={-(prim.config.y || 0) * zoomRatio - h / 2}
                    width={w}
                    height={h}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={pw}
                    dash={[4, 4]}
                  />
                );
              }
              if (prim.type === 'circle') {
                const r = (prim.config.radius || 25) * zoomRatio;
                return (
                  <Circle
                    key={idx}
                    x={(prim.config.x || 0) * zoomRatio}
                    y={-(prim.config.y || 0) * zoomRatio}
                    radius={r}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={pw}
                    dash={[4, 4]}
                  />
                );
              }
              return null;
            })}
            <Circle radius={5} fill="#c084fc" />
          </Group>
        );
      }
    }

    if (!drawStart) {
      if (drawHover && drawingMode !== 'select') {
        const hpx = toPixelX(drawHover[0]);
        const hpy = toPixelY(drawHover[1]);
        return (
          <Group key="start_point_hover_preview">
            <Circle x={hpx} y={hpy} radius={4} fill="#06b6d4" opacity={0.8} />
            <Circle x={hpx} y={hpy} radius={8} stroke="#06b6d4" strokeWidth={1.5} dash={[3, 3]} opacity={0.6} />
          </Group>
        );
      }
      return null;
    }

    if (!drawHover) return null;

    const p1x = toPixelX(drawStart[0]);
    const p1y = toPixelY(drawStart[1]);

    if (drawingMode === 'draw_super_vector' || drawingMode === 'draw_super_line') {
      if (!superDrawEnd) {
        // Step 2: Placing End Point (straight line to hover)
        const p2x = toPixelX(drawHover[0]);
        const p2y = toPixelY(drawHover[1]);
        return (
          <Group key="super_preview_step1">
            {drawingMode === 'draw_super_vector' ? (
              <Arrow points={[p1x, p1y, p2x, p2y]} stroke="#f59e0b" fill="#f59e0b" strokeWidth={3} pointerLength={12} pointerWidth={12} dash={[4, 4]} />
            ) : (
              <Line points={[p1x, p1y, p2x, p2y]} stroke="#10b981" strokeWidth={3} dash={[4, 4]} />
            )}
            <Circle x={p1x} y={p1y} radius={5} fill="#f59e0b" />
          </Group>
        );
      } else {
        // Step 3: Placing Guidance Point (curved Bezier through hover)
        const p2x = toPixelX(superDrawEnd[0]);
        const p2y = toPixelY(superDrawEnd[1]);
        const hcx = toPixelX(drawHover[0]);
        const hcy = toPixelY(drawHover[1]);

        return (
          <Group key="super_preview_step2">
            <Line points={[p1x, p1y, hcx, hcy, p2x, p2y]} stroke="#f59e0b" strokeWidth={1} dash={[3, 3]} opacity={0.6} />
            {drawingMode === 'draw_super_vector' ? (
              <Arrow points={[p1x, p1y, hcx, hcy, p2x, p2y]} bezier stroke="#f59e0b" fill="#f59e0b" strokeWidth={3} pointerLength={12} pointerWidth={12} dash={[4, 4]} />
            ) : (
              <Line points={[p1x, p1y, hcx, hcy, p2x, p2y]} bezier stroke="#10b981" strokeWidth={3} dash={[4, 4]} />
            )}
            <Circle x={p1x} y={p1y} radius={5} fill="#f59e0b" />
            <Circle x={p2x} y={p2y} radius={5} fill="#38bdf8" />
            <Rect x={hcx - 4} y={hcy - 4} width={8} height={8} fill="#f59e0b" />
          </Group>
        );
      }
    }

    const p2x = toPixelX(drawHover[0]);
    const p2y = toPixelY(drawHover[1]);

    return (
      <Group key="drawing_preview">
        {drawingMode === 'draw_vector' ? (
          <Arrow
            points={[p1x, p1y, p2x, p2y]}
            stroke="#ef4444"
            fill="#ef4444"
            strokeWidth={3}
            pointerLength={12}
            pointerWidth={12}
            dash={[4, 4]}
          />
        ) : (
          <Line
            points={[p1x, p1y, p2x, p2y]}
            stroke="#38bdf8"
            strokeWidth={3}
            dash={[4, 4]}
          />
        )}
        <Circle x={p1x} y={p1y} radius={5} fill="#ef4444" />
      </Group>
    );
  };

  return (
    <div
      className="relative w-full h-full overflow-hidden select-none transition-colors"
      style={{ backgroundColor: bgColor }}
      ref={containerRef}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Zoom & Canvas Controls Overlay */}
      <div className="absolute top-4 left-4 z-30 bg-slate-900/90 backdrop-blur border border-slate-700/80 rounded-xl p-2.5 flex items-center gap-3 shadow-xl text-xs font-semibold text-slate-200">
        <span>Scale:</span>
        <button
          onClick={() => setScale((s) => Math.max(10, s - 5))}
          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-200"
        >
          -
        </button>
        <span className="w-16 text-center text-indigo-400 font-mono">{scale} px/unit</span>
        <button
          onClick={() => setScale((s) => Math.min(260, s + 5))}
          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-200"
        >
          +
        </button>

        <button
          onClick={() => {
            setPanOffset({ x: 0, y: 0 });
            setScale(40);
          }}
          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 text-[11px]"
        >
          Recenter
        </button>

        {/* Canvas Grid Switcher */}
        <button
          onClick={() => setShowKonvaGrid((g) => !g)}
          className={`px-2.5 py-1 rounded text-[11px] font-medium transition ${
            showKonvaGrid ? 'bg-slate-800 hover:bg-slate-700 text-indigo-400 font-semibold' : 'bg-slate-800/60 text-slate-500 hover:text-slate-300'
          }`}
          title="Toggle interactive Konva stage grid overlay"
        >
          Stage Grid: {showKonvaGrid ? 'ON' : 'OFF'}
        </button>

        {/* Paper Theme Switcher */}
        <button
          onClick={() => setCanvasBgTheme((t) => (t === 'light' ? 'dark' : 'light'))}
          className="flex items-center gap-1 px-2.5 py-1 bg-indigo-600/80 hover:bg-indigo-600 text-white rounded text-[11px] font-medium transition"
        >
          {isLight ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5 text-amber-300" />}
          <span>{isLight ? 'Dark Mode' : 'Light Paper'}</span>
        </button>

        {mode === 'robot_designer' && polyVertices.length >= 3 && (
          <button
            onClick={handleFinishPolygon}
            className="flex items-center gap-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-bold transition shadow-lg animate-pulse"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Finish Polygon ({polyVertices.length} pts)</span>
          </button>
        )}

        {megaPoints.length >= 2 && (
          <button
            onClick={handleFinishMegaLine}
            className="flex items-center gap-1 px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-[11px] font-bold transition shadow-lg animate-pulse"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Finish Mega Line ({megaPoints.length} pts)</span>
          </button>
        )}

        <div className="text-[10px] text-slate-400 border-l border-slate-700/80 pl-3 space-x-2">
          <span>💡 <b>Mouse Wheel</b> Zoom</span>
          <span>• <b>Middle Click Drag</b> Pan Canvas</span>
          <span>• <b>Double Click</b> Add Text</span>
          <span>• <b>Hold Ctrl</b> Multi-Select / Lock 45°</span>
        </div>
      </div>

      {/* Quick Edit Setting Bar (Second Row right below Scale/Recenter bar) */}
      <div className="absolute top-16 left-4 z-30 bg-slate-900/95 backdrop-blur border border-slate-700/90 rounded-xl p-2.5 flex items-center gap-3.5 shadow-2xl text-xs text-slate-200">
        <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider px-1">Quick Edit:</span>
        {(() => {
          const selectedNode = scene.find((n) => n.id === selectedNodeId) || (selectedNodeIds.length > 0 ? scene.find((n) => n.id === selectedNodeIds[0]) : null);
          if (!selectedNode) {
            return <span className="text-[11px] text-slate-400 italic">Select an entity on stage to quick-edit colors, stroke style, and font size</span>;
          }

          const applyColorPreset = (color: string, fillColor: string) => {
            const targets = selectedNodeIds.length > 0 ? scene.filter((n) => selectedNodeIds.includes(n.id)) : [selectedNode];
            const updated = targets.map((n) => ({
              ...n,
              style: { ...n.style, color, fillColor },
            }));
            if (onUpdateNodes) onUpdateNodes(updated);
            else updated.forEach(onUpdateNode);
          };

          const applyStrokeStyle = (strokeStyle: 'solid' | 'dashed' | 'dashdot') => {
            const targets = selectedNodeIds.length > 0 ? scene.filter((n) => selectedNodeIds.includes(n.id)) : [selectedNode];
            const updated = targets.map((n) => ({
              ...n,
              style: { ...n.style, strokeStyle },
            }));
            if (onUpdateNodes) onUpdateNodes(updated);
            else updated.forEach(onUpdateNode);
          };

          const applyFontSize = (fontSize: number) => {
            const targets = selectedNodeIds.length > 0 ? scene.filter((n) => selectedNodeIds.includes(n.id)) : [selectedNode];
            const updated = targets.map((n) => ({
              ...n,
              fontSize,
            }));
            if (onUpdateNodes) onUpdateNodes(updated);
            else updated.forEach(onUpdateNode);
          };

          const applyLineShape = (lineShape: 'straight' | 'curve') => {
            const targets = selectedNodeIds.length > 0 ? scene.filter((n) => selectedNodeIds.includes(n.id)) : [selectedNode];
            const updated = targets.map((n) => ({
              ...n,
              lineShape,
            }));
            if (onUpdateNodes) onUpdateNodes(updated);
            else updated.forEach(onUpdateNode);
          };

          const applyEdgeSnapPoints = (pts: number) => {
            const targets = selectedNodeIds.length > 0 ? scene.filter((n) => selectedNodeIds.includes(n.id)) : [selectedNode];
            const updated = targets.map((n) => ({
              ...n,
              edgeSnapPoints: Math.max(1, Math.min(6, pts)),
            }));
            if (onUpdateNodes) onUpdateNodes(updated);
            else updated.forEach(onUpdateNode);
          };

          const applyTextAlign = (textAlign: 'left' | 'center' | 'right') => {
            const targets = selectedNodeIds.length > 0 ? scene.filter((n) => selectedNodeIds.includes(n.id)) : [selectedNode];
            const updated = targets.map((n) => ({
              ...n,
              textAlign,
            }));
            if (onUpdateNodes) onUpdateNodes(updated);
            else updated.forEach(onUpdateNode);
          };

          const curFontSize = selectedNode.fontSize || fontSizePresets.med;
          const curStrokeStyle = selectedNode.style?.strokeStyle || 'solid';
          const curTextAlign = selectedNode.textAlign || 'left';
          const isLineFamily = selectedNode.type === 'vector' || selectedNode.type === 'line' || selectedNode.type === 'super_vector' || selectedNode.type === 'super_line' || selectedNode.type === 'mega_vector' || selectedNode.type === 'mega_line';
          const isShapeFamily = selectedNode.type === 'rect' || selectedNode.type === 'circle' || selectedNode.type === 'triangle' || selectedNode.type === 'diamond' || selectedNode.type === 'obstacle';

          return (
            <>
              {/* 5 Color Presets */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-400 font-semibold">Color:</span>
                <button
                  title="Black / White Preset"
                  onClick={() => applyColorPreset('#000000', '#ffffff')}
                  className="w-5 h-5 rounded border border-slate-600 bg-white shadow hover:scale-110 transition flex items-center justify-center text-[9px] font-bold text-black"
                >
                  B/W
                </button>
                <button
                  title="Red Preset"
                  onClick={() => applyColorPreset('#ef4444', '#fee2e2')}
                  className="w-5 h-5 rounded border border-red-500 bg-red-100 hover:scale-110 transition flex items-center justify-center"
                >
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                </button>
                <button
                  title="Blue Preset"
                  onClick={() => applyColorPreset('#3b82f6', '#dbeafe')}
                  className="w-5 h-5 rounded border border-blue-500 bg-blue-100 hover:scale-110 transition flex items-center justify-center"
                >
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                </button>
                <button
                  title="Yellow / Amber Preset"
                  onClick={() => applyColorPreset('#f59e0b', '#fef3c7')}
                  className="w-5 h-5 rounded border border-amber-500 bg-amber-100 hover:scale-110 transition flex items-center justify-center"
                >
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                </button>
                <button
                  title="Green Preset"
                  onClick={() => applyColorPreset('#10b981', '#d1fae5')}
                  className="w-5 h-5 rounded border border-emerald-500 bg-emerald-100 hover:scale-110 transition flex items-center justify-center"
                >
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                </button>
              </div>

              <div className="h-4 w-px bg-slate-700/80 mx-0.5" />

              {/* Text Alignment Selector */}
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-slate-400 font-semibold font-sans">Align:</span>
                <button
                  type="button"
                  onClick={() => applyTextAlign('left')}
                  className={`p-1 rounded transition ${
                    curTextAlign === 'left' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                  title="Align Left"
                >
                  <AlignLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => applyTextAlign('center')}
                  className={`p-1 rounded transition ${
                    (curTextAlign || 'center') === 'center' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                  title="Align Middle / Center (Default)"
                >
                  <AlignCenter className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => applyTextAlign('right')}
                  className={`p-1 rounded transition ${
                    curTextAlign === 'right' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                  title="Align Right"
                >
                  <AlignRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="h-4 w-px bg-slate-700/80 mx-0.5" />

              {/* Stroke Style Selector */}
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-slate-400 font-semibold">Stroke:</span>
                <button
                  onClick={() => applyStrokeStyle('solid')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                    curStrokeStyle === 'solid' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  Solid
                </button>
                <button
                  onClick={() => applyStrokeStyle('dashed')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                    curStrokeStyle === 'dashed' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  Dashed
                </button>
                <button
                  onClick={() => applyStrokeStyle('dashdot')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                    curStrokeStyle === 'dashdot' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  DashDot
                </button>
              </div>

              {isLineFamily && (
                <>
                  <div className="h-4 w-px bg-slate-700/80 mx-0.5" />
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-400 font-semibold">Line:</span>
                    <button
                      onClick={() => applyLineShape('straight')}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                        selectedNode.lineShape !== 'curve' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      Straight
                    </button>
                    <button
                      onClick={() => applyLineShape('curve')}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                        selectedNode.lineShape === 'curve' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      Curve
                    </button>
                  </div>
                </>
              )}

              {isShapeFamily && (
                <>
                  <div className="h-4 w-px bg-slate-700/80 mx-0.5" />
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-400 font-semibold font-sans">Snap Pts:</span>
                    <button
                      onClick={() => applyEdgeSnapPoints(Math.max(1, (selectedNode.edgeSnapPoints ?? 3) - 1))}
                      className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-200 font-bold text-xs"
                    >
                      -
                    </button>
                    <span className="font-mono text-indigo-400 font-bold min-w-[18px] text-center text-xs">
                      {selectedNode.edgeSnapPoints ?? 3}
                    </span>
                    <button
                      onClick={() => applyEdgeSnapPoints(Math.min(6, (selectedNode.edgeSnapPoints ?? 3) + 1))}
                      className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-200 font-bold text-xs"
                    >
                      +
                    </button>
                  </div>
                </>
              )}

              <div className="h-4 w-px bg-slate-700/80 mx-0.5" />

              {/* Font Size Steppers & Presets */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-400 font-semibold font-sans">Font Size:</span>
                <button
                  onClick={() => applyFontSize(Math.max(6, curFontSize - 1))}
                  className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-200 font-bold text-xs"
                >
                  -
                </button>
                <span className="font-mono text-emerald-400 font-bold min-w-[32px] text-center text-xs">
                  {curFontSize}pt
                </span>
                <button
                  onClick={() => applyFontSize(Math.min(60, curFontSize + 1))}
                  className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-200 font-bold text-xs"
                >
                  +
                </button>

                <div className="flex items-center gap-1 ml-1">
                  <button
                    onClick={() => applyFontSize(fontSizePresets.small)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                      curFontSize === fontSizePresets.small ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    Small ({fontSizePresets.small})
                  </button>
                  <button
                    onClick={() => applyFontSize(fontSizePresets.med)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                      curFontSize === fontSizePresets.med ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    Med ({fontSizePresets.med})
                  </button>
                  <button
                    onClick={() => applyFontSize(fontSizePresets.large)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                      curFontSize === fontSizePresets.large ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    Large ({fontSizePresets.large})
                  </button>
                </div>
              </div>
            </>
          );
        })()}
      </div>

      {/* Advanced Transforms Toolbar Row (Second Row right below Quick Edit bar) */}
      {(() => {
        const selectedNode = scene.find((n) => n.id === selectedNodeId) || (selectedNodeIds.length > 0 ? scene.find((n) => n.id === selectedNodeIds[0]) : null);
        if (!selectedNode) return null;

        const isVectorType = selectedNode.type === 'vector' || selectedNode.type === 'super_vector' || selectedNode.type === 'mega_vector';
        const isLineType = selectedNode.type === 'line' || selectedNode.type === 'super_line' || selectedNode.type === 'mega_line';
        const isLineFamily = isVectorType || isLineType;

        const toggleVectorLineType = () => {
          const targets = selectedNodeIds.length > 0 ? scene.filter((n) => selectedNodeIds.includes(n.id)) : [selectedNode];
          const typeMap: Record<string, SceneNode['type']> = {
            vector: 'line',
            line: 'vector',
            super_vector: 'super_line',
            super_line: 'super_vector',
            mega_vector: 'mega_line',
            mega_line: 'mega_vector',
          };

          const updated = targets.map((n) => {
            if (typeMap[n.type]) {
              return {
                ...n,
                type: typeMap[n.type],
              };
            }
            return n;
          });

          if (onUpdateNodes) onUpdateNodes(updated);
          else updated.forEach(onUpdateNode);
        };

        const updateSceneOrder = (newScene: SceneNode[]) => {
          if (onUpdateScene) {
            onUpdateScene(newScene);
          } else if (onUpdateNodes) {
            onUpdateNodes(newScene);
          }
        };

        const moveLayerTop = () => {
          const targetIds = selectedNodeIds.length > 0 ? selectedNodeIds : [selectedNode.id];
          const remaining = scene.filter((n) => !targetIds.includes(n.id));
          const selected = scene.filter((n) => targetIds.includes(n.id));
          updateSceneOrder([...remaining, ...selected]);
        };

        const moveLayerBot = () => {
          const targetIds = selectedNodeIds.length > 0 ? selectedNodeIds : [selectedNode.id];
          const remaining = scene.filter((n) => !targetIds.includes(n.id));
          const selected = scene.filter((n) => targetIds.includes(n.id));
          updateSceneOrder([...selected, ...remaining]);
        };

        const moveLayerInc = () => {
          const targetIds = selectedNodeIds.length > 0 ? selectedNodeIds : [selectedNode.id];
          const newScene = [...scene];
          for (let i = newScene.length - 2; i >= 0; i--) {
            if (targetIds.includes(newScene[i].id) && !targetIds.includes(newScene[i + 1].id)) {
              const temp = newScene[i];
              newScene[i] = newScene[i + 1];
              newScene[i + 1] = temp;
            }
          }
          updateSceneOrder(newScene);
        };

        const moveLayerDec = () => {
          const targetIds = selectedNodeIds.length > 0 ? selectedNodeIds : [selectedNode.id];
          const newScene = [...scene];
          for (let i = 1; i < newScene.length; i++) {
            if (targetIds.includes(newScene[i].id) && !targetIds.includes(newScene[i - 1].id)) {
              const temp = newScene[i];
              newScene[i] = newScene[i - 1];
              newScene[i - 1] = temp;
            }
          }
          updateSceneOrder(newScene);
        };

        const straightenSelectedNodes = () => {
          const targetIds = selectedNodeIds.length > 0 ? selectedNodeIds : (selectedNode ? [selectedNode.id] : []);
          if (targetIds.length === 0) return;

          const targetNodes = scene.filter((n) => targetIds.includes(n.id));
          const nodeMap = new Map<string, SceneNode>();
          scene.forEach((n) => nodeMap.set(n.id, { ...n }));

          // 1. Strict Co-linear Shape Alignment (ONLY for shapes explicitly selected by user)
          const shapes = targetNodes.filter(
            (n) => n.type === 'rect' || n.type === 'circle' || n.type === 'triangle' || n.type === 'diamond' || n.type === 'obstacle' || n.type === 'alias'
          );

          const clusterThreshold = 0.35; // scientific units (strict threshold for explicitly selected shapes)

          if (shapes.length > 1) {
            // Align Y (horizontal rows)
            const yClusters: SceneNode[][] = [];
            shapes.forEach((s) => {
              let found = false;
              for (const cl of yClusters) {
                const avgY = cl.reduce((acc, n) => acc + n.y, 0) / cl.length;
                if (Math.abs(s.y - avgY) <= clusterThreshold) {
                  cl.push(s);
                  found = true;
                  break;
                }
              }
              if (!found) yClusters.push([s]);
            });

            yClusters.forEach((cl) => {
              if (cl.length > 1) {
                const avgY = Math.round((cl.reduce((acc, n) => acc + n.y, 0) / cl.length) * 100) / 100;
                cl.forEach((s) => {
                  const mapped = nodeMap.get(s.id);
                  if (mapped) nodeMap.set(s.id, { ...mapped, y: avgY });
                });
              }
            });

            // Align X (vertical columns)
            const xClusters: SceneNode[][] = [];
            shapes.forEach((s) => {
              let found = false;
              for (const cl of xClusters) {
                const avgX = cl.reduce((acc, n) => acc + n.x, 0) / cl.length;
                if (Math.abs(s.x - avgX) <= clusterThreshold) {
                  cl.push(s);
                  found = true;
                  break;
                }
              }
              if (!found) xClusters.push([s]);
            });

            xClusters.forEach((cl) => {
              if (cl.length > 1) {
                const avgX = Math.round((cl.reduce((acc, n) => acc + n.x, 0) / cl.length) * 100) / 100;
                cl.forEach((s) => {
                  const mapped = nodeMap.get(s.id);
                  if (mapped) nodeMap.set(s.id, { ...mapped, x: avgX });
                });
              }
            });
          }

          // 2. Line & Vector Orthogonalization (Sub-segment Beautification with Fixed Shape Anchors)
          targetNodes.forEach((n) => {
            const node = nodeMap.get(n.id) || n;
            if (node.type === 'vector' || node.type === 'line') {
              const pts = node.points || [0, 0, 3, 2];
              let dx1 = pts[0];
              let dy1 = pts[1];
              let dx2 = pts[2];
              let dy2 = pts[3];

              const absX1 = node.x + dx1;
              const absY1 = node.y + dy1;
              const absX2 = node.x + dx2;
              const absY2 = node.y + dy2;

              const deltaX = Math.abs(absX2 - absX1);
              const deltaY = Math.abs(absY2 - absY1);

              let newDx2 = dx2;
              let newDy2 = dy2;

              if (deltaX > deltaY) {
                // Horizontal (set end Y to match start Y)
                newDy2 = dy1;
              } else {
                // Vertical (set end X to match start X)
                newDx2 = dx1;
              }

              nodeMap.set(n.id, {
                ...node,
                points: [dx1, dy1, newDx2, newDy2],
              });
            } else if (node.type === 'super_vector' || node.type === 'super_line') {
              const pts = node.points || [0, 0, 3, 2];
              let dx1 = pts[0];
              let dy1 = pts[1];
              let dx2 = pts[2];
              let dy2 = pts[3];

              const cp = node.controlPoint || [(dx1 + dx2) / 2, (dy1 + dy2) / 2];
              let cx = cp[0];
              let cy = cp[1];

              // Segment 1: P1 (dx1, dy1) -> Pc (cx, cy)
              const dX1 = Math.abs(cx - dx1);
              const dY1 = Math.abs(cy - dy1);
              if (dX1 > dY1) {
                cy = dy1; // Segment 1 is horizontal
              } else {
                cx = dx1; // Segment 1 is vertical
              }

              // Segment 2: Pc (cx, cy) -> P2 (dx2, dy2)
              const dX2 = Math.abs(dx2 - cx);
              const dY2 = Math.abs(dy2 - cy);
              if (dX2 > dY2) {
                dy2 = cy; // Segment 2 is horizontal
              } else {
                dx2 = cx; // Segment 2 is vertical
              }

              nodeMap.set(n.id, {
                ...node,
                points: [dx1, dy1, dx2, dy2],
                controlPoint: [cx, cy],
              });
            } else if (node.type === 'mega_vector' || node.type === 'mega_line') {
              const pts = [...(node.points || [0, 0, 3, 2])];
              for (let i = 0; i < pts.length - 3; i += 2) {
                const x1 = pts[i];
                const y1 = pts[i + 1];
                const x2 = pts[i + 2];
                const y2 = pts[i + 3];

                const dX = Math.abs(x2 - x1);
                const dY = Math.abs(y2 - y1);

                if (dX > dY) {
                  pts[i + 3] = y1;
                } else {
                  pts[i + 2] = x1;
                }
              }

              nodeMap.set(n.id, {
                ...node,
                points: pts,
              });
            }
          });

          // 3. Re-sync bindings for all modified nodes in scene
          let updatedScene = scene.map((n) => nodeMap.get(n.id) || n);
          const allModifiedNodes = Array.from(nodeMap.values());
          updatedScene = syncBoundNodesForGroup(updatedScene, allModifiedNodes);

          // 4. Post-sync Alignment & Orthogonalization for Vector / Line, Super Vector / Line, and Mega Vector / Line
          // After syncBoundNodesForGroup settles node.x, node.y and bound shape snap points:
          updatedScene = updatedScene.map((n) => {
            if (!targetIds.includes(n.id)) return n;

            if (n.type === 'vector' || n.type === 'line') {
              const pts = [...(n.points || [0, 0, 3, 2])];
              let dx1 = pts[0];
              let dy1 = pts[1];
              let dx2 = pts[2];
              let dy2 = pts[3];

              const absX1 = n.x + dx1;
              const absY1 = n.y + dy1;
              const absX2 = n.x + dx2;
              const absY2 = n.y + dy2;

              const deltaX = Math.abs(absX2 - absX1);
              const deltaY = Math.abs(absY2 - absY1);

              if (deltaX > deltaY) {
                // Horizontal line: match Y coordinates
                if (n.endBinding && !n.startBinding) {
                  // End is bound to shape snap Y -> adjust unbound start Y (dy1)
                  dy1 = dy2;
                } else {
                  // Start is bound or neither is bound -> adjust end Y (dy2)
                  dy2 = dy1;
                }
              } else {
                // Vertical line: match X coordinates
                if (n.endBinding && !n.startBinding) {
                  // End is bound to shape snap X -> adjust unbound start X (dx1)
                  dx1 = dx2;
                } else {
                  // Start is bound or neither is bound -> adjust end X (dx2)
                  dx2 = dx1;
                }
              }

              return {
                ...n,
                points: [dx1, dy1, dx2, dy2],
              };
            }

            if (n.type === 'super_vector' || n.type === 'super_line') {
              const pts = n.points || [0, 0, 3, 2];
              const dx1 = pts[0];
              const dy1 = pts[1];
              const dx2 = pts[2];
              const dy2 = pts[3];
              const cp = n.controlPoint || [(dx1 + dx2) / 2, (dy1 + dy2) / 2];

              // Orientation A: (dx2, dy1) -> Seg 1 horizontal, Seg 2 vertical
              const distA = Math.hypot(cp[0] - dx2, cp[1] - dy1);
              // Orientation B: (dx1, dy2) -> Seg 1 vertical, Seg 2 horizontal
              const distB = Math.hypot(cp[0] - dx1, cp[1] - dy2);

              let cx = cp[0];
              let cy = cp[1];

              if (distA <= distB) {
                cx = dx2;
                cy = dy1;
              } else {
                cx = dx1;
                cy = dy2;
              }

              return {
                ...n,
                controlPoint: [cx, cy],
              };
            }

            if (n.type === 'mega_vector' || n.type === 'mega_line') {
              const pts = [...(n.points || [0, 0, 3, 2])];
              const megaBindings = n.megaBindings || {};
              for (let i = 0; i < pts.length - 3; i += 2) {
                const idx1 = i / 2;
                const idx2 = (i + 2) / 2;
                const isBound1 = !!megaBindings[idx1];
                const isBound2 = !!megaBindings[idx2];

                const x1 = pts[i];
                const y1 = pts[i + 1];
                const x2 = pts[i + 2];
                const y2 = pts[i + 3];

                const dX = Math.abs(x2 - x1);
                const dY = Math.abs(y2 - y1);

                if (dX > dY) {
                  // Horizontal segment
                  if (isBound2 && !isBound1) {
                    pts[i + 1] = y2;
                  } else {
                    pts[i + 3] = y1;
                  }
                } else {
                  // Vertical segment
                  if (isBound2 && !isBound1) {
                    pts[i] = x2;
                  } else {
                    pts[i + 2] = x1;
                  }
                }
              }

              return {
                ...n,
                points: pts,
              };
            }

            return n;
          });

          if (onUpdateScene) {
            onUpdateScene(updatedScene);
          } else if (onUpdateNodes) {
            onUpdateNodes(updatedScene);
          }
        };

        return (
          <div className="absolute top-28 left-4 z-30 bg-slate-900/95 backdrop-blur border border-slate-700/90 rounded-xl p-2 flex items-center gap-3 shadow-2xl text-xs text-slate-200">
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider px-1">Transforms:</span>

            {isLineFamily ? (
              <button
                onClick={toggleVectorLineType}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded text-[11px] font-bold transition shadow"
                title="Convert between Line (no arrow) and Vector (with arrowhead)"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>{isVectorType ? '⇄ Convert to Line' : '⇄ Convert to Vector'}</span>
              </button>
            ) : (
              <button
                disabled
                className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 text-slate-500 border border-slate-700 rounded text-[11px] font-medium cursor-not-allowed opacity-60"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>⇄ To Line / Vector</span>
              </button>
            )}

            {/* Straighten (Ortho Align) Action Button */}
            <button
              onClick={straightenSelectedNodes}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-600/80 hover:bg-emerald-600 text-white rounded text-[11px] font-bold transition shadow"
              title="Straighten selected lines/vectors to 90° axes and auto-align shape rows/columns"
            >
              <Wand2 className="w-3.5 h-3.5 text-emerald-200" />
              <span>⚡ Straighten</span>
            </button>

            <div className="h-4 w-px bg-slate-700/80 mx-0.5" />

            <div className="flex items-center gap-1">
              <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-0.5 pr-0.5">
                <Layers className="w-3 h-3 text-indigo-400" />
                Layer:
              </span>
              <button
                onClick={moveLayerTop}
                className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] font-bold transition"
                title="Top Lyer (Move to Front / Foreground)"
              >
                <ChevronsUp className="w-3.5 h-3.5 text-indigo-400" />
                <span>Top Lyer</span>
              </button>
              <button
                onClick={moveLayerInc}
                className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] font-bold transition"
                title="Inc Lyer (Move Up 1 Position)"
              >
                <ChevronUp className="w-3.5 h-3.5 text-indigo-400" />
                <span>Inc Lyer</span>
              </button>
              <button
                onClick={moveLayerDec}
                className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] font-bold transition"
                title="Dec Lyer (Move Down 1 Position)"
              >
                <ChevronDown className="w-3.5 h-3.5 text-indigo-400" />
                <span>Dec Lyer</span>
              </button>
              <button
                onClick={moveLayerBot}
                className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] font-bold transition"
                title="Bot Lyer (Move to Back / Background)"
              >
                <ChevronsDown className="w-3.5 h-3.5 text-indigo-400" />
                <span>Bot Lyer</span>
              </button>
            </div>
          </div>
        );
      })()}

      <Stage
        width={dimensions.width}
        height={dimensions.height}
        ref={stageRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => setActiveSnapPreview(null)}
        onClick={handleStageClick}
      >
        <Layer>
          <Rect
            name="bg_rect"
            x={0}
            y={0}
            width={dimensions.width}
            height={dimensions.height}
            fill={bgColor}
          />

          {renderGrid()}

          {mode === 'main_scene' ? (
            <>
              {renderExportBounds()}
              {/* Base Layer: All scene node bodies in natural layer stack order */}
              {scene.map((node) => renderSceneNode(node, 'body'))}

              {/* Top Overlay Layer: Selection handles & guidance points of focused/selected node on top */}
              {scene
                .filter((node) => selectedNodeIds.includes(node.id) || node.id === selectedNodeId)
                .map((node) => renderSceneNode(node, 'handles'))}
              {renderInteractiveDrawingPreview()}
              {rightDragStart && rightDragEnd && (
                <Rect
                  x={Math.min(rightDragStart.x, rightDragEnd.x)}
                  y={Math.min(rightDragStart.y, rightDragEnd.y)}
                  width={Math.abs(rightDragStart.x - rightDragEnd.x)}
                  height={Math.abs(rightDragStart.y - rightDragEnd.y)}
                  fill="rgba(168, 85, 247, 0.15)"
                  stroke="#a855f7"
                  strokeWidth={1}
                  dash={[4, 4]}
                />
              )}
            </>
          ) : (
            <>
              {renderRobotDesignerPrimitives()}
              {renderInteractiveDrawingPreview()}
              {rightDragStart && rightDragEnd && (
                <Rect
                  x={Math.min(rightDragStart.x, rightDragEnd.x)}
                  y={Math.min(rightDragStart.y, rightDragEnd.y)}
                  width={Math.abs(rightDragStart.x - rightDragEnd.x)}
                  height={Math.abs(rightDragStart.y - rightDragEnd.y)}
                  fill="rgba(236, 72, 153, 0.15)"
                  stroke="#ec4899"
                  strokeWidth={1}
                  dash={[4, 4]}
                />
              )}
            </>
          )}

          {/* Guidance Point Snapping Indicator Preview */}
          {activeSnapPreview && (() => {
            const isShapeSnap = activeSnapPreview.type === 'shape';
            const color = isShapeSnap ? '#ef4444' : '#10b981'; // Red for Shape Snap, Emerald Green for Grid Snap
            return (
              <Group x={toPixelX(activeSnapPreview.sciX)} y={toPixelY(activeSnapPreview.sciY)} key="snap_preview_indicator">
                <Circle radius={4} fill={color} opacity={0.9} />
                <Circle radius={10} stroke={color} strokeWidth={1.5} dash={[3, 3]} opacity={0.8} />
              </Group>
            );
          })()}
        </Layer>
      </Stage>

      {/* KaTeX Live Math Mode HTML Overlay */}
      {(plotOptions?.renderMathOnCanvas ?? true) && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-10">
          {scene
            .filter((node) => node.label && node.label.trim())
            .map((node) => {
              const isShape = node.type === 'rect' || node.type === 'circle' || node.type === 'triangle' || node.type === 'diamond' || node.type === 'obstacle' || node.type === 'text' || node.type === 'alias';
              const defaultOffX = isShape ? 0.0 : 0.3;
              const defaultOffY = isShape ? 0.0 : 0.3;
              const nodeScale = node.scale || 1.0;
              const lox = (node.labelOffsetX ?? defaultOffX) * scale * nodeScale;
              const loy = -(node.labelOffsetY ?? defaultOffY) * scale * nodeScale;
              const labelPx = toPixelX(node.x) + lox;
              const labelPy = toPixelY(node.y) + loy;

              const baseFSize = node.fontSize || 12;
              const scaleWithZoom = plotOptions?.scaleLabelsWithZoom ?? false;
              const defaultScale = 72;
              const fSize = scaleWithZoom ? Math.max(8, Math.round(baseFSize * (scale / defaultScale))) : baseFSize;

              const trueTextColor = node.labelTextColor || node.style.color || (canvasBgTheme === 'light' ? '#0f172a' : '#f8fafc');
              const boxOpacity = plotOptions?.labelBoxOpacity ?? 0.0;
              const isTransparent = node.labelFillTransparent ?? (boxOpacity === 0.0);
              const bgOpacity = isTransparent ? boxOpacity : 0.85;
              const bgColor = node.labelFillColor || (canvasBgTheme === 'light' ? '#ffffff' : '#1e293b');

              const renderedHtml = renderLatexToHtml(node.label || '', macros);
              const isSelected = selectedNodeId === node.id || selectedNodeIds.includes(node.id);
              const align = node.textAlign || 'center';

              return (
                <div
                  key={`math_label_${node.id}`}
                  className={`math-label-container absolute pointer-events-auto select-none flex flex-col ${
                    align === 'left' ? 'items-start text-left' : align === 'right' ? 'items-end text-right' : 'items-center text-center'
                  } ${
                    isSelected ? 'cursor-move ring-1 ring-purple-400/60' : 'cursor-pointer hover:ring-1 hover:ring-slate-400/40'
                  }`}
                  style={{
                    left: `${labelPx}px`,
                    top: `${labelPy}px`,
                    transform: 'translate(-50%, -50%)',
                    textAlign: align,
                    lineHeight: 1.15,
                    fontSize: `${fSize}px`,
                    color: trueTextColor,
                    backgroundColor: bgOpacity > 0 ? bgColor : 'transparent',
                    opacity: 1.0,
                    padding: '2px 4px',
                    borderRadius: '4px',
                  }}
                  onPointerDown={(e) => {
                    if (drawingMode !== 'select') return;
                    if (e.button !== 0) return;
                    e.stopPropagation();

                    const startPointerX = e.clientX;
                    const startPointerY = e.clientY;
                    const initX = node.x;
                    const initY = node.y;
                    const initOffX = node.labelOffsetX ?? defaultOffX;
                    const initOffY = node.labelOffsetY ?? defaultOffY;
                    const targetEl = e.currentTarget as HTMLDivElement;
                    let hasDragged = false;
                    let lastDx = 0;
                    let lastDy = 0;

                    const handlePointerMove = (moveEvt: PointerEvent) => {
                      const dx = moveEvt.clientX - startPointerX;
                      const dy = moveEvt.clientY - startPointerY;
                      if (!hasDragged && Math.hypot(dx, dy) > 3) {
                        hasDragged = true;
                      }
                      if (hasDragged) {
                        lastDx = dx;
                        lastDy = dy;
                        targetEl.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
                      }
                    };

                    const handlePointerUp = (upEvt: PointerEvent) => {
                      window.removeEventListener('pointermove', handlePointerMove);
                      window.removeEventListener('pointerup', handlePointerUp);

                      if (hasDragged) {
                        targetEl.style.transform = 'translate(-50%, -50%)';
                        if (node.type === 'text') {
                          const newX = Math.round((initX + lastDx / scale) * 100) / 100;
                          const newY = Math.round((initY - lastDy / scale) * 100) / 100;
                          onUpdateNode({
                            ...node,
                            x: newX,
                            y: newY,
                            labelOffsetX: 0,
                            labelOffsetY: 0,
                          });
                        } else {
                          const newOffX = Math.round((initOffX + lastDx / (scale * nodeScale)) * 100) / 100;
                          const newOffY = Math.round((initOffY - lastDy / (scale * nodeScale)) * 100) / 100;
                          onUpdateNode({
                            ...node,
                            labelOffsetX: newOffX,
                            labelOffsetY: newOffY,
                          });
                        }
                      } else {
                        const now = Date.now();
                        const isDoubleClick = lastLabelClickRef.current.id === node.id && (now - lastLabelClickRef.current.time) < 400;
                        lastLabelClickRef.current = { id: node.id, time: now };

                        if (isDoubleClick) {
                          popoverOpenedAtRef.current = Date.now();
                          setEditingLabelNodeId(node.id);
                        } else {
                          if (upEvt.ctrlKey || upEvt.metaKey) {
                            if (selectedNodeIds.includes(node.id)) {
                              const newIds = selectedNodeIds.filter((id) => id !== node.id);
                              onSelectNodes(newIds);
                              onSelectNode(newIds.length > 0 ? newIds[newIds.length - 1] : null);
                            } else {
                              const newIds = [...selectedNodeIds, node.id];
                              onSelectNodes(newIds);
                              onSelectNode(node.id);
                            }
                          } else {
                            onSelectNode(node.id);
                            onSelectNodes([node.id]);
                          }
                        }
                      }
                    };

                    window.addEventListener('pointermove', handlePointerMove);
                    window.addEventListener('pointerup', handlePointerUp);
                  }}
                  onDoubleClick={(e) => {
                    if (drawingMode === 'select') {
                      e.stopPropagation();
                      popoverOpenedAtRef.current = Date.now();
                      setEditingLabelNodeId(node.id);
                    }
                  }}
                  dangerouslySetInnerHTML={{ __html: renderedHtml }}
                />
              );
            })}
        </div>
      )}

      {/* Double Click Floating Label Editor Popover */}
      {editingLabelNodeId && (() => {
        const targetNode = scene.find((n) => n.id === editingLabelNodeId);
        if (!targetNode) return null;
        const isShape = targetNode.type === 'rect' || targetNode.type === 'circle' || targetNode.type === 'triangle' || targetNode.type === 'diamond' || targetNode.type === 'obstacle' || targetNode.type === 'text' || targetNode.type === 'alias';
        const defaultOffX = isShape ? 0.0 : 0.3;
        const defaultOffY = isShape ? 0.0 : 0.3;
        const nodeScale = targetNode.scale || 1.0;
        const lox = (targetNode.labelOffsetX ?? defaultOffX) * scale * nodeScale;
        const loy = -(targetNode.labelOffsetY ?? defaultOffY) * scale * nodeScale;
        const px = toPixelX(targetNode.x) + lox;
        const py = toPixelY(targetNode.y) + loy - 50;

        return (
          <div
            ref={popoverContainerRef}
            className="absolute z-50 transform -translate-x-1/2 bg-slate-900/95 backdrop-blur border border-indigo-500 rounded-xl p-2.5 shadow-2xl flex flex-col gap-2 text-xs text-white"
            style={{
              left: Math.max(130, Math.min(px, dimensions.width - 140)),
              top: Math.max(20, Math.min(py, dimensions.height - 130)),
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-indigo-400 font-bold whitespace-nowrap">Edit Label (Shift+Enter for newline):</span>
              <span className="text-[9px] text-slate-400">Ctrl+Enter to save</span>
            </div>
            <textarea
              ref={popoverTextareaRef}
              autoFocus
              defaultValue={targetNode.label || ''}
              placeholder="e.g. \zmass&#10;Line 2"
              rows={2}
              className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-emerald-400 font-mono focus:outline-none focus:border-indigo-400 w-56 resize-y"
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                  const val = e.currentTarget.value;
                  if (targetNode.type === 'text' && (!val || !val.trim())) {
                    onDeleteNode?.(targetNode.id);
                  } else {
                    onUpdateNode({ ...targetNode, label: val });
                  }
                  setEditingLabelNodeId(null);
                } else if (e.key === 'Escape') {
                  if (targetNode.type === 'text' && (!targetNode.label || !targetNode.label.trim())) {
                    onDeleteNode?.(targetNode.id);
                  }
                  setEditingLabelNodeId(null);
                }
              }}
            />
            <div className="flex justify-end gap-1.5">
              <button
                onClick={() => {
                  if (targetNode.type === 'text' && (!targetNode.label || !targetNode.label.trim())) {
                    onDeleteNode?.(targetNode.id);
                  }
                  setEditingLabelNodeId(null);
                }}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px]"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const val = popoverTextareaRef.current?.value ?? '';
                  if (targetNode.type === 'text' && (!val || !val.trim())) {
                    onDeleteNode?.(targetNode.id);
                  } else {
                    onUpdateNode({ ...targetNode, label: val });
                  }
                  setEditingLabelNodeId(null);
                }}
                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[10px] font-bold shadow"
              >
                Save Label
              </button>
            </div>
          </div>
        );
      })()}

      {/* Right Double Click Quick Creation Floating Popover Menu */}
      {quickMenuPos && (
        <div
          className="absolute z-50 bg-slate-900/95 backdrop-blur border border-slate-700 rounded-xl shadow-2xl p-3 w-[520px] text-xs text-slate-200"
          style={{
            left: Math.min(quickMenuPos.x, dimensions.width - 530),
            top: Math.min(quickMenuPos.y, dimensions.height - 300),
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 font-bold text-slate-100">
            <span className="flex items-center gap-1.5 text-indigo-400">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Quick Create Entity</span>
            </span>
            <button
              onClick={() => setQuickMenuPos(null)}
              className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {/* Category 1: Annotations & Text */}
            <div>
              <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider block mb-1">
                Annotation / Text
              </span>
              <div className="grid grid-cols-4 gap-1.5 font-medium">
                <button
                  onClick={() => {
                    if (onAddTextEntity) onAddTextEntity(quickMenuPos.sciX, quickMenuPos.sciY);
                    setQuickMenuPos(null);
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-purple-600 hover:text-white rounded-lg transition text-left"
                >
                  <Type className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  <span>Text ('m')</span>
                </button>
              </div>
            </div>

            {/* Category 2: Basic Shapes */}
            <div className="pt-2 border-t border-slate-800/80">
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block mb-1">
                Basic Shapes
              </span>
              <div className="grid grid-cols-4 gap-1.5 font-medium">
                <button
                  onClick={() => {
                    onAddNode?.('rect', undefined, quickMenuPos.sciX, quickMenuPos.sciY);
                    setQuickMenuPos(null);
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-amber-600 hover:text-white rounded-lg transition text-left"
                >
                  <Square className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Rectangle</span>
                </button>

                <button
                  onClick={() => {
                    onAddNode?.('circle', undefined, quickMenuPos.sciX, quickMenuPos.sciY);
                    setQuickMenuPos(null);
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-blue-600 hover:text-white rounded-lg transition text-left"
                >
                  <CircleIcon className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span>Circle</span>
                </button>

                <button
                  onClick={() => {
                    onAddNode?.('triangle', undefined, quickMenuPos.sciX, quickMenuPos.sciY);
                    setQuickMenuPos(null);
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-emerald-600 hover:text-white rounded-lg transition text-left"
                >
                  <Triangle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Triangle</span>
                </button>

                <button
                  onClick={() => {
                    onAddNode?.('diamond', undefined, quickMenuPos.sciX, quickMenuPos.sciY);
                    setQuickMenuPos(null);
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-purple-600 hover:text-white rounded-lg transition text-left"
                >
                  <Square className="w-3.5 h-3.5 text-purple-400 rotate-45 shrink-0" />
                  <span>Diamond</span>
                </button>
              </div>
            </div>

            {/* Category 3: Lines & Vectors */}
            <div className="pt-2 border-t border-slate-800/80">
              <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider block mb-1">
                Lines & Vectors
              </span>
              <div className="grid grid-cols-4 gap-1.5 font-medium">
                <button
                  onClick={() => {
                    setDrawingMode?.('draw_vector');
                    setQuickMenuPos(null);
                  }}
                  className="flex items-center gap-1.5 px-2 py-1.5 bg-slate-800 hover:bg-rose-600 hover:text-white rounded-lg transition text-left text-[11px]"
                >
                  <MoveRight className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span>Vector</span>
                </button>

                <button
                  onClick={() => {
                    setDrawingMode?.('draw_line');
                    setQuickMenuPos(null);
                  }}
                  className="flex items-center gap-1.5 px-2 py-1.5 bg-slate-800 hover:bg-sky-600 hover:text-white rounded-lg transition text-left text-[11px]"
                >
                  <CornerDownRight className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <span>Line</span>
                </button>

                <button
                  onClick={() => {
                    setDrawingMode?.('draw_super_vector');
                    setQuickMenuPos(null);
                  }}
                  className="flex items-center gap-1.5 px-2 py-1.5 bg-slate-800 hover:bg-amber-600 hover:text-white rounded-lg transition text-left text-[11px]"
                >
                  <MoveRight className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>⚡ Super Vec</span>
                </button>

                <button
                  onClick={() => {
                    setDrawingMode?.('draw_super_line');
                    setQuickMenuPos(null);
                  }}
                  className="flex items-center gap-1.5 px-2 py-1.5 bg-slate-800 hover:bg-emerald-600 hover:text-white rounded-lg transition text-left text-[11px]"
                >
                  <CornerDownRight className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>⚡ Super Line</span>
                </button>

                <button
                  onClick={() => {
                    setDrawingMode?.('draw_mega_vector');
                    setQuickMenuPos(null);
                  }}
                  className="flex items-center gap-1.5 px-2 py-1.5 bg-slate-800 hover:bg-rose-600 hover:text-white rounded-lg transition text-left text-[11px]"
                >
                  <MoveRight className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span>🌟 Mega Vec</span>
                </button>

                <button
                  onClick={() => {
                    setDrawingMode?.('draw_mega_line');
                    setQuickMenuPos(null);
                  }}
                  className="flex items-center gap-1.5 px-2 py-1.5 bg-slate-800 hover:bg-cyan-600 hover:text-white rounded-lg transition text-left text-[11px]"
                >
                  <CornerDownRight className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span>🌟 Mega Line</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
