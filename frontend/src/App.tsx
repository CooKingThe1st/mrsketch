import React, { useState, useRef, useEffect } from 'react';
import type { ProjectLayout, SceneNode, ExportBounds, MacroDefinition, RobotDefinition, PlotOptions, PrimitiveDefinition, PointBinding, DrawingMode, PendingShapeToAdd } from './types/schema';
import { INITIAL_LAYOUT } from './utils/initialData';
import { Sidebar } from './components/Sidebar';
import { CanvasStage } from './components/CanvasStage';
import { MacroEditor } from './components/MacroEditor';
import { LivePreview } from './components/LivePreview';
import { PlotSettings } from './components/PlotSettings';
import { StandalonePreview } from './components/StandalonePreview';
import { ChangelogModal } from './components/ChangelogModal';
import { Compass, Code2, Eye, RotateCcw, Sliders, Download, Upload, Check, Sparkles, ChevronDown, PanelLeft, PanelRight, Grid } from 'lucide-react';
import { isDrawioContent, convertDrawioToProjectLayout } from './utils/drawioImporter';
import { getApiBaseUrl } from './utils/api';

const LOCAL_STORAGE_KEY = 'mrsketch_project_layout_v1';

const saveLayoutSafely = (layoutToSave: ProjectLayout) => {
  if (!layoutToSave || !Array.isArray(layoutToSave.scene) || !layoutToSave.exportBounds) return;
  try {
    const jsonStr = JSON.stringify(layoutToSave);
    localStorage.setItem(LOCAL_STORAGE_KEY, jsonStr);
    localStorage.setItem('mrsketch_project_layout_backup_v1', jsonStr);
    fetch(`${getApiBaseUrl()}/api/backup-save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: jsonStr,
    }).catch(() => {});
  } catch (e) {
    console.warn('Safe layout save failed:', e);
  }
};

const getInitialState = (): ProjectLayout => {
  try {
    const primary = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (primary) {
      const parsed = JSON.parse(primary);
      if (parsed && Array.isArray(parsed.scene) && parsed.exportBounds) {
        return parsed;
      }
    }
    const backup = localStorage.getItem('mrsketch_project_layout_backup_v1');
    if (backup) {
      const parsed = JSON.parse(backup);
      if (parsed && Array.isArray(parsed.scene) && parsed.exportBounds) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Failed to load layout from localStorage:', e);
  }
  return INITIAL_LAYOUT;
};

export const computePointFromBinding = (binding: { nodeId: string; pointKey: string }, targetNode: SceneNode): [number, number] | null => {
  if (!targetNode) return null;
  const rad = ((targetNode.rotation || 0) * Math.PI) / 180;
  const cosR = Math.cos(rad);
  const sinR = Math.sin(rad);

  const rotateLocal = (dx: number, dy: number): [number, number] => {
    const rx = targetNode.x + (dx * cosR - dy * sinR);
    const ry = targetNode.y + (dx * sinR + dy * cosR);
    return [rx, ry];
  };

  const key = binding.pointKey;
  if (key === 'center') return [targetNode.x, targetNode.y];

  const N = Math.max(1, Math.min(6, targetNode.edgeSnapPoints ?? 3));

  const resolveEdgePoint = (p0: [number, number], p1: [number, number], edgePrefix: string): [number, number] | null => {
    if (key === `${edgePrefix}_start`) return rotateLocal(p0[0], p0[1]);
    if (key.startsWith(`${edgePrefix}_int_`)) {
      const k = parseInt(key.replace(`${edgePrefix}_int_`, ''), 10);
      if (!isNaN(k) && k >= 1 && k <= N) {
        const t = k / (N + 1);
        const px = p0[0] + t * (p1[0] - p0[0]);
        const py = p0[1] + t * (p1[1] - p0[1]);
        return rotateLocal(px, py);
      }
    }
    return null;
  };

  if (targetNode.type === 'rect' || targetNode.type === 'obstacle') {
    const w = targetNode.width || 3;
    const h = targetNode.height || 2;
    if (key === 'corner_tl') return rotateLocal(-w / 2, -h / 2);
    if (key === 'corner_tr') return rotateLocal(w / 2, -h / 2);
    if (key === 'corner_br') return rotateLocal(w / 2, h / 2);
    if (key === 'corner_bl') return rotateLocal(-w / 2, h / 2);
    if (key === 'mid_t') return rotateLocal(0, -h / 2);
    if (key === 'mid_r') return rotateLocal(w / 2, 0);
    if (key === 'mid_b') return rotateLocal(0, h / 2);
    if (key === 'mid_l') return rotateLocal(-w / 2, 0);

    const ptT = resolveEdgePoint([-w / 2, -h / 2], [w / 2, -h / 2], 'edge_t');
    if (ptT) return ptT;
    const ptR = resolveEdgePoint([w / 2, -h / 2], [w / 2, h / 2], 'edge_r');
    if (ptR) return ptR;
    const ptB = resolveEdgePoint([w / 2, h / 2], [-w / 2, h / 2], 'edge_b');
    if (ptB) return ptB;
    const ptL = resolveEdgePoint([-w / 2, h / 2], [-w / 2, -h / 2], 'edge_l');
    if (ptL) return ptL;
  } else if (targetNode.type === 'circle') {
    const r = targetNode.radius || 1.5;
    if (key === 'cardinal_r') return rotateLocal(r, 0);
    if (key === 'cardinal_l') return rotateLocal(-r, 0);
    if (key === 'cardinal_b') return rotateLocal(0, r);
    if (key === 'cardinal_t') return rotateLocal(0, -r);

    if (key.startsWith('circle_p')) {
      const idx = parseInt(key.replace('circle_p', ''), 10);
      const totalPoints = 4 * (N + 1);
      if (!isNaN(idx)) {
        const angle = (idx * 2 * Math.PI) / totalPoints;
        return rotateLocal(r * Math.cos(angle), r * Math.sin(angle));
      }
    }
  } else if (targetNode.type === 'diamond') {
    const w = targetNode.width || 3;
    const h = targetNode.height || 2;
    if (key === 'vertex_t') return rotateLocal(0, h / 2);
    if (key === 'vertex_r') return rotateLocal(w / 2, 0);
    if (key === 'vertex_b') return rotateLocal(0, -h / 2);
    if (key === 'vertex_l') return rotateLocal(-w / 2, 0);
    if (key === 'mid_tr') return rotateLocal(w / 4, h / 4);
    if (key === 'mid_br') return rotateLocal(w / 4, -h / 4);
    if (key === 'mid_bl') return rotateLocal(-w / 4, -h / 4);
    if (key === 'mid_tl') return rotateLocal(-w / 4, h / 4);

    const ptTR = resolveEdgePoint([0, h / 2], [w / 2, 0], 'edge_tr');
    if (ptTR) return ptTR;
    const ptBR = resolveEdgePoint([w / 2, 0], [0, -h / 2], 'edge_br');
    if (ptBR) return ptBR;
    const ptBL = resolveEdgePoint([0, -h / 2], [-w / 2, 0], 'edge_bl');
    if (ptBL) return ptBL;
    const ptTL = resolveEdgePoint([-w / 2, 0], [0, h / 2], 'edge_tl');
    if (ptTL) return ptTL;
  } else if (targetNode.type === 'triangle') {
    const w = targetNode.width || 3;
    const triType = targetNode.triangleType || 'right_isosceles';
    const h = triType === 'equilateral' ? w * 0.866 : w;
    const v0: [number, number] = triType === 'equilateral' ? [0, h * 0.66] : [-w / 2, -w / 2];
    const v1: [number, number] = triType === 'equilateral' ? [-w / 2, -h * 0.33] : [-w / 2, w / 2];
    const v2: [number, number] = triType === 'equilateral' ? [w / 2, -h * 0.33] : [w / 2, -w / 2];

    if (key === 'vertex_0') return rotateLocal(v0[0], v0[1]);
    if (key === 'vertex_1') return rotateLocal(v1[0], v1[1]);
    if (key === 'vertex_2') return rotateLocal(v2[0], v2[1]);
    if (key === 'mid_01') return rotateLocal((v0[0] + v1[0]) / 2, (v0[1] + v1[1]) / 2);
    if (key === 'mid_12') return rotateLocal((v1[0] + v2[0]) / 2, (v1[1] + v2[1]) / 2);
    if (key === 'mid_20') return rotateLocal((v2[0] + v0[0]) / 2, (v2[1] + v0[1]) / 2);

    const pt01 = resolveEdgePoint(v0, v1, 'edge_01');
    if (pt01) return pt01;
    const pt12 = resolveEdgePoint(v1, v2, 'edge_12');
    if (pt12) return pt12;
    const pt20 = resolveEdgePoint(v2, v0, 'edge_20');
    if (pt20) return pt20;
  }

  return null;
};

export const syncBoundNodesForGroup = (scene: SceneNode[], movedNodes: SceneNode[]): SceneNode[] => {
  const nodeMap = new Map<string, SceneNode>();
  scene.forEach((n) => {
    nodeMap.set(n.id, n);
  });
  movedNodes.forEach((n) => {
    nodeMap.set(n.id, n);
  });

  const movedIds = new Set(movedNodes.map((n) => n.id));

  return scene.map((node) => {
    const baseNode = nodeMap.get(node.id) || node;

    let hasChanges = movedIds.has(node.id);
    let newX = baseNode.x;
    let newY = baseNode.y;
    let newPts = baseNode.points ? [...baseNode.points] : undefined;
    let newCp = baseNode.controlPoint ? [...baseNode.controlPoint] : undefined;

    let deltaX = 0;
    let deltaY = 0;

    // 1. Evaluate startBinding if present
    if (baseNode.startBinding) {
      const target = nodeMap.get(baseNode.startBinding.nodeId);
      if (target) {
        const p = computePointFromBinding(baseNode.startBinding, target);
        if (p) {
          const sX = Math.round(p[0] * 100) / 100;
          const sY = Math.round(p[1] * 100) / 100;
          if (sX !== newX || sY !== newY) {
            deltaX = sX - newX;
            deltaY = sY - newY;
            newX = sX;
            newY = sY;
            hasChanges = true;
          }
        }
      }
    }

    // 2. Evaluate endBinding if present
    if (baseNode.endBinding && newPts && newPts.length >= 4) {
      const target = nodeMap.get(baseNode.endBinding.nodeId);
      if (target) {
        const p = computePointFromBinding(baseNode.endBinding, target);
        if (p) {
          const eX = p[0];
          const eY = p[1];
          const calcDx = Math.round((eX - newX) * 100) / 100;
          const calcDy = Math.round((eY - newY) * 100) / 100;
          if (calcDx !== newPts[2] || calcDy !== newPts[3]) {
            newPts[2] = calcDx;
            newPts[3] = calcDy;
            hasChanges = true;
          }
        }
      }
    }

    // 3. Evaluate controlBinding if present
    if (baseNode.controlBinding && newCp && newCp.length >= 2) {
      const target = nodeMap.get(baseNode.controlBinding.nodeId);
      if (target) {
        const p = computePointFromBinding(baseNode.controlBinding, target);
        if (p) {
          const cX = p[0];
          const cY = p[1];
          const calcCpx = Math.round((cX - newX) * 100) / 100;
          const calcCpy = Math.round((cY - newY) * 100) / 100;
          if (calcCpx !== newCp[0] || calcCpy !== newCp[1]) {
            newCp[0] = calcCpx;
            newCp[1] = calcCpy;
            hasChanges = true;
          }
        }
      }
    } else if ((deltaX !== 0 || deltaY !== 0) && newCp && newCp.length >= 2) {
      // If startBinding moved (newX, newY) by (deltaX, deltaY), and controlBinding is NOT bound:
      // Adjust newCp relative offsets so controlPoint maintains its world position (newX + newCp[0] === oldX + oldCp[0])
      const calcCpx = Math.round((newCp[0] - deltaX) * 100) / 100;
      const calcCpy = Math.round((newCp[1] - deltaY) * 100) / 100;
      if (calcCpx !== newCp[0] || calcCpy !== newCp[1]) {
        newCp[0] = calcCpx;
        newCp[1] = calcCpy;
        hasChanges = true;
      }
    }

    // 4. Evaluate megaBindings if present
    if (baseNode.megaBindings && newPts) {
      let megaChanged = false;
      Object.entries(baseNode.megaBindings).forEach(([idxStr, binding]) => {
        const idx = parseInt(idxStr, 10);
        const target = nodeMap.get(binding.nodeId);
        if (target && idx * 2 + 1 < newPts.length) {
          const p = computePointFromBinding(binding, target);
          if (p) {
            const calcX = Math.round((p[0] - newX) * 100) / 100;
            const calcY = Math.round((p[1] - newY) * 100) / 100;
            if (calcX !== newPts[idx * 2] || calcY !== newPts[idx * 2 + 1]) {
              newPts[idx * 2] = calcX;
              newPts[idx * 2 + 1] = calcY;
              megaChanged = true;
            }
          }
        }
      });
      if (megaChanged) hasChanges = true;
    }

    if (hasChanges) {
      return {
        ...baseNode,
        x: newX,
        y: newY,
        points: newPts,
        controlPoint: newCp,
      };
    }

    return baseNode;
  });
};

export const syncBoundNodes = (scene: SceneNode[], movedNode: SceneNode): SceneNode[] => {
  return syncBoundNodesForGroup(scene, [movedNode]);
};

export function App() {
  const [hashRoute, setHashRoute] = useState<string>(window.location.hash);
  const [isChangelogOpen, setIsChangelogOpen] = useState<boolean>(false);

  useEffect(() => {
    const handleHashChange = () => setHashRoute(window.location.hash);
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    if (hashRoute === '#preview') {
      document.title = 'Popout Preview - MR-Sketch - Scientific Sketch Link';
    } else {
      document.title = 'MR-Sketch - Scientific Sketch Link';
    }
  }, [hashRoute]);

  // If opening the standalone pop-out preview tab URL (#preview)
  if (hashRoute === '#preview') {
    return <StandalonePreview />;
  }

  const initialData = getInitialState();
  const [layout, setLayout] = useState<ProjectLayout>(initialData);
  
  // Stackable Undo History State
  const [history, setHistory] = useState<ProjectLayout[]>([initialData]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);
  const [saveNotification, setSaveNotification] = useState<boolean>(false);

  // On mount, auto-load backend disk backup if present and local scene is initial default
  useEffect(() => {
    fetch(`${getApiBaseUrl()}/api/backup-load`)
      .then((res) => res.json())
      .then((data) => {
        if (data && Array.isArray(data.scene) && data.scene.length > 0) {
          setLayout((curr) => {
            if (!curr || !Array.isArray(curr.scene) || curr.scene.length <= 4) {
              setHistory([data]);
              setHistoryIndex(0);
              saveLayoutSafely(data);
              return data;
            }
            return curr;
          });
        }
      })
      .catch(() => {});
  }, []);

  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<'main_scene' | 'robot_designer'>('main_scene');

  const handleModeChange = (newMode: 'main_scene' | 'robot_designer') => {
    setActiveWorkspaceTab(newMode);
    setDrawingMode('select');
    if (newMode === 'robot_designer') {
      setSelectedNodeId(null);
      setSelectedNodeIds([]);
    } else {
      setSelectedPrimitiveIdx(null);
      setSelectedPrimitiveIdxs([]);
    }
  };

  const [activeRobotDefId, setActiveRobotDefId] = useState<string>(Object.keys(initialData.definitions)[0] || '');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedPrimitiveIdx, setSelectedPrimitiveIdx] = useState<number | null>(null);
  const [selectedPrimitiveIdxs, setSelectedPrimitiveIdxs] = useState<number[]>([]);

  const handleSelectNode = (id: string | null) => {
    setSelectedNodeId(id);
  };

  useEffect(() => {
    if (selectedNodeId) {
      setSelectedNodeIds((prev) => {
        if (prev.includes(selectedNodeId)) return prev;
        return [selectedNodeId];
      });
    } else {
      setSelectedNodeIds((prev) => {
        if (prev.length === 0) return prev;
        return [];
      });
    }
  }, [selectedNodeId]);

  useEffect(() => {
    if (selectedPrimitiveIdx !== null) {
      setSelectedPrimitiveIdxs((prev) => {
        if (prev.includes(selectedPrimitiveIdx)) return prev;
        return [selectedPrimitiveIdx];
      });
    } else {
      setSelectedPrimitiveIdxs((prev) => {
        if (prev.length === 0) return prev;
        return [];
      });
    }
  }, [selectedPrimitiveIdx]);

  const [drawingMode, setDrawingMode] = useState<DrawingMode>('select');
  const [pendingShapeToAdd, setPendingShapeToAdd] = useState<PendingShapeToAdd | null>(null);
  const [activeRightPanel, setActiveRightPanel] = useState<'preview' | 'plot' | 'macros'>('preview');

  const [shapeStyleMemory, setShapeStyleMemory] = useState<Record<string, { style?: any; fontSize?: number; labelFillTransparent?: boolean; labelFillColor?: string; labelTextColor?: string }>>({});
  const [fontSizePresets, setFontSizePresets] = useState<{ small: number; med: number; large: number }>({
    small: 18,
    med: 23,
    large: 30,
  });
  const [autoSaveSeconds, setAutoSaveSeconds] = useState<number>(60);
  const [activeMenu, setActiveMenu] = useState<'file' | 'edit' | 'view' | 'settings' | null>(null);
  const [showLeftSidebar, setShowLeftSidebar] = useState<boolean>(true);
  const [showRightPanel, setShowRightPanel] = useState<boolean>(true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const navbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (navbarRef.current && !navbarRef.current.contains(event.target as Node)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (autoSaveSeconds <= 0) return;
    const timer = setInterval(() => {
      saveLayoutSafely(layout);
    }, autoSaveSeconds * 1000);
    return () => clearInterval(timer);
  }, [layout, autoSaveSeconds]);

  const updateLayoutWithHistory = (newLayout: ProjectLayout) => {
    if (!newLayout || !Array.isArray(newLayout.scene)) return;
    setLayout(newLayout);
    setHistory((prevHistory) => {
      const sliced = prevHistory.slice(0, historyIndex + 1);
      return [...sliced, newLayout];
    });
    setHistoryIndex((prevIndex) => prevIndex + 1);
    saveLayoutSafely(newLayout);
  };

  const triggerSaveNotification = () => {
    saveLayoutSafely(layout);
    setSaveNotification(true);
    setTimeout(() => setSaveNotification(false), 2000);
  };

  const handleUndo = () => {
    setHistory((currentHistory) => {
      setHistoryIndex((currentIndex) => {
        if (currentIndex <= 0) return currentIndex;
        const targetIndex = currentIndex - 1;
        const prevLayout = currentHistory[targetIndex];
        if (prevLayout && Array.isArray(prevLayout.scene)) {
          setLayout(prevLayout);
          saveLayoutSafely(prevLayout);
          return targetIndex;
        }
        return currentIndex;
      });
      return currentHistory;
    });
  };

  const handleRedo = () => {
    setHistory((currentHistory) => {
      setHistoryIndex((currentIndex) => {
        if (currentIndex >= currentHistory.length - 1) return currentIndex;
        const targetIndex = currentIndex + 1;
        const nextLayout = currentHistory[targetIndex];
        if (nextLayout && Array.isArray(nextLayout.scene)) {
          setLayout(nextLayout);
          saveLayoutSafely(nextLayout);
          return targetIndex;
        }
        return currentIndex;
      });
      return currentHistory;
    });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isInputFocused =
        activeElement &&
        (activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA' ||
          activeElement.tagName === 'SELECT');

      // Ctrl + S Save to Cache Shortcut
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        triggerSaveNotification();
        return;
      }

      // Ctrl + Z Undo Shortcut
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
        return;
      }

      // Ctrl + Y Redo Shortcut
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
        return;
      }

      // Ctrl + C / Ctrl + D / Ctrl + V Duplicate Shortcut
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'c' || e.key.toLowerCase() === 'd' || e.key.toLowerCase() === 'v') && !isInputFocused) {
        if (activeWorkspaceTab === 'main_scene' && (selectedNodeIds.length > 0 || selectedNodeId)) {
          e.preventDefault();
          const targetIds = selectedNodeIds.length > 0 ? selectedNodeIds : (selectedNodeId ? [selectedNodeId] : []);
          const sourceNodes = layout.scene.filter((n) => targetIds.includes(n.id));

          if (sourceNodes.length > 0) {
            const idMapping = new Map<string, string>();
            const now = Date.now();
            sourceNodes.forEach((n, idx) => {
              idMapping.set(n.id, `node_${n.type}_${now}_${idx}`);
            });

            const remapBinding = (binding?: PointBinding): PointBinding | undefined => {
              if (!binding) return undefined;
              if (idMapping.has(binding.nodeId)) {
                return { nodeId: idMapping.get(binding.nodeId)!, pointKey: binding.pointKey };
              }
              return { ...binding };
            };

            const duplicatedNodes: SceneNode[] = sourceNodes.map((sourceNode) => {
              const newId = idMapping.get(sourceNode.id)!;
              const remapMega = (mb?: Record<number, PointBinding>): Record<number, PointBinding> | undefined => {
                if (!mb) return undefined;
                const res: Record<number, PointBinding> = {};
                Object.entries(mb).forEach(([k, v]) => {
                  const numK = parseInt(k, 10);
                  const newB = remapBinding(v);
                  if (newB) res[numK] = newB;
                });
                return Object.keys(res).length > 0 ? res : undefined;
              };

              return {
                ...sourceNode,
                id: newId,
                name: sourceNode.name ? `${sourceNode.name}_copy` : undefined,
                x: Math.round((sourceNode.x + 0.5) * 100) / 100,
                y: Math.round((sourceNode.y - 0.5) * 100) / 100,
                points: sourceNode.points ? [...sourceNode.points] : undefined,
                controlPoint: sourceNode.controlPoint ? [...sourceNode.controlPoint] : undefined,
                vertices: sourceNode.vertices ? sourceNode.vertices.map((v) => [...v]) : undefined,
                startBinding: remapBinding(sourceNode.startBinding),
                endBinding: remapBinding(sourceNode.endBinding),
                controlBinding: remapBinding(sourceNode.controlBinding),
                megaBindings: remapMega(sourceNode.megaBindings),
                style: sourceNode.style ? { ...sourceNode.style } : (undefined as any),
              };
            });

            const newLayout = {
              ...layout,
              scene: [...layout.scene, ...duplicatedNodes],
            };
            updateLayoutWithHistory(newLayout);

            const newIds = duplicatedNodes.map((n) => n.id);
            setSelectedNodeIds(newIds);
            setSelectedNodeId(newIds[0] || null);
          }
          return;
        } else if (activeWorkspaceTab === 'robot_designer' && selectedPrimitiveIdx !== null) {
          if (!activeRobotDefId || !layout.definitions[activeRobotDefId]) return;
          e.preventDefault();
          const currentDef = layout.definitions[activeRobotDefId];
          const activeIdxs = selectedPrimitiveIdxs.length > 0 ? selectedPrimitiveIdxs : [selectedPrimitiveIdx];
          
          const duplicatedPrims: PrimitiveDefinition[] = [];
          activeIdxs.forEach((i) => {
            const sourcePrim = currentDef.primitives[i];
            if (sourcePrim) {
              const newPrimId = `prim_${Date.now()}_${i}`;
              duplicatedPrims.push({
                ...sourcePrim,
                id: newPrimId,
                config: {
                  ...sourcePrim.config,
                  points: sourcePrim.config.points ? [...sourcePrim.config.points] : undefined,
                  controlPoint: sourcePrim.config.controlPoint ? [...sourcePrim.config.controlPoint] : undefined,
                  vertices: sourcePrim.config.vertices ? sourcePrim.config.vertices.map(v => [...v]) : undefined,
                },
              });
            }
          });

          if (duplicatedPrims.length > 0) {
            const updatedDef = {
              ...currentDef,
              primitives: [...currentDef.primitives, ...duplicatedPrims],
            };
            updateLayoutWithHistory({
              ...layout,
              definitions: {
                ...layout.definitions,
                [activeRobotDefId]: updatedDef,
              },
            });
            const newFocusIdx = updatedDef.primitives.length - duplicatedPrims.length;
            setSelectedPrimitiveIdx(newFocusIdx);
            
            const newFocusIdxs = duplicatedPrims.map((_, idxOffset) => newFocusIdx + idxOffset);
            setSelectedPrimitiveIdxs(newFocusIdxs);
          }
          return;
        }
      }

      // Delete / Backspace Shortcut
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (activeWorkspaceTab === 'main_scene' && selectedNodeIds.length > 1) {
          e.preventDefault();
          if (activeElement && 'blur' in activeElement) (activeElement as HTMLElement).blur();
          handleDeleteNodes(selectedNodeIds);
          return;
        }

        if (!isInputFocused) {
          if (activeWorkspaceTab === 'main_scene') {
            if (selectedNodeIds.length > 0) {
              e.preventDefault();
              handleDeleteNodes(selectedNodeIds);
            } else if (selectedNodeId) {
              e.preventDefault();
              handleDeleteNode(selectedNodeId);
            }
          } else if (activeWorkspaceTab === 'robot_designer') {
            const activeIdxs = selectedPrimitiveIdxs.length > 0 ? selectedPrimitiveIdxs : (selectedPrimitiveIdx !== null ? [selectedPrimitiveIdx] : []);
            if (activeIdxs.length > 0) {
              e.preventDefault();
              handleDeletePrimitives(activeIdxs);
            }
          }
        }
      }

      // Toggle Live Math Mode Shortcut (Ctrl+M or M when not typing)
      if ((e.key === 'm' || e.key === 'M') && !isInputFocused) {
        e.preventDefault();
        const currentVal = layout.plotOptions.renderMathOnCanvas ?? true;
        handleUpdatePlotOptions({
          ...layout.plotOptions,
          renderMathOnCanvas: !currentVal,
        });
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyIndex, history, activeWorkspaceTab, selectedNodeId, selectedNodeIds, selectedPrimitiveIdx, selectedPrimitiveIdxs, layout, activeRobotDefId]);

  useEffect(() => {
    const handleGlobalWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement;
      if (target && target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'number') {
        e.preventDefault();
        const input = target as HTMLInputElement;
        const step = parseFloat(input.step) || 1;
        const val = parseFloat(input.value) || 0;
        const direction = e.deltaY < 0 ? 1 : -1;
        const newVal = val + direction * step;

        const prototype = Object.getPrototypeOf(input);
        const valueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
        if (valueSetter) {
          valueSetter.call(input, Math.round(newVal * 100) / 100);
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    };

    window.addEventListener('wheel', handleGlobalWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleGlobalWheel);
  }, []);

  const handleAddNode = (type: SceneNode['type'], definitionId?: string, x: number = 0, y: number = 0) => {
    const newNodeId = `node_${type}_${Date.now()}`;
    const mem = shapeStyleMemory[type];
    const isShape = (type === 'obstacle' || type === 'rect' || type === 'circle' || type === 'triangle' || type === 'diamond');

    const newNode: SceneNode = {
      id: newNodeId,
      name: definitionId ? layout.definitions[definitionId]?.name || `${type} Node` : `${type.toUpperCase()} ${layout.scene.length + 1}`,
      type,
      definitionId,
      x,
      y,
      scale: 1.0,
      rotation: 0,
      width: isShape ? 3 : undefined,
      height: isShape ? 2 : undefined,
      radius: type === 'circle' ? 1.5 : undefined,
      triangleType: type === 'triangle' ? 'right_isosceles' : undefined,
      points: type === 'vector' || type === 'line' ? [0, 0, 3, 2] : undefined,
      label: type === 'text' ? 'm' : undefined,
      labelOffsetX: isShape ? 0.0 : undefined,
      labelOffsetY: isShape ? 0.0 : undefined,
      fontSize: mem?.fontSize ?? fontSizePresets.med,
      labelFillTransparent: mem?.labelFillTransparent,
      labelFillColor: mem?.labelFillColor,
      labelTextColor: mem?.labelTextColor,
      style: mem?.style ? { ...mem.style } : {
        strokeWidth: 2,
        strokeStyle: 'solid',
        color: type === 'vector' ? '#ef4444' : isShape ? '#f59e0b' : '#3b82f6',
        fillColor: isShape ? '#fef3c7' : '#dbeafe',
      },
    };

    const newLayout = {
      ...layout,
      scene: [...layout.scene, newNode],
    };
    updateLayoutWithHistory(newLayout);
    setSelectedNodeId(newNodeId);
  };

  const handleAddTextEntity = (x: number, y: number): string => {
    const newNodeId = `node_text_${Date.now()}`;
    const mem = shapeStyleMemory['text'];
    const newNode: SceneNode = {
      id: newNodeId,
      name: `TEXT ${layout.scene.length + 1}`,
      type: 'text',
      x,
      y,
      scale: 1.0,
      rotation: 0,
      label: '',
      fontSize: mem?.fontSize ?? fontSizePresets.med,
      labelFillTransparent: mem?.labelFillTransparent,
      labelFillColor: mem?.labelFillColor,
      labelTextColor: mem?.labelTextColor,
      style: mem?.style ? { ...mem.style } : {
        strokeWidth: 2,
        strokeStyle: 'solid',
        color: '#000000',
      },
    };
    updateLayoutWithHistory({
      ...layout,
      scene: [...layout.scene, newNode],
    });
    setSelectedNodeId(newNodeId);
    setDrawingMode('select');
    return newNodeId;
  };

  const handleAddMegaLine = (
    type: 'mega_line' | 'mega_vector',
    pointsSci: Array<[number, number]>,
    megaBindings?: Record<number, PointBinding>
  ) => {
    if (pointsSci.length < 2) return;
    const startSci = pointsSci[0];
    const relativePts: number[] = [];
    pointsSci.forEach(([px, py]) => {
      relativePts.push(
        Math.round((px - startSci[0]) * 100) / 100,
        Math.round((py - startSci[1]) * 100) / 100
      );
    });

    if (activeWorkspaceTab === 'robot_designer') {
      if (!activeRobotDefId || !layout.definitions[activeRobotDefId]) return;
      const currentDef = layout.definitions[activeRobotDefId];
      const newPrim: PrimitiveDefinition = {
        id: `prim_${Date.now()}`,
        type: type as any,
        config: {
          x: startSci[0],
          y: startSci[1],
          points: relativePts,
          lineShape: 'straight',
          strokeColor: type === 'mega_vector' ? '#ef4444' : '#0ea5e9',
          fillColor: '#dbeafe',
        },
      };

      const updatedDef = {
        ...currentDef,
        primitives: [...currentDef.primitives, newPrim],
      };

      updateLayoutWithHistory({
        ...layout,
        definitions: {
          ...layout.definitions,
          [activeRobotDefId]: updatedDef,
        },
      });
      setSelectedPrimitiveIdx(updatedDef.primitives.length - 1);
      setDrawingMode('select');
      return;
    }

    const mem = shapeStyleMemory[type];
    const newNodeId = `node_${type}_${Date.now()}`;
    const newNode: SceneNode = {
      id: newNodeId,
      name: `${type.toUpperCase()} ${layout.scene.length + 1}`,
      type: type,
      x: startSci[0],
      y: startSci[1],
      scale: 1.0,
      rotation: 0,
      points: relativePts,
      lineShape: 'straight',
      megaBindings,
      label: undefined,
      fontSize: mem?.fontSize ?? fontSizePresets.med,
      labelFillTransparent: mem?.labelFillTransparent,
      labelFillColor: mem?.labelFillColor,
      labelTextColor: mem?.labelTextColor,
      style: mem?.style ? { ...mem.style } : {
        strokeWidth: 2.5,
        strokeStyle: 'solid',
        color: type === 'mega_vector' ? '#f59e0b' : '#10b981',
      },
    };

    const newLayout = {
      ...layout,
      scene: [...layout.scene, newNode],
    };
    updateLayoutWithHistory(newLayout);
    setSelectedNodeId(newNodeId);
    setDrawingMode('select');
  };

  const handleAddVectorOrLine = (
    type: SceneNode['type'],
    startSci: [number, number],
    endSci: [number, number],
    controlPointSci?: [number, number],
    startBinding?: PointBinding,
    endBinding?: PointBinding,
    controlBinding?: PointBinding
  ) => {
    const dx = Math.round((endSci[0] - startSci[0]) * 100) / 100;
    const dy = Math.round((endSci[1] - startSci[1]) * 100) / 100;

    let controlPoint: [number, number] | undefined = undefined;
    if (type === 'super_vector' || type === 'super_line') {
      if (controlPointSci) {
        controlPoint = [
          Math.round((controlPointSci[0] - startSci[0]) * 100) / 100,
          Math.round((controlPointSci[1] - startSci[1]) * 100) / 100,
        ];
      } else {
        const offset = activeWorkspaceTab === 'robot_designer' ? 20.0 : 1.5;
        controlPoint = [
          Math.round((dx / 2) * 100) / 100,
          Math.round((dy / 2 + offset) * 100) / 100,
        ];
      }
    }

    if (activeWorkspaceTab === 'robot_designer') {
      if (!activeRobotDefId || !layout.definitions[activeRobotDefId]) return;
      const currentDef = layout.definitions[activeRobotDefId];
      const newPrim: PrimitiveDefinition = {
        id: `prim_${Date.now()}`,
        type: type as any,
        config: {
          x: startSci[0],
          y: startSci[1],
          points: [0, 0, dx, dy],
          controlPoint,
          lineShape: (type === 'super_vector' || type === 'super_line') ? 'straight' : undefined,
          strokeColor: (type === 'vector' || type === 'super_vector') ? '#ef4444' : '#0ea5e9',
          fillColor: '#dbeafe',
        },
      };

      const updatedDef = {
        ...currentDef,
        primitives: [...currentDef.primitives, newPrim],
      };

      updateLayoutWithHistory({
        ...layout,
        definitions: {
          ...layout.definitions,
          [activeRobotDefId]: updatedDef,
        },
      });
      setSelectedPrimitiveIdx(updatedDef.primitives.length - 1);
      setDrawingMode('select');
      return;
    }

    const mem = shapeStyleMemory[type];
    const newNodeId = `node_${type}_${Date.now()}`;
    const newNode: SceneNode = {
      id: newNodeId,
      name: `${type.toUpperCase()} ${layout.scene.length + 1}`,
      type: type,
      x: startSci[0],
      y: startSci[1],
      scale: 1.0,
      rotation: 0,
      points: type !== 'text' ? [0, 0, dx, dy] : undefined,
      controlPoint,
      lineShape: (type === 'super_vector' || type === 'super_line') ? 'straight' : undefined,
      startBinding,
      endBinding,
      controlBinding,
      label: undefined,
      fontSize: mem?.fontSize ?? fontSizePresets.med,
      labelFillTransparent: mem?.labelFillTransparent,
      labelFillColor: mem?.labelFillColor,
      labelTextColor: mem?.labelTextColor,
      style: mem?.style ? { ...mem.style } : {
        strokeWidth: 2.5,
        strokeStyle: 'solid',
        color: (type === 'vector' || type === 'super_vector') ? '#f59e0b' : type === 'text' ? '#000000' : '#10b981',
      },
    };

    const newLayout = {
      ...layout,
      scene: [...layout.scene, newNode],
    };
    updateLayoutWithHistory(newLayout);
    setSelectedNodeId(newNodeId);
    setDrawingMode('select');
  };

  const handleMoveLayer = (id: string, direction: 'up' | 'down') => {
    const index = layout.scene.findIndex((n) => n.id === id);
    if (index < 0) return;
    const targetIndex = direction === 'up' ? index + 1 : index - 1;
    if (targetIndex < 0 || targetIndex >= layout.scene.length) return;

    const updatedScene = [...layout.scene];
    const [movedNode] = updatedScene.splice(index, 1);
    updatedScene.splice(targetIndex, 0, movedNode);

    updateLayoutWithHistory({
      ...layout,
      scene: updatedScene,
    });
  };

  const handleMovePrimitiveLayer = (idx: number, direction: 'up' | 'down') => {
    if (!activeRobotDefId || !layout.definitions[activeRobotDefId]) return;
    const currentDef = layout.definitions[activeRobotDefId];
    const targetIndex = direction === 'up' ? idx + 1 : idx - 1;
    if (targetIndex < 0 || targetIndex >= currentDef.primitives.length) return;

    const updatedPrims = [...currentDef.primitives];
    const [movedPrim] = updatedPrims.splice(idx, 1);
    updatedPrims.splice(targetIndex, 0, movedPrim);

    updateLayoutWithHistory({
      ...layout,
      definitions: {
        ...layout.definitions,
        [activeRobotDefId]: { ...currentDef, primitives: updatedPrims },
      },
    });
    setSelectedPrimitiveIdx(targetIndex);
  };

  const handleAddPrimitive = (type: PrimitiveDefinition['type']) => {
    if (!activeRobotDefId || !layout.definitions[activeRobotDefId]) return;
    const currentDef = layout.definitions[activeRobotDefId];
    const newPrim: PrimitiveDefinition = {
      id: `prim_${Date.now()}`,
      type,
      config: {
        x: 0,
        y: 0,
        radius: type === 'circle' ? 25 : undefined,
        width: (type === 'rect' || type === 'diamond' || type === 'triangle') ? 30 : undefined,
        height: (type === 'rect' || type === 'diamond') ? 20 : undefined,
        triangleType: type === 'triangle' ? 'right_isosceles' : undefined,
        points: (type === 'vector' || type === 'line' || type === 'super_vector' || type === 'super_line' || type === 'mega_vector' || type === 'mega_line') ? [0, 0, 40, 0] : undefined,
        controlPoint: (type === 'super_vector' || type === 'super_line') ? [20, 20] : undefined,
        lineShape: (type === 'super_vector' || type === 'super_line') ? 'curve' : undefined,
        vertices: type === 'poly' ? [[-20, -20], [20, -20], [0, 30]] : undefined,
        strokeColor: (type === 'vector' || type === 'super_vector' || type === 'mega_vector') ? '#ef4444' : '#3b82f6',
        fillColor: '#dbeafe',
      },
    };

    const updatedDef = {
      ...currentDef,
      primitives: [...currentDef.primitives, newPrim],
    };

    updateLayoutWithHistory({
      ...layout,
      definitions: {
        ...layout.definitions,
        [activeRobotDefId]: updatedDef,
      },
    });
    setSelectedPrimitiveIdx(updatedDef.primitives.length - 1);
  };

  const handleDuplicatePrimitive = (idx: number) => {
    if (!activeRobotDefId || !layout.definitions[activeRobotDefId]) return;
    const currentDef = layout.definitions[activeRobotDefId];
    const sourcePrim = currentDef.primitives[idx];
    if (!sourcePrim) return;

    const clonedPrim: PrimitiveDefinition = {
      ...sourcePrim,
      id: `prim_${Date.now()}`,
      config: {
        ...sourcePrim.config,
        x: (sourcePrim.config.x || 0) + 15,
        y: (sourcePrim.config.y || 0) - 15,
      },
    };

    const updatedPrims = [...currentDef.primitives, clonedPrim];
    updateLayoutWithHistory({
      ...layout,
      definitions: {
        ...layout.definitions,
        [activeRobotDefId]: { ...currentDef, primitives: updatedPrims },
      },
    });
    setSelectedPrimitiveIdx(updatedPrims.length - 1);
  };

  const handleUpdatePrimitives = (updates: Array<{ idx: number; prim: PrimitiveDefinition }>) => {
    if (!activeRobotDefId || !layout.definitions[activeRobotDefId]) return;
    const currentDef = layout.definitions[activeRobotDefId];
    const updatedPrims = [...currentDef.primitives];
    updates.forEach(({ idx, prim }) => {
      if (idx >= 0 && idx < updatedPrims.length) {
        updatedPrims[idx] = prim;
      }
    });

    updateLayoutWithHistory({
      ...layout,
      definitions: {
        ...layout.definitions,
        [activeRobotDefId]: { ...currentDef, primitives: updatedPrims },
      },
    });
  };

  const handleImportComponentPrimitives = (sourceDefId: string) => {
    if (!activeRobotDefId || !layout.definitions[activeRobotDefId] || !layout.definitions[sourceDefId]) return;
    const currentDef = layout.definitions[activeRobotDefId];
    const sourceDef = layout.definitions[sourceDefId];

    // Clone & flatten primitives from sourceDef into currentDef
    const clonedPrimitives: PrimitiveDefinition[] = sourceDef.primitives.map((p, idx) => ({
      ...p,
      id: `imported_${p.id}_${Date.now()}_${idx}`,
      config: { ...p.config },
    }));

    const updatedDef = {
      ...currentDef,
      primitives: [...currentDef.primitives, ...clonedPrimitives],
    };

    updateLayoutWithHistory({
      ...layout,
      definitions: {
        ...layout.definitions,
        [activeRobotDefId]: updatedDef,
      },
    });
    setSelectedPrimitiveIdx(currentDef.primitives.length);
  };

  const handleAddPolygonPrimitive = (vertices: Array<[number, number]>) => {
    if (!activeRobotDefId || !layout.definitions[activeRobotDefId]) return;
    const currentDef = layout.definitions[activeRobotDefId];
    const newPrim: PrimitiveDefinition = {
      id: `poly_${Date.now()}`,
      type: 'poly',
      config: {
        x: 0,
        y: 0,
        vertices,
        strokeColor: '#ec4899',
        fillColor: '#fce7f3',
      },
    };

    const updatedDef = {
      ...currentDef,
      primitives: [...currentDef.primitives, newPrim],
    };

    updateLayoutWithHistory({
      ...layout,
      definitions: {
        ...layout.definitions,
        [activeRobotDefId]: updatedDef,
      },
    });
    setSelectedPrimitiveIdx(updatedDef.primitives.length - 1);
    setDrawingMode('select');
  };

  const handleDeletePrimitive = (idx: number) => {
    if (!activeRobotDefId || !layout.definitions[activeRobotDefId]) return;
    const currentDef = layout.definitions[activeRobotDefId];
    const updatedPrims = currentDef.primitives.filter((_, i) => i !== idx);

    updateLayoutWithHistory({
      ...layout,
      definitions: {
        ...layout.definitions,
        [activeRobotDefId]: { ...currentDef, primitives: updatedPrims },
      },
    });
    setSelectedPrimitiveIdx(null);
  };

  const handleDeletePrimitives = (idxs: number[]) => {
    if (!activeRobotDefId || !layout.definitions[activeRobotDefId]) return;
    const currentDef = layout.definitions[activeRobotDefId];
    const updatedPrims = currentDef.primitives.filter((_, i) => !idxs.includes(i));

    updateLayoutWithHistory({
      ...layout,
      definitions: {
        ...layout.definitions,
        [activeRobotDefId]: { ...currentDef, primitives: updatedPrims },
      },
    });
    setSelectedPrimitiveIdx(null);
    setSelectedPrimitiveIdxs([]);
  };

  const handleUpdatePrimitive = (idx: number, prim: PrimitiveDefinition) => {
    if (!activeRobotDefId || !layout.definitions[activeRobotDefId]) return;
    const currentDef = layout.definitions[activeRobotDefId];
    const updatedPrims = [...currentDef.primitives];
    updatedPrims[idx] = prim;

    updateLayoutWithHistory({
      ...layout,
      definitions: {
        ...layout.definitions,
        [activeRobotDefId]: { ...currentDef, primitives: updatedPrims },
      },
    });
  };

  const handleUpdateNodes = (updatedNodes: SceneNode[]) => {
    updatedNodes.forEach((node) => {
      setShapeStyleMemory((prev) => ({
        ...prev,
        [node.type]: {
          style: { ...node.style },
          fontSize: node.fontSize,
          labelFillTransparent: node.labelFillTransparent,
          labelFillColor: node.labelFillColor,
          labelTextColor: node.labelTextColor,
        },
      }));
    });

    const syncedScene = syncBoundNodesForGroup(layout.scene, updatedNodes);
    updateLayoutWithHistory({
      ...layout,
      scene: syncedScene,
    });
  };

  const handleUpdateNode = (updatedNode: SceneNode) => {
    handleUpdateNodes([updatedNode]);
  };

  const handleDeleteNode = (id: string) => {
    updateLayoutWithHistory({
      ...layout,
      scene: layout.scene.filter((n) => n.id !== id),
    });
    if (selectedNodeId === id) setSelectedNodeId(null);
    setSelectedNodeIds((ids) => ids.filter((nodeId) => nodeId !== id));
  };

  const handleDeleteNodes = (ids: string[]) => {
    if (ids.length === 0) return;
    updateLayoutWithHistory({
      ...layout,
      scene: layout.scene.filter((n) => !ids.includes(n.id)),
    });
    setSelectedNodeIds([]);
    setSelectedNodeId(null);
  };

  const handleUpdateExportBounds = (newBounds: ExportBounds) => {
    updateLayoutWithHistory({
      ...layout,
      exportBounds: newBounds,
    });
  };

  const handleUpdateMacros = (newMacros: Record<string, MacroDefinition>) => {
    updateLayoutWithHistory({
      ...layout,
      macros: newMacros,
    });
  };

  const handleUpdateDefinitions = (newDefs: Record<string, RobotDefinition>) => {
    const filteredScene = layout.scene.filter(n => n.type !== 'alias' || (n.definitionId && n.definitionId in newDefs));
    updateLayoutWithHistory({
      ...layout,
      definitions: newDefs,
      scene: filteredScene,
    });
  };

  const handleUpdatePlotOptions = (newOpts: PlotOptions) => {
    updateLayoutWithHistory({
      ...layout,
      plotOptions: newOpts,
    });
  };

  const handleExportJSON = () => {
    const jsonStr = JSON.stringify(layout, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `OOS_json_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleProcessImportContent = (rawText: string) => {
    const trimmed = rawText.trim();
    if (!trimmed) return;

    if (trimmed.startsWith('<') || isDrawioContent(trimmed)) {
      const translatedLayout = convertDrawioToProjectLayout(trimmed, layout);
      updateLayoutWithHistory(translatedLayout);
      setSelectedNodeId(null);
      alert(`Draw.io diagram translated & imported successfully (${translatedLayout.scene.length} scene elements)!`);
      return;
    }

    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && parsed.scene && parsed.exportBounds) {
        updateLayoutWithHistory(parsed);
        setSelectedNodeId(null);
        alert('Native layout JSON imported successfully!');
      } else if (isDrawioContent(parsed)) {
        const translatedLayout = convertDrawioToProjectLayout(parsed, layout);
        updateLayoutWithHistory(translatedLayout);
        setSelectedNodeId(null);
        alert(`Draw.io diagram translated & imported successfully (${translatedLayout.scene.length} scene elements)!`);
      } else {
        alert('Unrecognized layout schema. Please provide a valid Native Layout JSON or Draw.io Diagram XML/JSON file.');
      }
    } catch (err: any) {
      alert(`Failed to parse or translate imported content: ${err?.message || err}`);
    }
  };

  const handleTriggerImport = (_mode?: 'auto' | 'native' | 'drawio') => {
    fileInputRef.current?.click();
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const rawText = event.target?.result as string;
      handleProcessImportContent(rawText);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleResetLayout = () => {
    if (window.confirm('Reset scene layout to default mock parameters?')) {
      try {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
      } catch (e) {}
      updateLayoutWithHistory(INITIAL_LAYOUT);
      setSelectedNodeId(null);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 font-sans relative">
      {/* Save Notification Toast */}
      {saveNotification && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-4 py-2 rounded-xl shadow-2xl flex items-center gap-2 text-xs font-bold animate-bounce">
          <Check className="w-4 h-4" />
          <span>Committed to Cache! (Ctrl+S)</span>
        </div>
      )}

      {/* Top Application Header */}
      <header className="h-13 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between z-20 shrink-0 select-none">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsChangelogOpen(true)}
              className="p-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white transition shadow"
              title="Open Release Changelog"
            >
              <Compass className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xs font-bold text-slate-100 leading-none">
                  OOS (Scientific Sketch Link)
                </h1>
                <button
                  onClick={() => setIsChangelogOpen(true)}
                  className="px-1 py-0.2 bg-indigo-950 text-indigo-300 border border-indigo-700/60 rounded text-[9px] font-mono font-bold hover:bg-indigo-900 transition flex items-center gap-0.5"
                  title="View Changelog"
                >
                  <Sparkles className="w-2.5 h-2.5 text-emerald-400" />
                  <span>v1.6</span>
                </button>
              </div>
            </div>
          </div>

          {/* Top Navbar Dropdown Menus */}
          <div className="flex items-center gap-1 text-xs border-l border-slate-800 pl-3" ref={navbarRef}>
            {/* File Menu */}
            <div className="relative">
              <button
                onClick={() => setActiveMenu(activeMenu === 'file' ? null : 'file')}
                className={`px-2.5 py-1 rounded font-medium transition flex items-center gap-1 ${
                  activeMenu === 'file' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <span>File</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {activeMenu === 'file' && (
                <div className="absolute left-0 top-full mt-1 w-56 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 py-1.5 text-xs text-slate-200">
                  <button
                    onClick={() => {
                      handleExportJSON();
                      setActiveMenu(null);
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-slate-800 flex items-center justify-between transition"
                  >
                    <span className="font-medium text-slate-200">Export Layout JSON</span>
                    <Download className="w-3.5 h-3.5 text-indigo-400" />
                  </button>

                  <button
                    onClick={() => {
                      handleTriggerImport('drawio');
                      setActiveMenu(null);
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-slate-800 flex items-center justify-between transition border-t border-slate-800"
                  >
                    <div className="flex flex-col">
                      <span className="font-semibold text-emerald-400">Import Draw.io XML</span>
                      <span className="text-[10px] text-slate-400">Translates elements & LaTeX</span>
                    </div>
                    <Upload className="w-3.5 h-3.5 text-emerald-400" />
                  </button>

                  <button
                    onClick={() => {
                      handleTriggerImport('native');
                      setActiveMenu(null);
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-slate-800 flex items-center justify-between transition border-t border-slate-800"
                  >
                    <div className="flex flex-col">
                      <span className="font-semibold text-indigo-300">Import Native JSON</span>
                      <span className="text-[10px] text-slate-400">Restores native layout file (.json)</span>
                    </div>
                    <Upload className="w-3.5 h-3.5 text-indigo-400" />
                  </button>
                </div>
              )}
            </div>

            {/* Edit Menu */}
            <div className="relative">
              <button
                onClick={() => setActiveMenu(activeMenu === 'edit' ? null : 'edit')}
                className={`px-2.5 py-1 rounded font-medium transition flex items-center gap-1 ${
                  activeMenu === 'edit' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <span>Edit</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {activeMenu === 'edit' && (
                <div className="absolute left-0 top-full mt-1 w-52 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 py-1.5 text-xs text-slate-200">
                  <button
                    disabled={historyIndex <= 0}
                    onClick={() => {
                      handleUndo();
                      setActiveMenu(null);
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-slate-800 flex items-center justify-between disabled:opacity-40 disabled:hover:bg-transparent"
                  >
                    <span>Undo</span>
                    <span className="text-[10px] text-slate-500 font-mono">Ctrl+Z</span>
                  </button>

                  <button
                    disabled={historyIndex >= history.length - 1}
                    onClick={() => {
                      handleRedo();
                      setActiveMenu(null);
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-slate-800 flex items-center justify-between border-b border-slate-800 disabled:opacity-40 disabled:hover:bg-transparent"
                  >
                    <span>Redo</span>
                    <span className="text-[10px] text-slate-500 font-mono">Ctrl+Y</span>
                  </button>

                  <button
                    onClick={() => {
                      handleResetLayout();
                      setActiveMenu(null);
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-slate-800 text-rose-400 flex items-center justify-between transition"
                  >
                    <span>Reset Scene to Default</span>
                    <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                  </button>
                </div>
              )}
            </div>

            {/* View Menu */}
            <div className="relative">
              <button
                onClick={() => setActiveMenu(activeMenu === 'view' ? null : 'view')}
                className={`px-2.5 py-1 rounded font-medium transition flex items-center gap-1 ${
                  activeMenu === 'view' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <span>View</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {activeMenu === 'view' && (
                <div className="absolute left-0 top-full mt-1 w-56 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 py-1.5 text-xs text-slate-200">
                  <button
                    onClick={() => {
                      setShowLeftSidebar(!showLeftSidebar);
                      setActiveMenu(null);
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-slate-800 flex items-center justify-between transition"
                  >
                    <span>{showLeftSidebar ? 'Hide Left Sidebar' : 'Show Left Sidebar'}</span>
                    <PanelLeft className="w-3.5 h-3.5 text-indigo-400" />
                  </button>

                  <button
                    onClick={() => {
                      setShowRightPanel(!showRightPanel);
                      setActiveMenu(null);
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-slate-800 flex items-center justify-between transition border-t border-slate-800"
                  >
                    <span>{showRightPanel ? 'Hide Right Panel' : 'Show Right Panel'}</span>
                    <PanelRight className="w-3.5 h-3.5 text-indigo-400" />
                  </button>

                  <button
                    onClick={() => {
                      handleUpdatePlotOptions({ ...layout.plotOptions, showGrid: !layout.plotOptions.showGrid });
                      setActiveMenu(null);
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-slate-800 flex items-center justify-between transition border-t border-slate-800"
                  >
                    <span>{layout.plotOptions.showGrid ? 'Hide Grid Overlay' : 'Show Grid Overlay'}</span>
                    <Grid className="w-3.5 h-3.5 text-emerald-400" />
                  </button>

                  <button
                    onClick={() => {
                      handleUpdatePlotOptions({ ...layout.plotOptions, showAxis: !layout.plotOptions.showAxis });
                      setActiveMenu(null);
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-slate-800 flex items-center justify-between transition border-t border-slate-800"
                  >
                    <span>{layout.plotOptions.showAxis ? 'Hide Axis Frame' : 'Show Axis Frame'}</span>
                    <Eye className="w-3.5 h-3.5 text-amber-400" />
                  </button>
                </div>
              )}
            </div>

            {/* Settings Menu */}
            <div className="relative">
              <button
                onClick={() => setActiveMenu(activeMenu === 'settings' ? null : 'settings')}
                className={`px-2.5 py-1 rounded font-medium transition flex items-center gap-1 ${
                  activeMenu === 'settings' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <span>Settings</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {activeMenu === 'settings' && (
                <div className="absolute left-0 top-full mt-1 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 p-3 space-y-3 text-xs text-slate-200">
                  {/* Grid Resolution */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Grid Snap & Resolution</label>
                    <select
                      value={layout.plotOptions.gridResolution ?? 1.0}
                      onChange={(e) => handleUpdatePlotOptions({ ...layout.plotOptions, gridResolution: parseFloat(e.target.value) || 1.0 })}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-indigo-300 font-mono font-bold focus:outline-none"
                    >
                      <option value={0.25}>0.25x (Ultra-Fine Subdivisions)</option>
                      <option value={0.5}>0.50x (Fine Grid Subdivisions)</option>
                      <option value={1.0}>1.00x (Standard Adaptive Grid)</option>
                      <option value={2.0}>2.00x (Coarse Grid)</option>
                    </select>
                  </div>

                  {/* Scale Labels with Zoom Toggle */}
                  <div className="flex items-center justify-between border-t border-slate-800 pt-2">
                    <div className="flex flex-col pr-2">
                      <span className="text-xs font-bold text-slate-200">Scale Labels with Zoom</span>
                      <span className="text-[10px] text-slate-400 leading-tight">Shrinks text on zoom-out to avoid blocking diagram</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={layout.plotOptions.scaleLabelsWithZoom ?? true}
                      onChange={(e) => handleUpdatePlotOptions({ ...layout.plotOptions, scaleLabelsWithZoom: e.target.checked })}
                      className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
                    />
                  </div>

                  {/* Label Bounding Box Opacity Slider */}
                  <div className="space-y-1 border-t border-slate-800 pt-2">
                    <div className="flex justify-between items-center text-xs">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Label Box Opacity</label>
                      <span className="font-mono text-indigo-400 font-bold">{Math.round((layout.plotOptions.labelBoxOpacity ?? 0.0) * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.0"
                      max="1.0"
                      step="0.05"
                      value={layout.plotOptions.labelBoxOpacity ?? 0.0}
                      onChange={(e) => handleUpdatePlotOptions({ ...layout.plotOptions, labelBoxOpacity: parseFloat(e.target.value) || 0 })}
                      className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                  </div>

                  {/* Grab Handle Size (Dashed Circle Radius) */}
                  <div className="space-y-1 border-t border-slate-800 pt-2">
                    <div className="flex justify-between items-center text-xs">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Grab Handle Size (Dashed Circle)</label>
                      <span className="font-mono text-indigo-400 font-bold">{layout.plotOptions.grabHandleRadius ?? 14} px</span>
                    </div>
                    <input
                      type="range"
                      min="6"
                      max="36"
                      step="1"
                      value={layout.plotOptions.grabHandleRadius ?? 14}
                      onChange={(e) => handleUpdatePlotOptions({ ...layout.plotOptions, grabHandleRadius: parseInt(e.target.value, 10) || 14 })}
                      className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                  </div>

                  {/* Live Math Mode (KaTeX on Canvas) */}
                  <div className="flex items-center justify-between border-t border-slate-800 pt-2">
                    <div className="flex flex-col pr-2">
                      <span className="text-xs font-bold text-slate-200">Render LaTeX Math Mode</span>
                      <span className="text-[10px] text-slate-400 leading-tight">Render math formulas on canvas (Shortcut: M)</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={layout.plotOptions.renderMathOnCanvas ?? true}
                      onChange={(e) => handleUpdatePlotOptions({ ...layout.plotOptions, renderMathOnCanvas: e.target.checked })}
                      className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
                    />
                  </div>

                  {/* Auto-Save Interval */}
                  <div className="space-y-1 border-t border-slate-800 pt-2">
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Auto-Save Interval</label>
                    <select
                      value={autoSaveSeconds}
                      onChange={(e) => setAutoSaveSeconds(parseInt(e.target.value, 10))}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-emerald-400 font-bold focus:outline-none"
                    >
                      <option value={60}>Every 60 Seconds (Default)</option>
                      <option value={5}>Every 5 Seconds</option>
                      <option value={10}>Every 10 Seconds</option>
                      <option value={30}>Every 30 Seconds</option>
                      <option value={0}>Disabled (Off)</option>
                    </select>
                  </div>

                  {/* Font Size Presets */}
                  <div className="space-y-1.5 border-t border-slate-800 pt-2">
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Font Size Presets (pt)</label>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <span className="text-[10px] text-slate-400 block mb-0.5">Small</span>
                        <input
                          type="number"
                          value={fontSizePresets.small}
                          onChange={(e) => setFontSizePresets((p) => ({ ...p, small: parseInt(e.target.value, 10) || 18 }))}
                          className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-indigo-400 font-bold text-center focus:outline-none"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block mb-0.5">Med (Def)</span>
                        <input
                          type="number"
                          value={fontSizePresets.med}
                          onChange={(e) => setFontSizePresets((p) => ({ ...p, med: parseInt(e.target.value, 10) || 23 }))}
                          className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-emerald-400 font-bold text-center focus:outline-none"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block mb-0.5">Large</span>
                        <input
                          type="number"
                          value={fontSizePresets.large}
                          onChange={(e) => setFontSizePresets((p) => ({ ...p, large: parseInt(e.target.value, 10) || 30 }))}
                          className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-amber-400 font-bold text-center focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Help Menu */}
            <div className="relative">
              <button
                onClick={() => setIsChangelogOpen(true)}
                className="px-2.5 py-1 rounded font-medium transition text-slate-300 hover:bg-slate-800 flex items-center gap-1"
              >
                <span>Help</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-3">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportJSON}
            accept=".json,.xml,.drawio"
            className="hidden"
          />

          {/* Quick Side Panel Toggle Buttons */}
          <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-lg border border-slate-700">
            <button
              onClick={() => setShowLeftSidebar(!showLeftSidebar)}
              className={`p-1.5 rounded-md transition ${
                showLeftSidebar ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
              }`}
              title={showLeftSidebar ? "Hide Left Sidebar (Scene Tree & Tools)" : "Show Left Sidebar (Scene Tree & Tools)"}
            >
              <PanelLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowRightPanel(!showRightPanel)}
              className={`p-1.5 rounded-md transition ${
                showRightPanel ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
              }`}
              title={showRightPanel ? "Hide Right Panel (Preview & Settings)" : "Show Right Panel (Preview & Settings)"}
            >
              <PanelRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700 text-xs">
            <button
              onClick={() => {
                setActiveRightPanel('preview');
                setShowRightPanel(true);
              }}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition ${
                activeRightPanel === 'preview' && showRightPanel
                  ? 'bg-indigo-600 text-white font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Matplotlib Output</span>
            </button>

            <button
              onClick={() => {
                setActiveRightPanel('plot');
                setShowRightPanel(true);
              }}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition ${
                activeRightPanel === 'plot' && showRightPanel
                  ? 'bg-indigo-600 text-white font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>PDF & Plot Settings</span>
            </button>

            <button
              onClick={() => {
                setActiveRightPanel('macros');
                setShowRightPanel(true);
              }}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition ${
                activeRightPanel === 'macros' && showRightPanel
                  ? 'bg-indigo-600 text-white font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>LaTeX Macros ({Object.keys(layout.macros).length})</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Body */}
      <div className="flex-1 flex min-h-0 relative overflow-hidden">
        {/* Left Sidebar */}
        {showLeftSidebar && (
          <Sidebar
            mode={activeWorkspaceTab}
            onModeChange={handleModeChange}
            scene={layout.scene}
            definitions={layout.definitions}
            activeRobotDefId={activeRobotDefId}
            selectedPrimitiveIdx={selectedPrimitiveIdx}
            selectedPrimitiveIdxs={selectedPrimitiveIdxs}
            macros={layout.macros}
            exportBounds={layout.exportBounds}
            plotOptions={layout.plotOptions}
            onUpdatePlotOptions={handleUpdatePlotOptions}
            selectedNodeId={selectedNodeId}
            selectedNodeIds={selectedNodeIds}
            drawingMode={drawingMode}
            setDrawingMode={setDrawingMode}
            pendingShapeToAdd={pendingShapeToAdd}
            setPendingShapeToAdd={setPendingShapeToAdd}
            setActiveRobotDefId={setActiveRobotDefId}
            onAddNode={handleAddNode}
            onUpdateNode={handleUpdateNode}
            onDeleteNode={handleDeleteNode}
            onMoveLayer={handleMoveLayer}
            onMovePrimitiveLayer={handleMovePrimitiveLayer}
            onUpdateExportBounds={handleUpdateExportBounds}
            onSelectNode={handleSelectNode}
            onSelectPrimitive={setSelectedPrimitiveIdx}
            onSelectPrimitives={setSelectedPrimitiveIdxs}
            onAddPrimitive={handleAddPrimitive}
            onImportComponentPrimitives={handleImportComponentPrimitives}
            onDeletePrimitive={handleDeletePrimitive}
            onDeletePrimitives={handleDeletePrimitives}
            onDuplicatePrimitive={handleDuplicatePrimitive}
            onUpdatePrimitive={handleUpdatePrimitive}
            onUpdatePrimitives={handleUpdatePrimitives}
            onUpdateDefinitions={handleUpdateDefinitions}
          />
        )}

        {/* Center Canvas Stage */}
        <div className="flex-1 h-full flex flex-col relative min-w-0 overflow-hidden">
          <div className="flex-1 h-full relative min-w-0 overflow-hidden">
            <CanvasStage
              mode={activeWorkspaceTab}
              scene={layout.scene}
              definitions={layout.definitions}
              activeRobotDefId={activeRobotDefId}
              exportBounds={layout.exportBounds}
              plotOptions={layout.plotOptions}
              macros={layout.macros}
              selectedNodeId={selectedNodeId}
              selectedNodeIds={selectedNodeIds}
              selectedPrimitiveIdx={selectedPrimitiveIdx}
              selectedPrimitiveIdxs={selectedPrimitiveIdxs}
              drawingMode={drawingMode}
              setDrawingMode={setDrawingMode}
              pendingShapeToAdd={pendingShapeToAdd}
              setPendingShapeToAdd={setPendingShapeToAdd}
              fontSizePresets={fontSizePresets}
              onAddNode={handleAddNode}
              onSelectNode={handleSelectNode}
              onSelectNodes={setSelectedNodeIds}
              onSelectPrimitive={setSelectedPrimitiveIdx}
              onSelectPrimitives={setSelectedPrimitiveIdxs}
              onUpdateNode={handleUpdateNode}
              onUpdateNodes={handleUpdateNodes}
              onUpdateScene={(newScene) => updateLayoutWithHistory({ ...layout, scene: newScene })}
              onUpdatePrimitive={handleUpdatePrimitive}
              onUpdatePrimitives={handleUpdatePrimitives}
              onDeletePrimitive={handleDeletePrimitive}
              onDeletePrimitives={handleDeletePrimitives}
              onMovePrimitiveLayer={handleMovePrimitiveLayer}
              onUpdateExportBounds={handleUpdateExportBounds}
              onAddVectorOrLine={handleAddVectorOrLine}
              onAddMegaLine={handleAddMegaLine}
              onAddTextEntity={handleAddTextEntity}
              onAddPolygonPrimitive={handleAddPolygonPrimitive}
              onDeleteNode={handleDeleteNode}
            />
          </div>
        </div>

        {/* Right Side Panel */}
        {showRightPanel && (
          <div className="w-[450px] h-full shrink-0">
            {activeRightPanel === 'preview' && <LivePreview layout={layout} />}
            {activeRightPanel === 'plot' && (
              <PlotSettings
                plotOptions={layout.plotOptions}
                onUpdatePlotOptions={handleUpdatePlotOptions}
              />
            )}
            {activeRightPanel === 'macros' && (
              <MacroEditor macros={layout.macros} onUpdateMacros={handleUpdateMacros} />
            )}
          </div>
        )}
      </div>

      {/* Changelog Modal */}
      <ChangelogModal isOpen={isChangelogOpen} onClose={() => setIsChangelogOpen(false)} />
    </div>
  );
}

export default App;
