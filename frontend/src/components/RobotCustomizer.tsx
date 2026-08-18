import React, { useState } from 'react';
import type { RobotDefinition, PrimitiveDefinition } from '../types/schema';
import { Stage, Layer, Circle as KonvaCircle, Rect as KonvaRect, Line as KonvaLine, Arrow as KonvaArrow } from 'react-konva';
import { Box, Plus, Trash2, Circle, Square, MoveRight, Hexagon, Eye } from 'lucide-react';

interface RobotCustomizerProps {
  definitions: Record<string, RobotDefinition>;
  onUpdateDefinitions: (updated: Record<string, RobotDefinition>) => void;
}

export const RobotCustomizer: React.FC<RobotCustomizerProps> = ({
  definitions,
  onUpdateDefinitions,
}) => {
  const [selectedDefId, setSelectedDefId] = useState<string>(Object.keys(definitions)[0] || '');
  const [newDefName, setNewDefName] = useState('');

  const currentDef = definitions[selectedDefId];

  const handleCreateNewDefinition = () => {
    if (!newDefName.trim()) return;
    const id = `custom_${Date.now()}`;
    const newDef: RobotDefinition = {
      id,
      name: newDefName.trim(),
      primitives: [
        { id: 'base', type: 'circle', config: { radius: 30, strokeColor: '#3b82f6', fillColor: '#dbeafe' } },
      ],
    };

    onUpdateDefinitions({ ...definitions, [id]: newDef });
    setSelectedDefId(id);
    setNewDefName('');
  };

  const handleDeleteDefinition = (id: string) => {
    if (Object.keys(definitions).length <= 1) {
      alert('Must keep at least one component definition.');
      return;
    }
    const updated = { ...definitions };
    delete updated[id];
    onUpdateDefinitions(updated);
    setSelectedDefId(Object.keys(updated)[0]);
  };

  const handleAddPrimitive = (type: PrimitiveDefinition['type']) => {
    if (!currentDef) return;
    const newPrim: PrimitiveDefinition = {
      id: `prim_${Date.now()}`,
      type,
      config: {
        radius: type === 'circle' ? 25 : undefined,
        width: type === 'rect' ? 30 : undefined,
        height: type === 'rect' ? 20 : undefined,
        points: type === 'vector' ? [0, 0, 40, 0] : undefined,
        vertices: type === 'poly' ? [[-20, -20], [20, -20], [0, 30]] : undefined,
        strokeColor: '#3b82f6',
        fillColor: '#dbeafe',
      },
    };

    const updatedDef = {
      ...currentDef,
      primitives: [...currentDef.primitives, newPrim],
    };

    onUpdateDefinitions({ ...definitions, [selectedDefId]: updatedDef });
  };

  const handleDeletePrimitive = (idx: number) => {
    if (!currentDef) return;
    const updatedPrims = currentDef.primitives.filter((_, i) => i !== idx);
    onUpdateDefinitions({
      ...definitions,
      [selectedDefId]: { ...currentDef, primitives: updatedPrims },
    });
  };

  const handleUpdatePrimitive = (idx: number, updatedPrim: PrimitiveDefinition) => {
    if (!currentDef) return;
    const updatedPrims = [...currentDef.primitives];
    updatedPrims[idx] = updatedPrim;
    onUpdateDefinitions({
      ...definitions,
      [selectedDefId]: { ...currentDef, primitives: updatedPrims },
    });
  };

  const renderSandboxPrimitives = () => {
    if (!currentDef) return null;
    return currentDef.primitives.map((prim, idx) => {
      const fill = prim.config.fillColor || '#dbeafe';
      const stroke = prim.config.strokeColor || '#3b82f6';

      if (prim.type === 'circle') {
        return <KonvaCircle key={idx} x={150} y={100} radius={prim.config.radius || 25} fill={fill} stroke={stroke} strokeWidth={2} />;
      }
      if (prim.type === 'rect') {
        const w = prim.config.width || 30;
        const h = prim.config.height || 30;
        const ox = (prim.config.x || -15) + 150;
        const oy = (prim.config.y || -15) + 100;
        return <KonvaRect key={idx} x={ox} y={oy} width={w} height={h} fill={fill} stroke={stroke} strokeWidth={2} />;
      }
      if (prim.type === 'poly' && prim.config.vertices) {
        const flatPoints = prim.config.vertices.flatMap(([vx, vy]) => [vx + 150, -vy + 100]);
        return <KonvaLine key={idx} points={flatPoints} closed fill={fill} stroke={stroke} strokeWidth={2} />;
      }
      if (prim.type === 'vector' && prim.config.points) {
        const [x1, y1, x2, y2] = prim.config.points;
        return <KonvaArrow key={idx} points={[x1 + 150, -y1 + 100, x2 + 150, -y2 + 100]} stroke={stroke} fill={stroke} strokeWidth={2.5} pointerLength={8} pointerWidth={8} />;
      }
      return null;
    });
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100 p-4 rounded-xl border border-slate-800 shadow-xl overflow-y-auto space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-indigo-400 font-semibold text-sm">
        <div className="flex items-center gap-2">
          <Box className="w-4 h-4" />
          <span>Robot Designer Sandbox</span>
        </div>
      </div>

      {/* Active Robot Definition Selector & New Robot Form */}
      <div className="bg-slate-800/60 p-3.5 rounded-lg border border-slate-700 space-y-3">
        <div>
          <label className="text-[11px] font-semibold text-slate-300">Select Component Definition</label>
          <select
            value={selectedDefId}
            onChange={(e) => setSelectedDefId(e.target.value)}
            className="w-full mt-1 bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-indigo-300 font-medium"
          >
            {Object.values(definitions).map((def) => (
              <option key={def.id} value={def.id}>
                {def.name} ({def.primitives.length} primitives)
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="New Robot Name..."
            value={newDefName}
            onChange={(e) => setNewDefName(e.target.value)}
            className="flex-1 bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-slate-200"
          />
          <button
            onClick={handleCreateNewDefinition}
            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold flex items-center gap-1 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create</span>
          </button>
        </div>
      </div>

      {/* Sandbox Mini Canvas Preview */}
      <div className="bg-slate-950 rounded-xl border border-slate-800 p-2 space-y-1">
        <div className="flex items-center justify-between px-1 text-[11px] font-semibold text-slate-400">
          <span className="flex items-center gap-1">
            <Eye className="w-3.5 h-3.5 text-indigo-400" />
            <span>Isolated Sandbox Canvas</span>
          </span>
          <span className="text-[10px] text-slate-500">Center: (0,0)</span>
        </div>
        <div className="w-full h-[200px] bg-slate-900/60 rounded-lg overflow-hidden flex items-center justify-center border border-slate-800/80">
          <Stage width={300} height={200}>
            <Layer>
              {renderSandboxPrimitives()}
            </Layer>
          </Stage>
        </div>
      </div>

      {/* Primitives Editor */}
      {currentDef && (
        <div className="flex-1 flex flex-col min-h-0 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-200">
              Primitives for {currentDef.name}
            </span>
            <button
              onClick={() => handleDeleteDefinition(currentDef.id)}
              className="text-slate-400 hover:text-red-400 text-xs flex items-center gap-1 transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
          </div>

          <div className="grid grid-cols-4 gap-2">
            <button
              onClick={() => handleAddPrimitive('circle')}
              className="p-2 bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 text-[11px] flex flex-col items-center gap-1 text-slate-300"
            >
              <Circle className="w-4 h-4 text-blue-400" />
              <span>Circle</span>
            </button>
            <button
              onClick={() => handleAddPrimitive('rect')}
              className="p-2 bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 text-[11px] flex flex-col items-center gap-1 text-slate-300"
            >
              <Square className="w-4 h-4 text-emerald-400" />
              <span>Rect</span>
            </button>
            <button
              onClick={() => handleAddPrimitive('vector')}
              className="p-2 bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 text-[11px] flex flex-col items-center gap-1 text-slate-300"
            >
              <MoveRight className="w-4 h-4 text-red-400" />
              <span>Vector</span>
            </button>
            <button
              onClick={() => handleAddPrimitive('poly')}
              className="p-2 bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 text-[11px] flex flex-col items-center gap-1 text-slate-300"
            >
              <Hexagon className="w-4 h-4 text-purple-400" />
              <span>Poly</span>
            </button>
          </div>

          <div className="space-y-2 overflow-y-auto pr-1 flex-1">
            {currentDef.primitives.map((prim, idx) => (
              <div
                key={idx}
                className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-indigo-400 uppercase text-[10px]">
                    #{idx + 1} {prim.type}
                  </span>
                  <button
                    onClick={() => handleDeletePrimitive(idx)}
                    className="text-slate-500 hover:text-red-400 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400">Stroke Color</label>
                    <input
                      type="color"
                      value={prim.config.strokeColor || '#3b82f6'}
                      onChange={(e) =>
                        handleUpdatePrimitive(idx, {
                          ...prim,
                          config: { ...prim.config, strokeColor: e.target.value },
                        })
                      }
                      className="w-full h-6 bg-slate-900 border border-slate-700 rounded cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400">Fill Color</label>
                    <input
                      type="color"
                      value={prim.config.fillColor || '#dbeafe'}
                      onChange={(e) =>
                        handleUpdatePrimitive(idx, {
                          ...prim,
                          config: { ...prim.config, fillColor: e.target.value },
                        })
                      }
                      className="w-full h-6 bg-slate-900 border border-slate-700 rounded cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
