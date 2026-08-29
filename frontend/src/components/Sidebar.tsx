import React, { useState } from 'react';
import type { SceneNode, RobotDefinition, MacroDefinition, PrimitiveDefinition, ExportBounds, PlotOptions, DrawingMode, PendingShapeToAdd } from '../types/schema';
import { useMacroParser } from '../hooks/useMacroParser';
import { Box, MoveRight, Layers, Sliders, Trash2, CornerDownRight, Maximize2, MousePointer, Plus, ArrowUp, ArrowDown, Circle, Square, Triangle, Hexagon, Tag, Copy, Crop, Type, Target, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';

interface SidebarProps {
  mode: 'main_scene' | 'robot_designer';
  onModeChange: (mode: 'main_scene' | 'robot_designer') => void;
  scene: SceneNode[];
  definitions: Record<string, RobotDefinition>;
  activeRobotDefId: string | null;
  selectedPrimitiveIdx: number | null;
  selectedPrimitiveIdxs: number[];
  macros: Record<string, MacroDefinition>;
  exportBounds: ExportBounds;
  plotOptions?: PlotOptions;
  onUpdatePlotOptions?: (options: PlotOptions) => void;
  selectedNodeId: string | null;
  selectedNodeIds?: string[];
  drawingMode: DrawingMode;
  setDrawingMode: (mode: DrawingMode) => void;
  pendingShapeToAdd: PendingShapeToAdd | null;
  setPendingShapeToAdd: (pending: PendingShapeToAdd | null) => void;
  setActiveRobotDefId: (id: string) => void;
  onAddNode: (type: SceneNode['type'], definitionId?: string, x?: number, y?: number) => void;
  onUpdateNode: (updatedNode: SceneNode) => void;
  onDeleteNode: (id: string) => void;
  onMoveLayer: (id: string, direction: 'up' | 'down') => void;
  onMovePrimitiveLayer: (idx: number, direction: 'up' | 'down') => void;
  onUpdateExportBounds: (bounds: ExportBounds) => void;
  onSelectNode: (id: string | null) => void;
  onSelectPrimitive: (idx: number | null) => void;
  onSelectPrimitives: (idxs: number[]) => void;
  onAddPrimitive: (type: PrimitiveDefinition['type']) => void;
  onImportComponentPrimitives: (sourceDefId: string) => void;
  onDeletePrimitive: (idx: number) => void;
  onDeletePrimitives?: (idxs: number[]) => void;
  onDuplicatePrimitive?: (idx: number) => void;
  onUpdatePrimitive: (idx: number, prim: PrimitiveDefinition) => void;
  onUpdatePrimitives?: (updates: Array<{ idx: number; prim: PrimitiveDefinition }>) => void;
  onUpdateDefinitions: (defs: Record<string, RobotDefinition>) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  mode,
  onModeChange,
  scene,
  definitions,
  activeRobotDefId,
  selectedPrimitiveIdx,
  selectedPrimitiveIdxs,
  macros,
  exportBounds,
  plotOptions,
  onUpdatePlotOptions,
  selectedNodeId,
  selectedNodeIds: _selectedNodeIds = [],
  drawingMode,
  setDrawingMode,
  pendingShapeToAdd,
  setPendingShapeToAdd,
  setActiveRobotDefId,
  onAddNode: _onAddNode,
  onUpdateNode,
  onDeleteNode,
  onMoveLayer,
  onMovePrimitiveLayer,
  onUpdateExportBounds,
  onSelectNode,
  onSelectPrimitive,
  onSelectPrimitives,
  onAddPrimitive,
  onImportComponentPrimitives,
  onDeletePrimitive,
  onDeletePrimitives: _onDeletePrimitives,
  onDuplicatePrimitive,
  onUpdatePrimitive,
  onUpdateDefinitions,
}) => {
  const selectedNode = scene.find((n) => n.id === selectedNodeId);
  const isExportBoundsSelected = selectedNodeId === 'export_bounds' || !selectedNodeId;

  const [selectedShapeToAdd, setSelectedShapeToAdd] = useState<string>(Object.keys(definitions)[0] || '');
  const [selectedComponentToImport, setSelectedComponentToImport] = useState<string>('');
  const [newRobotName, setNewRobotName] = useState('');

  const { suggestions } = useMacroParser(macros, selectedNode?.label || '');
  const [showMacroSuggestions, setShowMacroSuggestions] = useState(false);
  const [activeSuggestionIdx, setActiveSuggestionIdx] = useState(0);

  const activeDef = activeRobotDefId ? definitions[activeRobotDefId] : null;
  const activePrimitive = activeDef && selectedPrimitiveIdx !== null ? activeDef.primitives[selectedPrimitiveIdx] : null;

  const labelInputRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    setActiveSuggestionIdx(0);
  }, [suggestions]);

  React.useEffect(() => {
    if (selectedNodeId) {
      const el = document.getElementById(`scene_tree_node_${selectedNodeId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [selectedNodeId]);

  const handleCreateNewRobot = () => {
    if (!newRobotName.trim()) return;
    const id = `custom_${Date.now()}`;
    const newDef: RobotDefinition = {
      id,
      name: newRobotName.trim(),
      primitives: [
        { id: 'chassis', type: 'circle', config: { radius: 30, strokeColor: '#3b82f6', fillColor: '#dbeafe' } },
      ],
    };
    onUpdateDefinitions({ ...definitions, [id]: newDef });
    setActiveRobotDefId(id);
    setNewRobotName('');
  };

  const handleDeleteActiveRobot = () => {
    if (!activeRobotDefId) return;
    const currentName = definitions[activeRobotDefId]?.name || 'this component';
    const confirmDelete = window.confirm(`Are you sure you want to delete component "${currentName}"?`);
    if (!confirmDelete) return;

    const newDefs = { ...definitions };
    delete newDefs[activeRobotDefId];

    const remainingIds = Object.keys(newDefs);
    const nextId = remainingIds.length > 0 ? remainingIds[0] : '';

    onUpdateDefinitions(newDefs);
    setActiveRobotDefId(nextId || null as any);
  };

  const handleLabelChange = (val: string) => {
    if (!selectedNode) return;
    onUpdateNode({ ...selectedNode, label: val });
  };

  const handleSelectMacroSuggestion = (macro: { command: string; argsCount?: number }) => {
    if (!selectedNode) return;
    const current = selectedNode.label || '';
    const textarea = labelInputRef.current;
    const cursorPos = textarea ? textarea.selectionStart : current.length;
    const textBeforeCursor = current.slice(0, cursorPos);
    const textAfterCursor = current.slice(cursorPos);

    const lastBackslash = textBeforeCursor.lastIndexOf('\\');
    const prefix = lastBackslash >= 0 ? textBeforeCursor.slice(0, lastBackslash) : textBeforeCursor;

    let inserted = macro.command;
    let targetCursorOffset = inserted.length;

    if ((macro.argsCount ?? 0) > 0) {
      inserted = `${macro.command}{}`;
      targetCursorOffset = macro.command.length + 1; // position cursor inside {}
    }

    const newText = prefix + inserted + textAfterCursor;
    const targetCursorPos = prefix.length + targetCursorOffset;

    onUpdateNode({ ...selectedNode, label: newText });
    setShowMacroSuggestions(false);

    setTimeout(() => {
      if (labelInputRef.current) {
        labelInputRef.current.focus();
        labelInputRef.current.setSelectionRange(targetCursorPos, targetCursorPos);
      }
    }, 10);
  };

  const getNodeIcon = (type: SceneNode['type']) => {
    switch (type) {
      case 'vector':
        return <MoveRight className="w-3.5 h-3.5 text-red-400" />;
      case 'line':
        return <CornerDownRight className="w-3.5 h-3.5 text-sky-400" />;
      case 'text':
        return <Tag className="w-3.5 h-3.5 text-purple-400" />;
      case 'obstacle':
        return <Box className="w-3.5 h-3.5 text-amber-400" />;
      default:
        return <Box className="w-3.5 h-3.5 text-indigo-400" />;
    }
  };

  const availableDefsForImport = Object.values(definitions).filter((d) => d.id !== activeRobotDefId);

  return (
    <div className="w-80 bg-slate-900 border-r border-slate-800 flex flex-col h-full text-slate-200 shrink-0">
      {/* Sidebar Header Tab Switcher: Scene Tree vs Component Tools */}
      <div className="flex border-b border-slate-800 bg-slate-950/60">
        <button
          onClick={() => {
            onModeChange('main_scene');
            setDrawingMode('select');
          }}
          className={`flex-1 py-3 text-xs font-bold transition flex items-center justify-center gap-1.5 border-b-2 ${
            mode === 'main_scene'
              ? 'border-indigo-500 text-indigo-400 bg-slate-900'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Scene Tree</span>
        </button>

        <button
          onClick={() => {
            onModeChange('robot_designer');
            setDrawingMode('select');
          }}
          className={`flex-1 py-3 text-xs font-bold transition flex items-center justify-center gap-1.5 border-b-2 ${
            mode === 'robot_designer'
              ? 'border-emerald-500 text-emerald-400 bg-slate-900'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
          }`}
        >
          <Box className="w-3.5 h-3.5" />
          <span>Component Tools</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {mode === 'robot_designer' ? (
          /* ================= SHEET 2: COMPONENT TOOLS SIDEBAR ================= */
          <>
            {/* Active Component Definition Selector */}
            <div className="bg-slate-800/60 p-3.5 rounded-xl border border-slate-700 space-y-3">
              <span className="text-xs font-semibold text-slate-300">Active Component Model</span>
              <select
                value={activeRobotDefId || ''}
                onChange={(e) => setActiveRobotDefId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-emerald-400 font-semibold"
              >
                {Object.values(definitions).map((def) => (
                  <option key={def.id} value={def.id}>
                    {def.name} ({def.primitives.length} parts)
                  </option>
                ))}
              </select>

              <div className="flex gap-2 pt-1">
                <input
                  type="text"
                  placeholder="New Component Name..."
                  value={newRobotName}
                  onChange={(e) => setNewRobotName(e.target.value)}
                  className="flex-1 min-w-0 bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-slate-200"
                />
                <button
                  onClick={handleCreateNewRobot}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold flex items-center gap-1 transition whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create</span>
                </button>
                <button
                  disabled={!activeRobotDefId}
                  onClick={handleDeleteActiveRobot}
                  className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-semibold flex items-center gap-1 transition disabled:opacity-40 whitespace-nowrap"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              </div>
            </div>

            {/* Tool Mode for Component Designer */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Tool Mode
              </span>
              <div className="space-y-1.5 bg-slate-950 p-1.5 rounded-lg border border-slate-800 text-[10px]">
                <div className="grid grid-cols-4 gap-1">
                  <button
                    onClick={() => setDrawingMode('select')}
                    className={`flex flex-col items-center justify-center gap-1 py-1.5 rounded-md font-medium transition ${
                      drawingMode === 'select' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="Select and Drag"
                  >
                    <MousePointer className="w-3 h-3" />
                    <span>Select</span>
                  </button>

                  <button
                    onClick={() => setDrawingMode('draw_poly')}
                    className={`flex flex-col items-center justify-center gap-1 py-1.5 rounded-md font-medium transition ${
                      drawingMode === 'draw_poly' ? 'bg-pink-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="Draw Polygon Chain"
                  >
                    <Hexagon className="w-3 h-3" />
                    <span>+ Poly</span>
                  </button>

                  <button
                    onClick={() => setDrawingMode('draw_vector')}
                    className={`flex flex-col items-center justify-center gap-1 py-1.5 rounded-md font-medium transition ${
                      drawingMode === 'draw_vector' ? 'bg-red-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                    title="Add Vector Arrow"
                  >
                    <MoveRight className="w-3 h-3 text-red-400" />
                    <span>+ Vector</span>
                  </button>

                  <button
                    onClick={() => setDrawingMode('draw_line')}
                    className={`flex flex-col items-center justify-center gap-1 py-1.5 rounded-md font-medium transition ${
                      drawingMode === 'draw_line' ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                    title="Add Line Segment"
                  >
                    <CornerDownRight className="w-3 h-3 text-sky-400" />
                    <span>+ Line</span>
                  </button>
                </div>

                {/* Row 2: Super Vector & Super Line primitives */}
                <div className="grid grid-cols-2 gap-1 pt-1 border-t border-slate-800/80">
                  <button
                    onClick={() => setDrawingMode('draw_super_vector')}
                    className={`flex items-center justify-center gap-1.5 py-1 rounded-md font-bold transition border border-amber-900/30 ${
                      drawingMode === 'draw_super_vector' ? 'bg-amber-600 text-white shadow' : 'bg-slate-900 text-amber-400 hover:bg-slate-800'
                    }`}
                    title="Add Super Vector Primitive"
                  >
                    <MoveRight className="w-3 h-3" />
                    <span>⚡ + Super Vector</span>
                  </button>

                  <button
                    onClick={() => setDrawingMode('draw_super_line')}
                    className={`flex items-center justify-center gap-1.5 py-1 rounded-md font-bold transition border border-emerald-900/30 ${
                      drawingMode === 'draw_super_line' ? 'bg-emerald-600 text-white shadow' : 'bg-slate-900 text-emerald-400 hover:bg-slate-800'
                    }`}
                    title="Add Super Line Primitive"
                  >
                    <CornerDownRight className="w-3 h-3" />
                    <span>⚡ + Super Line</span>
                  </button>
                </div>

                {/* Row 3: Mega Vector & Mega Line primitives */}
                <div className="grid grid-cols-2 gap-1 pt-1 border-t border-slate-800/80">
                  <button
                    onClick={() => setDrawingMode('draw_mega_vector')}
                    className={`flex items-center justify-center gap-1.5 py-1 rounded-md font-bold transition border border-rose-900/30 ${
                      drawingMode === 'draw_mega_vector' ? 'bg-rose-600 text-white shadow' : 'bg-slate-900 text-rose-400 hover:bg-slate-800'
                    }`}
                    title="Add Mega Vector Poly-Chain"
                  >
                    <MoveRight className="w-3 h-3" />
                    <span>🌊 + Mega Vector</span>
                  </button>

                  <button
                    onClick={() => setDrawingMode('draw_mega_line')}
                    className={`flex items-center justify-center gap-1.5 py-1 rounded-md font-bold transition border border-cyan-900/30 ${
                      drawingMode === 'draw_mega_line' ? 'bg-cyan-600 text-white shadow' : 'bg-slate-900 text-cyan-400 hover:bg-slate-800'
                    }`}
                    title="Add Mega Line Poly-Chain"
                  >
                    <CornerDownRight className="w-3 h-3" />
                    <span>🌊 + Mega Line</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Add Other Shape Section */}
            <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-700/80 space-y-2">
              <span className="text-xs font-semibold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                <Copy className="w-3.5 h-3.5 text-indigo-400" />
                <span>Add Other Shape (Flatten Primitives)</span>
              </span>

              <div className="flex gap-2 pt-1">
                <select
                  value={selectedComponentToImport}
                  onChange={(e) => setSelectedComponentToImport(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-indigo-300 font-medium"
                >
                  <option value="">Select Shape to Copy...</option>
                  {availableDefsForImport.map((def) => (
                    <option key={def.id} value={def.id}>
                      {def.name} ({def.primitives.length} parts)
                    </option>
                  ))}
                </select>

                <button
                  disabled={!selectedComponentToImport}
                  onClick={() => {
                    if (selectedComponentToImport) {
                      onImportComponentPrimitives(selectedComponentToImport);
                      setSelectedComponentToImport('');
                    }
                  }}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition disabled:opacity-40"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Import</span>
                </button>
              </div>
            </div>

            {/* Add Primitive Shape */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Add Primitive Shape
              </span>
              <div className="grid grid-cols-4 gap-1.5">
                <button
                  onClick={() => onAddPrimitive('circle')}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 text-[11px] flex flex-col items-center justify-center gap-1 text-slate-300 transition"
                  title="Add Circle Primitive"
                >
                  <Circle className="w-3.5 h-3.5 text-blue-400" />
                  <span>Circle</span>
                </button>
                <button
                  onClick={() => onAddPrimitive('rect')}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 text-[11px] flex flex-col items-center justify-center gap-1 text-slate-300 transition"
                  title="Add Rectangle Primitive"
                >
                  <Square className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Rect</span>
                </button>
                <button
                  onClick={() => onAddPrimitive('diamond')}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 text-[11px] flex flex-col items-center justify-center gap-1 text-slate-300 transition"
                  title="Add Diamond Primitive"
                >
                  <Hexagon className="w-3.5 h-3.5 text-amber-400 rotate-45" />
                  <span>Diamond</span>
                </button>
                <button
                  onClick={() => onAddPrimitive('triangle')}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 text-[11px] flex flex-col items-center justify-center gap-1 text-slate-300 transition"
                  title="Add Triangle Primitive"
                >
                  <Triangle className="w-3.5 h-3.5 text-rose-400" />
                  <span>Triangle</span>
                </button>
              </div>
            </div>

            {/* Component Parts Tree */}
            {activeDef && (
              <div className="space-y-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Component Parts ({activeDef.primitives.length})
                </span>

                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                  {activeDef.primitives.length === 0 ? (
                    <span className="text-[11px] text-slate-500 italic block text-center py-2">
                      No parts in this component model
                    </span>
                  ) : (
                    activeDef.primitives.map((prim, idx) => {
                      const isSelected = selectedPrimitiveIdx === idx;
                      const isGroupSelected = selectedPrimitiveIdxs.includes(idx);
                      return (
                        <div
                          key={idx}
                          onClick={() => {
                            onSelectPrimitive(idx);
                            onSelectPrimitives([idx]);
                          }}
                          className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer border transition ${
                            isSelected
                              ? 'bg-emerald-900/40 border-emerald-500 text-white font-medium'
                              : isGroupSelected
                              ? 'bg-slate-800/80 border-slate-600/80 text-white'
                              : 'bg-slate-900/80 border-slate-800/80 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <span className="capitalize">
                            #{idx + 1} {prim.type}
                          </span>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onMovePrimitiveLayer(idx, 'up');
                              }}
                              disabled={idx === activeDef.primitives.length - 1}
                              className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded disabled:opacity-30"
                              title="Move Part Up"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onMovePrimitiveLayer(idx, 'down');
                              }}
                              disabled={idx === 0}
                              className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded disabled:opacity-30"
                              title="Move Part Down"
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>
                            {onDuplicatePrimitive && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDuplicatePrimitive(idx);
                                }}
                                className="p-1 hover:bg-slate-800 text-slate-400 hover:text-indigo-300 rounded"
                                title="Duplicate Part"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeletePrimitive(idx);
                              }}
                              className="p-1 hover:bg-slate-800 text-slate-400 hover:text-red-400 rounded"
                              title="Delete Part"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Inspect Component Part */}
                {activePrimitive && selectedPrimitiveIdx !== null && (
                  <div className="bg-slate-800/60 p-3.5 rounded-xl border border-slate-700 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-100">
                        <Sliders className="w-4 h-4 text-emerald-400" />
                        <span className="uppercase">Inspect Part #{selectedPrimitiveIdx + 1} ({activePrimitive.type})</span>
                      </div>
                      <button
                        onClick={() => onDeletePrimitive(selectedPrimitiveIdx)}
                        className="text-slate-400 hover:text-red-400 p-1 rounded transition"
                        title="Delete Part (Del)"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-semibold text-slate-400">Offset X (px)</label>
                        <input
                          type="number"
                          value={activePrimitive.config.x || 0}
                          onChange={(e) =>
                            onUpdatePrimitive(selectedPrimitiveIdx, {
                              ...activePrimitive,
                              config: { ...activePrimitive.config, x: parseFloat(e.target.value) || 0 },
                            })
                          }
                          className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-400">Offset Y (px)</label>
                        <input
                          type="number"
                          value={activePrimitive.config.y || 0}
                          onChange={(e) =>
                            onUpdatePrimitive(selectedPrimitiveIdx, {
                              ...activePrimitive,
                              config: { ...activePrimitive.config, y: parseFloat(e.target.value) || 0 },
                            })
                          }
                          className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200"
                        />
                      </div>
                    </div>

                    {/* Circle Radius Field */}
                    {activePrimitive.type === 'circle' && (
                      <div>
                        <label className="text-[10px] font-semibold text-slate-400">Radius (px)</label>
                        <input
                          type="number"
                          value={activePrimitive.config.radius || 25}
                          onChange={(e) =>
                            onUpdatePrimitive(selectedPrimitiveIdx, {
                              ...activePrimitive,
                              config: { ...activePrimitive.config, radius: parseFloat(e.target.value) || 0 },
                            })
                          }
                          className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200"
                        />
                      </div>
                    )}

                    {/* Rect Width/Height Fields */}
                    {activePrimitive.type === 'rect' && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-semibold text-slate-400">Width (px)</label>
                          <input
                            type="number"
                            value={activePrimitive.config.width || 30}
                            onChange={(e) =>
                              onUpdatePrimitive(selectedPrimitiveIdx, {
                                ...activePrimitive,
                                config: { ...activePrimitive.config, width: parseFloat(e.target.value) || 0 },
                              })
                            }
                            className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-slate-400">Height (px)</label>
                          <input
                            type="number"
                            value={activePrimitive.config.height || 20}
                            onChange={(e) =>
                              onUpdatePrimitive(selectedPrimitiveIdx, {
                                ...activePrimitive,
                                config: { ...activePrimitive.config, height: parseFloat(e.target.value) || 0 },
                              })
                            }
                            className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200"
                          />
                        </div>
                      </div>
                    )}

                    {/* Diamond Width/Height Fields */}
                    {activePrimitive.type === 'diamond' && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-semibold text-slate-400">Width (px)</label>
                          <input
                            type="number"
                            value={activePrimitive.config.width || 30}
                            onChange={(e) =>
                              onUpdatePrimitive(selectedPrimitiveIdx, {
                                ...activePrimitive,
                                config: { ...activePrimitive.config, width: parseFloat(e.target.value) || 0 },
                              })
                            }
                            className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-slate-400">Height (px)</label>
                          <input
                            type="number"
                            value={activePrimitive.config.height || 20}
                            onChange={(e) =>
                              onUpdatePrimitive(selectedPrimitiveIdx, {
                                ...activePrimitive,
                                config: { ...activePrimitive.config, height: parseFloat(e.target.value) || 0 },
                              })
                            }
                            className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200"
                          />
                        </div>
                      </div>
                    )}

                    {/* Triangle Width & Type Fields */}
                    {activePrimitive.type === 'triangle' && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-semibold text-slate-400">Side / Base (px)</label>
                          <input
                            type="number"
                            value={activePrimitive.config.width || 30}
                            onChange={(e) =>
                              onUpdatePrimitive(selectedPrimitiveIdx, {
                                ...activePrimitive,
                                config: { ...activePrimitive.config, width: parseFloat(e.target.value) || 0 },
                              })
                            }
                            className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-slate-400">Type</label>
                          <select
                            value={activePrimitive.config.triangleType || 'right_isosceles'}
                            onChange={(e) =>
                              onUpdatePrimitive(selectedPrimitiveIdx, {
                                ...activePrimitive,
                                config: { ...activePrimitive.config, triangleType: e.target.value as any },
                              })
                            }
                            className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200"
                          >
                            <option value="right_isosceles">Right Isosceles</option>
                            <option value="equilateral">Equilateral</option>
                          </select>
                        </div>
                      </div>
                    )}

                    {/* Component Primitive Super/Mega Settings */}
                    {(activePrimitive.type === 'super_vector' || activePrimitive.type === 'super_line' || activePrimitive.type === 'mega_vector' || activePrimitive.type === 'mega_line') && (
                      <div className="space-y-3 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800">
                        <span className="text-[11px] font-semibold text-amber-300 uppercase tracking-wider block">Super Settings</span>
                        
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-semibold text-slate-400">Line Shape</label>
                          <div className="flex bg-slate-950 rounded border border-slate-700 p-0.5 text-[10px]">
                            <button
                              onClick={() =>
                                onUpdatePrimitive(selectedPrimitiveIdx, {
                                  ...activePrimitive,
                                  config: { ...activePrimitive.config, lineShape: 'curve' },
                                })
                              }
                              className={`px-2 py-0.5 rounded transition ${
                                (activePrimitive.config.lineShape || 'curve') === 'curve'
                                  ? 'bg-amber-600 text-white font-bold'
                                  : 'text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              Curve
                            </button>
                            <button
                              onClick={() =>
                                onUpdatePrimitive(selectedPrimitiveIdx, {
                                  ...activePrimitive,
                                  config: { ...activePrimitive.config, lineShape: 'straight' },
                                })
                              }
                              className={`px-2 py-0.5 rounded transition ${
                                activePrimitive.config.lineShape === 'straight'
                                  ? 'bg-amber-600 text-white font-bold'
                                  : 'text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              Straight
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-slate-800">
                          <div>
                            <label className="text-[10px] font-semibold text-slate-400">Guidance X (px)</label>
                            <input
                              type="number"
                              value={activePrimitive.config.controlPoint ? activePrimitive.config.controlPoint[0] : 20}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                const cy = activePrimitive.config.controlPoint ? activePrimitive.config.controlPoint[1] : 20;
                                onUpdatePrimitive(selectedPrimitiveIdx, {
                                  ...activePrimitive,
                                  config: { ...activePrimitive.config, controlPoint: [val, cy] },
                                });
                              }}
                              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-slate-400">Guidance Y (px)</label>
                            <input
                              type="number"
                              value={activePrimitive.config.controlPoint ? activePrimitive.config.controlPoint[1] : 20}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                const cx = activePrimitive.config.controlPoint ? activePrimitive.config.controlPoint[0] : 20;
                                onUpdatePrimitive(selectedPrimitiveIdx, {
                                  ...activePrimitive,
                                  config: { ...activePrimitive.config, controlPoint: [cx, val] },
                                });
                              }}
                              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2 pt-2 border-t border-slate-700/60">
                      {/* Color Presets */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-slate-400">Color Presets</label>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            title="Black & White"
                            onClick={() =>
                              onUpdatePrimitive(selectedPrimitiveIdx, {
                                ...activePrimitive,
                                config: { ...activePrimitive.config, strokeColor: '#000000', fillColor: '#ffffff' },
                              })
                            }
                            className="w-5 h-5 rounded border border-slate-600 bg-white hover:scale-110 transition flex items-center justify-center text-[8px] font-bold text-black"
                          >
                            B/W
                          </button>
                          <button
                            type="button"
                            title="Red Theme"
                            onClick={() =>
                              onUpdatePrimitive(selectedPrimitiveIdx, {
                                ...activePrimitive,
                                config: { ...activePrimitive.config, strokeColor: '#ef4444', fillColor: '#fee2e2' },
                              })
                            }
                            className="w-5 h-5 rounded border border-red-500 bg-red-100 hover:scale-110 transition flex items-center justify-center"
                          >
                            <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                          </button>
                          <button
                            type="button"
                            title="Blue Theme"
                            onClick={() =>
                              onUpdatePrimitive(selectedPrimitiveIdx, {
                                ...activePrimitive,
                                config: { ...activePrimitive.config, strokeColor: '#3b82f6', fillColor: '#dbeafe' },
                              })
                            }
                            className="w-5 h-5 rounded border border-blue-500 bg-blue-100 hover:scale-110 transition flex items-center justify-center"
                          >
                            <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                          </button>
                          <button
                            type="button"
                            title="Amber / Gold Theme"
                            onClick={() =>
                              onUpdatePrimitive(selectedPrimitiveIdx, {
                                ...activePrimitive,
                                config: { ...activePrimitive.config, strokeColor: '#f59e0b', fillColor: '#fef3c7' },
                              })
                            }
                            className="w-5 h-5 rounded border border-amber-500 bg-amber-100 hover:scale-110 transition flex items-center justify-center"
                          >
                            <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                          </button>
                          <button
                            type="button"
                            title="Emerald Green Theme"
                            onClick={() =>
                              onUpdatePrimitive(selectedPrimitiveIdx, {
                                ...activePrimitive,
                                config: { ...activePrimitive.config, strokeColor: '#10b981', fillColor: '#d1fae5' },
                              })
                            }
                            className="w-5 h-5 rounded border border-emerald-500 bg-emerald-100 hover:scale-110 transition flex items-center justify-center"
                          >
                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-slate-400">Stroke Style</label>
                          <select
                            value={activePrimitive.config.strokeStyle || 'solid'}
                            onChange={(e) =>
                              onUpdatePrimitive(selectedPrimitiveIdx, {
                                ...activePrimitive,
                                config: { ...activePrimitive.config, strokeStyle: e.target.value as any },
                              })
                            }
                            className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-indigo-300 font-semibold focus:outline-none"
                          >
                            <option value="solid">Solid (-)</option>
                            <option value="dashed">Dashed (--)</option>
                            <option value="dashdot">Dash-Dot (-.)</option>
                            <option value="dotted">Dotted (:)</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400">Stroke Width (pt)</label>
                          <input
                            type="number"
                            min="0.5"
                            max="10"
                            step="0.5"
                            value={activePrimitive.config.strokeWidth ?? 2.5}
                            onChange={(e) =>
                              onUpdatePrimitive(selectedPrimitiveIdx, {
                                ...activePrimitive,
                                config: { ...activePrimitive.config, strokeWidth: parseFloat(e.target.value) || 2.5 },
                              })
                            }
                            className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-slate-200"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-semibold text-slate-400">Stroke Color</label>
                          <input
                            type="color"
                            value={activePrimitive.config.strokeColor || '#3b82f6'}
                            onChange={(e) =>
                              onUpdatePrimitive(selectedPrimitiveIdx, {
                                ...activePrimitive,
                                config: { ...activePrimitive.config, strokeColor: e.target.value },
                              })
                            }
                            className="w-full h-7 bg-slate-950 border border-slate-700 rounded cursor-pointer"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-slate-400">Fill Color</label>
                          <input
                            type="color"
                            value={activePrimitive.config.fillColor || '#dbeafe'}
                            onChange={(e) =>
                              onUpdatePrimitive(selectedPrimitiveIdx, {
                                ...activePrimitive,
                                config: { ...activePrimitive.config, fillColor: e.target.value },
                              })
                            }
                            className="w-full h-7 bg-slate-950 border border-slate-700 rounded cursor-pointer"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <div className="flex justify-between items-center mb-0.5">
                            <label className="text-[10px] text-slate-400">Stroke Opacity</label>
                            <span className="text-[9px] font-mono text-slate-400">
                              {Math.round((activePrimitive.config.strokeOpacity ?? 1) * 100)}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={activePrimitive.config.strokeOpacity ?? 1}
                            onChange={(e) =>
                              onUpdatePrimitive(selectedPrimitiveIdx, {
                                ...activePrimitive,
                                config: { ...activePrimitive.config, strokeOpacity: parseFloat(e.target.value) },
                              })
                            }
                            className="w-full accent-indigo-500"
                          />
                        </div>
                        <div>
                          <div className="flex justify-between items-center mb-0.5">
                            <label className="text-[10px] text-slate-400">Fill Opacity</label>
                            <span className="text-[9px] font-mono text-slate-400">
                              {Math.round((activePrimitive.config.fillOpacity ?? 1) * 100)}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={activePrimitive.config.fillOpacity ?? 1}
                            onChange={(e) =>
                              onUpdatePrimitive(selectedPrimitiveIdx, {
                                ...activePrimitive,
                                config: { ...activePrimitive.config, fillOpacity: parseFloat(e.target.value) },
                              })
                            }
                            className="w-full accent-indigo-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          /* ================= SHEET 1: MAIN DIAGRAM SCENE SIDEBAR ================= */
          <>
            {/* Tool Mode */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Tool Mode
              </span>
              <div className="space-y-1.5 bg-slate-950 p-1.5 rounded-lg border border-slate-800 text-[11px]">
                <div className="grid grid-cols-4 gap-1">
                  <button
                    onClick={() => setDrawingMode('select')}
                    className={`flex items-center justify-center gap-1 py-1.5 rounded-md font-medium transition ${
                      drawingMode === 'select' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <MousePointer className="w-3 h-3" />
                    <span>Select</span>
                  </button>

                  <button
                    onClick={() => setDrawingMode('draw_vector')}
                    className={`flex items-center justify-center gap-1 py-1.5 rounded-md font-medium transition ${
                      drawingMode === 'draw_vector' ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <MoveRight className="w-3 h-3" />
                    <span>+ Vector</span>
                  </button>

                  <button
                    onClick={() => setDrawingMode('draw_line')}
                    className={`flex items-center justify-center gap-1 py-1.5 rounded-md font-medium transition ${
                      drawingMode === 'draw_line' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <CornerDownRight className="w-3 h-3" />
                    <span>+ Line</span>
                  </button>

                  <button
                    onClick={() => setDrawingMode('draw_label')}
                    className={`flex items-center justify-center gap-1 py-1.5 rounded-md font-medium transition ${
                      drawingMode === 'draw_label' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Tag className="w-3 h-3" />
                    <span>+ Text</span>
                  </button>
                </div>

                {/* Row 2: Super Vector, Super Line, Mega Vector, Mega Line */}
                <div className="grid grid-cols-2 gap-1 pt-1 border-t border-slate-800/80">
                  <button
                    onClick={() => setDrawingMode('draw_super_vector')}
                    className={`flex items-center justify-center gap-1 py-1 rounded-md font-bold transition ${
                      drawingMode === 'draw_super_vector' ? 'bg-amber-600 text-white shadow' : 'bg-slate-900 text-amber-400 hover:bg-slate-800'
                    }`}
                    title="Draw Curved or 3-Point Guided Vector Arrow"
                  >
                    <MoveRight className="w-3 h-3 text-amber-300" />
                    <span>⚡ Super Vec</span>
                  </button>

                  <button
                    onClick={() => setDrawingMode('draw_super_line')}
                    className={`flex items-center justify-center gap-1 py-1 rounded-md font-bold transition ${
                      drawingMode === 'draw_super_line' ? 'bg-emerald-600 text-white shadow' : 'bg-slate-900 text-emerald-400 hover:bg-slate-800'
                    }`}
                    title="Draw Curved or 3-Point Guided Line Segment"
                  >
                    <CornerDownRight className="w-3 h-3 text-emerald-300" />
                    <span>⚡ Super Line</span>
                  </button>

                  <button
                    onClick={() => setDrawingMode('draw_mega_vector')}
                    className={`flex items-center justify-center gap-1 py-1 rounded-md font-bold transition ${
                      drawingMode === 'draw_mega_vector' ? 'bg-rose-600 text-white shadow' : 'bg-slate-900 text-rose-400 hover:bg-slate-800'
                    }`}
                    title="Draw Multi-Vertex Line/Curve Vector (Left-click points, Right-click finish)"
                  >
                    <MoveRight className="w-3 h-3 text-rose-300" />
                    <span>🌟 Mega Vec</span>
                  </button>

                  <button
                    onClick={() => setDrawingMode('draw_mega_line')}
                    className={`flex items-center justify-center gap-1 py-1 rounded-md font-bold transition ${
                      drawingMode === 'draw_mega_line' ? 'bg-cyan-600 text-white shadow' : 'bg-slate-900 text-cyan-400 hover:bg-slate-800'
                    }`}
                    title="Draw Multi-Vertex Line/Curve (Left-click points, Right-click finish)"
                  >
                    <CornerDownRight className="w-3 h-3 text-cyan-300" />
                    <span>🌟 Mega Line</span>
                  </button>
                </div>

                {/* Row 3: + Rect and + Circle quick shape spawn */}
                <div className="grid grid-cols-2 gap-1 pt-1 border-t border-slate-800/80">
                  <button
                    onClick={() => {
                      setPendingShapeToAdd({ type: 'rect' });
                      setDrawingMode('add_shape');
                    }}
                    className={`flex items-center justify-center gap-1.5 py-1 rounded-md font-medium text-amber-300 transition ${
                      drawingMode === 'add_shape' && pendingShapeToAdd?.type === 'rect' ? 'bg-amber-600 text-white font-bold' : 'bg-slate-900 hover:bg-slate-800 border border-amber-900/40'
                    }`}
                    title="Click to place Rectangle Obstacle on stage"
                  >
                    <Square className="w-3 h-3 text-amber-400" />
                    <span>+ Rect</span>
                  </button>

                  <button
                    onClick={() => {
                      setPendingShapeToAdd({ type: 'circle' });
                      setDrawingMode('add_shape');
                    }}
                    className={`flex items-center justify-center gap-1.5 py-1 rounded-md font-medium text-blue-300 transition ${
                      drawingMode === 'add_shape' && pendingShapeToAdd?.type === 'circle' ? 'bg-blue-600 text-white font-bold' : 'bg-slate-900 hover:bg-slate-800 border border-blue-900/40'
                    }`}
                    title="Click to place Circle on stage"
                  >
                    <Circle className="w-3 h-3 text-blue-400" />
                    <span>+ Circle</span>
                  </button>
                </div>

                {/* Row 4: + Triangle and + Diamond quick shape spawn */}
                <div className="grid grid-cols-2 gap-1 pt-1 border-t border-slate-800/80">
                  <button
                    onClick={() => {
                      setPendingShapeToAdd({ type: 'triangle' });
                      setDrawingMode('add_shape');
                    }}
                    className={`flex items-center justify-center gap-1.5 py-1 rounded-md font-medium text-emerald-300 transition ${
                      drawingMode === 'add_shape' && pendingShapeToAdd?.type === 'triangle' ? 'bg-emerald-600 text-white font-bold' : 'bg-slate-900 hover:bg-slate-800 border border-emerald-900/40'
                    }`}
                    title="Click to place Triangle Shape on stage"
                  >
                    <Triangle className="w-3 h-3 text-emerald-400" />
                    <span>+ Triangle</span>
                  </button>

                  <button
                    onClick={() => {
                      setPendingShapeToAdd({ type: 'diamond' });
                      setDrawingMode('add_shape');
                    }}
                    className={`flex items-center justify-center gap-1.5 py-1 rounded-md font-medium text-purple-300 transition ${
                      drawingMode === 'add_shape' && pendingShapeToAdd?.type === 'diamond' ? 'bg-purple-600 text-white font-bold' : 'bg-slate-900 hover:bg-slate-800 border border-purple-900/40'
                    }`}
                    title="Click to place Diamond Shape on stage"
                  >
                    <Square className="w-3 h-3 text-purple-400 rotate-45" />
                    <span>+ Diamond</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Add Object Shape Dropdown */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Add Object / Shape
              </span>
              <div className="flex gap-2">
                <select
                  value={selectedShapeToAdd}
                  onChange={(e) => setSelectedShapeToAdd(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-indigo-300 font-medium focus:outline-none focus:border-indigo-500"
                >
                  <option value="obstacle">Obstacle Box</option>
                  <option value="rect">Rectangle</option>
                  <option value="circle">Circle</option>
                  {Object.values(definitions).map((def) => (
                    <option key={def.id} value={def.id}>
                      {def.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    if (selectedShapeToAdd === 'obstacle' || selectedShapeToAdd === 'rect' || selectedShapeToAdd === 'circle') {
                      setPendingShapeToAdd({ type: selectedShapeToAdd as any });
                    } else {
                      setPendingShapeToAdd({ type: 'alias', definitionId: selectedShapeToAdd });
                    }
                    setDrawingMode('add_shape');
                  }}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </div>
            </div>

            {/* Scene Tree Explorer with Export Boundary Entry */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Scene Entities ({scene.length + 1})
                </span>
              </div>

              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1 bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                {/* Export Boundary Entity item */}
                <div
                  onClick={() => onSelectNode('export_bounds')}
                  className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer border transition ${
                    isExportBoundsSelected
                      ? 'bg-purple-900/50 border-purple-500 text-white font-semibold'
                      : 'bg-slate-900/90 border-purple-900/40 text-purple-300 hover:border-purple-600'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Crop className="w-3.5 h-3.5 text-purple-400" />
                    <span className="truncate">Export Boundary</span>
                  </div>
                  <span className="text-[10px] bg-purple-950 text-purple-300 px-1.5 py-0.5 rounded font-mono">
                    [{exportBounds.xMin}, {exportBounds.xMax}]
                  </span>
                </div>

                {scene.map((node, idx) => {
                  const isSelected = selectedNodeId === node.id;
                  return (
                    <div
                      key={node.id}
                      id={`scene_tree_node_${node.id}`}
                      onClick={() => onSelectNode(node.id)}
                      className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer border transition ${
                        isSelected
                          ? 'bg-indigo-900/40 border-indigo-500 text-white font-medium'
                          : 'bg-slate-900/80 border-slate-800/80 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {getNodeIcon(node.type)}
                        <span className="truncate">
                          {node.name || `${node.type} #${idx + 1}`}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onMoveLayer(node.id, 'up');
                          }}
                          disabled={idx === scene.length - 1}
                          className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded disabled:opacity-30"
                          title="Move Layer Up"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onMoveLayer(node.id, 'down');
                          }}
                          disabled={idx === 0}
                          className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded disabled:opacity-30"
                          title="Move Layer Down"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteNode(node.id);
                          }}
                          className="p-1 hover:bg-slate-800 text-slate-400 hover:text-red-400 rounded"
                          title="Delete Node (Del)"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Inspector Panel for Export Boundary */}
            {isExportBoundsSelected && (
              <div className="bg-purple-950/40 p-3.5 rounded-xl border border-purple-800/60 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-purple-200 border-b border-purple-800/50 pb-2">
                  <Crop className="w-4 h-4 text-purple-400" />
                  <span>Inspect Export Boundary Bounds</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-[10px] font-semibold text-purple-300">X Min (units)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={exportBounds.xMin}
                      onChange={(e) =>
                        onUpdateExportBounds({
                          ...exportBounds,
                          xMin: parseFloat(e.target.value) || -10,
                        })
                      }
                      className="w-full mt-1 bg-slate-950 border border-purple-800/60 rounded px-2 py-1 text-xs text-purple-200 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-purple-300">X Max (units)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={exportBounds.xMax}
                      onChange={(e) =>
                        onUpdateExportBounds({
                          ...exportBounds,
                          xMax: parseFloat(e.target.value) || 10,
                        })
                      }
                      className="w-full mt-1 bg-slate-950 border border-purple-800/60 rounded px-2 py-1 text-xs text-purple-200 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-purple-300">Y Min (units)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={exportBounds.yMin}
                      onChange={(e) =>
                        onUpdateExportBounds({
                          ...exportBounds,
                          yMin: parseFloat(e.target.value) || -10,
                        })
                      }
                      className="w-full mt-1 bg-slate-950 border border-purple-800/60 rounded px-2 py-1 text-xs text-purple-200 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-purple-300">Y Max (units)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={exportBounds.yMax}
                      onChange={(e) =>
                        onUpdateExportBounds({
                          ...exportBounds,
                          yMax: parseFloat(e.target.value) || 10,
                        })
                      }
                      className="w-full mt-1 bg-slate-950 border border-purple-800/60 rounded px-2 py-1 text-xs text-purple-200 font-mono"
                    />
                  </div>
                </div>

                {/* Fit Artboard to Content Toggle & Content Padding Slider */}
                {plotOptions && onUpdatePlotOptions && (
                  <div className="space-y-2 border-t border-purple-800/50 pt-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col pr-2">
                        <span className="text-xs font-bold text-purple-200">Fit Artboard to Content</span>
                        <span className="text-[10px] text-purple-400 leading-tight">
                          {plotOptions.cropToContent
                            ? 'Auto-wraps all entities (ignores purple box)'
                            : 'Fixed Viewport Frame (clips overflow)'}
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={plotOptions.cropToContent ?? false}
                        onChange={(e) => onUpdatePlotOptions({ ...plotOptions, cropToContent: e.target.checked })}
                        className="w-4 h-4 rounded bg-slate-950 border-purple-800 text-purple-600 focus:ring-purple-500 cursor-pointer shrink-0"
                      />
                    </div>

                    {(plotOptions.cropToContent ?? false) && (
                      <div className="space-y-1 bg-slate-950/60 p-2 rounded-lg border border-purple-800/50">
                        <div className="flex justify-between items-center text-xs">
                          <label className="text-[10px] font-semibold text-purple-300">Content Padding</label>
                          <span className="font-mono text-purple-300 font-bold">{(plotOptions.cropPadding ?? 0.2).toFixed(2)} units</span>
                        </div>
                        <input
                          type="range"
                          min="0.05"
                          max="2.0"
                          step="0.05"
                          value={Math.max(0.05, plotOptions.cropPadding ?? 0.2)}
                          onChange={(e) => onUpdatePlotOptions({ ...plotOptions, cropPadding: parseFloat(e.target.value) || 0.05 })}
                          className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-purple-500"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Selected Node Inspector */}
            {selectedNode && !isExportBoundsSelected ? (
              <div className="bg-slate-800/60 p-3.5 rounded-xl border border-slate-700 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-100">
                    <Sliders className="w-4 h-4 text-indigo-400" />
                    <span className="uppercase">Inspect Node ({selectedNode.type})</span>
                  </div>
                  <button
                    onClick={() => onDeleteNode(selectedNode.id)}
                    className="text-slate-400 hover:text-red-400 p-1 rounded transition"
                    title="Delete Node (Del)"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {selectedNode.type === 'alias' && (
                  <div>
                    <label className="text-[11px] font-semibold text-slate-300">Object Footprint Shape</label>
                    <select
                      value={selectedNode.definitionId || ''}
                      onChange={(e) => onUpdateNode({ ...selectedNode, definitionId: e.target.value })}
                      className="w-full mt-1 bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-indigo-300 font-medium"
                    >
                      {Object.values(definitions).map((def) => (
                        <option key={def.id} value={def.id}>
                          {def.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Super Vector & Super Line Settings */}
                {(selectedNode.type === 'super_vector' || selectedNode.type === 'super_line') && (
                  <div className="space-y-3 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-[11px] font-semibold text-amber-300 uppercase tracking-wider block">Super Settings</span>
                    
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-semibold text-slate-400">Line Shape</label>
                      <div className="flex bg-slate-950 rounded border border-slate-700 p-0.5 text-[10px]">
                        <button
                          onClick={() => onUpdateNode({ ...selectedNode, lineShape: 'curve' })}
                          className={`px-2 py-0.5 rounded transition ${
                            (selectedNode.lineShape || 'curve') === 'curve'
                              ? 'bg-amber-600 text-white font-bold'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          Curve
                        </button>
                        <button
                          onClick={() => onUpdateNode({ ...selectedNode, lineShape: 'straight' })}
                          className={`px-2 py-0.5 rounded transition ${
                            selectedNode.lineShape === 'straight'
                              ? 'bg-amber-600 text-white font-bold'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          Straight
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-slate-800">
                      <div>
                        <label className="text-[10px] font-semibold text-slate-400">Guidance X (units)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={selectedNode.controlPoint ? selectedNode.controlPoint[0] : 1.5}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            const cy = selectedNode.controlPoint ? selectedNode.controlPoint[1] : 1.5;
                            onUpdateNode({ ...selectedNode, controlPoint: [val, cy] });
                          }}
                          className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-400">Guidance Y (units)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={selectedNode.controlPoint ? selectedNode.controlPoint[1] : 1.5}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            const cx = selectedNode.controlPoint ? selectedNode.controlPoint[0] : 1.5;
                            onUpdateNode({ ...selectedNode, controlPoint: [cx, val] });
                          }}
                          className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* LaTeX Label Inspector & Transparency Checkbox */}
                <div className="space-y-2 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold text-slate-300">LaTeX Annotation Label</label>
                    <span className="text-[9px] text-slate-400 font-mono">Shift+Enter for newline</span>
                  </div>
                  <div className="relative">
                    <textarea
                      ref={labelInputRef}
                      rows={2}
                      value={selectedNode.label || ''}
                      onChange={(e) => {
                        handleLabelChange(e.target.value);
                        setShowMacroSuggestions(true);
                      }}
                      onKeyDown={(e) => {
                        if (showMacroSuggestions && suggestions.length > 0) {
                          if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            setActiveSuggestionIdx((prev) => (prev + 1) % suggestions.length);
                            return;
                          }
                          if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            setActiveSuggestionIdx((prev) => (prev - 1 + suggestions.length) % suggestions.length);
                            return;
                          }
                          if (e.key === 'Enter' || e.key === 'Tab') {
                            if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
                              e.preventDefault();
                              const selectedMacro = suggestions[activeSuggestionIdx] || suggestions[0];
                              if (selectedMacro) {
                                handleSelectMacroSuggestion(selectedMacro);
                              }
                              return;
                            }
                          }
                          if (e.key === 'Escape') {
                            e.preventDefault();
                            setShowMacroSuggestions(false);
                            return;
                          }
                        }
                      }}
                      onFocus={() => setShowMacroSuggestions(true)}
                      onBlur={() => {
                        setTimeout(() => setShowMacroSuggestions(false), 200);
                        if (selectedNode.type === 'text' && (!selectedNode.label || !selectedNode.label.trim())) {
                          onDeleteNode(selectedNode.id);
                        }
                      }}
                      placeholder="e.g. \zmass&#10;Line 2"
                      className="w-full bg-slate-950 border border-slate-700 rounded-md px-2.5 py-1.5 text-xs font-mono text-indigo-300 focus:outline-none focus:border-indigo-500 resize-y"
                    />

                    {showMacroSuggestions && suggestions.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-slate-950 border border-slate-700 rounded-md shadow-xl max-h-36 overflow-y-auto z-20">
                        {suggestions.map((m, idx) => (
                          <button
                            key={m.command}
                            ref={(el) => {
                              if (idx === activeSuggestionIdx && el) {
                                el.scrollIntoView({ block: 'nearest' });
                              }
                            }}
                            onMouseEnter={() => setActiveSuggestionIdx(idx)}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handleSelectMacroSuggestion(m);
                            }}
                            className={`w-full text-left px-3 py-1.5 text-xs flex justify-between items-center border-b border-slate-800/50 transition-colors ${
                              idx === activeSuggestionIdx ? 'bg-indigo-600 text-white font-bold' : 'hover:bg-indigo-900/50 text-indigo-300'
                            }`}
                          >
                            <span className="font-mono">{m.command}</span>
                            <span
                              className={`font-mono text-[10px] truncate max-w-[120px] ${
                                idx === activeSuggestionIdx ? 'text-indigo-100' : 'text-slate-400'
                              }`}
                            >
                              {m.template}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Label Text Color & Background Controls */}
                  <div className="space-y-2 pt-2 border-t border-slate-800">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-semibold text-slate-300">Font Size (pt)</label>
                      <input
                        type="number"
                        min={6}
                        max={48}
                        value={selectedNode.fontSize || 12}
                        onChange={(e) =>
                          onUpdateNode({
                            ...selectedNode,
                            fontSize: parseInt(e.target.value, 10) || 12,
                          })
                        }
                        className="w-16 bg-slate-950 border border-slate-700 rounded px-2 py-0.5 text-xs text-slate-200 font-mono text-center"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-semibold text-slate-300">Alignment</label>
                      <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded p-0.5">
                        <button
                          type="button"
                          onClick={() => onUpdateNode({ ...selectedNode, textAlign: 'left' })}
                          className={`p-1 rounded transition ${
                            selectedNode.textAlign === 'left' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                          }`}
                          title="Align Left"
                        >
                          <AlignLeft className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onUpdateNode({ ...selectedNode, textAlign: 'center' })}
                          className={`p-1 rounded transition ${
                            (selectedNode.textAlign || 'center') === 'center' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                          }`}
                          title="Align Middle / Center (Default)"
                        >
                          <AlignCenter className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onUpdateNode({ ...selectedNode, textAlign: 'right' })}
                          className={`p-1 rounded transition ${
                            selectedNode.textAlign === 'right' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                          }`}
                          title="Align Right"
                        >
                          <AlignRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-semibold text-slate-300">Label Text Color</label>
                      <input
                        type="color"
                        value={selectedNode.labelTextColor || selectedNode.style.color || '#38bdf8'}
                        onChange={(e) => onUpdateNode({ ...selectedNode, labelTextColor: e.target.value })}
                        className="w-12 h-6 bg-slate-950 border border-slate-700 rounded cursor-pointer"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-semibold text-slate-400">Transparent Background</label>
                      <input
                        type="checkbox"
                        checked={selectedNode.labelFillTransparent ?? true}
                        onChange={(e) => onUpdateNode({ ...selectedNode, labelFillTransparent: e.target.checked })}
                        className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                    </div>

                    {!(selectedNode.labelFillTransparent ?? true) && (
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-semibold text-slate-400">Label Background Fill Color</label>
                        <input
                          type="color"
                          value={selectedNode.labelFillColor || selectedNode.style.fillColor || '#ffffff'}
                          onChange={(e) => onUpdateNode({ ...selectedNode, labelFillColor: e.target.value })}
                          className="w-12 h-6 bg-slate-950 border border-slate-700 rounded cursor-pointer"
                        />
                      </div>
                    )}

                    {selectedNode.type !== 'text' && (
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
                        <div>
                          <label className="text-[10px] font-semibold text-slate-400">Label Offset X</label>
                          <input
                            type="number"
                            step="0.05"
                            value={selectedNode.labelOffsetX ?? 0.3}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              onUpdateNode({ ...selectedNode, labelOffsetX: isNaN(val) ? 0.3 : val });
                            }}
                            className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-slate-400">Label Offset Y</label>
                          <input
                            type="number"
                            step="0.05"
                            value={selectedNode.labelOffsetY ?? 0.3}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              onUpdateNode({ ...selectedNode, labelOffsetY: isNaN(val) ? 0.3 : val });
                            }}
                            className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200"
                          />
                        </div>
                      </div>
                    )}

                    {(selectedNode.type === 'super_vector' ||
                      selectedNode.type === 'super_line' ||
                      selectedNode.type === 'mega_vector' ||
                      selectedNode.type === 'mega_line') && (
                      <div className="space-y-2 pt-2 border-t border-slate-800">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-semibold text-slate-300">Line Shape Mode</label>
                          <div className="flex bg-slate-950 p-0.5 rounded border border-slate-700 text-xs">
                            <button
                              type="button"
                              onClick={() => onUpdateNode({ ...selectedNode, lineShape: 'curve' })}
                              className={`px-2.5 py-0.5 rounded text-[11px] font-medium transition ${
                                (selectedNode.lineShape || 'curve') === 'curve'
                                  ? 'bg-indigo-600 text-white font-bold'
                                  : 'text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              Curved (Spline)
                            </button>
                            <button
                              type="button"
                              onClick={() => onUpdateNode({ ...selectedNode, lineShape: 'straight' })}
                              className={`px-2.5 py-0.5 rounded text-[11px] font-medium transition ${
                                selectedNode.lineShape === 'straight'
                                  ? 'bg-indigo-600 text-white font-bold'
                                  : 'text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              Straight
                            </button>
                          </div>
                        </div>

                        {(selectedNode.type === 'super_vector' || selectedNode.type === 'super_line') && (
                          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/60">
                            <div>
                              <label className="text-[10px] font-semibold text-slate-400">Guidance X (px)</label>
                              <input
                                type="number"
                                step="0.1"
                                value={selectedNode.controlPoint ? selectedNode.controlPoint[0] : 1.5}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  const cy = selectedNode.controlPoint ? selectedNode.controlPoint[1] : 1.5;
                                  onUpdateNode({ ...selectedNode, controlPoint: [val, cy] });
                                }}
                                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-semibold text-slate-400">Guidance Y (px)</label>
                              <input
                                type="number"
                                step="0.1"
                                value={selectedNode.controlPoint ? selectedNode.controlPoint[1] : 1.5}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  const cx = selectedNode.controlPoint ? selectedNode.controlPoint[0] : 1.5;
                                  onUpdateNode({ ...selectedNode, controlPoint: [cx, val] });
                                }}
                                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {selectedNode.type === 'triangle' && (
                      <div className="space-y-2 p-2.5 bg-slate-900 rounded-lg border border-slate-800 mt-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-semibold text-slate-300">Triangle Type</label>
                          <select
                            value={selectedNode.triangleType || 'right_isosceles'}
                            onChange={(e) =>
                              onUpdateNode({ ...selectedNode, triangleType: e.target.value as any })
                            }
                            className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-emerald-400 font-bold focus:outline-none"
                          >
                            <option value="right_isosceles">Right Isosceles (📐)</option>
                            <option value="equilateral">Equilateral (△)</option>
                          </select>
                        </div>

                        <div className="pt-2 border-t border-slate-800">
                          <label className="text-[10px] font-semibold text-slate-400 block mb-1">Triangle Size (Leg Width)</label>
                          <input
                            type="number"
                            step="0.1"
                            min="0.2"
                            value={selectedNode.width ?? 3}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              onUpdateNode({ ...selectedNode, width: isNaN(val) ? 3 : val, height: isNaN(val) ? 3 : val });
                            }}
                            className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-emerald-400 font-bold"
                          />
                        </div>
                      </div>
                    )}

                    {selectedNode.type === 'diamond' && (
                      <div className="space-y-2 p-2.5 bg-slate-900 rounded-lg border border-slate-800 mt-2">
                        <span className="text-[10px] font-semibold text-purple-300 uppercase tracking-wider block">Diamond Shape Guidance</span>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-semibold text-slate-400 block mb-1">Width (w)</label>
                            <input
                              type="number"
                              step="0.1"
                              min="0.2"
                              value={selectedNode.width ?? 3}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                onUpdateNode({ ...selectedNode, width: isNaN(val) ? 3 : val });
                              }}
                              className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-purple-400 font-bold"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-slate-400 block mb-1">Height (h)</label>
                            <input
                              type="number"
                              step="0.1"
                              min="0.2"
                              value={selectedNode.height ?? 2}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                onUpdateNode({ ...selectedNode, height: isNaN(val) ? 2 : val });
                              }}
                              className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-purple-400 font-bold"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Shape Guidance Snap Points Config (1 - 6) */}
                    {(selectedNode.type === 'rect' || selectedNode.type === 'circle' || selectedNode.type === 'triangle' || selectedNode.type === 'diamond' || selectedNode.type === 'obstacle') && (
                      <div className="space-y-1 pt-2 border-t border-slate-800">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] font-semibold text-slate-300 flex items-center gap-1">
                            <Target className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Snap Points / Edge (1 - 6)</span>
                          </label>
                          <span className="text-xs font-mono text-cyan-400 font-bold">
                            {selectedNode.edgeSnapPoints ?? 3} pts
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min="1"
                            max="6"
                            step="1"
                            value={selectedNode.edgeSnapPoints ?? 3}
                            onChange={(e) =>
                              onUpdateNode({ ...selectedNode, edgeSnapPoints: parseInt(e.target.value, 10) || 3 })
                            }
                            className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                          />
                          <input
                            type="number"
                            min="1"
                            max="6"
                            value={selectedNode.edgeSnapPoints ?? 3}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              onUpdateNode({ ...selectedNode, edgeSnapPoints: isNaN(val) ? 3 : Math.max(1, Math.min(6, val)) });
                            }}
                            className="w-12 bg-slate-950 border border-slate-700 rounded px-1 py-0.5 text-xs text-cyan-400 font-bold text-center"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Object Scale Multiplier - EXCLUDED for vector, line, text */}
                {(selectedNode.type === 'alias' || selectedNode.type === 'obstacle' || selectedNode.type === 'rect') && (
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
                        <Maximize2 className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Object Scale Multiplier</span>
                      </label>
                      <span className="text-xs font-mono text-indigo-400 font-bold">
                        {(selectedNode.scale || 1.0).toFixed(1)}x
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.2"
                      max="3.0"
                      step="0.1"
                      value={selectedNode.scale || 1.0}
                      onChange={(e) =>
                        onUpdateNode({ ...selectedNode, scale: parseFloat(e.target.value) || 1.0 })
                      }
                      className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                  </div>
                )}

                {/* Position & Rotation controls (Rotation EXCLUDED for text) */}
                <div className={`grid ${selectedNode.type === 'text' ? 'grid-cols-2' : 'grid-cols-3'} gap-2`}>
                  <div>
                    <label className="text-[10px] font-semibold text-slate-400">X (units)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={selectedNode.x}
                      onChange={(e) => onUpdateNode({ ...selectedNode, x: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-slate-400">Y (units)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={selectedNode.y}
                      onChange={(e) => onUpdateNode({ ...selectedNode, y: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200"
                    />
                  </div>
                  {selectedNode.type !== 'text' && (
                    <div>
                      <label className="text-[10px] font-semibold text-slate-400">Rotation (°)</label>
                      <input
                        type="number"
                        step="5"
                        value={selectedNode.rotation}
                        onChange={(e) => onUpdateNode({ ...selectedNode, rotation: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200"
                      />
                    </div>
                  )}
                </div>

                {/* Style Controls */}
                <div className="space-y-2 pt-2 border-t border-slate-700/60">
                  <span className="text-[11px] font-semibold text-slate-300">
                    {selectedNode.type === 'text' ? 'Text Styling & Font Size' : 'Style & Stroke (Matlab Specs)'}
                  </span>

                  {/* For text: Font Size input instead of Stroke Style & Stroke Width */}
                  {selectedNode.type === 'text' ? (
                    <div>
                      <label className="text-[10px] font-semibold text-slate-400 flex items-center gap-1">
                        <Type className="w-3 h-3 text-purple-400" />
                        <span>Font Size (pt)</span>
                      </label>
                      <input
                        type="number"
                        min={6}
                        max={48}
                        value={selectedNode.fontSize || 12}
                        onChange={(e) =>
                          onUpdateNode({
                            ...selectedNode,
                            fontSize: parseInt(e.target.value, 10) || 12,
                          })
                        }
                        className="w-full mt-1 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200"
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-400">Stroke Style</label>
                        <select
                          value={selectedNode.style.strokeStyle}
                          onChange={(e) =>
                            onUpdateNode({
                              ...selectedNode,
                              style: { ...selectedNode.style, strokeStyle: e.target.value as any },
                            })
                          }
                          className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200"
                        >
                          <option value="-">- Solid ( — )</option>
                          <option value="--">-- Dashed ( - - )</option>
                          <option value="-.">-. Dash-Dot ( - . )</option>
                          <option value=":">: Dotted ( ... )</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400">Stroke Width</label>
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={selectedNode.style.strokeWidth}
                          onChange={(e) =>
                            onUpdateNode({
                              ...selectedNode,
                              style: { ...selectedNode.style, strokeWidth: parseInt(e.target.value, 10) || 1 },
                            })
                          }
                          className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200"
                        />
                      </div>
                    </div>
                  )}

                  {/* Text stroke color defaults to black (#000000) */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <label className="text-[10px] text-slate-400">
                        {selectedNode.type === 'text' ? 'Text Color' : 'Stroke Color'}
                      </label>
                      <input
                        type="color"
                        value={selectedNode.style.color || '#000000'}
                        onChange={(e) =>
                          onUpdateNode({
                            ...selectedNode,
                            style: { ...selectedNode.style, color: e.target.value },
                          })
                        }
                        className="w-full h-7 bg-slate-950 border border-slate-700 rounded cursor-pointer"
                      />
                    </div>
                    {selectedNode.type !== 'text' && (
                      <div>
                        <label className="text-[10px] text-slate-400">Fill Color</label>
                        <input
                          type="color"
                          value={selectedNode.style.fillColor || '#ffffff'}
                          onChange={(e) =>
                            onUpdateNode({
                              ...selectedNode,
                              style: { ...selectedNode.style, fillColor: e.target.value },
                            })
                          }
                          className="w-full h-7 bg-slate-950 border border-slate-700 rounded cursor-pointer"
                        />
                      </div>
                    )}
                  </div>

                  {/* Opacity Sliders */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <label className="text-[10px] text-slate-400">
                        {selectedNode.type === 'text' ? 'Text Opacity' : 'Stroke Opacity'}
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={selectedNode.style.strokeOpacity ?? 1.0}
                        onChange={(e) =>
                          onUpdateNode({
                            ...selectedNode,
                            style: { ...selectedNode.style, strokeOpacity: parseFloat(e.target.value) || 0 },
                          })
                        }
                        className="w-full h-1 bg-slate-950 rounded appearance-none cursor-pointer accent-indigo-500"
                      />
                    </div>
                    {selectedNode.type !== 'text' && (
                      <div>
                        <label className="text-[10px] text-slate-400">Fill Opacity</label>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={selectedNode.style.fillOpacity ?? 1.0}
                          onChange={(e) =>
                            onUpdateNode({
                              ...selectedNode,
                              style: { ...selectedNode.style, fillOpacity: parseFloat(e.target.value) || 0 },
                            })
                          }
                          className="w-full h-1 bg-slate-950 rounded appearance-none cursor-pointer accent-indigo-500"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
};
