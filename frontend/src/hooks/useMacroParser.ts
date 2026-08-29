import { useMemo } from 'react';
import type { MacroDefinition } from '../types/schema';

// Robust parser to extract TeX macro definitions (\newcommand, \renewcommand, \providecommand, \DeclareRobustCommand, \def)
// Handles arbitrary brace nesting depth, escaped characters, and varied syntax formats.
export function parseTexMacros(texSource: string): Record<string, MacroDefinition> {
  const macros: Record<string, MacroDefinition> = {};
  if (!texSource) return macros;

  // Clean comments (lines starting with % or % after unescaped char)
  const lines = texSource.split('\n').map((l) => {
    const commentIdx = l.search(/(?<!\\)%/);
    return commentIdx >= 0 ? l.slice(0, commentIdx) : l;
  });
  const cleanedSource = lines.join('\n');

  let pos = 0;
  const len = cleanedSource.length;

  while (pos < len) {
    // Find next macro declaration keyword
    const match = cleanedSource.slice(pos).match(/\\(?:newcommand\*?|renewcommand\*?|providecommand\*?|DeclareRobustCommand\*?|def)\b/);
    if (!match || match.index === undefined) break;

    pos += match.index + match[0].length;

    // Skip whitespace
    while (pos < len && /\s/.test(cleanedSource[pos])) pos++;

    let cmdName = '';
    // Check if command is wrapped in braces {\cmd} or {cmd}
    if (cleanedSource[pos] === '{') {
      pos++; // skip '{'
      while (pos < len && /\s/.test(cleanedSource[pos])) pos++;
      const cmdMatch = cleanedSource.slice(pos).match(/^\\?([a-zA-Z0-9@]+)/);
      if (cmdMatch) {
        cmdName = `\\${cmdMatch[1]}`;
        pos += cmdMatch[0].length;
      }
      while (pos < len && cleanedSource[pos] !== '}') pos++;
      if (pos < len && cleanedSource[pos] === '}') pos++;
    } else if (cleanedSource[pos] === '\\') {
      // \newcommand\cmd or \def\cmd
      const cmdMatch = cleanedSource.slice(pos).match(/^\\([a-zA-Z0-9@]+)/);
      if (cmdMatch) {
        cmdName = `\\${cmdMatch[1]}`;
        pos += cmdMatch[0].length;
      }
    }

    if (!cmdName) continue;

    // Skip whitespace
    while (pos < len && /\s/.test(cleanedSource[pos])) pos++;

    let argsCount = 0;
    // Check for [args] parameter
    if (cleanedSource[pos] === '[') {
      const argsMatch = cleanedSource.slice(pos).match(/^\[(\d+)\]/);
      if (argsMatch) {
        argsCount = parseInt(argsMatch[1], 10) || 0;
        pos += argsMatch[0].length;
      }
      // If optional argument default parameter like [1][default] is present, skip the second bracket
      while (pos < len && /\s/.test(cleanedSource[pos])) pos++;
      if (cleanedSource[pos] === '[') {
        while (pos < len && cleanedSource[pos] !== ']') pos++;
        if (pos < len && cleanedSource[pos] === ']') pos++;
      }
    }

    // Skip whitespace
    while (pos < len && /\s/.test(cleanedSource[pos])) pos++;

    // Read template body enclosed in {...}
    if (cleanedSource[pos] === '{') {
      pos++; // skip opening '{'
      let depth = 1;
      let template = '';
      while (pos < len && depth > 0) {
        const char = cleanedSource[pos];
        if (char === '\\') {
          template += char;
          pos++;
          if (pos < len) {
            template += cleanedSource[pos];
            pos++;
          }
          continue;
        }
        if (char === '{') {
          depth++;
        } else if (char === '}') {
          depth--;
          if (depth === 0) {
            pos++;
            break;
          }
        }
        template += char;
        pos++;
      }

      macros[cmdName] = {
        command: cmdName,
        argsCount,
        template: template.trim(),
      };
    }
  }

  return macros;
}

export function useMacroParser(macros: Record<string, MacroDefinition>, filterText: string = '') {
  const suggestions = useMemo(() => {
    if (!filterText || !filterText.includes('\\')) {
      return [];
    }

    // Extract the active macro token being typed (e.g., "\zcont" from "\zcont")
    const lastBackslashIndex = filterText.lastIndexOf('\\');
    const query = filterText.slice(lastBackslashIndex).toLowerCase();

    return Object.values(macros).filter((macro) =>
      macro.command.toLowerCase().startsWith(query)
    );
  }, [macros, filterText]);

  return { suggestions };
}
