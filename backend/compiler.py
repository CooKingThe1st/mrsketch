from __future__ import annotations
import io
import math
import base64
import gc
from typing import Tuple, List, Dict, Optional, Any, Union
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as patches
import matplotlib.transforms as transforms
import matplotlib.colors as mcolors
from models import ProjectLayout, SceneNode, RobotDefinition, PrimitiveDefinition, ExportBounds

import re

def expand_ifblank_python(input_str: str) -> str:
    text = input_str
    safety = 0
    while safety < 20:
        safety += 1
        idx = text.find('\\ifblank')
        if idx == -1:
            break

        p = idx + 8
        while p < len(text) and text[p].isspace():
            p += 1

        def read_brace_group(start_pos: int):
            cur = start_pos
            while cur < len(text) and text[cur].isspace():
                cur += 1
            if cur >= len(text) or text[cur] != '{':
                return None
            cur += 1
            depth = 1
            content = ""
            while cur < len(text) and depth > 0:
                c = text[cur]
                if c == '\\':
                    content += c
                    cur += 1
                    if cur < len(text):
                        content += text[cur]
                        cur += 1
                    continue
                if c == '{':
                    depth += 1
                elif c == '}':
                    depth -= 1
                    if depth == 0:
                        cur += 1
                        return content, cur
                content += c
                cur += 1
            return None

        g1 = read_brace_group(p)
        if not g1:
            text = text[:idx] + text[idx + 8:]
            continue
        g2 = read_brace_group(g1[1])
        if not g2:
            text = text[:idx] + text[idx + 8:]
            continue
        g3 = read_brace_group(g2[1])
        if not g3:
            text = text[:idx] + text[idx + 8:]
            continue

        arg = g1[0].strip()
        then_val = g2[0]
        else_val = g3[0]
        replacement = then_val if (arg == "" or arg in ["#1", "#2", "#3"]) else else_val
        text = text[:idx] + replacement + text[g3[1]:]

    return text

def expand_macros_for_mathtext(raw_label: str, macros_dict: dict) -> str:
    if not raw_label:
        return ""
    if not macros_dict:
        return expand_ifblank_python(raw_label)

    macro_list = sorted(macros_dict.values(), key=lambda m: len(getattr(m, 'command', '')), reverse=True)
    result = raw_label
    prev_result = ""
    iterations = 0

    while result != prev_result and iterations < 5:
        prev_result = result
        iterations += 1

        for macro in macro_list:
            cmd_name = macro.command if macro.command.startswith('\\') else f"\\{macro.command}"
            args_count = getattr(macro, 'argsCount', 0)
            template = getattr(macro, 'template', '')
            escaped_cmd = re.escape(cmd_name)

            if args_count == 0:
                pattern = escaped_cmd + r"(?![a-zA-Z0-9])"
                result = re.sub(pattern, lambda _: template, result)
            else:
                pattern = escaped_cmd + (r"(?:\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\})?" * args_count) + r"(?![a-zA-Z0-9])"
                def make_replacer(tmpl, ac):
                    def replacer(m):
                        res = tmpl
                        for i in range(1, ac + 1):
                            val = m.group(i) if m.group(i) is not None else ""
                            res = res.replace(f"#{i}", val)
                        return res
                    return replacer
                result = re.sub(pattern, make_replacer(template, args_count), result)

        result = expand_ifblank_python(result)

    result = result.replace(r'\bm{', r'\mathbf{').replace(r'\boldsymbol{', r'\mathbf{')
    return result

def build_catmull_rom_path(coords):
    from matplotlib.path import Path
    if len(coords) < 2:
        return Path([(0, 0)], [Path.MOVETO])
    if len(coords) == 2:
        return Path(coords, [Path.MOVETO, Path.LINETO])

    pts = [coords[0]] + list(coords) + [coords[-1]]
    path_verts = [coords[0]]
    path_codes = [Path.MOVETO]

    for i in range(1, len(pts) - 2):
        p0, p1, p2, p3 = pts[i-1], pts[i], pts[i+1], pts[i+2]
        c1 = (p1[0] + (p2[0] - p0[0]) / 6.0, p1[1] + (p2[1] - p0[1]) / 6.0)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6.0, p2[1] - (p3[1] - p1[1]) / 6.0)
        path_verts.extend([c1, c2, p2])
        path_codes.extend([Path.CURVE4, Path.CURVE4, Path.CURVE4])

    return Path(path_verts, path_codes)

def get_rgba(color_str: str, alpha: float = 1.0):
    if not color_str or color_str == 'none':
        return 'none'
    try:
        safe_alpha = max(0.0, min(1.0, float(alpha)))
        return mcolors.to_rgba(color_str, alpha=safe_alpha)
    except Exception:
        return color_str

_last_config_key = None
_cached_fig = None
_cached_ax = None
_cached_size = None

def get_figure_and_axes(fig_width: float, fig_height: float, dpi: int = 80):
    global _cached_fig, _cached_ax, _cached_size
    target_size = (round(fig_width, 2), round(fig_height, 2), dpi)
    if _cached_fig is not None and _cached_size == target_size:
        _cached_ax.clear()
        return _cached_fig, _cached_ax

    if _cached_fig is not None:
        try:
            plt.close(_cached_fig)
        except Exception:
            pass

    fig = plt.figure(figsize=(fig_width, fig_height), dpi=dpi)
    ax = fig.add_axes([0, 0, 1, 1])
    _cached_fig = fig
    _cached_ax = ax
    _cached_size = target_size
    return _cached_fig, _cached_ax

