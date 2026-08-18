import type { ProjectLayout, SceneNode, RobotDefinition, ExportBounds } from '../types/schema';

export function computeNodeAABB(
  node: SceneNode,
  definitions: Record<string, RobotDefinition>
): [number, number, number, number] {
  const xs: number[] = [node.x];
  const ys: number[] = [node.y];

  const type = node.type;

  if (type === 'rect' || type === 'obstacle' || type === 'triangle' || type === 'diamond') {
    const w = node.width || 3;
    const h = node.height || 2;
    xs.push(node.x - w / 2, node.x + w / 2);
    ys.push(node.y - h / 2, node.y + h / 2);
  } else if (type === 'circle') {
    const r = node.radius || 1.5;
    xs.push(node.x - r, node.x + r);
    ys.push(node.y - r, node.y + r);
  } else if (type === 'vector' || type === 'line' || type === 'super_vector' || type === 'super_line') {
    const pts = node.points || [0, 0, 3, 2];
    if (pts.length >= 4) {
      xs.push(node.x + pts[0], node.x + pts[2]);
      ys.push(node.y + pts[1], node.y + pts[3]);
    }
    if (node.controlPoint && node.controlPoint.length >= 2) {
      xs.push(node.x + node.controlPoint[0]);
      ys.push(node.y + node.controlPoint[1]);
    }
  } else if (type === 'mega_line' || type === 'mega_vector') {
    const pts = node.points || [0, 0, 3, 2];
    for (let i = 0; i < pts.length - 1; i += 2) {
      xs.push(node.x + pts[i]);
      ys.push(node.y + pts[i + 1]);
    }
  } else if (type === 'alias' && node.definitionId && definitions[node.definitionId]) {
    const def = definitions[node.definitionId];
    const nodeScale = node.scale || 1.0;
    const rad = ((node.rotation || 0) * Math.PI) / 180;
    const cosR = Math.cos(rad);
    const sinR = Math.sin(rad);

    if (def.primitives && def.primitives.length > 0) {
      def.primitives.forEach((prim) => {
        const cfg = prim.config || {};
        const ox = ((cfg.x || 0) / 40.0) * nodeScale;
        const oy = ((cfg.y || 0) / 40.0) * nodeScale;
        const rx = node.x + (ox * cosR - oy * sinR);
        const ry = node.y + (ox * sinR + oy * cosR);

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
        } else {
          xs.push(rx - 0.5 * nodeScale, rx + 0.5 * nodeScale);
          ys.push(ry - 0.5 * nodeScale, ry + 0.5 * nodeScale);
        }
      });
    } else {
      xs.push(node.x - 1.0, node.x + 1.0);
      ys.push(node.y - 1.0, node.y + 1.0);
    }
  } else {
    // text or default
    xs.push(node.x - 1, node.x + 1);
    ys.push(node.y - 1, node.y + 1);
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
