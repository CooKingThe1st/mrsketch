import React from 'react';
import { X, Sparkles, CheckCircle2, Layers, Compass, Zap, MousePointer, ShieldCheck } from 'lucide-react';

interface ChangelogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChangelogModal: React.FC<ChangelogModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col text-slate-100 max-h-[85vh]">
        {/* Modal Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-indigo-600 rounded-lg text-white">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <span>mrsketch (MR-Sketch OOS)</span>
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-[10px] font-mono font-bold">
                  v1.5 Release
                </span>
              </h2>
              <p className="text-[10px] text-slate-400">System Changelog & Feature Notes</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-300">
          <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs border-b border-slate-800 pb-2">
            <Sparkles className="w-4 h-4" />
            <span>What's New in Version 1.5</span>
          </div>

          <div className="space-y-3">
            {/* Feature Item 1 */}
            <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/60 space-y-1">
              <div className="flex items-center gap-2 font-bold text-slate-100">
                <Zap className="w-3.5 h-3.5 text-cyan-400" />
                <span>Guidance Point Snapping Feature</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Automatically detects and previews snap points (corners, edge midpoints, centers) across all scene shapes during line & vector drawing. Glowing cyan target indicators preview the snap in real-time. Toggleable ON/OFF in Settings.
              </p>
            </div>

            {/* Feature Item 2 */}
            <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/60 space-y-1">
              <div className="flex items-center gap-2 font-bold text-slate-100">
                <MousePointer className="w-3.5 h-3.5 text-purple-400" />
                <span>Right Double-Click Quick Create Entity Popover</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Right double-clicking on the canvas spawns a 4-column quick entity popover menu directly at cursor coordinates. Organized into 3 distinct categories (Text, Basic Shapes, Lines & Vectors) for 1-click creation.
              </p>
            </div>

            {/* Feature Item 3 */}
            <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/60 space-y-1">
              <div className="flex items-center gap-2 font-bold text-slate-100">
                <Layers className="w-3.5 h-3.5 text-emerald-400" />
                <span>New Shapes: Triangle & Diamond with Guidance Controls</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Native support for Triangle (Right Isosceles 📐 & Equilateral △) and Diamond shapes. Embedded with interactive canvas drag handles and sidebar guidance dimension controls. Matplotlib orientation aligned with 1:1 canvas view.
              </p>
            </div>

            {/* Feature Item 4 */}
            <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/60 space-y-1">
              <div className="flex items-center gap-2 font-bold text-slate-100">
                <Compass className="w-3.5 h-3.5 text-amber-400" />
                <span>Dedicated Application Toolbar & 60s Auto-Save</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Clean application top bar with File (Export/Import), Edit (Undo/Redo/Reset), Settings (Auto-Save, Guidance Snapping), and Help dropdowns. Auto-save default set to 60s.
              </p>
            </div>

            {/* Feature Item 5 */}
            <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/60 space-y-1">
              <div className="flex items-center gap-2 font-bold text-slate-100">
                <ShieldCheck className="w-3.5 h-3.5 text-pink-400" />
                <span>Mega Line / Mega Vector & Reliability Fixes</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Multi-vertex Catmull-Rom spline / polyline drawing mode. Single & multi-node text deletion fix, right-click completion fix, Line Shape Mode toggles (`Curved` vs `Straight`), and strict double-click text entity creation rules.
              </p>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-xs transition flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Got it!</span>
          </button>
        </div>
      </div>
    </div>
  );
};
