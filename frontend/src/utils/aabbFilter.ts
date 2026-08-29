import type { ProjectLayout, SceneNode, RobotDefinition, ExportBounds } from '../types/schema';

export function computeNodeAABB(
  node: SceneNode,
  definitions: Record<string, RobotDefinition>
): [number, number, number, number] {
  const nx = node.x;
  const ny = node.y;
  const scale = node.scale || 1.0;
  const rad = (((node.rotation || 0)) * Math.PI) / 180;
  const cosR = Math.cos(rad);
  const sinR = Math.sin(rad);

  const type = node.type;

  // Standalone text nodes have no background shape at (nx, ny); their content is solely at the label offset
  if (type === 'text') {
    const lox = (node.labelOffsetX ?? 0.0) * scale;
    const loy = (node.labelOffsetY ?? 0.0) * scale;
    const lx = nx + lox;
    const ly = ny + loy;
    const fsize = node.fontSize || 12;
    const fsizeUnits = (fsize / 40.0) * scale;
    const lines = (node.label || '').split('\n');
    const lineCount = Math.max(1, lines.length);
    const maxChars = Math.max(...lines.map((l) => l.length), 1);
    const halfW = Math.max(0.2, maxChars * (fsizeUnits * 0.28));
    const halfH = Math.max(0.15, lineCount * (fsizeUnits * 0.45));
    return [lx - halfW, ly - halfH, lx + halfW, ly + halfH];
  }

  const xs: number[] = [];
  const ys: number[] = [];

  if (type === 'rect' || type === 'obstacle') {
    const w = (node.width || 3) * scale;
    const h = (node.height || 2) * scale;
    const corners = [
      [-w / 2, -h / 2],
      [w / 2, -h / 2],
      [w / 2, h / 2],
      [-w / 2, h / 2],
    ];
    corners.forEach(([cx, cy]) => {
      xs.push(nx + (cx * cosR - cy * sinR));
      ys.push(ny + (cx * sinR + cy * cosR));
    });
  } else if (type === 'circle') {
    const r = (node.radius || 1.5) * scale;
    xs.push(nx - r, nx + r);
    ys.push(ny - r, ny + r);
  } else if (type === 'triangle') {
    const w = (node.width || 3) * scale;
    const triType = node.triangleType || 'right_isosceles';
    const pts = triType === 'equilateral'
      ? [[0, (w * 0.866) * 0.66], [-w / 2, -(w * 0.866) * 0.33], [w / 2, -(w * 0.866) * 0.33]]
      : [[-w / 3, (2 * w) / 3], [-w / 3, -w / 3], [(2 * w) / 3, -w / 3]];
    pts.forEach(([cx, cy]) => {
      xs.push(nx + (cx * cosR - cy * sinR));
      ys.push(ny + (cx * sinR + cy * cosR));
    });
  } else if (type === 'diamond') {
    const w = (node.width || 3) * scale;
    const h = (node.height || 2) * scale;
    const pts = [[0, h / 2], [w / 2, 0], [0, -h / 2], [-w / 2, 0]];
    pts.forEach(([cx, cy]) => {
      xs.push(nx + (cx * cosR - cy * sinR));
      ys.push(ny + (cx * sinR + cy * cosR));
    });
  } else if (type === 'vector' || type === 'line' || type === 'super_vector' || type === 'super_line') {
    const pts = node.points || [0, 0, 3, 2];
    if (pts.length >= 4) {
      const dx1 = pts[0] * scale;
      const dy1 = pts[1] * scale;
      const dx2 = pts[2] * scale;
      const dy2 = pts[3] * scale;
      xs.push(nx + (dx1 * cosR - dy1 * sinR), nx + (dx2 * cosR - dy2 * sinR));
      ys.push(ny + (dx1 * sinR + dy1 * cosR), ny + (dx2 * sinR + dy2 * cosR));
    }
    if (node.controlPoint && node.controlPoint.length >= 2) {
      const cpx = node.controlPoint[0] * scale;
      const cpy = node.controlPoint[1] * scale;
      xs.push(nx + (cpx * cosR - cpy * sinR));
      ys.push(ny + (cpx * sinR + cpy * cosR));
    }
  } else if (type === 'mega_line' || type === 'mega_vector') {
    const pts = node.points || [0, 0, 3, 2];
    for (let i = 0; i < pts.length - 1; i += 2) {
      const dx = pts[i] * scale;
      const dy = pts[i + 1] * scale;
      xs.push(nx + (dx * cosR - dy * sinR));
      ys.push(ny + (dx * sinR + dy * cosR));
    }
  } else if (type === 'alias' && node.definitionId && definitions[node.definitionId]) {
    const def = definitions[node.definitionId];
    const nodeScale = scale;

    if (def.primitives && def.primitives.length > 0) {
      def.primitives.forEach((prim) => {
        const cfg = prim.config || {};
        const ox = ((cfg.x || 0) / 40.0) * nodeScale;
        const oy = ((cfg.y || 0) / 40.0) * nodeScale;
        const rx = nx + (ox * cosR - oy * sinR);
        const ry = ny + (ox * sinR + oy * cosR);

        if (prim.type === 'circle') {
          const r = ((cfg.radius !== undefined ? cfg.radius : 25.0) / 40.0) * nodeScale;
          xs.push(rx - r, rx + r);
          ys.push(ry - r, ry + r);
        } else if (prim.type === 'rect') {
          const w = ((cfg.width !== undefined ? cfg.width : 30.0) / 40.0) * nodeScale;
          const h = ((cfg.height !== undefined ? cfg.height : 30.0) / 40.0) * nodeScale;
          const maxExtent = Math.hypot(w / 2, h / 2);
          xs.push(rx - maxExtent, rx + maxExtent);
          ys.push(ry - maxExtent, ry + maxExtent);
        } else if (prim.type === 'poly' && cfg.vertices) {
          cfg.vertices.forEach(([vx, vy]) => {
            const sx = ox + (vx / 40.0) * nodeScale;
            const sy = oy + (vy / 40.0) * nodeScale;
            xs.push(nx + (sx * cosR - sy * sinR));
            ys.push(ny + (sx * sinR + sy * cosR));
          });
        } else if (cfg.points) {
          const [x1, y1, x2, y2] = cfg.points.map((p) => (p / 40.0) * nodeScale);
          xs.push(nx + ((ox + x1) * cosR - (oy + y1) * sinR), nx + ((ox + x2) * cosR - (oy + y2) * sinR));
          ys.push(ny + ((ox + x1) * sinR + (oy + y1) * cosR), ny + ((ox + x2) * sinR + (oy + y2) * cosR));
        } else {
          xs.push(rx - 0.5 * nodeScale, rx + 0.5 * nodeScale);
          ys.push(ry - 0.5 * nodeScale, ry + 0.5 * nodeScale);
        }
      });
    } else {
      xs.push(nx - 1.0, nx + 1.0);
      ys.push(ny - 1.0, ny + 1.0);
    }
  } else {
    // default
    xs.push(nx - 0.5, nx + 0.5);
    ys.push(ny - 0.5, ny + 0.5);
  }

  if (node.label && node.label.trim()) {
    const isShape = type === 'rect' || type === 'circle' || type === 'triangle' || type === 'diamond' || type === 'obstacle' || type === 'alias';
    const defaultOff = isShape ? 0.0 : 0.3;
    const lox = (node.labelOffsetX ?? defaultOff) * scale;
    const loy = (node.labelOffsetY ?? defaultOff) * scale;
    const fsize = node.fontSize || 12;
    const fsizeUnits = (fsize / 40.0) * scale;
    const lines = node.label.split('\n');
    const lineCount = Math.max(1, lines.length);
    const maxChars = Math.max(...lines.map((l) => l.length), 1);
    const halfW = Math.max(0.2, maxChars * (fsizeUnits * 0.28));
    const halfH = Math.max(0.15, lineCount * (fsizeUnits * 0.45));
    xs.push(nx + lox - halfW, nx + lox + halfW);
    ys.push(ny + loy - halfH, ny + loy + halfH);
  }

  if (xs.length === 0 || ys.length === 0) {
    return [nx - 0.5, ny - 0.5, nx + 0.5, ny + 0.5];
  }

  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

export function isAABBIntersecting(
  aabb: [number, number, number, number],
  bounds: ExportBounds,
  margin: number = 0.0
): boolean {
  const [minX, minY, maxX, maxY] = aabb;
  const eMinX = bounds.xMin - margin;
  const eMaxX = bounds.xMax + margin;
  const eMinY = bounds.yMin - margin;
  const eMaxY = bounds.yMax + margin;

  return !(maxX < eMinX || minX > eMaxX || maxY < eMinY || minY > eMaxY);
}

export function computeContentBounds(layout: ProjectLayout, padding: number = 0.2): ExportBounds {
  const { scene, definitions, exportBounds } = layout;
  if (!scene || scene.length === 0) return exportBounds;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  scene.forEach((node) => {
    const [nxMin, nyMin, nxMax, nyMax] = computeNodeAABB(node, definitions || {});
    minX = Math.min(minX, nxMin);
    maxX = Math.max(maxX, nxMax);
    minY = Math.min(minY, nyMin);
    maxY = Math.max(maxY, nyMax);
  });

  if (minX === Infinity || maxX === -Infinity) return exportBounds;

  const pad = Math.max(0.05, padding);
  let finalXMin = Math.round((minX - pad) * 100) / 100;
  let finalXMax = Math.round((maxX + pad) * 100) / 100;
  let finalYMin = Math.round((minY - pad) * 100) / 100;
  let finalYMax = Math.round((maxY + pad) * 100) / 100;

  if (finalXMax <= finalXMin) finalXMax = finalXMin + 1.0;
  if (finalYMax <= finalYMin) finalYMax = finalYMin + 1.0;

  return {
    xMin: finalXMin,
    xMax: finalXMax,
    yMin: finalYMin,
    yMax: finalYMax,
  };
}

export function computeCropToBounds(layout: ProjectLayout, padding: number = 0.2): ExportBounds {
  const { scene, definitions, exportBounds } = layout;
  if (!scene || scene.length === 0) return exportBounds;

  // Filter nodes that fall within or are bound to exportBounds
  const visibleIds = new Set<string>();
  scene.forEach((node) => {
    const aabb = computeNodeAABB(node, definitions || {});
    if (isAABBIntersecting(aabb, exportBounds, 0.0)) {
      visibleIds.add(node.id);
    }
  });

  const visibleNodes = scene.filter((node) => visibleIds.has(node.id));
  if (visibleNodes.length === 0) return exportBounds;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  visibleNodes.forEach((node) => {
    const [nxMin, nyMin, nxMax, nyMax] = computeNodeAABB(node, definitions || {});
    minX = Math.min(minX, nxMin);
    maxX = Math.max(maxX, nxMax);
    minY = Math.min(minY, nyMin);
    maxY = Math.max(maxY, nyMax);
  });

  if (minX === Infinity || maxX === -Infinity) return exportBounds;

  const pad = Math.max(0.05, padding);
  let finalXMin = Math.round((minX - pad) * 100) / 100;
  let finalXMax = Math.round((maxX + pad) * 100) / 100;
  let finalYMin = Math.round((minY - pad) * 100) / 100;
  let finalYMax = Math.round((maxY + pad) * 100) / 100;

  if (finalXMax <= finalXMin) finalXMax = finalXMin + 1.0;
  if (finalYMax <= finalYMin) finalYMax = finalYMin + 1.0;

  return {
    xMin: finalXMin,
    xMax: finalXMax,
    yMin: finalYMin,
    yMax: finalYMax,
  };
}

export function filterLayoutForExport(layout: ProjectLayout): ProjectLayout {
  const { scene, definitions, exportBounds: bounds } = layout;

  if (!bounds) return layout;

  const visibleIds = new Set<string>();

  // Pass 1: Direct AABB intersection with export bounds
  scene.forEach((node) => {
    const aabb = computeNodeAABB(node, definitions || {});
    if (isAABBIntersecting(aabb, bounds, 0.0)) {
      visibleIds.add(node.id);
    }
  });

  // Pass 2: Binding propagation (if node B is bound to visible node A, include node B)
  let addedNew = true;
  while (addedNew) {
    addedNew = false;
    scene.forEach((node) => {
      if (visibleIds.has(node.id)) return;

      const boundNodeIds: string[] = [];
      if (node.startBinding?.nodeId) boundNodeIds.push(node.startBinding.nodeId);
      if (node.endBinding?.nodeId) boundNodeIds.push(node.endBinding.nodeId);
      if (node.controlBinding?.nodeId) boundNodeIds.push(node.controlBinding.nodeId);
      if (node.megaBindings) {
        Object.values(node.megaBindings).forEach((b) => {
          if (b?.nodeId) boundNodeIds.push(b.nodeId);
        });
      }

      const isConnectedToVisible = boundNodeIds.some((id) => visibleIds.has(id));
      if (isConnectedToVisible) {
        visibleIds.add(node.id);
        addedNew = true;
      }
    });
  }

  const visibleScene = scene.filter((node) => visibleIds.has(node.id));

  let finalBounds = bounds;
  if (layout.plotOptions?.cropToContent && visibleScene.length > 0) {
    const pad = Math.max(0.05, layout.plotOptions.cropPadding ?? 0.2);
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    visibleScene.forEach((node) => {
      const [nxMin, nyMin, nxMax, nyMax] = computeNodeAABB(node, definitions || {});
      minX = Math.min(minX, nxMin);
      maxX = Math.max(maxX, nxMax);
      minY = Math.min(minY, nyMin);
      maxY = Math.max(maxY, nyMax);
    });

    if (minX !== Infinity && maxX !== -Infinity) {
      let finalXMin = Math.round((minX - pad) * 100) / 100;
      let finalXMax = Math.round((maxX + pad) * 100) / 100;
      let finalYMin = Math.round((minY - pad) * 100) / 100;
      let finalYMax = Math.round((maxY + pad) * 100) / 100;

      if (finalXMax <= finalXMin) finalXMax = finalXMin + 1.0;
      if (finalYMax <= finalYMin) finalYMax = finalYMin + 1.0;

      finalBounds = {
        xMin: finalXMin,
        xMax: finalXMax,
        yMin: finalYMin,
        yMax: finalYMax,
      };
    }
  }

  return {
    ...layout,
    exportBounds: finalBounds,
    scene: visibleScene,
  };
}