def configure_matplotlib_latex(macros_dict: dict, font_size: int = 12, fast_mode: bool = True):
    global _last_config_key

    # Fast mode uses Matplotlib's native C-engine Mathtext renderer without spawning TeX sub-processes
    if fast_mode:
        config_key = ("fast", font_size)
        if _last_config_key == config_key:
            return
        plt.rcParams.update({
            "text.usetex": False,
            "font.family": "sans-serif",
            "font.size": font_size,
        })
        _last_config_key = config_key
        return

    preamble = r"""
\usepackage{amsmath}
\usepackage{amssymb}
\usepackage{bm}
\usepackage{ifthen}
\usepackage{etoolbox}
"""
    for cmd, macro in macros_dict.items():
        cmd_name = macro.command if macro.command.startswith('\\') else f"\\{macro.command}"
        args_count = macro.argsCount
        template = macro.template
        if args_count > 0:
            preamble += f"\\newcommand{{{cmd_name}}}[{args_count}]{{{template}}}\n"
        else:
            preamble += f"\\newcommand{{{cmd_name}}}{{{template}}}\n"

    config_key = ("full_tex", font_size, preamble)
    if _last_config_key == config_key:
        return

    try:
        plt.rcParams.update({
            "text.usetex": True,
            "font.family": "serif",
            "font.size": font_size,
            "text.latex.preamble": preamble,
            "figure.dpi": 200,
        })
        _last_config_key = config_key
    except Exception as e:
        print(f"Warning: Could not configure LaTeX usetex: {e}")
        plt.rcParams.update({
            "text.usetex": False,
            "font.family": "sans-serif",
            "font.size": font_size,
        })
        _last_config_key = ("failed_tex", font_size)

def compute_node_aabb(node: SceneNode, definitions: dict) -> Tuple[float, float, float, float]:
    nx, ny = node.x, node.y
    scale = getattr(node, 'scale', 1.0) or 1.0
    rot = getattr(node, 'rotation', 0.0) or 0.0
    rad = math.radians(rot)
    cos_r = math.cos(rad)
    sin_r = math.sin(rad)

    # Standalone text nodes have no background shape at (nx, ny); their content is solely at the label offset
    if node.type == 'text':
        lox = (getattr(node, 'labelOffsetX', 0.0) if getattr(node, 'labelOffsetX', None) is not None else 0.0) * scale
        loy = (getattr(node, 'labelOffsetY', 0.0) if getattr(node, 'labelOffsetY', None) is not None else 0.0) * scale
        lx = nx + lox
        ly = ny + loy
        fsize = getattr(node, 'fontSize', 12.0) or 12.0
        fsize_units = (fsize / 40.0) * scale
        lines = (getattr(node, 'label', '') or '').split('\n')
        line_count = max(1, len(lines))
        max_chars = max([len(l) for l in lines] + [1])
        half_w = max(0.2, max_chars * (fsize_units * 0.28))
        half_h = max(0.15, line_count * (fsize_units * 0.45))
        return (lx - half_w, ly - half_h, lx + half_w, ly + half_h)

    xs = []
    ys = []

    if node.type in ('rect', 'obstacle'):
        w = (getattr(node, 'width', 3.0) or 3.0) * scale
        h = (getattr(node, 'height', 2.0) or 2.0) * scale
        corners = [
            (-w / 2.0, -h / 2.0),
            (w / 2.0, -h / 2.0),
            (w / 2.0, h / 2.0),
            (-w / 2.0, h / 2.0),
        ]
        for cx, cy in corners:
            rx = nx + (cx * cos_r - cy * sin_r)
            ry = ny + (cx * sin_r + cy * cos_r)
            xs.append(rx)
            ys.append(ry)
    elif node.type == 'circle':
        r = (getattr(node, 'radius', 1.5) or 1.5) * scale
        xs.extend([nx - r, nx + r])
        ys.extend([ny - r, ny + r])
    elif node.type == 'triangle':
        w = (getattr(node, 'width', 3.0) or 3.0) * scale
        tri_type = getattr(node, 'triangleType', 'right_isosceles') or 'right_isosceles'
        if tri_type == 'equilateral':
            h = w * 0.866
            pts = [(0, h * 0.66), (-w/2, -h * 0.33), (w/2, -h * 0.33)]
        else:
            pts = [(-w/3, 2*w/3), (-w/3, -w/3), (2*w/3, -w/3)]
        for cx, cy in pts:
            rx = nx + (cx * cos_r - cy * sin_r)
            ry = ny + (cx * sin_r + cy * cos_r)
            xs.append(rx)
            ys.append(ry)
    elif node.type == 'diamond':
        w = (getattr(node, 'width', 3.0) or 3.0) * scale
        h = (getattr(node, 'height', 2.0) or 2.0) * scale
        pts = [(0, h/2), (w/2, 0), (0, -h/2), (-w/2, 0)]
        for cx, cy in pts:
            rx = nx + (cx * cos_r - cy * sin_r)
            ry = ny + (cx * sin_r + cy * cos_r)
            xs.append(rx)
            ys.append(ry)
    elif node.type == 'alias' and getattr(node, 'definitionId', None) and node.definitionId in definitions:
        def_obj = definitions[node.definitionId]
        prims = getattr(def_obj, 'primitives', []) or []
        if prims:
            for prim in prims:
                cfg = prim.config if hasattr(prim, 'config') else (prim.get('config', {}) if isinstance(prim, dict) else {})
                ptype = getattr(prim, 'type', 'circle') if hasattr(prim, 'type') else (prim.get('type', 'circle') if isinstance(prim, dict) else 'circle')
                prim_x = getattr(cfg, 'x', 0.0) if getattr(cfg, 'x', None) is not None else 0.0
                prim_y = getattr(cfg, 'y', 0.0) if getattr(cfg, 'y', None) is not None else 0.0
                ox = (prim_x / 40.0) * scale
                oy = (prim_y / 40.0) * scale

                if ptype == 'circle':
                    r_px = getattr(cfg, 'radius', 25.0) if getattr(cfg, 'radius', None) is not None else 25.0
                    r = (r_px / 40.0) * scale
                    rx = nx + (ox * cos_r - oy * sin_r)
                    ry = ny + (ox * sin_r + oy * cos_r)
                    xs.extend([rx - r, rx + r])
                    ys.extend([ry - r, ry + r])
                elif ptype == 'rect':
                    w_px = getattr(cfg, 'width', 30.0) if getattr(cfg, 'width', None) is not None else 30.0
                    h_px = getattr(cfg, 'height', 30.0) if getattr(cfg, 'height', None) is not None else 30.0
                    w = (w_px / 40.0) * scale
                    h = (h_px / 40.0) * scale
                    rx = nx + (ox * cos_r - oy * sin_r)
                    ry = ny + (ox * sin_r + oy * cos_r)
                    max_ext = math.hypot(w / 2.0, h / 2.0)
                    xs.extend([rx - max_ext, rx + max_ext])
                    ys.extend([ry - max_ext, ry + max_ext])
                elif ptype == 'diamond':
                    w_px = getattr(cfg, 'width', 30.0) if getattr(cfg, 'width', None) is not None else 30.0
                    h_px = getattr(cfg, 'height', 20.0) if getattr(cfg, 'height', None) is not None else 20.0
                    w = (w_px / 40.0) * scale
                    h = (h_px / 40.0) * scale
                    rx = nx + (ox * cos_r - oy * sin_r)
                    ry = ny + (ox * sin_r + oy * cos_r)
                    max_ext = math.hypot(w / 2.0, h / 2.0)
                    xs.extend([rx - max_ext, rx + max_ext])
                    ys.extend([ry - max_ext, ry + max_ext])
                elif ptype == 'triangle':
                    w_px = getattr(cfg, 'width', 30.0) if getattr(cfg, 'width', None) is not None else 30.0
                    w = (w_px / 40.0) * scale
                    rx = nx + (ox * cos_r - oy * sin_r)
                    ry = ny + (ox * sin_r + oy * cos_r)
                    xs.extend([rx - w, rx + w])
                    ys.extend([ry - w, ry + w])
                elif ptype == 'poly' and getattr(cfg, 'vertices', None):
                    for vx, vy in cfg.vertices:
                        sx = ox + (vx / 40.0) * scale
                        sy = oy + (vy / 40.0) * scale
                        rx = nx + (sx * cos_r - sy * sin_r)
                        ry = ny + (sx * sin_r + sy * cos_r)
                        xs.append(rx)
                        ys.append(ry)
                elif getattr(cfg, 'points', None):
                    raw_pts = cfg.points
                    for i in range(0, len(raw_pts) - 1, 2):
                        px = (raw_pts[i] / 40.0) * scale
                        py = (raw_pts[i + 1] / 40.0) * scale
                        rx = nx + ((ox + px) * cos_r - (oy + py) * sin_r)
                        ry = ny + ((ox + px) * sin_r + (oy + py) * cos_r)
                        xs.append(rx)
                        ys.append(ry)
                else:
                    rx = nx + (ox * cos_r - oy * sin_r)
                    ry = ny + (ox * sin_r + oy * cos_r)
                    xs.extend([rx - 0.5 * scale, rx + 0.5 * scale])
                    ys.extend([ry - 0.5 * scale, ry + 0.5 * scale])
        else:
            xs.extend([nx - 1.0, nx + 1.0])
            ys.extend([ny - 1.0, ny + 1.0])
    elif node.type in ('vector', 'line', 'super_vector', 'super_line', 'mega_vector', 'mega_line'):
        pts = getattr(node, 'points', None)
        if pts:
            for i in range(0, len(pts) - 1, 2):
                dx = pts[i] * scale
                dy = pts[i + 1] * scale
                rx = nx + (dx * cos_r - dy * sin_r)
                ry = ny + (dx * sin_r + dy * cos_r)
                xs.append(rx)
                ys.append(ry)
        cp = getattr(node, 'controlPoint', None)
        if cp and len(cp) >= 2:
            dx = cp[0] * scale
            dy = cp[1] * scale
            rx = nx + (dx * cos_r - dy * sin_r)
            ry = ny + (dx * sin_r + dy * cos_r)
            xs.append(rx)
            ys.append(ry)
    else:
        xs.extend([nx - 0.5, nx + 0.5])
        ys.extend([ny - 0.5, ny + 0.5])

    # Include label annotation offset if present
    if getattr(node, 'label', None) and node.label.strip():
        is_shape = node.type in ('rect', 'circle', 'triangle', 'diamond', 'obstacle', 'alias')
        default_off = 0.0 if is_shape else 0.3
        lox = (getattr(node, 'labelOffsetX', default_off) if getattr(node, 'labelOffsetX', None) is not None else default_off) * scale
        loy = (getattr(node, 'labelOffsetY', default_off) if getattr(node, 'labelOffsetY', None) is not None else default_off) * scale
        fsize = getattr(node, 'fontSize', 12.0) or 12.0
        fsize_units = (fsize / 40.0) * scale
        lines = node.label.split('\n')
        line_count = max(1, len(lines))
        max_chars = max([len(l) for l in lines] + [1])
        half_w = max(0.2, max_chars * (fsize_units * 0.28))
        half_h = max(0.15, line_count * (fsize_units * 0.45))
        xs.extend([nx + lox - half_w, nx + lox + half_w])
        ys.extend([ny + loy - half_h, ny + loy + half_h])

    if not xs or not ys:
        return (nx - 0.5, ny - 0.5, nx + 0.5, ny + 0.5)

    return (min(xs), min(ys), max(xs), max(ys))

