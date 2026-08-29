import katex from 'katex';
import type { MacroDefinition } from '../types/schema';

const katexStringCache = new Map<string, string>();

function expandIfBlank(input: string): string {
  let text = input;
  let safety = 0;
  while (safety < 20) {
    safety++;
    const idx = text.indexOf('\\ifblank');
    if (idx === -1) break;

    let p = idx + 8; // skip '\\ifblank'
    while (p < text.length && /\s/.test(text[p])) p++;

    const readBraceGroup = (startPos: number): { content: string; endPos: number } | null => {
      let cur = startPos;
      while (cur < text.length && /\s/.test(text[cur])) cur++;
      if (cur >= text.length || text[cur] !== '{') return null;
      cur++; // skip '{'
      let depth = 1;
      let content = '';
      while (cur < text.length && depth > 0) {
        const c = text[cur];
        if (c === '\\') {
          content += c;
          cur++;
          if (cur < text.length) {
            content += text[cur];
            cur++;
          }
          continue;
        }
        if (c === '{') depth++;
        else if (c === '}') {
          depth--;
          if (depth === 0) {
            cur++;
            return { content, endPos: cur };
          }
        }
        content += c;
        cur++;
      }
      return null;
    };

    const g1 = readBraceGroup(p);
    if (!g1) {
      text = text.slice(0, idx) + text.slice(idx + 8);
      continue;
    }

    const g2 = readBraceGroup(g1.endPos);
    if (!g2) {
      text = text.slice(0, idx) + text.slice(idx + 8);
      continue;
    }

    const g3 = readBraceGroup(g2.endPos);
    if (!g3) {
      text = text.slice(0, idx) + text.slice(idx + 8);
      continue;
    }

    const arg = g1.content.trim();
    const thenVal = g2.content;
    const elseVal = g3.content;
    const replacement = (arg === '' || arg === '#1' || arg === '#2' || arg === '#3') ? thenVal : elseVal;

    text = text.slice(0, idx) + replacement + text.slice(g3.endPos);
  }
  return text;
}

export function expandLatexMacros(rawLabel: string, macros?: Record<string, MacroDefinition>): string {
  if (!rawLabel) return '';
  if (!macros) return expandIfBlank(rawLabel);

  // Sort macros by command length descending (longest first) to prevent prefix collisions
  const sortedMacros = Object.values(macros).sort((a, b) => b.command.length - a.command.length);

  let text = rawLabel;
  let prevText = '';
  let iterations = 0;

  // Expand up to 5 passes for nested macros and conditionals
  while (text !== prevText && iterations < 5) {
    prevText = text;
    iterations++;

    for (const macro of sortedMacros) {
      const cmd = macro.command.startsWith('\\') ? macro.command : `\\${macro.command}`;
      const escapedCmd = cmd.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      if (macro.argsCount === 0) {
        // Word boundary check
        const regex = new RegExp(escapedCmd + '(?![a-zA-Z0-9])', 'g');
        text = text.replace(regex, macro.template || '');
      } else {
        // Match command followed by optional argsCount brace groups
        let pattern = escapedCmd;
        for (let i = 0; i < macro.argsCount; i++) {
          pattern += '(?:\\{([^{}]*(?:\\{[^{}]*\\}[^{}]*)*)\\})?';
        }
        pattern += '(?![a-zA-Z0-9])';
        const regex = new RegExp(pattern, 'g');
        text = text.replace(regex, (...args) => {
          let res = macro.template || '';
          for (let i = 1; i <= macro.argsCount; i++) {
            const argVal = args[i] !== undefined ? args[i] : '';
            res = res.replaceAll(`#${i}`, argVal);
          }
          return res;
        });
      }
    }

    // Expand bracket-aware \ifblank{arg}{then}{else}
    text = expandIfBlank(text);
  }

  return text.replaceAll('\\bm{', '\\mathbf{').replaceAll('\\boldsymbol{', '\\mathbf{');
}

export function renderLatexToHtml(rawLabel: string, macros?: Record<string, MacroDefinition>): string {
  if (!rawLabel) return '';

  const expandedText = expandLatexMacros(rawLabel, macros);

  const lines = expandedText.split('\n');
  return lines
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return '<div class="katex-line" style="line-height: 1.15; height: 1em;"></div>';

      const renderSnippet = (mathSnippet: string) => {
        // Replace unescaped spaces with '\ ' so KaTeX preserves literal whitespace in math mode
        const spaced = mathSnippet.replace(/(?<!\\) /g, '\\ ');

        const cached = katexStringCache.get(spaced);
        if (cached !== undefined) return cached;

        let rendered = spaced;
        try {
          rendered = katex.renderToString(spaced, {
            throwOnError: false,
            displayMode: false,
          });
        } catch {
          rendered = mathSnippet;
        }

        if (katexStringCache.size > 2000) katexStringCache.clear();
        katexStringCache.set(spaced, rendered);
        return rendered;
      };

      let lineHtml = '';
      if (trimmed.includes('$')) {
        const parts = trimmed.split('$');
        const resHtml: string[] = [];
        for (let i = 0; i < parts.length; i++) {
          const part = parts[i];
          if (!part) continue;
          if (i % 2 === 1) {
            // Inside $ ... $
            resHtml.push(renderSnippet(part));
          } else {
            // Outside $ ... $ plain text
            const safeText = part
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/ /g, '&nbsp;');
            resHtml.push(`<span>${safeText}</span>`);
          }
        }
        lineHtml = resHtml.join('');
      } else {
        lineHtml = renderSnippet(trimmed);
      }
      return `<div class="katex-line" style="line-height: 1.15; margin: 0; padding: 0;">${lineHtml}</div>`;
    })
    .join('');
}
