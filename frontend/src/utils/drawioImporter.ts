import type { ProjectLayout, SceneNode } from '../types/schema';
import { INITIAL_LAYOUT } from './initialData';

export interface DrawioCell {
  id: string;
  type?: string;
  parent?: string;
  source?: string;
  target?: string;
  label?: string;
  html?: string;
  value?: string;
  style?: string;
  geometry?: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  };
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface DrawioPage {
  id?: string;
  name?: string;
  cells?: DrawioCell[];
}

/**
 * Cleans Draw.io label text by stripping HTML tags, resolving HTML entities,
 * and converting Draw.io ASCIIMath / backticks (e.g. `X_d`) into standard LaTeX ($X_d$).
 */
export function cleanDrawioText(rawText: string | undefined): string {
  if (!rawText) return '';
  let text = rawText;

  // Decode standard HTML entities
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // Replace HTML breaks/paragraphs/divs with newlines
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/div>\s*<div>/gi, '\n');
  text = text.replace(/<[^>]+>/g, ''); // Strip remaining HTML tags

  text = text.trim();

  // Convert backticked expressions `...` to LaTeX math $...$
  text = text.replace(/`([^`]+)`/g, (_match, inner) => {
    let latex = inner.trim();
    // Common ASCIIMath replacements
    latex = latex.replace(/hat\(([^)]+)\)/g, '\\hat{$1}');
    latex = latex.replace(/<=>/g, '\\Leftrightarrow');
    latex = latex.replace(/\^-1/g, '^{-1}');
    latex = latex.replace(/_\(([^)]+)\)/g, '_{\\text{$1}}');
    return `$${latex}$`;
  });

  return text;
}

/**
 * Validates whether a parsed object or string resembles Draw.io schema.
 */
export function isDrawioContent(input: any): boolean {
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (trimmed.startsWith('<mxfile') || trimmed.includes('<mxGraphModel') || trimmed.includes('<mxCell')) {
      return true;
    }
    try {
      const parsed = JSON.parse(input);
      return isDrawioContent(parsed);
    } catch {
      return false;
    }
  }

  if (input && typeof input === 'object') {
    if (input.version && Array.isArray(input.pages)) return true;
    if (Array.isArray(input.cells) && input.cells.some((c: any) => c && (c.source || c.target || c.type === 'edge' || c.type === 'node'))) return true;
  }
  return false;
}

/**
 * Helper to extract key-value style properties from Draw.io style string.
 * Example: "rounded=0;fillColor=#ffe6cc;strokeColor=#d79b00;"
 */
function parseStyleString(styleStr: string | undefined): Record<string, string> {
  const styles: Record<string, string> = {};
  if (!styleStr) return styles;

  const parts = styleStr.split(';');
  for (const part of parts) {
    if (!part.trim()) continue;
    const [key, val] = part.split('=');
    if (key) {
      styles[key.trim()] = val ? val.trim() : 'true';
    }
  }
  return styles;
}

/**
 * Parses Draw.io XML format (<mxfile> ... <mxGraphModel> ... <mxCell>) and converts it
 * into a publication-ready Scientific Sketch `ProjectLayout`.
 */
export function parseDrawioXML(xmlString: string, baseLayout?: ProjectLayout): ProjectLayout {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

  const parserError = xmlDoc.querySelector('parsererror');
  if (parserError) {
    throw new Error(`XML Parsing Error: ${parserError.textContent}`);
  }

  const mxCellNodes = Array.from(xmlDoc.querySelectorAll('mxCell'));
  if (mxCellNodes.length === 0) {
    throw new Error('No <mxCell> elements found in Draw.io XML.');
  }

  const edgeIds = new Set<string>();
  const edgeNodes: Array<{ id: string; source: string; target: string; value: string; style: string }> = [];
  const edgeLabelMap = new Map<string, string>();
  const vertexNodes: Array<{ id: string; parent: string; value: string; style: string; x: number; y: number; width: number; height: number }> = [];

  // First pass: identify edges and edge IDs
  for (const el of mxCellNodes) {
    const id = el.getAttribute('id') || '';
    const isEdge = el.getAttribute('edge') === '1';
    const source = el.getAttribute('source') || '';
    const target = el.getAttribute('target') || '';

    if (isEdge || (source && target)) {
      edgeIds.add(id);
      edgeNodes.push({
        id,
        source,
        target,
        value: el.getAttribute('value') || el.getAttribute('label') || '',
        style: el.getAttribute('style') || ''
      });
    }
  }

  // Second pass: collect edge labels and vertices
  for (const el of mxCellNodes) {
    const id = el.getAttribute('id') || '';
    if (id === '0' || id === '1' || id === 'root') continue;

    const parent = el.getAttribute('parent') || '';
    const isEdge = edgeIds.has(id);
    const isEdgeLabel = parent && edgeIds.has(parent);
    const value = el.getAttribute('value') || el.getAttribute('label') || '';
    const style = el.getAttribute('style') || '';

    if (isEdgeLabel) {
      const cleaned = cleanDrawioText(value);
      if (cleaned) {
        const existing = edgeLabelMap.get(parent);
        edgeLabelMap.set(parent, existing ? `${existing} ${cleaned}` : cleaned);
      }
      continue;
    }

    if (!isEdge && !isEdgeLabel) {
      // Vertex node
      const geom = el.querySelector('mxGeometry');
      const x = parseFloat(geom?.getAttribute('x') || '0');
      const y = parseFloat(geom?.getAttribute('y') || '0');
      const width = parseFloat(geom?.getAttribute('width') || '60');
      const height = parseFloat(geom?.getAttribute('height') || '30');

      vertexNodes.push({
        id,
        parent,
        value,
        style,
        x,
        y,
        width,
        height
      });
    }
  }

  if (vertexNodes.length === 0) {
    throw new Error('No diagram vertex elements found in Draw.io XML.');
  }

  // Calculate pixel bounding box to perform exact center-offset & scientific unit scale normalization
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const v of vertexNodes) {
    minX = Math.min(minX, v.x);
    maxX = Math.max(maxX, v.x + v.width);
    minY = Math.min(minY, v.y);
    maxY = Math.max(maxY, v.y + v.height);
  }

  const totalWidth = maxX > minX ? maxX - minX : 100;
  const totalHeight = maxY > minY ? maxY - minY : 100;
  const centerX_px = minX + totalWidth / 2;
  const centerY_px = minY + totalHeight / 2;

  // Scientific stage scale factor: fit overall graph within [-7.5, 7.5] x [-5.5, 5.5]
  const scaleX = 15.0 / totalWidth;
  const scaleY = 11.0 / totalHeight;
  const scale = Math.min(scaleX, scaleY, 0.05);

  const nodePositions = new Map<string, { x: number; y: number; w: number; h: number }>();
  const sceneNodes: SceneNode[] = [];
  const defaultLayout = baseLayout || INITIAL_LAYOUT;

  for (const v of vertexNodes) {
    const cx_px = v.x + v.width / 2;
    const cy_px = v.y + v.height / 2;

    // Convert pixel center to scientific plot center (Inverting Y axis!)
    const normX = Math.round(((cx_px - centerX_px) * scale) * 100) / 100;
    const normY = Math.round((-(cy_px - centerY_px) * scale) * 100) / 100;
    const normW = Math.max(0.6, Math.round((v.width * scale) * 100) / 100);
    const normH = Math.max(0.4, Math.round((v.height * scale) * 100) / 100);

    nodePositions.set(v.id, { x: normX, y: normY, w: normW, h: normH });

    const cleanedLabel = cleanDrawioText(v.value);
    const styles = parseStyleString(v.style);

    const isEllipse = v.style.includes('ellipse') || cleanedLabel === '-' || cleanedLabel === '+';
    const isDashed = v.style.includes('dashed=1');
    const isTextOnly = v.style.includes('text;') || (styles['strokeColor'] === 'none' && styles['fillColor'] === 'none');

    const fillColor = styles['fillColor'] && styles['fillColor'] !== 'none' ? styles['fillColor'] : (isEllipse ? '#eff6ff' : '#f8fafc');
    const strokeColor = styles['strokeColor'] && styles['strokeColor'] !== 'none' ? styles['strokeColor'] : (isEllipse ? '#2563eb' : '#1e293b');

    if (isEllipse) {
      sceneNodes.push({
        id: `node_xml_${v.id}`,
        name: cleanedLabel || 'Junction',
        type: 'circle',
        x: normX,
        y: normY,
        radius: Math.max(0.4, normW / 2),
        label: cleanedLabel || undefined,
        labelOffsetX: 0,
        labelOffsetY: 0,
        fontSize: 14,
        style: {
          strokeWidth: 2,
          strokeStyle: 'solid',
          color: strokeColor,
          fillColor: fillColor,
          strokeOpacity: 1,
          fillOpacity: 1
        }
      });
    } else {
      sceneNodes.push({
        id: `node_xml_${v.id}`,
        name: cleanedLabel.split('\n')[0] || 'Block',
        type: 'obstacle',
        x: normX,
        y: normY,
        width: normW,
        height: normH,
        label: cleanedLabel || undefined,
        labelOffsetX: 0,
        labelOffsetY: 0,
        fontSize: 12,
        style: {
          strokeWidth: parseFloat(styles['strokeWidth'] || '2'),
          strokeStyle: isDashed ? 'dashed' : 'solid',
          color: strokeColor,
          fillColor: isTextOnly ? undefined : fillColor,
          strokeOpacity: isTextOnly ? 0 : 1,
          fillOpacity: isTextOnly ? 0 : 1
        }
      });
    }
  }

  // Construct Vector Connections (Edges)
  let edgeCount = 1;
  for (const edge of edgeNodes) {
    if (!edge.source || !edge.target) continue;

    const srcPos = nodePositions.get(edge.source);
    const tgtPos = nodePositions.get(edge.target);
    if (!srcPos || !tgtPos) continue;

    const dx = Math.round((tgtPos.x - srcPos.x) * 100) / 100;
    const dy = Math.round((tgtPos.y - srcPos.y) * 100) / 100;

    const edgeLabel = edgeLabelMap.get(edge.id) || cleanDrawioText(edge.value);

    sceneNodes.push({
      id: `vector_xml_${edge.id || edgeCount++}`,
      name: edgeLabel || `Vector ${edgeCount}`,
      type: 'vector',
      x: srcPos.x,
      y: srcPos.y,
      points: [0, 0, dx, dy],
      label: edgeLabel || undefined,
      labelOffsetX: Math.round((dx * 0.45) * 100) / 100,
      labelOffsetY: Math.round((dy * 0.45 + 0.3) * 100) / 100,
      fontSize: 12,
      style: {
        strokeWidth: 2,
        strokeStyle: 'solid',
        color: '#0f172a',
        strokeOpacity: 1,
        fillOpacity: 1
      }
    });
  }

  return {
    macros: defaultLayout.macros || {},
    definitions: defaultLayout.definitions || {},
    scene: sceneNodes,
    exportBounds: defaultLayout.exportBounds || { xMin: -10, yMin: -10, xMax: 10, yMax: 10 },
    plotOptions: defaultLayout.plotOptions || {
      showGrid: true,
      gridStyle: 'dotted',
      showAxis: true,
      showAxisLabels: true,
      xLabel: '$x$ [m]',
      yLabel: '$y$ [m]',
      title: 'Draw.io XML Imported Diagram',
      fontSize: 12,
      backgroundColor: '#ffffff',
      bgOpacity: 1,
      marginPadding: 0.05,
      showPlotBorder: true
    }
  };
}

/**
 * Universal Importer: Accepts Draw.io XML string, JSON string, or JSON object
 * and returns a compiled Scientific Sketch `ProjectLayout`.
 */
export function convertDrawioToProjectLayout(input: any, baseLayout?: ProjectLayout): ProjectLayout {
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (trimmed.startsWith('<') || trimmed.includes('<mxGraphModel') || trimmed.includes('<mxCell')) {
      return parseDrawioXML(trimmed, baseLayout);
    }
    try {
      const parsedJSON = JSON.parse(trimmed);
      return convertDrawioToProjectLayout(parsedJSON, baseLayout);
    } catch {
      throw new Error('Unrecognized string format. Please provide valid Draw.io XML or JSON layout content.');
    }
  }

  // JSON handling fallback
  const data = input;
  let cells: DrawioCell[] = [];

  if (Array.isArray(data.pages) && data.pages.length > 0) {
    for (const page of data.pages) {
      if (Array.isArray(page.cells)) {
        cells.push(...page.cells);
      }
    }
  } else if (Array.isArray(data.cells)) {
    cells = data.cells;
  }

  if (cells.length === 0) {
    throw new Error('No cells found in Draw.io JSON file.');
  }

  const edgeIds = new Set<string>();
  const edgeMap = new Map<string, DrawioCell>();
  const edgeLabelMap = new Map<string, string>();

  for (const cell of cells) {
    if (cell.type === 'edge' || (cell.source && cell.target)) {
      edgeIds.add(cell.id);
      edgeMap.set(cell.id, cell);
    }
  }

  for (const cell of cells) {
    if (cell.parent && edgeIds.has(cell.parent)) {
      const cleaned = cleanDrawioText(cell.label || cell.value);
      if (cleaned) {
        const existing = edgeLabelMap.get(cell.parent);
        edgeLabelMap.set(cell.parent, existing ? `${existing} ${cleaned}` : cleaned);
      }
    }
  }

  const nodeMap = new Map<string, DrawioCell>();
  for (const cell of cells) {
    const isEdge = edgeIds.has(cell.id);
    const isEdgeLabel = cell.parent && edgeIds.has(cell.parent);
    const isRootContainer = cell.id === '0' || cell.id === '1' || cell.id === 'root';

    if (!isEdge && !isEdgeLabel && !isRootContainer) {
      nodeMap.set(cell.id, cell);
    }
  }

  const nodes = Array.from(nodeMap.values());
  if (nodes.length === 0) {
    throw new Error('No graph nodes identified in Draw.io JSON file.');
  }

  // Simple topological layout for JSON diagrams
  const sceneNodes: SceneNode[] = [];
  const defaultLayout = baseLayout || INITIAL_LAYOUT;

  nodes.forEach((n, idx) => {
    const cleanedLabel = cleanDrawioText(n.label || n.value);
    const normX = -6.0 + (idx % 4) * 4.0;
    const normY = 4.0 - Math.floor(idx / 4) * 3.0;

    sceneNodes.push({
      id: `node_json_${n.id}`,
      name: cleanedLabel || `Node ${idx + 1}`,
      type: cleanedLabel === '-' ? 'circle' : 'obstacle',
      x: normX,
      y: normY,
      width: 3.2,
      height: 1.6,
      radius: 0.7,
      label: cleanedLabel || undefined,
      fontSize: 12,
      style: {
        strokeWidth: 2,
        strokeStyle: 'solid',
        color: '#1e293b',
        fillColor: '#f8fafc',
        strokeOpacity: 1,
        fillOpacity: 1
      }
    });
  });

  return {
    macros: defaultLayout.macros || {},
    definitions: defaultLayout.definitions || {},
    scene: sceneNodes,
    exportBounds: defaultLayout.exportBounds || { xMin: -10, yMin: -10, xMax: 10, yMax: 10 },
    plotOptions: defaultLayout.plotOptions || {
      showGrid: true,
      gridStyle: 'dotted',
      showAxis: true,
      showAxisLabels: true,
      xLabel: '$x$ [m]',
      yLabel: '$y$ [m]',
      title: 'Draw.io Diagram',
      fontSize: 12,
      backgroundColor: '#ffffff',
      bgOpacity: 1,
      marginPadding: 0.05,
      showPlotBorder: true
    }
  };
}
