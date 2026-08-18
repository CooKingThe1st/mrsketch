import { useMemo } from 'react';
import type { MacroDefinition } from '../types/schema';

// Helper function to parse TeX source code into MacroDefinition records
export function parseTexMacros(texSource: string): Record<string, MacroDefinition> {
  const macros: Record<string, MacroDefinition> = {};
  
  // Regex to match \newcommand{\command}[args]{template} or \newcommand{\command}{template}
  // Handles escaped braces and basic tex patterns
  const regex = /\\newcommand\{\\([a-zA-Z0-9]+)\}(?:\[(\d+)\])?\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g;
  
  let match: RegExpExecArray | null;
  while ((match = regex.exec(texSource)) !== null) {
    const cmdName = `\\${match[1]}`;
    const argsCount = match[2] ? parseInt(match[2], 10) : 0;
    const template = match[3];

    macros[cmdName] = {
      command: cmdName,
      argsCount,
      template,
    };
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
