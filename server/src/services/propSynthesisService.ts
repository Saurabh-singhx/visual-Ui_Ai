/**
 * Prop Synthesis & Import Adaptation Service
 *
 * Automatically parses component TypeScript interfaces, types, and parameter defaults,
 * synthesizes realistic contextual mock data, and adapts component imports/primitives
 * (stripping asset imports, converting subcomponents to styled primitives, cleaning Framer Motion)
 * so arbitrary components render cleanly in the canvas without breaking.
 */

export interface SynthesizedPropResult {
  props: Record<string, any>;
  adaptedCode: string;
}

export class PropSynthesisService {
  /**
   * Helper to extract top-level properties from a type/interface block using balanced brace counting
   */
  private extractPropsFromBlock(block: string): Record<string, { type: string; optional: boolean }> {
    const result: Record<string, { type: string; optional: boolean }> = {};
    let currentPropName = '';
    let isOptional = false;
    let isReadingType = false;
    let currentType = '';
    let braceDepth = 0;
    let parenDepth = 0;
    let angleDepth = 0;
    let bracketDepth = 0;
    let inString: string | null = null;
    let inLineComment = false;
    let inBlockComment = false;
    let preColon = '';

    const saveCurrentProp = () => {
      if (currentPropName && currentType.trim()) {
        result[currentPropName] = {
          type: currentType.trim(),
          optional: isOptional,
        };
      }
      currentPropName = '';
      isOptional = false;
      isReadingType = false;
      currentType = '';
      preColon = '';
    };

    for (let i = 0; i < block.length; i++) {
      const char = block[i];
      const nextChar = block[i + 1];

      if (inLineComment) {
        if (char === '\n') inLineComment = false;
        continue;
      }
      if (inBlockComment) {
        if (char === '*' && nextChar === '/') {
          inBlockComment = false;
          i++;
        }
        continue;
      }
      if (inString) {
        if (char === '\\') {
          if (isReadingType) currentType += char + (nextChar || '');
          i++;
        } else {
          if (isReadingType) currentType += char;
          if (char === inString) inString = null;
        }
        continue;
      }

      if (char === '/' && nextChar === '/') {
        inLineComment = true;
        i++;
        continue;
      }
      if (char === '/' && nextChar === '*') {
        inBlockComment = true;
        i++;
        continue;
      }
      if (char === '"' || char === "'" || char === '`') {
        inString = char;
        if (isReadingType) currentType += char;
        continue;
      }

      // Arrows '=>': do not treat '>' as closing an angle bracket
      if (char === '=' && nextChar === '>') {
        if (isReadingType) currentType += '=>';
        i++;
        continue;
      }

      if (char === '{') {
        braceDepth++;
        if (isReadingType) currentType += char;
        continue;
      }
      if (char === '}') {
        if (braceDepth > 0) braceDepth--;
        if (isReadingType) currentType += char;
        continue;
      }
      if (char === '(') {
        parenDepth++;
        if (isReadingType) currentType += char;
        continue;
      }
      if (char === ')') {
        if (parenDepth > 0) parenDepth--;
        if (isReadingType) currentType += char;
        continue;
      }
      if (char === '<') {
        angleDepth++;
        if (isReadingType) currentType += char;
        continue;
      }
      if (char === '>') {
        if (angleDepth > 0) angleDepth--;
        if (isReadingType) currentType += char;
        continue;
      }
      if (char === '[') {
        bracketDepth++;
        if (isReadingType) currentType += char;
        continue;
      }
      if (char === ']') {
        if (bracketDepth > 0) bracketDepth--;
        if (isReadingType) currentType += char;
        continue;
      }

      if (braceDepth === 0 && parenDepth === 0 && angleDepth === 0 && bracketDepth === 0) {
        if (!isReadingType) {
          if (char === ':') {
            const match = preColon.trim().match(/^([a-zA-Z0-9_]+)(\?)?$/);
            if (match) {
              currentPropName = match[1];
              isOptional = Boolean(match[2]);
              isReadingType = true;
              currentType = '';
            } else {
              preColon = '';
            }
          } else if (char === ';' || char === '\n') {
            preColon = '';
          } else {
            preColon += char;
          }
        } else {
          if (char === ';' || char === ',') {
            saveCurrentProp();
          } else if (char === '\n') {
            const rest = block.slice(i + 1).trim();
            if (/^[a-zA-Z0-9_]+(\?)?:/.test(rest) || rest.length === 0) {
              saveCurrentProp();
            } else {
              currentType += char;
            }
          } else {
            currentType += char;
          }
        }
      } else {
        if (isReadingType) {
          currentType += char;
        }
      }
    }
    saveCurrentProp();
    return result;
  }