def is_node_in_export_bounds(node: SceneNode, bounds: ExportBounds, definitions: dict, margin: float = 0.0) -> bool:
    min_x, min_y, max_x, max_y = compute_node_aabb(node, definitions)
    e_min_x = bounds.xMin - margin
    e_max_x = bounds.xMax + margin
    e_min_y = bounds.yMin - margin
    e_max_y = bounds.yMax + margin
    return not (max_x < e_min_x or min_x > e_max_x or max_y < e_min_y or min_y > e_max_y)

def compute_scene_content_bounds(layout: ProjectLayout, padding: float = 0.2) -> ExportBounds:
    scene = layout.scene
    bounds = layout.exportBounds
    defs = layout.definitions or {}
    if not scene:
        return bounds

    # Filter to only visible nodes inside export bounds
    visible_nodes = [node for node in scene if is_node_in_export_bounds(node, bounds, defs, margin=0.0)]
    if not visible_nodes:
        return bounds

    x_min = float('inf')
    x_max = float('-inf')
    y_min = float('inf')
    y_max = float('-inf')

    for node in visible_nodes:
        nx_min, ny_min, nx_max, ny_max = compute_node_aabb(node, defs)
        x_min = min(x_min, nx_min)
        x_max = max(x_max, nx_max)
        y_min = min(y_min, ny_min)
        y_max = max(y_max, ny_max)

    if x_min == float('inf') or x_max == float('-inf'):
        return bounds

    pad = max(0.05, padding)
    final_x_min = round(x_min - pad, 2)
    final_x_max = round(x_max + pad, 2)
    final_y_min = round(y_min - pad, 2)
    final_y_max = round(y_max + pad, 2)

    if final_x_max <= final_x_min:
        final_x_max = final_x_min + 1.0
    if final_y_max <= final_y_min:
        final_y_max = final_y_min + 1.0

    return ExportBounds(xMin=final_x_min, xMax=final_x_max, yMin=final_y_min, yMax=final_y_max)

