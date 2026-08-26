import React, { useState, useEffect, useRef } from 'react';
import type { ProjectLayout } from '../types/schema';
import { INITIAL_LAYOUT } from '../utils/initialData';
import { filterLayoutForExport } from '../utils/aabbFilter';
import { getApiBaseUrl } from '../utils/api';
import { RefreshCw, CheckCircle2, AlertCircle, Download, Compass, ZoomIn, ZoomOut, RotateCcw, Move, Copy } from 'lucide-react';
import { getCurrentExportFileName, consumeExportFileName, getCurrentExportBaseName } from '../utils/exportNaming';

const LOCAL_STORAGE_KEY = 'mrsketch_project_layout_v1';

export const StandalonePreview: React.FC<{ backendUrl?: string }> = ({
  backendUrl = getApiBaseUrl(),
}) => {
  const [layout, setLayout] = useState<ProjectLayout>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return INITIAL_LAYOUT;
  });

  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isCompiling, setIsCompiling] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastCompiledAt, setLastCompiledAt] = useState<string | null>(null);

  // Interactive PDF Viewer Controls State
  const [zoomScale, setZoomScale] = useState<number>(1.0);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);

  // Set browser tab title for pop out tab
  useEffect(() => {
    document.title = 'Popout Preview - MR-Sketch - Scientific Sketch Link';
  }, []);

  // Sync state changes from main workspace tab via localStorage storage event
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === LOCAL_STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          setLayout(parsed);
        } catch (err) {}
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Global mouseup event listener to ensure middle-click drag release is 100% reliably caught
  useEffect(() => {
    const handleGlobalMouseUp = (e: MouseEvent) => {
      if (e.button === 1 || isDragging) {
        setIsDragging(false);
      }
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [isDragging]);

  const abortControllerRef = useRef<AbortController | null>(null);
  const lastJsonRef = useRef<string>('');

  const compileLayout = async () => {
    const exportableLayout = filterLayoutForExport(layout);
    const currentJson = JSON.stringify(exportableLayout);

    if (currentJson === lastJsonRef.current && previewImage) {
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsCompiling(true);
    setError(null);

    try {
      const response = await fetch(`${backendUrl}/api/compile?dpi=200&fast_mode=false`, {
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
      setPreviewImage(`data:image/png;base64,${data.image_base64}`);
      setLastCompiledAt(new Date().toLocaleTimeString());
      lastJsonRef.current = currentJson;
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error('Compilation Error:', err);
      setError(err.message || 'Error connecting to Python backend');
    } finally {
      if (abortControllerRef.current === controller) {
        setIsCompiling(false);
      }
    }
  };

  useEffect(() => {
    compileLayout();
  }, [layout]);

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

  // Interactive Viewport Navigation Handlers (Middle Click Drag)
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 0.85;
    const oldScale = zoomScale;
    const newScale = Math.min(5.0, Math.max(0.2, oldScale * factor));
    if (newScale === oldScale) return;

    const f = newScale / oldScale;
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const newPanX = mouseX - (mouseX - panOffset.x) * f;
      const newPanY = mouseY - (mouseY - panOffset.y) * f;
      setPanOffset({ x: newPanX, y: newPanY });
    }
    setZoomScale(newScale);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only pan on Middle Click (button === 1)
    if (e.button === 1) {
      e.preventDefault();
      setIsDragging(true);
      setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPanOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (e.button === 1 || isDragging) {
      setIsDragging(false);
    }
  };

  const resetView = () => {
    setZoomScale(1.0);
    setPanOffset({ x: 0, y: 0 });
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 font-sans overflow-hidden select-none">
      {/* Top Header Controls Bar */}
      <header className="h-12 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between shrink-0 z-20 shadow-md">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-indigo-600 rounded-lg text-white shadow">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-xs font-bold text-slate-200 leading-tight">
              Publication Live PDF Viewer (Overleaf Sync)
            </h1>
            <p className="text-[10px] text-slate-400">
              Real-time TeX rendering preview • Auto-synced with workspace
            </p>
          </div>
        </div>

        {/* Viewer Zoom & Action Controls */}
        <div className="flex items-center gap-3">
          {/* Zoom Buttons */}
          <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-lg border border-slate-700 text-xs">
            <button
              onClick={() => setZoomScale((z) => Math.max(0.2, z - 0.15))}
              className="p-1 hover:bg-slate-700 text-slate-300 rounded transition"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="w-14 text-center font-mono font-bold text-indigo-400 text-[11px]">
              {Math.round(zoomScale * 100)}%
            </span>
            <button
              onClick={() => setZoomScale((z) => Math.min(5.0, z + 0.15))}
              className="p-1 hover:bg-slate-700 text-slate-300 rounded transition"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={resetView}
              className="p-1 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded transition ml-1"
              title="Reset Zoom & Pan"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Sync Status Badge */}
          {isCompiling ? (
            <div className="flex items-center gap-1.5 text-xs text-indigo-400 font-mono">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Compiling...</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Live Synced</span>
            </div>
          )}

          {lastCompiledAt && (
            <span className="text-[10px] text-slate-500 font-mono">
              {lastCompiledAt}
            </span>
          )}

          {/* Copy PNG button */}
          <button
            onClick={handleCopyPngToClipboard}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition border shadow-lg ${
              copiedPng ? 'bg-emerald-900/60 border-emerald-500 text-emerald-300' : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
            title="Copy PNG image directly to clipboard"
            disabled={!previewImage}
          >
            <Copy className="w-3.5 h-3.5 text-blue-400" />
            <span>{copiedPng ? 'Copied PNG!' : 'Copy PNG'}</span>
          </button>

          {/* Download PNG button */}
          <button
            onClick={handleDownloadPng}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition border border-slate-700 shadow-lg"
            title="Download PNG image"
            disabled={!previewImage}
          >
            <Download className="w-3.5 h-3.5 text-blue-400" />
            <span>Export PNG</span>
          </button>

          {/* Copy LaTeX template */}
          <button
            onClick={handleCopyLatexTemplate}
            className={`px-3 py-1.5 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-lg ${
              copiedLatex ? 'bg-purple-700' : 'bg-purple-600 hover:bg-purple-500'
            }`}
            title="Copy LaTeX Figure Inclusion Template to Clipboard"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>{copiedLatex ? 'Copied!' : 'Copy LaTeX'}</span>
          </button>

          {/* Download PDF */}
          <button
            onClick={handleDownloadPdf}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-lg"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Vector PDF</span>
          </button>
        </div>
      </header>

      {/* Main Interactive Vector Viewer Canvas */}
      <div
        ref={containerRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onAuxClick={(e) => e.preventDefault()}
        onContextMenu={(e) => e.preventDefault()}
        className="flex-1 w-full h-full bg-slate-950 relative overflow-hidden flex items-center justify-center cursor-grab active:cursor-grabbing"
      >
        {/* Navigation Helper Indicator */}
        <div className="absolute bottom-4 left-4 z-10 bg-slate-900/80 backdrop-blur border border-slate-800 rounded-lg px-3 py-1.5 text-[10px] text-slate-400 flex items-center gap-2 shadow-lg">
          <Move className="w-3 h-3 text-indigo-400" />
          <span><b>Mouse Wheel</b> Zoom • <b>Middle Click Drag</b> Move Around Viewport</span>
        </div>

        {error ? (
          <div className="flex flex-col items-center gap-3 text-red-400 p-6 max-w-md text-center bg-red-950/40 border border-red-900/60 rounded-2xl shadow-2xl z-10">
            <AlertCircle className="w-10 h-10" />
            <span className="text-sm font-bold">LaTeX Compilation Error</span>
            <p className="text-xs font-mono text-red-300/90 leading-relaxed">{error}</p>
          </div>
        ) : previewImage ? (
          <div
            style={{
              transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomScale})`,
              transition: isDragging ? 'none' : 'transform 0.15s ease-out',
            }}
            className="p-4 bg-white rounded-xl shadow-2xl border border-slate-700/80 inline-block max-w-none max-h-none pointer-events-none"
          >
            <img
              src={previewImage}
              alt="Live PDF Vector Preview"
              className="block rounded max-w-[85vw] max-h-[85vh] object-contain shadow"
            />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-slate-500 z-10">
            <RefreshCw className="w-8 h-8 animate-spin text-indigo-400" />
            <span className="text-xs font-medium">Rendering Matplotlib LaTeX figure...</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default StandalonePreview;
