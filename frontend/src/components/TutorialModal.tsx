import React, { useState } from 'react';
import { X, BookOpen, MousePointer, Type, CheckCircle2, Keyboard, Download, Move } from 'lucide-react';

interface TutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TutorialModal: React.FC<TutorialModalProps> = ({ isOpen, onClose }) => {
  const [dontShowAgain, setDontShowAgain] = useState<boolean>(true);

  if (!isOpen) return null;

  const handleClose = () => {
    if (dontShowAgain) {
      try {
        localStorage.setItem('mrsketch_tutorial_seen', 'true');
      } catch (e) {}
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in select-none">
      <div className="bg-slate-900 border border-slate-700/90 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col text-slate-100 max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-600/30">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <span>Welcome to MR-Sketch (Scientific Sketch Link)</span>
                <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-full text-[10px] font-mono font-bold">
                  Quick Guide
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">Interactive LaTeX Vector Modeling & Publication Diagrams</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-300">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Guide Card 1: Canvas Navigation */}
            <div className="bg-slate-800/60 p-3.5 rounded-xl border border-slate-700/70 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-indigo-400">
                <Move className="w-4 h-4" />
                <span>Canvas Navigation</span>
              </div>
              <ul className="text-[11px] text-slate-400 space-y-1 list-disc list-inside leading-relaxed">
                <li><strong className="text-slate-200">Pan:</strong> Hold <kbd className="px-1 py-0.5 bg-slate-950 rounded border border-slate-700 text-slate-300 font-mono text-[10px]">Space</kbd> + Left-click drag, or use Middle / Right-click drag.</li>
                <li><strong className="text-slate-200">Zoom:</strong> Mouse scroll wheel to zoom into details or out for the full layout.</li>
                <li><strong className="text-slate-200">Select & Move:</strong> Left-click to select; drag to reposition. Hold <kbd className="px-1 py-0.5 bg-slate-950 rounded border border-slate-700 text-slate-300 font-mono text-[10px]">Shift</kbd> to multi-select.</li>
              </ul>
            </div>

            {/* Guide Card 2: LaTeX Text & Math */}
            <div className="bg-slate-800/60 p-3.5 rounded-xl border border-slate-700/70 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-emerald-400">
                <Type className="w-4 h-4" />
                <span>LaTeX Math Annotations</span>
              </div>
              <ul className="text-[11px] text-slate-400 space-y-1 list-disc list-inside leading-relaxed">
                <li><strong className="text-slate-200">In-Place Editing:</strong> Double-click any label or text entity directly on the canvas to open the formula editor.</li>
                <li><strong className="text-slate-200">Math Syntax:</strong> Use standard TeX math syntax like <code className="text-emerald-300 font-mono text-[10px]">$x_r$</code>, <code className="text-emerald-300 font-mono text-[10px]">\mathbf&#123;F&#125;_&#123;net&#125;</code>, <code className="text-emerald-300 font-mono text-[10px]">\theta</code>.</li>
                <li><strong className="text-slate-200">Freeform Text:</strong> Pick the <strong className="text-slate-200">T</strong> tool on the left toolbar to place standalone text anywhere.</li>
              </ul>
            </div>

            {/* Guide Card 3: Shapes & Guidance Snapping */}
            <div className="bg-slate-800/60 p-3.5 rounded-xl border border-slate-700/70 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-cyan-400">
                <MousePointer className="w-4 h-4" />
                <span>Shapes & Guidance Snapping</span>
              </div>
              <ul className="text-[11px] text-slate-400 space-y-1 list-disc list-inside leading-relaxed">
                <li><strong className="text-slate-200">Quick Creation:</strong> Right double-click on the canvas to spawn the quick-create entity menu directly at your cursor.</li>
                <li><strong className="text-slate-200">Guidance Points:</strong> When drawing lines or vectors, endpoints automatically snap to nearby shape corners and midpoints.</li>
                <li><strong className="text-slate-200">Splines & Curves:</strong> Use <strong className="text-slate-200">Mega Line / Vector</strong> for smooth Catmull-Rom curved trajectories.</li>
              </ul>
            </div>

            {/* Guide Card 4: Publication Export */}
            <div className="bg-slate-800/60 p-3.5 rounded-xl border border-slate-700/70 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-amber-400">
                <Download className="w-4 h-4" />
                <span>Publication Export</span>
              </div>
              <ul className="text-[11px] text-slate-400 space-y-1 list-disc list-inside leading-relaxed">
                <li><strong className="text-slate-200">Live Preview:</strong> Open the Right Panel to inspect real-time Matplotlib-compiled TeX renderings.</li>
                <li><strong className="text-slate-200">Vector PDF:</strong> Click <strong className="text-slate-200">Export PDF</strong> for native publication-grade vector graphics (PDFLaTeX ready).</li>
                <li><strong className="text-slate-200">Artboard Bounds:</strong> Adjust the purple viewport box to frame your export area, or toggle auto-crop.</li>
              </ul>
            </div>
          </div>

          {/* Guide Card 5: Keyboard Shortcuts Bar */}
          <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-700/50 flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <div className="flex items-center gap-1.5 font-bold text-purple-400">
              <Keyboard className="w-4 h-4" />
              <span>Key Shortcuts:</span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-slate-300">
              <span><kbd className="px-1.5 py-0.5 bg-slate-950 rounded border border-slate-700 text-slate-200 font-mono text-[10px]">Ctrl+Z</kbd> Undo</span>
              <span><kbd className="px-1.5 py-0.5 bg-slate-950 rounded border border-slate-700 text-slate-200 font-mono text-[10px]">Ctrl+Y</kbd> Redo</span>
              <span><kbd className="px-1.5 py-0.5 bg-slate-950 rounded border border-slate-700 text-slate-200 font-mono text-[10px]">Del</kbd> Delete</span>
              <span><kbd className="px-1.5 py-0.5 bg-slate-950 rounded border border-slate-700 text-slate-200 font-mono text-[10px]">Ctrl+S</kbd> Save</span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer hover:text-slate-200 transition">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
            />
            <span>Don't show this automatically on launch</span>
          </label>

          <button
            onClick={handleClose}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs transition flex items-center gap-2 shadow-lg shadow-indigo-600/30"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Start Drawing</span>
          </button>
        </div>
      </div>
    </div>
  );
};
