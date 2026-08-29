import React, { useState } from 'react';
import type { MacroDefinition } from '../types/schema';
import { parseTexMacros } from '../hooks/useMacroParser';
import { Code2, Plus, Trash2, FileText, CheckCircle } from 'lucide-react';

interface MacroEditorProps {
  macros: Record<string, MacroDefinition>;
  onUpdateMacros: (macros: Record<string, MacroDefinition>) => void;
}

export const MacroEditor: React.FC<MacroEditorProps> = ({ macros, onUpdateMacros }) => {
  const [rawTex, setRawTex] = useState('');
  const [newCmd, setNewCmd] = useState('');
  const [newArgs, setNewArgs] = useState(0);
  const [newTemplate, setNewTemplate] = useState('');
  const [activeTab, setActiveTab] = useState<'list' | 'import'>('list');

  const handleAddMacro = () => {
    if (!newCmd.trim() || !newTemplate.trim()) return;
    const formattedCmd = newCmd.startsWith('\\') ? newCmd.trim() : `\\${newCmd.trim()}`;
    
    onUpdateMacros({
      ...macros,
      [formattedCmd]: {
        command: formattedCmd,
        argsCount: newArgs,
        template: newTemplate.trim(),
      },
    });

    setNewCmd('');
    setNewArgs(0);
    setNewTemplate('');
  };

  const handleDeleteMacro = (commandKey: string) => {
    const updated = { ...macros };
    delete updated[commandKey];
    onUpdateMacros(updated);
  };

  const handleImportRawTex = () => {
    if (!rawTex.trim()) return;
    const parsed = parseTexMacros(rawTex);
    onUpdateMacros({
      ...macros,
      ...parsed,
    });
    setRawTex('');
    setActiveTab('list');
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100 p-4 rounded-xl border border-slate-800 shadow-xl">
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
        <div className="flex items-center gap-2 text-indigo-400 font-semibold text-sm">
          <Code2 className="w-4 h-4" />
          <span>LaTeX Macro Manager</span>
        </div>
        <div className="flex bg-slate-800 p-1 rounded-lg text-xs">
          <button
            onClick={() => setActiveTab('list')}
            className={`px-3 py-1 rounded-md transition ${
              activeTab === 'list' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Definitions ({Object.keys(macros).length})
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`px-3 py-1 rounded-md transition ${
              activeTab === 'import' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Import .tex
          </button>
        </div>
      </div>

      {activeTab === 'list' ? (
        <div className="flex-1 flex flex-col min-h-0 gap-4">
          {/* Add Macro Form */}
          <div className="bg-slate-800/60 p-3 rounded-lg border border-slate-700/50 flex flex-col gap-2">
            <span className="text-xs font-semibold text-slate-300">Add New Macro</span>
            <div className="grid grid-cols-12 gap-2">
              <input
                type="text"
                placeholder="\zcmd"
                value={newCmd}
                onChange={(e) => setNewCmd(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddMacro();
                }}
                className="col-span-4 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-indigo-300 focus:outline-none focus:border-indigo-500"
              />
              <input
                type="number"
                min={0}
                max={9}
                value={newArgs}
                onChange={(e) => setNewArgs(parseInt(e.target.value, 10) || 0)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddMacro();
                }}
                className="col-span-2 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 text-center focus:outline-none focus:border-indigo-500"
                title="Arguments Count"
              />
              <input
                type="text"
                placeholder="\hat{\boldsymbol{n}}_{#1}"
                value={newTemplate}
                onChange={(e) => setNewTemplate(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddMacro();
                }}
                className="col-span-5 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-emerald-300 focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={handleAddMacro}
                className="col-span-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded flex items-center justify-center transition"
                title="Add Macro (Enter)"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Macro List */}
          <div className="flex-1 overflow-y-auto pr-1 space-y-2">
            {Object.values(macros).map((m) => (
              <div
                key={m.command}
                className="flex items-center justify-between p-2.5 bg-slate-950/70 rounded-lg border border-slate-800/80 hover:border-slate-700 transition"
              >
                <div className="flex flex-col min-w-0 pr-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-indigo-300 font-bold">{m.command}</span>
                    {m.argsCount > 0 && (
                      <span className="bg-indigo-950 text-indigo-400 text-[10px] px-1.5 py-0.5 rounded border border-indigo-800">
                        {m.argsCount} arg{m.argsCount > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-[11px] text-emerald-400 truncate mt-0.5">
                    {m.template}
                  </span>
                </div>
                <button
                  onClick={() => handleDeleteMacro(m.command)}
                  className="text-slate-500 hover:text-red-400 p-1 rounded transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0 gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <FileText className="w-4 h-4 text-emerald-400" />
            <span>Paste raw TeX source (containing \newcommand definitions):</span>
          </div>
          <textarea
            value={rawTex}
            onChange={(e) => setRawTex(e.target.value)}
            placeholder={`\\newcommand{\\zcontactnormal}[1]{\\hat{\\boldsymbol{n}}_{#1}}\n\\newcommand{\\zmass}{m}`}
            className="flex-1 bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500 resize-none"
          />
          <button
            onClick={handleImportRawTex}
            className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition"
          >
            <CheckCircle className="w-4 h-4" />
            <span>Parse & Merge Definitions</span>
          </button>
        </div>
      )}
    </div>
  );
};
