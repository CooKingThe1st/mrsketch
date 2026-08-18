import React, { useState, useEffect, useRef } from 'react';
import type { ProjectLayout } from '../types/schema';
import { filterLayoutForExport } from '../utils/aabbFilter';
import { RefreshCw, Download, FileCode, CheckCircle2, AlertCircle, ExternalLink, Copy } from 'lucide-react';
import { getCurrentExportFileName, consumeExportFileName, getCurrentExportBaseName } from '../utils/exportNaming';

interface LivePreviewProps {
  layout: ProjectLayout;
  backendUrl?: string;
}

export const LivePreview: React.FC<LivePreviewProps> = ({
  layout,
  backendUrl = 'http://127.0.0.1:8000',
}) => {
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isCompiling, setIsCompiling] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastCompiledAt, setLastCompiledAt] = useState<string | null>(null);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastJsonRef = useRef<string>('');

  const compileLayout = async () => {
    const exportableLayout = filterLayoutForExport(layout);
    const currentJson = JSON.stringify(exportableLayout);

    // Skip redundant network request if visible export layout has not changed
    if (currentJson === lastJsonRef.current && previewImage) {
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

  // Debounced sync loop (500ms hysteresis live preview)
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      compileLayout();
    }, 500);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
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
              <RefreshCw className="w-3.5 h-3.5 text-indigo-400 animate-spin ml-1" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 ml-1" />
            )}
          </div>
          <div className="flex items-center gap-2">
            {lastCompiledAt && (
              <span className="text-[10px] text-slate-500 font-mono">Updated: {lastCompiledAt}</span>
            )}

            <button
              onClick={handlePopOutPreview}
              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold flex items-center gap-1 transition"
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

        {/* Row 2: Export Options */}
        <div className="p-2 px-3 bg-slate-950/40 flex items-center justify-end gap-2 text-xs">
          <span className="text-[10px] font-semibold text-slate-400 mr-auto uppercase tracking-wider">Export Panel</span>

          <button
            onClick={handleDownloadPng}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-semibold flex items-center gap-1 transition border border-slate-700"
            title="Download PNG image"
            disabled={!previewImage}
          >
            <Download className="w-3.5 h-3.5 text-blue-400" />
            <span>Export PNG</span>
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
            <span>{copiedPng ? 'Copied PNG!' : 'Copy PNG'}</span>
          </button>

          <button
            onClick={handleDownloadPdf}
            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold flex items-center gap-1 transition"
            title="Download Publication Vector PDF"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      {/* Main Preview Display */}
      <div className="flex-1 p-4 bg-slate-950 flex items-center justify-center relative overflow-hidden">
        {error ? (
          <div className="flex flex-col items-center gap-2 text-red-400 p-4 max-w-sm text-center bg-red-950/30 border border-red-900/50 rounded-xl">
            <AlertCircle className="w-8 h-8" />
            <span className="text-xs font-semibold">LaTeX Compilation Error</span>
            <p className="text-[11px] font-mono text-red-300/80">{error}</p>
          </div>
        ) : previewImage ? (
          <div className="w-full h-full flex items-center justify-center p-2 bg-slate-950 overflow-auto">
            <div className="p-2 bg-white rounded-lg shadow-2xl border border-slate-700 max-w-full max-h-full flex items-center justify-center">
              <img
                src={previewImage}
                alt="Matplotlib Live Preview"
                className="max-w-full max-h-full w-auto h-auto object-contain rounded"
              />
            </div>
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
