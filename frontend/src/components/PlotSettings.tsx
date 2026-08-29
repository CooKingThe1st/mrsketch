import React from 'react';
import type { PlotOptions } from '../types/schema';
import { Sliders, Grid, Type, Palette, Eye, Square } from 'lucide-react';

interface PlotSettingsProps {
  plotOptions: PlotOptions;
  onUpdatePlotOptions: (updated: PlotOptions) => void;
}

export const PlotSettings: React.FC<PlotSettingsProps> = ({ plotOptions, onUpdatePlotOptions }) => {
  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100 p-4 rounded-xl border border-slate-800 shadow-xl overflow-y-auto space-y-5">
      <div className="flex items-center gap-2 pb-3 border-b border-slate-800 text-indigo-400 font-semibold text-sm">
        <Sliders className="w-4 h-4" />
        <span>Matplotlib Figure & PDF Customization</span>
      </div>

      {/* Grid Settings */}
      <div className="bg-slate-800/60 p-3.5 rounded-lg border border-slate-700 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
            <Grid className="w-4 h-4 text-emerald-400" />
            <span>Grid Overlay</span>
          </div>
          <input
            type="checkbox"
            checked={plotOptions.showGrid}
            onChange={(e) => onUpdatePlotOptions({ ...plotOptions, showGrid: e.target.checked })}
            className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
          />
        </div>

        {plotOptions.showGrid && (
          <div>
            <label className="text-[11px] text-slate-400">Grid Line Style (Matlab Format)</label>
            <select
              value={plotOptions.gridStyle}
              onChange={(e) => onUpdatePlotOptions({ ...plotOptions, gridStyle: e.target.value as any })}
              className="w-full mt-1 bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-200"
            >
              <option value=":">: Dotted ( ... )</option>
              <option value="--">-- Dashed ( - - )</option>
              <option value="-.">-. Dash-Dot ( - . )</option>
              <option value="-">- Solid ( — )</option>
            </select>
          </div>
        )}
      </div>

      {/* Axis & Border Control Settings */}
      <div className="bg-slate-800/60 p-3.5 rounded-lg border border-slate-700 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
            <Eye className="w-4 h-4 text-amber-400" />
            <span>Show Axis Frame & Ticks</span>
          </div>
          <input
            type="checkbox"
            checked={plotOptions.showAxis}
            onChange={(e) => onUpdatePlotOptions({ ...plotOptions, showAxis: e.target.checked })}
            className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
          />
        </div>

        <div className="flex items-center justify-between border-t border-slate-700/60 pt-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
            <Square className="w-4 h-4 text-sky-400" />
            <span>Show Outer Plot Border Line</span>
          </div>
          <input
            type="checkbox"
            checked={plotOptions.showPlotBorder ?? true}
            onChange={(e) => onUpdatePlotOptions({ ...plotOptions, showPlotBorder: e.target.checked })}
            className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
          />
        </div>

        {/* Margin Padding Control */}
        <div className="border-t border-slate-700/60 pt-2 space-y-1">
          <div className="flex justify-between items-center text-xs">
            <label className="text-[11px] font-semibold text-slate-300">Output Margin Padding (inches)</label>
            <span className="font-mono text-indigo-400 font-bold">{(plotOptions.marginPadding ?? 0.05).toFixed(2)} in</span>
          </div>
          <input
            type="range"
            min="0.0"
            max="0.5"
            step="0.01"
            value={plotOptions.marginPadding ?? 0.05}
            onChange={(e) => onUpdatePlotOptions({ ...plotOptions, marginPadding: parseFloat(e.target.value) || 0 })}
            className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
        </div>


        <div className="flex items-center justify-between border-t border-slate-700/60 pt-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
            <Type className="w-4 h-4 text-indigo-400" />
            <span>Show Axis Labels</span>
          </div>
          <input
            type="checkbox"
            checked={plotOptions.showAxisLabels}
            onChange={(e) => onUpdatePlotOptions({ ...plotOptions, showAxisLabels: e.target.checked })}
            className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
          />
        </div>

        {plotOptions.showAxisLabels && (
          <div className="space-y-2 pt-1 border-t border-slate-700/60">
            <div>
              <label className="text-[11px] font-semibold text-slate-300">X-Axis Label (LaTeX)</label>
              <input
                type="text"
                value={plotOptions.xLabel || ''}
                onChange={(e) => onUpdatePlotOptions({ ...plotOptions, xLabel: e.target.value })}
                placeholder="$x$ [m]"
                className="w-full mt-1 bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono text-indigo-300"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-300">Y-Axis Label (LaTeX)</label>
              <input
                type="text"
                value={plotOptions.yLabel || ''}
                onChange={(e) => onUpdatePlotOptions({ ...plotOptions, yLabel: e.target.value })}
                placeholder="$y$ [m]"
                className="w-full mt-1 bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono text-indigo-300"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-300">Figure Title (Optional)</label>
              <input
                type="text"
                value={plotOptions.title || ''}
                onChange={(e) => onUpdatePlotOptions({ ...plotOptions, title: e.target.value })}
                placeholder="Robotics Experiment Scene Layout"
                className="w-full mt-1 bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-200"
              />
            </div>
          </div>
        )}
      </div>

      {/* Typography & Label Transparency Settings */}
      <div className="bg-slate-800/60 p-3.5 rounded-lg border border-slate-700 space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
          <Palette className="w-4 h-4 text-pink-400" />
          <span>Styling & Label Transparency</span>
        </div>

        {/* Label Bounding Box Opacity Slider */}
        <div className="space-y-1">
          <div className="flex justify-between items-center text-xs">
            <label className="text-[11px] font-semibold text-slate-200">Label Bounding Box Opacity</label>
            <span className="font-mono text-indigo-400 font-bold">{Math.round((plotOptions.labelBoxOpacity ?? 0.0) * 100)}%</span>
          </div>
          <input
            type="range"
            min="0.0"
            max="1.0"
            step="0.05"
            value={plotOptions.labelBoxOpacity ?? 0.0}
            onChange={(e) => onUpdatePlotOptions({ ...plotOptions, labelBoxOpacity: parseFloat(e.target.value) || 0 })}
            className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
        </div>

        {/* Scale Labels with Zoom Toggle */}
        <div className="flex items-center justify-between border-t border-slate-700/60 pt-2">
          <div className="flex flex-col pr-2">
            <span className="text-xs font-bold text-slate-200">Scale Labels with Canvas Zoom</span>
            <span className="text-[10px] text-slate-400 leading-tight">Shrinks text on zoom-out to avoid blocking diagram view</span>
          </div>
          <input
            type="checkbox"
            checked={plotOptions.scaleLabelsWithZoom ?? false}
            onChange={(e) => onUpdatePlotOptions({ ...plotOptions, scaleLabelsWithZoom: e.target.checked })}
            className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
          />
        </div>

        <div className="border-t border-slate-700/60 pt-2 space-y-2">
          <div>
            <label className="text-[11px] text-slate-400">Background Color</label>
            <input
              type="color"
              value={plotOptions.backgroundColor}
              onChange={(e) => onUpdatePlotOptions({ ...plotOptions, backgroundColor: e.target.value })}
              className="w-full h-8 mt-1 bg-slate-950 border border-slate-700 rounded cursor-pointer"
            />
          </div>

          {/* Background Opacity Slider */}
          <div className="space-y-1 pt-1">
            <div className="flex justify-between items-center text-xs">
              <label className="text-[11px] text-slate-400">Background Opacity</label>
              <span className="font-mono text-indigo-400 font-bold">{Math.round((plotOptions.bgOpacity ?? 1.0) * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.0"
              max="1.0"
              step="0.05"
              value={plotOptions.bgOpacity ?? 1.0}
              onChange={(e) => onUpdatePlotOptions({ ...plotOptions, bgOpacity: parseFloat(e.target.value) || 0 })}
              className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
