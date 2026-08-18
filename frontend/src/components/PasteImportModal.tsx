import { useState } from 'react';
import { X, Clipboard, Sparkles, AlertCircle } from 'lucide-react';

interface PasteImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (content: string) => void;
}

export function PasteImportModal({ isOpen, onClose, onImport }: PasteImportModalProps) {
  const [text, setText] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handlePasteFromClipboard = async () => {
    try {
      const clipboardText = await navigator.clipboard.readText();
      if (clipboardText) {
        setText(clipboardText);
        setError(null);
      }
    } catch (err) {
      setError('Unable to access system clipboard. Please paste manually using Ctrl+V.');
    }
  };

  const handleSubmit = () => {
    if (!text.trim()) {
      setError('Please paste your Draw.io XML or Layout JSON content first.');
      return;
    }
    setError(null);
    try {
      onImport(text);
      setText('');
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to translate pasted content.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 rounded-lg">
              <Clipboard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100">Paste Diagram XML / Layout JSON</h2>
              <p className="text-[11px] text-slate-400">
                Paste Draw.io XML (&lt;mxfile&gt;...) or Scientific Sketch layout JSON to import directly.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 flex flex-col gap-3">
          {error && (
            <div className="p-3 bg-red-950/60 border border-red-800/80 rounded-lg flex items-center gap-2 text-xs text-red-300">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex justify-between items-center text-xs text-slate-400">
            <label htmlFor="paste-area" className="font-semibold text-slate-300">
              Diagram Source Code:
            </label>
            <button
              onClick={handlePasteFromClipboard}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded border border-slate-700 transition"
              title="Paste content directly from your system clipboard"
            >
              <Clipboard className="w-3.5 h-3.5" />
              <span>Paste from System Clipboard</span>
            </button>
          </div>

          <textarea
            id="paste-area"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (error) setError(null);
            }}
            placeholder="Paste raw XML string here... e.g. <mxfile host='app.diagrams.net'><diagram>...</diagram></mxfile>"
            rows={12}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono text-emerald-300 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none"
          />
        </div>

        {/* Footer Controls */}
        <div className="px-5 py-3.5 border-t border-slate-800 bg-slate-900/50 flex items-center justify-between text-xs">
          <button
            onClick={() => setText('')}
            className="px-3 py-1.5 text-slate-400 hover:text-slate-200 transition"
          >
            Clear Text
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-slate-300 hover:bg-slate-800 rounded-lg transition border border-slate-700"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg shadow-lg shadow-indigo-600/20 transition"
            >
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>Translate & Import</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