  /**
   * Helper to strip specific JSX props supporting double-curly braces, balanced braces, and strings
   */
  private stripJsxProps(code: string, propNames: string[]): string {
    const pattern = new RegExp(`\\s+(?:${propNames.join('|')})\\s*=\\s*(?:(["'])(?:\\\\.|[^\\\\])*?\\1|\\{)`, 'g');
    let result = '';
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(code)) !== null) {
      result += code.slice(lastIndex, match.index);
      const matchEnd = match.index + match[0].length;
      if (code[matchEnd - 1] === '{') {
        let depth = 1;
        let i = matchEnd;
        let inStr: string | null = null;
        while (i < code.length && depth > 0) {
          const c = code[i];
          if (inStr) {
            if (c === '\\') {
              i++;
            } else if (c === inStr) {
              inStr = null;
            }
          } else {
            if (c === '"' || c === "'" || c === '`') {
              inStr = c;
            } else if (c === '{') {
              depth++;
            } else if (c === '}') {
              depth--;
            }
          }
          i++;
        }
        lastIndex = i;
      } else {
        lastIndex = matchEnd;
      }
      pattern.lastIndex = lastIndex;
    }
    result += code.slice(lastIndex);
    return result;
  }

  /**
   * Parse TypeScript prop interfaces or types from code
   */
  parsePropTypes(code: string): Record<string, { type: string; optional: boolean }> {
    const propTypes: Record<string, { type: string; optional: boolean }> = {};

    // 1. Match interface ... { ... } or type ... = ... { ... }
    // Using depth tracking for braces so nested objects do not truncate the outer interface
    const interfaceHeaderRegex = /(?:interface|type)\s+[A-Za-z0-9_]+\b[^{;=]*?(?:=\s*)?(?:[^{;]*&\s*)?\{/g;
    let match: RegExpExecArray | null;

    while ((match = interfaceHeaderRegex.exec(code)) !== null) {
      const openBraceIdx = match.index + match[0].length - 1;
      let depth = 1;
      let i = openBraceIdx + 1;
      let inString: string | null = null;
      let inLineComment = false;
      let inBlockComment = false;

      while (i < code.length && depth > 0) {
        const char = code[i];
        const nextChar = code[i + 1];

        if (inLineComment) {
          if (char === '\n') inLineComment = false;
        } else if (inBlockComment) {
          if (char === '*' && nextChar === '/') {
            inBlockComment = false;
            i++;
          }
        } else if (inString) {
          if (char === '\\') {
            i++;
          } else if (char === inString) {
            inString = null;
          }
        } else {
          if (char === '/' && nextChar === '/') {
            inLineComment = true;
            i++;
          } else if (char === '/' && nextChar === '*') {
            inBlockComment = true;
            i++;
          } else if (char === '"' || char === "'" || char === '`') {
            inString = char;
          } else if (char === '{') {
            depth++;
          } else if (char === '}') {
            depth--;
            if (depth === 0) break;
          }
        }
        i++;
      }

      if (depth === 0) {
        const block = code.slice(openBraceIdx + 1, i);
        const parsed = this.extractPropsFromBlock(block);
        Object.assign(propTypes, parsed);
        interfaceHeaderRegex.lastIndex = i + 1;
      }
    }

    // 2. Match inline type in function parameter: ({ ... }: { ... })
    const inlineHeaderRegex = /\(\s*\{[\s\S]*?\}\s*:\s*\{/g;
    while ((match = inlineHeaderRegex.exec(code)) !== null) {
      const openBraceIdx = match.index + match[0].length - 1;
      let depth = 1;
      let i = openBraceIdx + 1;
      let inString: string | null = null;
      let inLineComment = false;
      let inBlockComment = false;

      while (i < code.length && depth > 0) {
        const char = code[i];
        const nextChar = code[i + 1];

        if (inLineComment) {
          if (char === '\n') inLineComment = false;
        } else if (inBlockComment) {
          if (char === '*' && nextChar === '/') {
            inBlockComment = false;
            i++;
          }
        } else if (inString) {
          if (char === '\\') {
            i++;
          } else if (char === inString) {
            inString = null;
          }
        } else {
          if (char === '/' && nextChar === '/') {
            inLineComment = true;
            i++;
          } else if (char === '/' && nextChar === '*') {
            inBlockComment = true;
            i++;
          } else if (char === '"' || char === "'" || char === '`') {
            inString = char;
          } else if (char === '{') {
            depth++;
          } else if (char === '}') {
            depth--;
            if (depth === 0) break;
          }
        }
        i++;
      }

      if (depth === 0) {
        const block = code.slice(openBraceIdx + 1, i);
        const parsed = this.extractPropsFromBlock(block);
        for (const [propName, meta] of Object.entries(parsed)) {
          if (!propTypes[propName]) {
            propTypes[propName] = meta;
          }
        }
        inlineHeaderRegex.lastIndex = i + 1;
      }
    }

    // 3. Match destructured parameter defaults: ({ title = 'Default', count = 5 })
    const paramMatch =
      code.match(/(?:const|function)\s+[A-Za-z0-9_]+\s*(?::\s*[^=]+)?\s*=\s*\(\s*\{([\s\S]*?)\}\s*(?::\s*[^=)]+)?\s*\)/) ||
      code.match(/function\s+[A-Za-z0-9_]+\s*\(\s*\{([\s\S]*?)\}\s*(?::\s*[^=)]+)?\s*\)/) ||
      code.match(/\(\s*\{([\s\S]*?)\}\s*(?::\s*[^=)]+)?\s*\)\s*=>/);

    if (paramMatch) {
      const paramsBlock = paramMatch[1];
      for (const m of paramsBlock.matchAll(/([a-zA-Z0-9_]+)\s*=\s*["']([^"']+)["']/g)) {
        if (!propTypes[m[1]]) {
          propTypes[m[1]] = { type: 'string', optional: true };
        }
      }
      for (const m of paramsBlock.matchAll(/([a-zA-Z0-9_]+)\s*=\s*([0-9]+(?:\.[0-9]+)?)/g)) {
        if (!propTypes[m[1]]) {
          propTypes[m[1]] = { type: 'number', optional: true };
        }
      }
      for (const m of paramsBlock.matchAll(/([a-zA-Z0-9_]+)\s*=\s*(true|false)/g)) {
        if (!propTypes[m[1]]) {
          propTypes[m[1]] = { type: 'boolean', optional: true };
        }
      }
      for (const m of paramsBlock.matchAll(/([a-zA-Z0-9_]+)\s*=\s*(\[[\s\S]*?\])/g)) {
        if (!propTypes[m[1]]) {
          propTypes[m[1]] = { type: 'array', optional: true };
        }
      }
    }

    return propTypes;
  }

  /**
   * Generate realistic, high-quality sample mock props based on field names and types
   */
  generateSampleValue(propName: string, rawType: string, componentName?: string): any {
    const trimmed = rawType.trim();
    const lowerTrimmed = trimmed.toLowerCase();
    const lowerName = propName.toLowerCase();

    // 1. Explicit Arrays: structural checks to avoid matching inner member []
    const isArray =
      lowerTrimmed.endsWith('[]') ||
      lowerTrimmed.startsWith('array<') ||
      lowerTrimmed.startsWith('readonlyarray<') ||
      lowerTrimmed === 'array';

    if (isArray) {
      // 1a. Array of Objects / Records
      let innerObjectType: string | null = null;
      if (lowerTrimmed.endsWith('[]')) {
        let inner = trimmed.slice(0, -2).trim();
        if (inner.startsWith('(') && inner.endsWith(')')) {
          inner = inner.slice(1, -1).trim();
        }
        innerObjectType = inner;
      } else if (lowerTrimmed.startsWith('array<') || lowerTrimmed.startsWith('readonlyarray<')) {
        const start = trimmed.indexOf('<');
        const end = trimmed.lastIndexOf('>');
        if (start !== -1 && end > start) {
          let inner = trimmed.slice(start + 1, end).trim();
          if (inner.startsWith('(') && inner.endsWith(')')) {
            inner = inner.slice(1, -1).trim();
          }
          innerObjectType = inner;
        }
      }

      const isObjectElement =
        Boolean(innerObjectType) &&
        ((innerObjectType!.startsWith('{') && innerObjectType!.endsWith('}')) ||
          innerObjectType!.toLowerCase().startsWith('record<') ||
          innerObjectType!.toLowerCase() === 'object' ||
          innerObjectType!.includes('{'));

      if (isObjectElement && innerObjectType) {
        const singularName = propName.replace(/s$/i, '').replace(/list$/i, '') || 'item';
        const elementSample = this.generateSampleValue(singularName, innerObjectType, componentName);

        if (/user|member|authors|people/i.test(lowerName)) {
          return [
            { role: 'Lead Architect', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100', ...elementSample, id: '1', name: 'Alex Rivers' },
            { role: 'Staff Designer', avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100', ...elementSample, id: '2', name: 'Elena Rostova' },
            { role: 'Full Stack', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100', ...elementSample, id: '3', name: 'Marcus Chen' },
          ];
        }

        const baseItem1 = { id: '1', title: 'High Performance', name: 'High Performance', label: 'Feature 1', description: 'Zero bundle overhead rendering.', active: true, price: 99.0, count: 10 };
        const baseItem2 = { id: '2', title: 'Smart Inspection', name: 'Smart Inspection', label: 'Feature 2', description: 'Interactive bounding box overlay.', active: false, price: 149.0, count: 20 };
        const baseItem3 = { id: '3', title: 'Live Code Grounding', name: 'Live Code Grounding', label: 'Feature 3', description: 'Atomic file saves with backup.', active: false, price: 199.0, count: 30 };

        if (elementSample && typeof elementSample === 'object') {
          return [
            { ...baseItem1, ...elementSample, id: '1' },
            { ...baseItem2, ...elementSample, id: '2', title: 'Secondary Item', name: 'Secondary Item', active: false },
            { ...baseItem3, ...elementSample, id: '3', title: 'Tertiary Item', name: 'Tertiary Item', active: false },
          ];
        }

        return [baseItem1, baseItem2, baseItem3];
      }

      // 1b. Array of Functions
      if (lowerTrimmed.includes('=>') || lowerTrimmed.includes('function')) {
        return [() => {}, () => {}];
      }

      // 1c. Array of Numbers
      if (lowerTrimmed.includes('number')) {
        return [10, 20, 30];
      }

      // 1d. Array of Booleans
      if (lowerTrimmed.includes('boolean')) {
        return [true, false, true];
      }

      // 1e. Array of Strings / Tags
      if (/tag|category|categories|labels|chips/i.test(lowerName) || lowerTrimmed.includes('string')) {
        return ['Overview', 'Analytics', 'Settings'];
      }

      // 1f. Array of Users
      if (/user|member|authors|people/i.test(lowerName)) {
        return [
          { id: '1', name: 'Alex Rivers', role: 'Lead Architect', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100' },
          { id: '2', name: 'Elena Rostova', role: 'Staff Designer', avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100' },
          { id: '3', name: 'Marcus Chen', role: 'Full Stack', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100' },
        ];
      }

      // 1g. General items array
      return [
        { id: '1', title: 'High Performance', name: 'High Performance', label: 'Feature 1', description: 'Zero bundle overhead rendering.', active: true },
        { id: '2', title: 'Smart Inspection', name: 'Smart Inspection', label: 'Feature 2', description: 'Interactive bounding box overlay.', active: false },
        { id: '3', title: 'Live Code Grounding', name: 'Live Code Grounding', label: 'Feature 3', description: 'Atomic file saves with backup.', active: false },
      ];
    }

    // 2. Objects & Records (must be prioritized BEFORE callbacks and scalars)
    const isObject =
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      lowerTrimmed.startsWith('record<') ||
      lowerTrimmed === 'object';

    if (isObject) {
      const firstBrace = trimmed.indexOf('{');
      const lastBrace = trimmed.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        const inner = trimmed.slice(firstBrace + 1, lastBrace).trim();
        const childProps = this.extractPropsFromBlock(inner);
        if (Object.keys(childProps).length > 0) {
          const synthesizedObj: Record<string, any> = {};
          for (const [childName, childMeta] of Object.entries(childProps)) {
            synthesizedObj[childName] = this.generateSampleValue(childName, childMeta.type, componentName);
          }

          if (/user|member|profile|author|creator/i.test(lowerName)) {
            return {
              id: 'user-1',
              name: 'Alex Rivers',
              email: 'alex@example.com',
              role: 'Admin',
              avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
              profile: { name: 'Alex Rivers', avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150' },
              ...synthesizedObj,
            };
          }
          if (/stat|metrics|analytics/i.test(lowerName)) {
            return { total: 1240, change: '+14.2%', active: 980, count: 42, ...synthesizedObj };
          }
          return { id: 'obj-1', name: 'Default Item', label: 'Sample', ...synthesizedObj };
        }
      }

      // Records or generic key-value dictionaries
      if (lowerTrimmed.includes('record<')) {
        if (lowerTrimmed.includes('number')) {
          return { count: 42, score: 98, total: 100, item1: 10, item2: 20 };
        }
        if (lowerTrimmed.includes('boolean')) {
          return { enabled: true, active: true, visible: false };
        }
        return { id: '1', key: 'value', title: 'Record Item', count: 42 };
      }

      // Named object fallbacks or empty object types
      if (/user|member|profile|author|creator/i.test(lowerName)) {
        return {
          id: 'user-1',
          name: 'Alex Rivers',
          email: 'alex@example.com',
          role: 'Admin',
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
          profile: { name: 'Alex Rivers', avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150' },
        };
      }
      if (/stat|metrics|analytics/i.test(lowerName)) {
        return { total: 1240, change: '+14.2%', active: 980, count: 42 };
      }
      return { id: 'obj-1', name: 'Default Item', label: 'Sample', count: 1, active: true };
    }

    // 3. Explicit Function Callbacks (must be prioritized BEFORE scalar boolean/number)
    if (
      lowerTrimmed.includes('=>') ||
      lowerTrimmed.includes('function') ||
      lowerTrimmed.includes('callback') ||
      lowerTrimmed.includes('()') ||
      (lowerTrimmed.startsWith('(') && (lowerTrimmed.includes('=>') || !lowerTrimmed.includes('|')))
    ) {
      return () => {};
    }

    // String literal unions (e.g. 'primary' | 'secondary', 'number' | 'text')
    const literalMatch = rawType.match(/["']([^"']+)["']/);
    if (literalMatch) {
      return literalMatch[1];
    }

    // 4. Explicit Booleans
    if (lowerTrimmed.includes('boolean')) {
      if (/disabled|hidden|loading|error/i.test(lowerName)) return false;
      return true;
    }

    // 5. Explicit Numbers
    if (lowerTrimmed.includes('number')) {
      if (/age/i.test(lowerName)) return 25;
      if (/price|amount|cost/i.test(lowerName)) return 99.0;
      if (/rating|score/i.test(lowerName)) return 4.9;
      if (/percentage|progress/i.test(lowerName)) return 85;
      if (/count|total|quantity|badge/i.test(lowerName)) return 42;
      return 1;
    }

    // Strings
    if (/title|heading|header/i.test(lowerName)) {
      return componentName ? `${componentName} Component` : 'Interactive Component';
    }
    if (/subtitle|desc|description|body|details|summary/i.test(lowerName)) {
      return 'Comprehensive visual interface with real-time inspection, styling controls, and direct code editing.';
    }
    if (/name|username|author|fullname/i.test(lowerName)) {
      return 'Alex Rivers';
    }
    if (/email/i.test(lowerName)) {
      return 'alex.rivers@example.com';
    }
    if (/role|job|title/i.test(lowerName)) {
      return 'Lead UI Engineer';
    }
    if (/avatar|image|img|src|thumbnail|photo|picture/i.test(lowerName)) {
      return 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200';
    }
    if (/badge|tag|status/i.test(lowerName)) {
      return 'Active';
    }
    if (/label|cta|button|action/i.test(lowerName)) {
      return 'Explore Now';
    }
    if (/url|href|link|path/i.test(lowerName)) {
      return '#';
    }
    if (/date|time|timestamp/i.test(lowerName)) {
      return 'Nov 14, 2026';
    }
    if (/icon/i.test(lowerName)) {
      return 'Sparkles';
    }

    return 'Sample Value';
  }

  /**
   * Synthesize full props by parsing types and parameter defaults, merging with user props
   */
  synthesizeProps(code: string, userProps?: Record<string, any>, componentName?: string): Record<string, any> {
    const propTypes = this.parsePropTypes(code);
    const synthesized: Record<string, any> = {};

    // Generate for all discovered types
    for (const [propName, meta] of Object.entries(propTypes)) {
      synthesized[propName] = this.generateSampleValue(propName, meta.type, componentName);
    }

    // Extract any literal default values from signature to override generated fallbacks
    const paramMatch =
      code.match(/(?:const|function)\s+[A-Za-z0-9_]+\s*(?::\s*[^=]+)?\s*=\s*\(\s*\{([\s\S]*?)\}\s*(?::\s*[^=)]+)?\s*\)/) ||
      code.match(/function\s+[A-Za-z0-9_]+\s*\(\s*\{([\s\S]*?)\}\s*(?::\s*[^=)]+)?\s*\)/) ||
      code.match(/\(\s*\{([\s\S]*?)\}\s*(?::\s*[^=)]+)?\s*\)\s*=>/);

    if (paramMatch) {
      const paramsBlock = paramMatch[1];
      for (const m of paramsBlock.matchAll(/([a-zA-Z0-9_]+)\s*=\s*["']([^"']+)["']/g)) {
        synthesized[m[1]] = m[2];
      }
      for (const m of paramsBlock.matchAll(/([a-zA-Z0-9_]+)\s*=\s*([0-9]+(?:\.[0-9]+)?)/g)) {
        synthesized[m[1]] = Number(m[2]);
      }
      for (const m of paramsBlock.matchAll(/([a-zA-Z0-9_]+)\s*=\s*(true|false)/g)) {
        synthesized[m[1]] = m[2] === 'true';
      }
    }

    // User props always take highest priority
    if (userProps && typeof userProps === 'object') {
      Object.assign(synthesized, userProps);
    }

    return synthesized;
  }

  /**
   * Adapt imports, subcomponents, and motion props so the component renders cleanly
   */
  adaptImports(code: string): string {
    if (!code) return '';

    let adapted = code;

    // 1. Strip CSS / SCSS / Asset file imports (bare, default, named, mixed, wildcard)
    adapted = adapted.replace(
      /import\s+(?:(?!import)[\s\S])*?\s+from\s+['"][^'"]*\.(css|scss|sass|less|svg|png|jpg|jpeg|gif|webp|ico)['"];?/g,
      ''
    );
    adapted = adapted.replace(
      /import\s+['"][^'"]*\.(css|scss|sass|less|svg|png|jpg|jpeg|gif|webp|ico)['"];?/g,
      ''
    );

    // 2. Clean Framer Motion imports and motion tags
    adapted = adapted.replace(/import\s+(?:(?!import)[\s\S])*?\s+from\s+['"]framer-motion['"];?/g, '');
    adapted = adapted.replace(/<motion\.([a-zA-Z0-9]+)/g, '<$1');
    adapted = adapted.replace(/<\/motion\.([a-zA-Z0-9]+)>/g, '</$1>');

    // Strip motion props supporting double-curly braces, balanced braces, and strings
    const motionPropNames = [
      'whileHover',
      'whileTap',
      'whileFocus',
      'whileDrag',
      'whileInView',
      'initial',
      'animate',
      'exit',
      'transition',
      'variants',
      'layoutId',
    ];
    adapted = this.stripJsxProps(adapted, motionPropNames);

    // 3. Convert common UI library subcomponents to styled primitives cleanly without orphan tags
    // <Button ...>
    adapted = adapted.replace(/<Button\b([^>]*?)(\/?)>/g, (_match, attrs, selfClosing) => {
      const hasClass = /className=(["'])/.test(attrs);
      const tagAttrs = hasClass
        ? attrs
        : ` className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-all shadow-sm inline-flex items-center gap-1.5"${attrs}`;
      return selfClosing ? `<button${tagAttrs} />` : `<button${tagAttrs}>`;
    });
    adapted = adapted.replace(/<\/Button>/g, '</button>');

    // <Badge ...>
    adapted = adapted.replace(/<Badge\b([^>]*?)(\/?)>/g, (_match, attrs, selfClosing) => {
      const hasClass = /className=(["'])/.test(attrs);
      const tagAttrs = hasClass
        ? attrs
        : ` className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"${attrs}`;
      return selfClosing ? `<span${tagAttrs} />` : `<span${tagAttrs}>`;
    });
    adapted = adapted.replace(/<\/Badge>/g, '</span>');

    // <Card ...>
    adapted = adapted.replace(/<Card\b([^>]*?)(\/?)>/g, (_match, attrs, selfClosing) => {
      const hasClass = /className=(["'])/.test(attrs);
      const tagAttrs = hasClass
        ? attrs
        : ` className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg text-slate-100"${attrs}`;
      return selfClosing ? `<div${tagAttrs} />` : `<div${tagAttrs}>`;
    });
    adapted = adapted.replace(/<\/Card>/g, '</div>');

    // <CardHeader ...>
    adapted = adapted.replace(/<CardHeader\b([^>]*?)(\/?)>/g, (_match, attrs, selfClosing) => {
      return selfClosing
        ? `<div className="border-b border-slate-800 pb-3 mb-3 flex items-center justify-between"${attrs} />`
        : `<div className="border-b border-slate-800 pb-3 mb-3 flex items-center justify-between"${attrs}>`;
    });
    adapted = adapted.replace(/<\/CardHeader>/g, '</div>');

    // <CardTitle ...>
    adapted = adapted.replace(/<CardTitle\b([^>]*?)(\/?)>/g, (_match, attrs, selfClosing) => {
      return selfClosing
        ? `<h3 className="font-semibold text-lg text-white"${attrs} />`
        : `<h3 className="font-semibold text-lg text-white"${attrs}>`;
    });
    adapted = adapted.replace(/<\/CardTitle>/g, '</h3>');

    // <CardContent ...>
    adapted = adapted.replace(/<CardContent\b([^>]*?)(\/?)>/g, (_match, attrs, selfClosing) => {
      return selfClosing
        ? `<div className="space-y-3"${attrs} />`
        : `<div className="space-y-3"${attrs}>`;
    });
    adapted = adapted.replace(/<\/CardContent>/g, '</div>');

    // <CardFooter ...>
    adapted = adapted.replace(/<CardFooter\b([^>]*?)(\/?)>/g, (_match, attrs, selfClosing) => {
      return selfClosing
        ? `<div className="border-t border-slate-800 pt-3 mt-3 flex items-center justify-between text-sm text-slate-400"${attrs} />`
        : `<div className="border-t border-slate-800 pt-3 mt-3 flex items-center justify-between text-sm text-slate-400"${attrs}>`;
    });
    adapted = adapted.replace(/<\/CardFooter>/g, '</div>');

    return adapted;
  }
}

export const propSynthesisService = new PropSynthesisService();
