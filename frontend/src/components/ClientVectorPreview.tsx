import React, { useMemo } from 'react';
import type { ProjectLayout, SceneNode, PrimitiveDefinition } from '../types/schema';
import { filterLayoutForExport } from '../utils/aabbFilter';
import { renderLatexToHtml } from '../utils/latexRenderer';

interface ClientVectorPreviewProps {
  layout: ProjectLayout;
  className?: string;
  bareSvg?: boolean;
}

export const ClientVectorPreview: React.FC<ClientVectorPreviewProps> = ({ layout, className = '', bareSvg = false }) => {
  const exportableLayout = useMemo(() => filterLayoutForExport(layout), [layout]);
  const bounds = exportableLayout.exportBounds;
  const plotOptions = exportableLayout.plotOptions;

  const spanX = Math.max(0.1, bounds.xMax - bounds.xMin);
  const spanY = Math.max(0.1, bounds.yMax - bounds.yMin);

  // SVG Coordinate System & Scaling
  const BASE_WIDTH = 800;
  const scale = BASE_WIDTH / spanX;
  const BASE_HEIGHT = spanY * scale;

  // Margin padding in pixels
  const marginPaddingInches = plotOptions.marginPadding ?? 0.05;
  const marginPx = Math.max(12, marginPaddingInches * 72);

  const totalWidth = BASE_WIDTH + marginPx * 2;
  const totalHeight = BASE_HEIGHT + marginPx * 2;

  const toSvgX = (sciX: number) => marginPx + (sciX - bounds.xMin) * scale;
  const toSvgY = (sciY: number) => marginPx + (bounds.yMax - sciY) * scale;

  const getStrokeDash = (style?: string) => {
    if (style === 'dashed' || style === '--') return '6,4';
    if (style === 'dashdot' || style === '-.') return '8,4,2,4';
    if (style === 'dotted' || style === ':') return '2,3';
    return undefined;
  };

  const toCubicBezierPoints = (
    p1x: number,
    p1y: number,
    hcx: number,
    hcy: number,
    p2x: number,
    p2y: number
  ): [number, number, number, number, number, number] => {
    const cp1x = p1x + (2 / 3) * (hcx - p1x);
    const cp1y = p1y + (2 / 3) * (hcy - p1y);
    const cp2x = p2x + (2 / 3) * (hcx - p2x);
    const cp2y = p2y + (2 / 3) * (hcy - p2y);
    return [cp1x, cp1y, cp2x, cp2y, p2x, p2y];
  };

  // Helper to render arrowheads
  const renderArrowHead = (tipX: number, tipY: number, fromX: number, fromY: number, color: string, size = 1.0) => {
    const angle = Math.atan2(tipY - fromY, tipX - fromX);
    const headLength = Math.max(8, 11 * size);
    const headAngle = Math.PI / 6.5;
    const w1x = tipX - headLength * Math.cos(angle - headAngle);
    const w1y = tipY - headLength * Math.sin(angle - headAngle);
    const w2x = tipX - headLength * Math.cos(angle + headAngle);
    const w2y = tipY - headLength * Math.sin(angle + headAngle);

    return (
      <polygon
        points={`${tipX},${tipY} ${w1x},${w1y} ${w2x},${w2y}`}
        fill={color}
        stroke={color}
        strokeWidth={1}
        strokeLinejoin="round"
      />
    );
  };

  // Render Grid lines
  const gridLines = useMemo(() => {
    if (!plotOptions.showGrid) return null;
    const lines = [];
    const step = plotOptions.gridResolution ?? 1.0;
    const minX = Math.floor(bounds.xMin / step) * step;
    const maxX = Math.ceil(bounds.xMax / step) * step;
    const minY = Math.floor(bounds.yMin / step) * step;
    const maxY = Math.ceil(bounds.yMax / step) * step;
    const dash = getStrokeDash(plotOptions.gridStyle);

    for (let x = minX; x <= maxX; x += step) {
      const sx = toSvgX(x);
      lines.push(
        <line
          key={`gx_${x}`}
          x1={sx}
          y1={toSvgY(bounds.yMin)}
          x2={sx}
          y2={toSvgY(bounds.yMax)}
          stroke="#cbd5e1"
          strokeWidth={0.8}
          strokeDasharray={dash}
        />
      );
    }
    for (let y = minY; y <= maxY; y += step) {
      const sy = toSvgY(y);
      lines.push(
        <line
          key={`gy_${y}`}
          x1={toSvgX(bounds.xMin)}
          y1={sy}
          x2={toSvgX(bounds.xMax)}
          y2={sy}
          stroke="#cbd5e1"
          strokeWidth={0.8}
          strokeDasharray={dash}
        />
      );
    }
    return lines;
  }, [bounds, plotOptions.showGrid, plotOptions.gridResolution, plotOptions.gridStyle]);

  // Render Axis Frame, Spines and Ticks
  const axisOverlay = useMemo(() => {
    if (!plotOptions.showAxis) return null;
    const ticks = [];
    const step = Math.max(1, Math.round(spanX / 6));

    const minX = Math.ceil(bounds.xMin / step) * step;
    const maxX = Math.floor(bounds.xMax / step) * step;
    const minY = Math.ceil(bounds.yMin / step) * step;
    const maxY = Math.floor(bounds.yMax / step) * step;

    // X Ticks
    for (let x = minX; x <= maxX; x += step) {
      const sx = toSvgX(x);
      const sy = toSvgY(bounds.yMin);
      ticks.push(
        <g key={`tx_${x}`}>
          <line x1={sx} y1={sy} x2={sx} y2={sy + 5} stroke="#0f172a" strokeWidth={1} />
          <text x={sx} y={sy + 16} fontSize={10} fontFamily="serif" textAnchor="middle" fill="#0f172a">
            {x}
          </text>
        </g>
      );
    }

    // Y Ticks
    for (let y = minY; y <= maxY; y += step) {
      const sx = toSvgX(bounds.xMin);
      const sy = toSvgY(y);
      ticks.push(
        <g key={`ty_${y}`}>
          <line x1={sx} y1={sy} x2={sx - 5} y2={sy} stroke="#0f172a" strokeWidth={1} />
          <text x={sx - 8} y={sy + 3} fontSize={10} fontFamily="serif" textAnchor="end" fill="#0f172a">
            {y}
          </text>
        </g>
      );
    }

    return (
      <g key="axis_spines">
        {/* Frame Box */}
        {(plotOptions.showPlotBorder ?? true) && (
          <rect
            x={toSvgX(bounds.xMin)}
            y={toSvgY(bounds.yMax)}
            width={BASE_WIDTH}
            height={BASE_HEIGHT}
            fill="none"
            stroke="#0f172a"
            strokeWidth={1.2}
          />
        )}
        {ticks}

        {/* Axis Labels & Title */}
        {plotOptions.showAxisLabels && (
          <>
            {plotOptions.xLabel && (
              <foreignObject
                x={toSvgX((bounds.xMin + bounds.xMax) / 2) - 100}
                y={toSvgY(bounds.yMin) + 20}
                width={200}
                height={26}
              >
                <div
                  style={{ textAlign: 'center', fontSize: '12px', color: '#0f172a' }}
                  dangerouslySetInnerHTML={{ __html: renderLatexToHtml(plotOptions.xLabel) }}
                />
              </foreignObject>
            )}
            {plotOptions.yLabel && (
              <foreignObject
                x={toSvgX(bounds.xMin) - 45}
                y={toSvgY((bounds.yMin + bounds.yMax) / 2) - 50}
                width={30}
                height={100}
              >
                <div
                  style={{
                    transform: 'rotate(-90deg)',
                    transformOrigin: 'center center',
                    textAlign: 'center',
                    fontSize: '12px',
                    color: '#0f172a',
                  }}
                  dangerouslySetInnerHTML={{ __html: renderLatexToHtml(plotOptions.yLabel) }}
                />
              </foreignObject>
            )}
            {plotOptions.title && (
              <foreignObject
                x={toSvgX((bounds.xMin + bounds.xMax) / 2) - 150}
                y={toSvgY(bounds.yMax) - 24}
                width={300}
                height={24}
              >
                <div
                  style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '13px', color: '#0f172a' }}
                  dangerouslySetInnerHTML={{ __html: renderLatexToHtml(plotOptions.title) }}
                />
              </foreignObject>
            )}
          </>
        )}
      </g>
    );
  }, [bounds, plotOptions]);

  // Render individual scene node
  const renderNode = (node: SceneNode) => {
    const style = node.style || {};
    const strokeColor = style.color || '#000000';
    const strokeWidth = style.strokeWidth || 2;
    const strokeDash = getStrokeDash(style.strokeStyle);
    const fillColor = style.fillColor || 'transparent';
    const fillOpacity = style.fillOpacity ?? 1.0;
    const strokeOpacity = style.strokeOpacity ?? 1.0;
    const nodeScale = node.scale || 1.0;

    let shapeContent = null;

    if (node.type === 'rect' || node.type === 'obstacle') {
      const w = (node.width || 3) * nodeScale * scale;
      const h = (node.height || 2) * nodeScale * scale;
      const cx = toSvgX(node.x);
      const cy = toSvgY(node.y);
      const rot = -(node.rotation || 0);

      shapeContent = (
        <rect
          x={cx - w / 2}
          y={cy - h / 2}
          width={w}
          height={h}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDash}
          strokeOpacity={strokeOpacity}
          fill={fillColor}
          fillOpacity={fillOpacity}
          transform={rot ? `rotate(${rot}, ${cx}, ${cy})` : undefined}
        />
      );
    } else if (node.type === 'circle') {
      const r = (node.radius || 1) * nodeScale * scale;
      const cx = toSvgX(node.x);
      const cy = toSvgY(node.y);

      shapeContent = (
        <circle
          cx={cx}
          cy={cy}
          r={r}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDash}
          strokeOpacity={strokeOpacity}
          fill={fillColor}
          fillOpacity={fillOpacity}
        />
      );
    } else if (node.type === 'diamond') {
      const w = (node.width || 4) * nodeScale * scale;
      const h = (node.height || 3) * nodeScale * scale;
      const cx = toSvgX(node.x);
      const cy = toSvgY(node.y);
      const pts = `${cx},${cy - h / 2} ${cx + w / 2},${cy} ${cx},${cy + h / 2} ${cx - w / 2},${cy}`;
      const rot = -(node.rotation || 0);

      shapeContent = (
        <polygon
          points={pts}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDash}
          strokeOpacity={strokeOpacity}
          fill={fillColor}
          fillOpacity={fillOpacity}
          transform={rot ? `rotate(${rot}, ${cx}, ${cy})` : undefined}
        />
      );
    } else if (node.type === 'triangle') {
      const w = (node.width || 3) * nodeScale * scale;
      const cx = toSvgX(node.x);
      const cy = toSvgY(node.y);
      const isEquilateral = node.triangleType === 'equilateral';
      let pts = '';
      if (isEquilateral) {
        const h = w * 0.866;
        pts = `${cx},${cy - h * 0.66} ${cx - w / 2},${cy + h * 0.33} ${cx + w / 2},${cy + h * 0.33}`;
      } else {
        pts = `${cx - w / 2},${cy + w / 2} ${cx - w / 2},${cy - w / 2} ${cx + w / 2},${cy + w / 2}`;
      }
      const rot = -(node.rotation || 0);

      shapeContent = (
        <polygon
          points={pts}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDash}
          strokeOpacity={strokeOpacity}
          fill={fillColor}
          fillOpacity={fillOpacity}
          transform={rot ? `rotate(${rot}, ${cx}, ${cy})` : undefined}
        />
      );
    } else if ((node.type as string) === 'poly' && node.vertices && node.vertices.length >= 3) {
      const pts = node.vertices
        .map(([vx, vy]) => `${toSvgX(node.x + vx * nodeScale)},${toSvgY(node.y + vy * nodeScale)}`)
        .join(' ');

      shapeContent = (
        <polygon
          points={pts}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDash}
          strokeOpacity={strokeOpacity}
          fill={fillColor}
          fillOpacity={fillOpacity}
        />
      );
    } else if (node.type === 'line' || node.type === 'vector') {
      const p = node.points || [0, 0, 3, 2];
      const x1 = toSvgX(node.x + p[0] * nodeScale);
      const y1 = toSvgY(node.y + p[1] * nodeScale);
      const x2 = toSvgX(node.x + p[2] * nodeScale);
      const y2 = toSvgY(node.y + p[3] * nodeScale);

      shapeContent = (
        <g key={`vec_${node.id}`}>
          <line
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDash}
            strokeOpacity={strokeOpacity}
            strokeLinecap="round"
          />
          {node.type === 'vector' && renderArrowHead(x2, y2, x1, y1, strokeColor, node.arrowSize)}
          {node.doubleArrow && renderArrowHead(x1, y1, x2, y2, strokeColor, node.arrowSize)}
        </g>
      );
    } else if (node.type === 'super_line' || node.type === 'super_vector') {
      const p = node.points || [0, 0, 3, 2];
      const x1 = toSvgX(node.x + p[0] * nodeScale);
      const y1 = toSvgY(node.y + p[1] * nodeScale);
      const x2 = toSvgX(node.x + p[2] * nodeScale);
      const y2 = toSvgY(node.y + p[3] * nodeScale);
      const cpx = node.controlPoint ? node.controlPoint[0] : (p[0] + p[2]) / 2;
      const cpy = node.controlPoint ? node.controlPoint[1] : (p[1] + p[3]) / 2 + 1.0;
      const hcx = toSvgX(node.x + cpx * nodeScale);
      const hcy = toSvgY(node.y + cpy * nodeScale);

      const [cp1x, cp1y, cp2x, cp2y] = toCubicBezierPoints(x1, y1, hcx, hcy, x2, y2);
      const pathD = `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`;

      shapeContent = (
        <g key={`svec_${node.id}`}>
          <path
            d={pathD}
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDash}
            strokeOpacity={strokeOpacity}
            strokeLinecap="round"
          />
          {node.type === 'super_vector' && renderArrowHead(x2, y2, cp2x, cp2y, strokeColor, node.arrowSize)}
          {node.doubleArrow && renderArrowHead(x1, y1, cp1x, cp1y, strokeColor, node.arrowSize)}
        </g>
      );
    } else if (node.type === 'mega_line' || node.type === 'mega_vector') {
      const p = node.points || [0, 0, 3, 2];
      const pathPts: Array<[number, number]> = [];
      for (let i = 0; i < p.length; i += 2) {
        pathPts.push([toSvgX(node.x + (p[i] || 0) * nodeScale), toSvgY(node.y + (p[i + 1] || 0) * nodeScale)]);
      }

      if (pathPts.length >= 2) {
        const d = pathPts.map(([px, py], i) => (i === 0 ? `M ${px} ${py}` : `L ${px} ${py}`)).join(' ');
        const last = pathPts[pathPts.length - 1];
        const prev = pathPts[pathPts.length - 2];

        shapeContent = (
          <g key={`mline_${node.id}`}>
            <path
              d={d}
              fill="none"
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDash}
              strokeOpacity={strokeOpacity}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {node.type === 'mega_vector' && renderArrowHead(last[0], last[1], prev[0], prev[1], strokeColor, node.arrowSize)}
          </g>
        );
      }
    } else if (node.type === 'alias' && node.definitionId && exportableLayout.definitions[node.definitionId]) {
      const def = exportableLayout.definitions[node.definitionId];
      shapeContent = (
        <g key={`alias_${node.id}`} transform={`translate(${toSvgX(node.x)}, ${toSvgY(node.y)})`}>
          {def.primitives.map((prim: PrimitiveDefinition, pIdx: number) => {
            const pCfg = prim.config;
            const pColor = pCfg.strokeColor || '#000000';
            const pFill = pCfg.fillColor || 'transparent';
            const pWidth = pCfg.strokeWidth || 1.5;
            const pDash = getStrokeDash(pCfg.strokeStyle);

            if (prim.type === 'rect') {
              const rw = (pCfg.width || 2) * scale;
              const rh = (pCfg.height || 2) * scale;
              const rx = (pCfg.x || 0) * scale - rw / 2;
              const ry = -(pCfg.y || 0) * scale - rh / 2;
              return (
                <rect
                  key={`ap_${pIdx}`}
                  x={rx}
                  y={ry}
                  width={rw}
                  height={rh}
                  stroke={pColor}
                  fill={pFill}
                  strokeWidth={pWidth}
                  strokeDasharray={pDash}
                />
              );
            } else if (prim.type === 'circle') {
              const cr = (pCfg.radius || 1) * scale;
              const cx = (pCfg.x || 0) * scale;
              const cy = -(pCfg.y || 0) * scale;
              return (
                <circle
                  key={`ap_${pIdx}`}
                  cx={cx}
                  cy={cy}
                  r={cr}
                  stroke={pColor}
                  fill={pFill}
                  strokeWidth={pWidth}
                  strokeDasharray={pDash}
                />
              );
            }
            return null;
          })}
        </g>
      );
    }

    // Render LaTeX Math Annotation Label
    const hasLabel = Boolean(node.label && node.label.trim());
    let labelContent = null;
    if (hasLabel) {
      const lx = toSvgX(node.x + (node.labelOffsetX || 0));
      const ly = toSvgY(node.y + (node.labelOffsetY || 0));
      const labelBoxOpacity = plotOptions.labelBoxOpacity ?? 0.0;
      const labelTextColor = node.labelTextColor || '#0f172a';
      const labelFontSize = Math.max(9, node.fontSize || 12);

      labelContent = (
        <foreignObject
          key={`label_${node.id}`}
          x={lx - 120}
          y={ly - 20}
          width={240}
          height={40}
          style={{ overflow: 'visible' }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              pointerEvents: 'none',
            }}
          >
            <span
              style={{
                backgroundColor: labelBoxOpacity > 0 ? `rgba(255, 255, 255, ${labelBoxOpacity})` : undefined,
                color: labelTextColor,
                fontSize: `${labelFontSize}px`,
                padding: labelBoxOpacity > 0 ? '2px 4px' : undefined,
                borderRadius: labelBoxOpacity > 0 ? '2px' : undefined,
                lineHeight: 1.2,
                display: 'inline-block',
                whiteSpace: 'nowrap',
              }}
              dangerouslySetInnerHTML={{ __html: renderLatexToHtml(node.label || '') }}
            />
          </div>
        </foreignObject>
      );
    }

    return (
      <g key={`node_group_${node.id}`}>
        {shapeContent}
        {labelContent}
      </g>
    );
  };

  const svgElement = (
    <svg
      viewBox={`0 0 ${totalWidth} ${totalHeight}`}
      className={`max-w-full max-h-full w-auto h-auto object-contain ${bareSvg ? className : ''}`}
      style={{
        backgroundColor: plotOptions.backgroundColor || '#ffffff',
        opacity: plotOptions.bgOpacity ?? 1.0,
      }}
    >
      {/* Plot Background Area */}
      <rect
        x={toSvgX(bounds.xMin)}
        y={toSvgY(bounds.yMax)}
        width={BASE_WIDTH}
        height={BASE_HEIGHT}
        fill={plotOptions.backgroundColor || '#ffffff'}
      />

      {/* Grid Layer */}
      {gridLines}

      {/* Scene Content Layer */}
      <g key="scene_content">{exportableLayout.scene.map(renderNode)}</g>

      {/* Axis & Labels Overlay Layer */}
      {axisOverlay}
    </svg>
  );

  if (bareSvg) {
    return svgElement;
  }

  return (
    <div className={`w-full h-full flex items-center justify-center p-2 bg-slate-950 overflow-auto ${className}`}>
      <div className="bg-white rounded-lg shadow-2xl border border-slate-700 max-w-full max-h-full flex items-center justify-center p-1 overflow-hidden">
        {svgElement}
      </div>
    </div>
  );
};
