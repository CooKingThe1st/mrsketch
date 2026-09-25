import React, { useState, useEffect, useRef } from 'react';
import type { ProjectLayout } from '../types/schema';
import { filterLayoutForExport } from '../utils/aabbFilter';
import { getApiBaseUrl } from '../utils/api';
import { RefreshCw, Download, FileCode, CheckCircle2, AlertCircle, ExternalLink, Copy, Zap, Clock } from 'lucide-react';
import { getCurrentExportFileName, consumeExportFileName, getCurrentExportBaseName } from '../utils/exportNaming';
import { ClientVectorPreview } from './ClientVectorPreview';

interface LivePreviewProps {
  layout: ProjectLayout;
  backendUrl?: string;
}

export const LivePreview: React.FC<LivePreviewProps> = ({
  layout,
  backendUrl = getApiBaseUrl(),
}) => {
  const [autoCompile, setAutoCompile] = useState<boolean>(() => {
    try {
      return localStorage.getItem('mrsketch_auto_compile') === 'true';
    } catch {
      return false;
    }
  });

  const [previewEngine, setPreviewEngine] = useState<'client' | 'matplotlib'>(() => {
    try {
      return (localStorage.getItem('mrsketch_preview_engine') as 'client' | 'matplotlib') || 'client';
    } catch {
      return 'client';
    }
  });

  const switchPreviewEngine = (engine: 'client' | 'matplotlib') => {
    setPreviewEngine(engine);
    try {
      localStorage.setItem('mrsketch_preview_engine', engine);
    } catch {}
  };

  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isCompiling, setIsCompiling] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastCompiledAt, setLastCompiledAt] = useState<string | null>(null);
  const [hasPendingChanges, setHasPendingChanges] = useState<boolean>(false);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastJsonRef = useRef<string>('');
  const pendingTimerRef = useRef<any>(null);

  const toggleAutoCompile = () => {
    const next = !autoCompile;
    setAutoCompile(next);
    try {
      localStorage.setItem('mrsketch_auto_compile', String(next));
    } catch {}
    if (next) {
      compileLayout();
    }
  };

  const compileLayout = async (force: boolean = false) => {
    const exportableLayout = filterLayoutForExport(layout);
    const currentJson = JSON.stringify(exportableLayout);

    // Skip redundant network request if visible export layout has not changed
    if (!force && currentJson === lastJsonRef.current && previewImage) {
      setHasPendingChanges(false);
      return;
    }

    // Cancel in-flight request if user makes new edit
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsCompiling(true);
    setError(null);

    try {
      const response = await fetch(`${backendUrl}/api/compile?dpi=80&fast_mode=true`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: currentJson,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Failed to compile Matplotlib output');
      }

      const data = await response.json();
      const imgUri = `data:image/png;base64,${data.image_base64}`;
      setPreviewImage(imgUri);
      setLastCompiledAt(new Date().toLocaleTimeString());
      lastJsonRef.current = currentJson;
      setHasPendingChanges(false);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // Request was safely aborted for newer layout state
        return;
      }
      console.error('Compilation Error:', err);
      setError(err.message || 'Error connecting to Python backend');
    } finally {
      if (abortControllerRef.current === controller) {
        setIsCompiling(false);
      }
    }
  };

  // Detect pending changes when layout changes in manual mode (debounced to avoid locking UI thread)
  useEffect(() => {
    if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
    pendingTimerRef.current = setTimeout(() => {
      const exportableLayout = filterLayoutForExport(layout);
      const currentJson = JSON.stringify(exportableLayout);
      if (lastJsonRef.current && currentJson !== lastJsonRef.current) {
        setHasPendingChanges(true);
      }
    }, 300);
    return () => {
      if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
    };
  }, [layout]);

  // Initial compile or auto-compile debounced sync loop
  useEffect(() => {
    // Initial mount: compile once so user sees initial state
    if (!lastJsonRef.current) {
      compileLayout();
      return;
    }

    if (!autoCompile) {
      return;
    }

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      compileLayout();
    }, 600);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [layout, autoCompile]);

  // Keyboard shortcut Ctrl+Enter / Cmd+Enter to manually trigger render
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        compileLayout(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [layout]);

  const handlePopOutPreview = () => {
    const previewUrl = `${window.location.origin}${window.location.pathname}#preview`;
    window.open(previewUrl, '_blank');
  };

  const [copiedLatex, setCopiedLatex] = useState(false);

  const handleCopyLatexTemplate = async () => {
    try {
      const pdfFileName = getCurrentExportFileName('pdf');
      const labelName = getCurrentExportBaseName();
      const latexCode = `\\begin{figure}[htbp]
    \\centering
    \\includegraphics[width=0.8\\textwidth, page=1]{${pdfFileName}}
    \\caption{FOOBAR Description}
    \\label{fig:${labelName}}
\\end{figure}`;
      await navigator.clipboard.writeText(latexCode);
      setCopiedLatex(true);
      setTimeout(() => setCopiedLatex(false), 2000);
    } catch (err: any) {
      alert(`Failed to copy: ${err.message}`);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      const response = await fetch(`${backendUrl}/api/export-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(layout),
      });

      if (!response.ok) throw new Error('PDF export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const pdfName = consumeExportFileName('pdf');

      const a = document.createElement('a');
      a.href = url;
      a.download = pdfName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    }
  };

  const [copiedPng, setCopiedPng] = useState(false);

  const handleDownloadPng = () => {
    if (!previewImage) return;
    const pngName = consumeExportFileName('png');
    const a = document.createElement('a');
    a.href = previewImage;
    a.download = pngName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleCopyPngToClipboard = async () => {
    if (!previewImage) return;
    try {
      const base64Data = previewImage.split(',')[1];
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'image/png' });

      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob
        })
      ]);
      setCopiedPng(true);
      setTimeout(() => setCopiedPng(false), 2000);
    } catch (err: any) {
      alert(`Failed to copy PNG: ${err.message}`);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border-l border-slate-800 text-slate-100">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/90 flex flex-col">
        {/* Row 1 */}
        <div className="p-3 flex items-center justify-between border-b border-slate-800/40">
          <div className="flex items-center gap-2">
            <FileCode className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold text-xs">Publication Matplotlib Output</span>
            {isCompiling ? (
              <span className="flex items-center gap-1 text-[11px] text-indigo-400 font-mono">
                <RefreshCw className="w-3.5 h-3.5 animate-spin ml-1" />
                Compiling...
              </span>
            ) : hasPendingChanges ? (
              <span className="flex items-center gap-1 text-[11px] text-amber-400 font-mono" title="Canvas has unrendered changes. Click Render or press Ctrl+Enter">
                <Clock className="w-3.5 h-3.5 ml-1" />
                Changes pending
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-mono">
                <CheckCircle2 className="w-3.5 h-3.5 ml-1" />
                Synced
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Engine Switcher */}
            <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-700/80 text-[11px]">
              <button
                type="button"
                onClick={() => switchPreviewEngine('client')}
                className={`px-2 py-0.5 rounded font-semibold transition flex items-center gap-1 ${
                  previewEngine === 'client'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Instant Client Vector Preview: 0ms latency, zero server connection, updates live as you draw"
              >
                <Zap className="w-3 h-3 text-amber-300" />
                <span>Instant SVG</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  switchPreviewEngine('matplotlib');
                  if (!previewImage) compileLayout(true);
                }}
                className={`px-2 py-0.5 rounded font-semibold transition flex items-center gap-1 ${
                  previewEngine === 'matplotlib'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Python Matplotlib Server Engine: High-precision pdflatex raster output from host"
              >
                <FileCode className="w-3 h-3 text-emerald-400" />
                <span>Matplotlib</span>
              </button>
            </div>

            {lastCompiledAt && previewEngine === 'matplotlib' && (
              <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">Updated: {lastCompiledAt}</span>
            )}

            <button
              onClick={handlePopOutPreview}
              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold flex items-center gap-1 transition shadow-sm"
              title="Pop Out Live Preview URL Tab (Overleaf style)"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Pop Out Tab</span>
            </button>

            <button
              onClick={handleCopyLatexTemplate}
              className={`px-2.5 py-1 text-white rounded text-xs font-semibold flex items-center gap-1 transition ${
                copiedLatex ? 'bg-purple-700' : 'bg-purple-600 hover:bg-purple-500'
              }`}
              title="Copy LaTeX Figure Inclusion Template to Clipboard"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{copiedLatex ? 'Copied!' : 'Copy LaTeX'}</span>
            </button>
          </div>
        </div>

        {/* Row 2: Render Trigger & Export Options */}
        <div className="p-2 px-3 bg-slate-950/40 flex items-center justify-between gap-2 text-xs flex-wrap">
          {/* Left: Render Button & Auto-Compile Toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => compileLayout(true)}
              disabled={isCompiling}
              className={`px-3 py-1 rounded text-xs font-bold flex items-center gap-1.5 transition shadow-md ${
                hasPendingChanges
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 animate-pulse'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white'
              } disabled:opacity-50`}
              title="Compile LaTeX output (Shortcut: Ctrl+Enter)"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>{isCompiling ? 'Rendering...' : 'Render TeX'}</span>
              <kbd className="hidden md:inline text-[9px] bg-black/20 px-1 rounded font-mono font-normal">Ctrl+↵</kbd>
            </button>

            {/* Auto Compile Toggle */}
            <label className="flex items-center gap-1.5 cursor-pointer select-none text-[11px] text-slate-300 hover:text-slate-100 transition px-1.5 py-0.5 rounded bg-slate-800/60 border border-slate-700/60" title="When ON, auto-compiles on canvas edits. When OFF (recommended), only renders on demand for 60fps drawing speed.">
              <input
                type="checkbox"
                checked={autoCompile}
                onChange={toggleAutoCompile}
                className="w-3 h-3 accent-indigo-500 rounded cursor-pointer"
              />
              <span>Live Sync</span>
            </label>
          </div>

          {/* Right: Export Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPng}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-semibold flex items-center gap-1 transition border border-slate-700"
              title="Download PNG image"
              disabled={!previewImage}
            >
              <Download className="w-3.5 h-3.5 text-blue-400" />
              <span>PNG</span>
            </button>

            <button
              onClick={handleCopyPngToClipboard}
              className={`px-2.5 py-1 text-slate-200 rounded text-xs font-semibold flex items-center gap-1 transition border ${
                copiedPng ? 'bg-emerald-900/60 border-emerald-500' : 'bg-slate-800 hover:bg-slate-700 border-slate-700'
              }`}
              title="Copy PNG image directly to clipboard"
              disabled={!previewImage}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>{copiedPng ? 'Copied' : 'Copy'}</span>
            </button>

            <button
              onClick={handleDownloadPdf}
              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold flex items-center gap-1 transition"
              title="Download Publication Vector PDF"
            >
              <Download className="w-3.5 h-3.5" />
              <span>PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Preview Display */}
      <div className="flex-1 bg-slate-950 flex items-center justify-center relative overflow-hidden">
        {previewEngine === 'client' ? (
          <ClientVectorPreview layout={layout} />
        ) : error ? (
          <div className="flex flex-col items-center gap-2 text-red-400 p-4 max-w-sm text-center bg-red-950/30 border border-red-900/50 rounded-xl">
            <AlertCircle className="w-8 h-8" />
            <span className="text-xs font-semibold">LaTeX Compilation Error</span>
            <p className="text-[11px] font-mono text-red-300/80">{error}</p>
          </div>
        ) : previewImage ? (
          <div className="w-full h-full flex items-center justify-center p-2 bg-slate-950 overflow-auto relative">
            <div className={`p-2 bg-white rounded-lg shadow-2xl border border-slate-700 max-w-full max-h-full flex items-center justify-center transition-opacity duration-200 ${hasPendingChanges ? 'opacity-75' : 'opacity-100'}`}>
              <img
                src={previewImage}
                alt="Matplotlib Live Preview"
                className="max-w-full max-h-full w-auto h-auto object-contain rounded"
              />
            </div>
            {hasPendingChanges && (
              <div className="absolute bottom-3 bg-amber-950/80 border border-amber-600/70 text-amber-200 px-3 py-1 rounded-full text-[10px] font-medium backdrop-blur shadow-lg flex items-center gap-1.5 pointer-events-none">
                <Clock className="w-3 h-3 text-amber-400" />
                <span>Showing previous render • Press Ctrl+Enter to update</span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
            <span className="text-xs font-medium">Rendering Matplotlib vector canvas...</span>
          </div>
        )}
      </div>
    </div>
  );
};