def compile_scene(layout: ProjectLayout, format: str = 'png', dpi: int = 80, fast_mode: bool = True) -> bytes:
    plot_opts = layout.plotOptions
    global_font_size = plot_opts.fontSize if plot_opts.fontSize is not None else 12
    configure_matplotlib_latex(layout.macros, font_size=int(global_font_size), fast_mode=fast_mode)

    if getattr(plot_opts, 'cropToContent', False):
        pad_val = getattr(plot_opts, 'cropPadding', 0.2)
        if pad_val is None:
            pad_val = 0.2
        bounds = compute_scene_content_bounds(layout, padding=pad_val)
    else:
        bounds = layout.exportBounds

    width = max(0.5, bounds.xMax - bounds.xMin)
    height = max(0.5, bounds.yMax - bounds.yMin)
    
    unit_scale = 1.0
    fig_width = max(1.5, min(40.0, width * unit_scale))
    fig_height = max(1.5, min(40.0, height * unit_scale))
    
    fig, ax = get_figure_and_axes(fig_width, fig_height, dpi=dpi)
    
    try:
        # Configure Background & Opacity
        bg_color_str = plot_opts.backgroundColor or '#ffffff'
        bg_opacity = plot_opts.bgOpacity if plot_opts.bgOpacity is not None else 1.0
        bg_color = get_rgba(bg_color_str, bg_opacity)

        fig.patch.set_facecolor(bg_color)
        ax.set_facecolor(bg_color)

        ax.set_xlim(bounds.xMin, bounds.xMax)
        ax.set_ylim(bounds.yMin, bounds.yMax)
        ax.set_aspect('equal')
        # Invisible corner anchors so tight bounding box preserves exact x and y padding
        ax.plot([bounds.xMin, bounds.xMax], [bounds.yMin, bounds.yMax], color='none', alpha=0.0, zorder=-100)

        # Matlab style map
        style_map = {
            'solid': '-',
            'dashed': '--',
            'dashdot': '-.',
            'dotted': ':',
            '-': '-',
            '--': '--',
            '-.': '-.',
            ':': ':'
        }

        # Grid Settings
        if plot_opts.showGrid:
            g_style = style_map.get(plot_opts.gridStyle, ':')
            ax.grid(True, linestyle=g_style, alpha=0.5, color='#94a3b8')
        else:
            ax.grid(False)
        ax.set_axisbelow(True)

        # Outer Plot Spines / Border Control
        show_border = plot_opts.showPlotBorder if plot_opts.showPlotBorder is not None else True
        if not show_border:
            for spine in ax.spines.values():
                spine.set_visible(False)

        # Axis visibility and Labels
        if not plot_opts.showAxis:
            ax.axis('off')
        else:
            if plot_opts.showAxisLabels:
                if plot_opts.xLabel:
                    ax.set_xlabel(plot_opts.xLabel, fontsize=global_font_size)
                if plot_opts.yLabel:
                    ax.set_ylabel(plot_opts.yLabel, fontsize=global_font_size)
                if plot_opts.title:
                    ax.set_title(plot_opts.title, fontsize=global_font_size + 2, pad=10)

        def render_primitive(prim: PrimitiveDefinition, parent_x: float, parent_y: float, rotation_deg: float, node_scale: float, default_style):
            cfg = prim.config
            rad = math.radians(rotation_deg)
            cos_r = math.cos(rad)
            sin_r = math.sin(rad)

            prim_x = cfg.x if cfg.x is not None else 0.0
            prim_y = cfg.y if cfg.y is not None else 0.0

            color_str = cfg.strokeColor or default_style.color
            stroke_opacity = cfg.strokeOpacity if cfg.strokeOpacity is not None else (default_style.strokeOpacity if default_style.strokeOpacity is not None else 1.0)
            color = get_rgba(color_str, stroke_opacity)

            fill_str = cfg.fillColor or default_style.fillColor or 'none'
            fill_opacity = cfg.fillOpacity if cfg.fillOpacity is not None else (default_style.fillOpacity if default_style.fillOpacity is not None else 1.0)
            fill = get_rgba(fill_str, fill_opacity) if fill_str != 'none' else 'none'

            pw = cfg.strokeWidth if cfg.strokeWidth is not None else default_style.strokeWidth
            ps_raw = cfg.strokeStyle if cfg.strokeStyle is not None else default_style.strokeStyle
            if ps_raw in ['dashed', '--']:
                pls = '--'
            elif ps_raw in ['dashdot', '-.']:
                pls = '-.'
            elif ps_raw in ['dotted', ':']:
                pls = ':'
            else:
                pls = '-'

            if prim.type == 'circle':
                radius_px = cfg.radius if cfg.radius is not None else 25.0
                r = (radius_px / 40.0) * node_scale
                ox = (prim_x / 40.0) * node_scale
                oy = (prim_y / 40.0) * node_scale
                rx = parent_x + (ox * cos_r - oy * sin_r)
                ry = parent_y + (ox * sin_r + oy * cos_r)
                circle = patches.Circle((rx, ry), radius=r, edgecolor=color, facecolor=fill, linewidth=pw, linestyle=pls)
                circle.set_clip_path(ax.patch)
                ax.add_patch(circle)

            elif prim.type == 'rect':
                w_px = cfg.width if cfg.width is not None else 30.0
                h_px = cfg.height if cfg.height is not None else 30.0
                w = (w_px / 40.0) * node_scale
                h = (h_px / 40.0) * node_scale
                ox = (prim_x / 40.0) * node_scale
                oy = (prim_y / 40.0) * node_scale

                rx = parent_x + (ox * cos_r - oy * sin_r)
                ry = parent_y + (ox * sin_r + oy * cos_r)

                rect = patches.Rectangle((-w / 2.0, -h / 2.0), w, h, edgecolor=color, facecolor=fill, linewidth=pw, linestyle=pls)
                t = transforms.Affine2D().rotate_deg(rotation_deg).translate(rx, ry) + ax.transData
                rect.set_transform(t)
                rect.set_clip_path(ax.patch)
                ax.add_patch(rect)

            elif prim.type == 'diamond':
                w_px = cfg.width if cfg.width is not None else 30.0
                h_px = cfg.height if cfg.height is not None else 20.0
                w = (w_px / 40.0) * node_scale
                h = (h_px / 40.0) * node_scale
                ox = (prim_x / 40.0) * node_scale
                oy = (prim_y / 40.0) * node_scale

                rx = parent_x + (ox * cos_r - oy * sin_r)
                ry = parent_y + (ox * sin_r + oy * cos_r)

                pts = [(0, h/2.0), (w/2.0, 0), (0, -h/2.0), (-w/2.0, 0)]
                poly = patches.Polygon(pts, closed=True, edgecolor=color, facecolor=fill, linewidth=pw, linestyle=pls)
                t = transforms.Affine2D().rotate_deg(rotation_deg).translate(rx, ry) + ax.transData
                poly.set_transform(t)
                poly.set_clip_path(ax.patch)
                ax.add_patch(poly)

            elif prim.type == 'triangle':
                w_px = cfg.width if cfg.width is not None else 30.0
                w = (w_px / 40.0) * node_scale
                tri_type = getattr(cfg, 'triangleType', 'right_isosceles') or 'right_isosceles'
                ox = (prim_x / 40.0) * node_scale
                oy = (prim_y / 40.0) * node_scale

                rx = parent_x + (ox * cos_r - oy * sin_r)
                ry = parent_y + (ox * sin_r + oy * cos_r)

                if tri_type == 'equilateral':
                    h = w * 0.866
                    pts = [(0, h * 0.66), (-w/2.0, -h * 0.33), (w/2.0, -h * 0.33)]
                else:
                    pts = [(-w/3.0, 2*w/3.0), (-w/3.0, -w/3.0), (2*w/3.0, -w/3.0)]
                poly = patches.Polygon(pts, closed=True, edgecolor=color, facecolor=fill, linewidth=pw, linestyle=pls)
                t = transforms.Affine2D().rotate_deg(rotation_deg).translate(rx, ry) + ax.transData
                poly.set_transform(t)
                poly.set_clip_path(ax.patch)
                ax.add_patch(poly)

            elif prim.type == 'poly' and cfg.vertices:
                verts = []
                ox = (prim_x / 40.0) * node_scale
                oy = (prim_y / 40.0) * node_scale
                for vx, vy in cfg.vertices:
                    sx = ox + (vx / 40.0) * node_scale
                    sy = oy + (vy / 40.0) * node_scale
                    rx = parent_x + (sx * cos_r - sy * sin_r)
                    ry = parent_y + (sx * sin_r + sy * cos_r)
                    verts.append((rx, ry))
                
                poly = patches.Polygon(verts, closed=True, edgecolor=color, facecolor=fill, linewidth=pw, linestyle=pls)
                poly.set_clip_path(ax.patch)
                ax.add_patch(poly)

            elif (prim.type == 'mega_line' or prim.type == 'mega_vector') and cfg.points and len(cfg.points) >= 4:
                raw_pts = cfg.points
                ox = (prim_x / 40.0) * node_scale
                oy = (prim_y / 40.0) * node_scale
                poly_pts = []
                for k in range(0, len(raw_pts), 2):
                    kx = (raw_pts[k] / 40.0) * node_scale
                    ky = (raw_pts[k+1] / 40.0) * node_scale
                    rx = parent_x + ((ox + kx) * cos_r - (oy + ky) * sin_r)
                    ry = parent_y + ((ox + kx) * sin_r + (oy + ky) * cos_r)
                    poly_pts.append((rx, ry))

                is_straight = getattr(cfg, 'lineShape', 'straight') == 'straight'
                if prim.type == 'mega_line':
                    if is_straight or len(poly_pts) < 3:
                        xs = [p[0] for p in poly_pts]
                        ys = [p[1] for p in poly_pts]
                        lines = ax.plot(xs, ys, color=color, linewidth=pw, linestyle=pls)
                        for l in lines:
                            l.set_clip_path(ax.patch)
                    else:
                        path = build_catmull_rom_path(poly_pts)
                        patch = patches.PathPatch(path, edgecolor=color, facecolor='none', linewidth=pw, linestyle=pls)
                        patch.set_clip_path(ax.patch)
                        ax.add_patch(patch)
                else:  # mega_vector
                    if is_straight or len(poly_pts) < 3:
                        for k in range(len(poly_pts) - 2):
                            lines = ax.plot([poly_pts[k][0], poly_pts[k+1][0]], [poly_pts[k][1], poly_pts[k+1][1]], color=color, linewidth=pw, linestyle=pls)
                            for l in lines:
                                l.set_clip_path(ax.patch)
                        ann = ax.annotate('', xy=poly_pts[-1], xytext=poly_pts[-2],
                                    arrowprops=dict(arrowstyle="-|>", color=color, lw=pw, linestyle=pls, mutation_scale=15, shrinkA=0, shrinkB=0))
                        ann.set_clip_path(ax.patch)
                    else:
                        from matplotlib.patches import FancyArrowPatch
                        path = build_catmull_rom_path(poly_pts)
                        arrow = FancyArrowPatch(
                            path=path,
                            arrowstyle="-|>",
                            color=color,
                            linewidth=pw,
                            linestyle=pls,
                            mutation_scale=15,
                        )
                        arrow.set_clip_path(ax.patch)
                        ax.add_patch(arrow)

            elif (prim.type == 'vector' or prim.type == 'line' or prim.type == 'super_vector' or prim.type == 'super_line') and cfg.points:
                pts = cfg.points
                x1, y1, x2, y2 = [(p / 40.0) * node_scale for p in pts[:4]]
                
                ox = (prim_x / 40.0) * node_scale
                oy = (prim_y / 40.0) * node_scale

                rx1 = parent_x + ((ox + x1) * cos_r - (oy + y1) * sin_r)
                ry1 = parent_y + ((ox + x1) * sin_r + (oy + y1) * cos_r)
                rx2 = parent_x + ((ox + x2) * cos_r - (oy + y2) * sin_r)
                ry2 = parent_y + ((ox + x2) * sin_r + (oy + y2) * cos_r)

                if prim.type == 'vector':
                    ann = ax.annotate('', xy=(rx2, ry2), xytext=(rx1, ry1),
                                arrowprops=dict(arrowstyle="-|>", color=color, lw=pw, linestyle=pls, mutation_scale=15, shrinkA=0, shrinkB=0))
                    ann.set_clip_path(ax.patch)
                elif prim.type == 'line':
                    lines = ax.plot([rx1, rx2], [ry1, ry2], color=color, linewidth=pw, linestyle=pls)
                    for l in lines:
                        l.set_clip_path(ax.patch)
                else:
                    # super_vector or super_line primitive
                    if cfg.controlPoint:
                        cpx, cpy = [(p / 40.0) * node_scale for p in cfg.controlPoint]
                        rcx = parent_x + ((ox + cpx) * cos_r - (oy + cpy) * sin_r)
                        rcy = parent_y + ((ox + cpx) * sin_r + (oy + cpy) * cos_r)
                    else:
                        rcx = (rx1 + rx2) / 2.0
                        rcy = (ry1 + ry2) / 2.0 + 0.5
                    
                    is_straight = cfg.lineShape == 'straight'
                    if prim.type == 'super_line':
                        if is_straight:
                            lines = ax.plot([rx1, rcx, rx2], [ry1, rcy, ry2], color=color, linewidth=pw, linestyle=pls)
                            for l in lines:
                                l.set_clip_path(ax.patch)
                        else:
                            path = build_catmull_rom_path([(rx1, ry1), (rcx, rcy), (rx2, ry2)])
                            patch = patches.PathPatch(path, edgecolor=color, facecolor='none', linewidth=pw, linestyle=pls)
                            patch.set_clip_path(ax.patch)
                            ax.add_patch(patch)
                    else:  # super_vector
                        if is_straight:
                            l1 = ax.plot([rx1, rcx], [ry1, rcy], color=color, linewidth=pw, linestyle=pls)
                            for l in l1:
                                l.set_clip_path(ax.patch)
                            ann = ax.annotate('', xy=(rx2, ry2), xytext=(rcx, rcy),
                                        arrowprops=dict(arrowstyle="-|>", color=color, lw=pw, linestyle=pls, mutation_scale=15, shrinkA=0, shrinkB=0))
                            ann.set_clip_path(ax.patch)
                        else:
                            from matplotlib.patches import FancyArrowPatch
                            path = build_catmull_rom_path([(rx1, ry1), (rcx, rcy), (rx2, ry2)])
                            arrow = FancyArrowPatch(
                                path=path,
                                arrowstyle="-|>",
                                color=color,
                                linewidth=pw,
                                linestyle=pls,
                                mutation_scale=15,
                            )
                            arrow.set_clip_path(ax.patch)
                            ax.add_patch(arrow)

        defs = layout.definitions or {}
        for node in layout.scene:
            if not is_node_in_export_bounds(node, layout.exportBounds, defs, margin=0.0):
                continue

            ls = style_map.get(node.style.strokeStyle, '-')
            node_scale = node.scale or 1.0

            stroke_opacity = node.style.strokeOpacity if node.style.strokeOpacity is not None else 1.0
            node_color = get_rgba(node.style.color or '#000000', stroke_opacity)

            fill_opacity = node.style.fillOpacity if node.style.fillOpacity is not None else 1.0
            node_fill = get_rgba(node.style.fillColor, fill_opacity) if node.style.fillColor else 'none'

            if node.type == 'alias' and node.definitionId in layout.definitions:
                def_obj = layout.definitions[node.definitionId]
                for prim in def_obj.primitives:
                    render_primitive(prim, node.x, node.y, node.rotation, node_scale, node.style)

            elif node.type == 'obstacle' or node.type == 'rect':
                w = (node.width or 3.0) * node_scale
                h = (node.height or 2.0) * node_scale
                rect = patches.Rectangle((-w/2, -h/2), w, h,
                                         edgecolor=node_color,
                                         facecolor=node_fill,
                                         linestyle=ls,
                                         linewidth=node.style.strokeWidth)
                t = transforms.Affine2D().rotate_deg(node.rotation).translate(node.x, node.y) + ax.transData
                rect.set_transform(t)
                rect.set_clip_path(ax.patch)
                ax.add_patch(rect)

            elif node.type == 'circle':
                r = (node.radius or 1.5) * node_scale
                circle = patches.Circle((0, 0), r,
                                        edgecolor=node_color,
                                        facecolor=node_fill,
                                        linestyle=ls,
                                        linewidth=node.style.strokeWidth)
                t = transforms.Affine2D().rotate_deg(node.rotation).translate(node.x, node.y) + ax.transData
                circle.set_transform(t)
                circle.set_clip_path(ax.patch)
                ax.add_patch(circle)

            elif node.type == 'triangle':
                w = (node.width or 3.0) * node_scale
                tri_type = getattr(node, 'triangleType', 'right_isosceles') or 'right_isosceles'
                if tri_type == 'equilateral':
                    h = w * 0.866
                    pts = [(0, h * 0.66), (-w/2, -h * 0.33), (w/2, -h * 0.33)]
                else:
                    # right_isosceles: Centroid at (0,0)
                    pts = [(-w/3, 2*w/3), (-w/3, -w/3), (2*w/3, -w/3)]
                poly = patches.Polygon(pts, closed=True, edgecolor=node_color, facecolor=node_fill, linestyle=ls, linewidth=node.style.strokeWidth)
                t = transforms.Affine2D().rotate_deg(node.rotation).translate(node.x, node.y) + ax.transData
                poly.set_transform(t)
                poly.set_clip_path(ax.patch)
                ax.add_patch(poly)

            elif node.type == 'diamond':
                w = (node.width or 3.0) * node_scale
                h = (node.height or 2.0) * node_scale
                pts = [(0, h/2), (w/2, 0), (0, -h/2), (-w/2, 0)]
                poly = patches.Polygon(pts, closed=True, edgecolor=node_color, facecolor=node_fill, linestyle=ls, linewidth=node.style.strokeWidth)
                t = transforms.Affine2D().rotate_deg(node.rotation).translate(node.x, node.y) + ax.transData
                poly.set_transform(t)
                poly.set_clip_path(ax.patch)
                ax.add_patch(poly)

            elif node.type == 'vector':
                pts = node.points or [0, 0, 3, 2]
                rad = math.radians(node.rotation)
                cos_r, sin_r = math.cos(rad), math.sin(rad)
                dx1, dy1, dx2, dy2 = [p * node_scale for p in pts[:4]]
                
                rx1 = node.x + (dx1 * cos_r - dy1 * sin_r)
                ry1 = node.y + (dx1 * sin_r + dy1 * cos_r)
                rx2 = node.x + (dx2 * cos_r - dy2 * sin_r)
                ry2 = node.y + (dx2 * sin_r + dy2 * cos_r)

                ann = ax.annotate('', xy=(rx2, ry2), xytext=(rx1, ry1),
                            arrowprops=dict(arrowstyle="-|>", color=node_color, lw=node.style.strokeWidth, linestyle=ls, mutation_scale=18, shrinkA=0, shrinkB=0))
                ann.set_clip_path(ax.patch)

            elif node.type == 'line':
                pts = node.points or [0, 0, 3, 2]
                rad = math.radians(node.rotation)
                cos_r, sin_r = math.cos(rad), math.sin(rad)
                dx1, dy1, dx2, dy2 = [p * node_scale for p in pts[:4]]

                rx1 = node.x + (dx1 * cos_r - dy1 * sin_r)
                ry1 = node.y + (dx1 * sin_r + dy1 * cos_r)
                rx2 = node.x + (dx2 * cos_r - dy2 * sin_r)
                ry2 = node.y + (dx2 * sin_r + dy2 * cos_r)

                lines = ax.plot([rx1, rx2], [ry1, ry2], color=node_color, linestyle=ls, linewidth=node.style.strokeWidth)
                for l in lines:
                    l.set_clip_path(ax.patch)

            elif node.type == 'super_vector' or node.type == 'super_line':
                pts = node.points or [0, 0, 3, 2]
                rad = math.radians(node.rotation)
                cos_r, sin_r = math.cos(rad), math.sin(rad)
                dx1, dy1, dx2, dy2 = [p * node_scale for p in pts[:4]]

                rx1 = node.x + (dx1 * cos_r - dy1 * sin_r)
                ry1 = node.y + (dx1 * sin_r + dy1 * cos_r)
                rx2 = node.x + (dx2 * cos_r - dy2 * sin_r)
                ry2 = node.y + (dx2 * sin_r + dy2 * cos_r)

                if node.controlPoint:
                    cpx, cpy = [p * node_scale for p in node.controlPoint]
                    rcx = node.x + (cpx * cos_r - cpy * sin_r)
                    rcy = node.y + (cpx * sin_r + cpy * cos_r)
                else:
                    rcx = (rx1 + rx2) / 2.0
                    rcy = (ry1 + ry2) / 2.0 + 1.0

                is_straight = node.lineShape == 'straight'

                if node.type == 'super_line':
                    if is_straight:
                        lines = ax.plot([rx1, rcx, rx2], [ry1, rcy, ry2], color=node_color, linestyle=ls, linewidth=node.style.strokeWidth)
                        for l in lines:
                            l.set_clip_path(ax.patch)
                    else:
                        from matplotlib.path import Path
                        path = build_catmull_rom_path([(rx1, ry1), (rcx, rcy), (rx2, ry2)])
                        patch = patches.PathPatch(path, edgecolor=node_color, facecolor='none', linestyle=ls, linewidth=node.style.strokeWidth)
                        patch.set_clip_path(ax.patch)
                        ax.add_patch(patch)
                else: # super_vector
                    if is_straight:
                        l1 = ax.plot([rx1, rcx], [ry1, rcy], color=node_color, linestyle=ls, linewidth=node.style.strokeWidth)
                        for l in l1:
                            l.set_clip_path(ax.patch)
                        ann = ax.annotate('', xy=(rx2, ry2), xytext=(rcx, rcy),
                                    arrowprops=dict(arrowstyle="-|>", color=node_color, lw=node.style.strokeWidth, linestyle=ls, mutation_scale=18, shrinkA=0, shrinkB=0))
                        ann.set_clip_path(ax.patch)
                    else:
                        from matplotlib.patches import FancyArrowPatch
                        path = build_catmull_rom_path([(rx1, ry1), (rcx, rcy), (rx2, ry2)])
                        arrow = FancyArrowPatch(
                            path=path,
                            arrowstyle="-|>",
                            color=node_color,
                            linestyle=ls,
                            linewidth=node.style.strokeWidth,
                            mutation_scale=18,
                        )
                        arrow.set_clip_path(ax.patch)
                        ax.add_patch(arrow)

            elif node.type == 'mega_line' or node.type == 'mega_vector':
                pts = node.points or [0, 0, 3, 2]
                rad = math.radians(node.rotation)
                cos_r, sin_r = math.cos(rad), math.sin(rad)
                coords = []
                for i in range(0, len(pts) - 1, 2):
                    dx = pts[i] * node_scale
                    dy = pts[i+1] * node_scale
                    rx = node.x + (dx * cos_r - dy * sin_r)
                    ry = node.y + (dx * sin_r + dy * cos_r)
                    coords.append((rx, ry))

                if len(coords) >= 2:
                    is_straight = node.lineShape == 'straight'
                    if is_straight:
                        xs = [c[0] for c in coords]
                        ys = [c[1] for c in coords]
                        if node.type == 'mega_line':
                            lines = ax.plot(xs, ys, color=node_color, linestyle=ls, linewidth=node.style.strokeWidth)
                            for l in lines:
                                l.set_clip_path(ax.patch)
                        else:  # mega_vector
                            if len(coords) > 2:
                                lines = ax.plot(xs[:-1], ys[:-1], color=node_color, linestyle=ls, linewidth=node.style.strokeWidth)
                                for l in lines:
                                    l.set_clip_path(ax.patch)
                            ann = ax.annotate('', xy=coords[-1], xytext=coords[-2],
                                        arrowprops=dict(arrowstyle="-|>", color=node_color, lw=node.style.strokeWidth, linestyle=ls, mutation_scale=18, shrinkA=0, shrinkB=0))
                            ann.set_clip_path(ax.patch)
                    else:
                        from matplotlib.patches import PathPatch, FancyArrowPatch
                        path = build_catmull_rom_path(coords)
                        if node.type == 'mega_line':
                            patch = PathPatch(path, edgecolor=node_color, facecolor='none', linestyle=ls, linewidth=node.style.strokeWidth)
                            patch.set_clip_path(ax.patch)
                            ax.add_patch(patch)
                        else:  # mega_vector
                            arrow = FancyArrowPatch(
                                path=path,
                                arrowstyle="-|>",
                                color=node_color,
                                linestyle=ls,
                                linewidth=node.style.strokeWidth,
                                mutation_scale=18,
                            )
                            arrow.set_clip_path(ax.patch)
                            ax.add_patch(arrow)

            elif node.type == 'text':
                pass

            # LaTeX Label Annotation Rendering with Strict Export Bounds Checking!
            if node.label and node.label.strip():
                is_shape = node.type in ('rect', 'circle', 'triangle', 'diamond', 'obstacle', 'text')
                default_off_x = 0.0 if is_shape else 0.3
                default_off_y = 0.0 if is_shape else 0.3
                off_x = node.labelOffsetX if node.labelOffsetX is not None else default_off_x
                off_y = node.labelOffsetY if node.labelOffsetY is not None else default_off_y
                lx = node.x + off_x
                ly = node.y + off_y

                # STRICT BOUNDS CHECKING: If label position is completely outside export bounds, DO NOT add ax.text!
                # Adding ax.text outside bounds forces Matplotlib's bbox_inches='tight' algorithm to stretch export dimensions.
                if (lx < bounds.xMin - 0.5 or lx > bounds.xMax + 0.5 or 
                    ly < bounds.yMin - 0.5 or ly > bounds.yMax + 0.5):
                    continue

                raw_label = node.label.strip()
                if fast_mode and layout.macros:
                    raw_label = expand_macros_for_mathtext(raw_label, layout.macros)

                def format_mathtext_line(line_str: str) -> str:
                    s = line_str.strip()
                    if not s:
                        return ""
                    if '$' in s:
                        parts = s.split('$')
                        res = []
                        for i, p in enumerate(parts):
                            if i % 2 == 1:
                                res.append('$' + p.replace(' ', r'\ ') + '$')
                            else:
                                res.append(p)
                        return ''.join(res)
                    else:
                        return '$' + s.replace(' ', r'\ ') + '$'

                if '\n' in raw_label:
                    latex_lines = [format_mathtext_line(line) for line in raw_label.split('\n')]
                    latex_text = "\n".join([l for l in latex_lines if l])
                else:
                    latex_text = format_mathtext_line(raw_label)

                fn_size = node.fontSize if node.fontSize is not None else global_font_size

                # Label background transparency & box opacity
                box_opacity = getattr(plot_opts, 'labelBoxOpacity', 0.0)
                if box_opacity is None:
                    box_opacity = 0.0
                is_transparent = node.labelFillTransparent if node.labelFillTransparent is not None else (box_opacity == 0.0)

                if is_transparent and box_opacity == 0.0:
                    lbl_bbox = dict(boxstyle='round,pad=0.2', facecolor='none', edgecolor='none')
                else:
                    bg_color_val = node.labelFillColor or node.style.fillColor or node.style.color or '#ffffff'
                    effective_opacity = box_opacity if is_transparent else 0.85
                    if effective_opacity > 0.0:
                        lbl_color = get_rgba(bg_color_val, effective_opacity)
                        lbl_bbox = dict(boxstyle='round,pad=0.2', facecolor=lbl_color, edgecolor='none')
                    else:
                        lbl_bbox = dict(boxstyle='round,pad=0.2', facecolor='none', edgecolor='none')

                # Use custom labelTextColor if specified, otherwise fall back to node_color
                txt_color_val = node.labelTextColor or node.style.color or '#000000'
                txt_color = get_rgba(txt_color_val, stroke_opacity)

                align_val = getattr(node, 'textAlign', 'center') or 'center'

                try:
                    txt = ax.text(lx, ly, latex_text, fontsize=fn_size, color=txt_color, ha='center', va='center', multialignment=align_val, bbox=lbl_bbox, zorder=10)
                    txt.set_clip_path(ax.patch)
                except Exception as tex_err:
                    print(f"LaTeX label render warning for '{raw_label}': {tex_err}")
                    clean_label = raw_label.replace('\\', '')
                    txt = ax.text(lx, ly, clean_label, fontsize=fn_size, color=txt_color, ha='center', va='center', multialignment=align_val, bbox=lbl_bbox, zorder=10)
                    txt.set_clip_path(ax.patch)

        pad_inches = plot_opts.marginPadding if plot_opts.marginPadding is not None else 0.05
        buf = io.BytesIO()
        plt.savefig(buf, format=format, bbox_inches='tight', pad_inches=pad_inches, facecolor=fig.get_facecolor(), dpi=dpi)
        buf.seek(0)
        img_bytes = buf.getvalue()
        buf.close()
        return img_bytes

    finally:
        pass

def compile_scene_to_base64(layout: ProjectLayout, dpi: int = 80, fast_mode: bool = True) -> str:
    image_bytes = compile_scene(layout, format='png', dpi=dpi, fast_mode=fast_mode)
    return base64.b64encode(image_bytes).decode('utf-8')
