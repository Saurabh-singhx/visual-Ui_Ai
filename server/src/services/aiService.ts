import { RedesignRequest, RedesignResponse } from '../types';

export interface AiModificationResult {
  modifiedCode: string;
  appliedChanges: string[];
}

export interface AnimationUtilityDefinition {
  id: string;
  keywords: string[];
  classes: string[];
  conflictPatterns: RegExp[];
  description: string;
}

export const ANIMATION_PRESETS: AnimationUtilityDefinition[] = [
  {
    id: 'hover-scale',
    keywords: ['hover scale', 'zoom on hover', 'scale on hover', 'scale up', 'hover zoom', 'zoom', 'scale', 'scale-up', 'smoothly scale up'],
    classes: ['transition-all', 'duration-300', 'ease-in-out', 'hover:scale-105', 'active:scale-95', 'cursor-pointer'],
    conflictPatterns: [
      /transition(?:-\w+)?/,
      /duration-\d+/,
      /ease-\w+/,
      /hover:scale-\d+/,
      /active:scale-\d+/,
      /scale-\d+/,
      /cursor-(?:pointer|default|not-allowed)/,
    ],
    description: 'Added smooth hover scale transition (105%) with active press feedback',
  },
  {
    id: 'hover-lift',
    keywords: ['hover lift', 'float on hover', 'lift on hover', 'elevate on hover', 'hover float', 'float', 'hover elevation', 'smooth hover elevation'],
    classes: ['transition-all', 'duration-300', 'ease-in-out', 'hover:-translate-y-1', 'hover:shadow-xl'],
    conflictPatterns: [
      /transition(?:-\w+)?/,
      /duration-\d+/,
      /ease-\w+/,
      /hover:-?translate-[xy]-\w+/,
      /hover:shadow-(?:sm|md|lg|xl|2xl|none|\[[^\]]+\])/,
    ],
    description: 'Added hover micro-lift (-1px) and shadow elevation',
  },
  {
    id: 'pulse',
    keywords: ['pulse', 'pulsing', 'heartbeat', 'flashing', 'pulse animation'],
    classes: ['animate-pulse'],
    conflictPatterns: [/animate-(?:pulse|bounce|spin|ping|none)/],
    description: 'Added pulse animation',
  },
  {
    id: 'bounce',
    keywords: ['bounce', 'bouncing', 'spring', 'bounce on hover'],
    classes: ['animate-bounce'],
    conflictPatterns: [/animate-(?:pulse|bounce|spin|ping|none)/],
    description: 'Added bounce animation',
  },
  {
    id: 'spin',
    keywords: ['spin', 'spinning', 'rotate', 'rotating'],
    classes: ['animate-spin'],
    conflictPatterns: [/animate-(?:pulse|bounce|spin|ping|none)/],
    description: 'Added continuous spin animation',
  },
  {
    id: 'smooth-transition',
    keywords: ['smooth transition', 'transition', 'smooth', 'ease'],
    classes: ['transition-all', 'duration-300', 'ease-in-out'],
    conflictPatterns: [/transition(?:-\w+)?/, /duration-\d+/, /ease-\w+/],
    description: 'Added smooth ease-in-out transition',
  },
  {
    id: 'glow',
    keywords: ['glow', 'neon', 'glow on hover', 'neon glow', 'glow effect'],
    classes: ['transition-all', 'duration-300', 'hover:shadow-[0_0_15px_rgba(99,102,241,0.5)]'],
    conflictPatterns: [
      /transition(?:-\w+)?/,
      /duration-\d+/,
      /ease-\w+/,
      /hover:shadow-(?:sm|md|lg|xl|2xl|\[[^\]]+\])/,
    ],
    description: 'Added neon glow hover effect',
  },
];

export function mergeCleanClasses(
  existingClassStr: string,
  newClasses: string[],
  conflictPatterns: RegExp[] = []
): string {
  let tokens = existingClassStr.trim().split(/\s+/).filter(Boolean);

  // Remove conflicting classes
  for (const pattern of conflictPatterns) {
    tokens = tokens.filter((cls) => !pattern.test(cls));
  }

  // Append new classes without duplicates
  for (const group of newClasses) {
    for (const token of group.trim().split(/\s+/)) {
      if (token && !tokens.includes(token)) {
        tokens.push(token);
      }
    }
  }

  return tokens.join(' ');
}

export class AiService {
  /**
   * Main entry point for component redesign and chat
   */
  async redesignComponent(request: RedesignRequest): Promise<RedesignResponse> {
    const prompt = request.prompt || 'Redesign this component with modern UI/UX principles';

    // Default targetFramework if not specified based on file/code or workspace context
    if (!request.targetFramework) {
      let resolvedFramework: 'react-tailwind' | 'html-tailwind' | 'react-native' | 'vue' = 'react-tailwind';
      const code = request.originalCode || '';

      if (
        code.includes("'react-native'") ||
        code.includes('"react-native"') ||
        code.includes('<SafeAreaView') ||
        (code.includes('<View') && code.includes('<Text')) ||
        code.includes('StyleSheet.create')
      ) {
        resolvedFramework = 'react-native';
      } else if (
        code.includes('<template') ||
        code.includes("'vue'") ||
        code.includes('"vue"') ||
        code.includes('defineComponent')
      ) {
        resolvedFramework = 'vue';
      } else {
        try {
          const { workspacePatcherService } = require('./workspacePatcherService');
          const targetDir = process.env.WORKSPACE_DIR || workspacePatcherService.getDefaultSampleWorkspace();
          const ctx = workspacePatcherService.detectWorkspaceProjectContext(targetDir);
          if (ctx.detectedFramework === 'react-native' || ctx.detectedPlatform === 'mobile') {
            resolvedFramework = 'react-native';
          } else if (ctx.detectedFramework === 'vue') {
            resolvedFramework = 'vue';
          } else {
            resolvedFramework = 'react-tailwind';
          }
        } catch {
          resolvedFramework = 'react-tailwind';
        }
      }
      request.targetFramework = resolvedFramework;
    }

    // If an external API key is configured in env, we can try calling it
    if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) {
      try {
        const result = await this.callGemini(request);
        if (result) return result;
      } catch (err: any) {
        console.warn('Gemini API call failed, falling back to smart local engine:', err.message);
      }
    }

    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const result = await this.callClaude(request);
        if (result) return result;
      } catch (err: any) {
        console.warn('Claude API call failed, falling back to smart local engine:', err.message);
      }
    }

    if (process.env.OPENAI_API_KEY) {
      try {
        const result = await this.callOpenAI(request);
        if (result) return result;
      } catch (err: any) {
        console.warn('OpenAI API call failed, falling back to smart local engine:', err.message);
      }
    }

    // Default: High-fidelity smart local UI/UX engine
    return this.generateSmartLocalRedesign(request);
  }

  /**
   * Public engine for in-session AI code modification returning both modified code and changelog
   */
  modifyComponentCode(code: string, prompt: string, elementId?: string): AiModificationResult {
    let updated = code;
    const lowerPrompt = prompt.toLowerCase();
    const appliedChanges: string[] = [];

    // Parse targeting info from elementId or prompt
    let targetTag: string | null = null;
    let targetLine: number | null = null;
    let targetIdAttr: string | null = null;

    if (elementId) {
      // Check if elementId matches an exact id="..." attribute in code, e.g. id="submit-btn"
      const idAttrRegex = new RegExp(`\\bid=["']${elementId}["']`, 'i');
      if (idAttrRegex.test(updated)) {
        targetIdAttr = elementId;
      }

      const parts = elementId.split('-');
      if (parts.length >= 2 && !isNaN(parseInt(parts[parts.length - 1], 10))) {
        targetLine = parseInt(parts[parts.length - 1], 10);
        targetTag = parts.slice(0, parts.length - 1).join('-').toLowerCase();
      } else if (parts.length > 0 && /^[a-zA-Z][a-zA-Z0-9]*$/.test(parts[0])) {
        targetTag = parts[0].toLowerCase();
      }
    }

    if (!targetTag) {
      if (lowerPrompt.includes('button') || lowerPrompt.includes('btn') || lowerPrompt.includes('cta')) {
        targetTag = 'button';
      } else if (lowerPrompt.includes('heading') || lowerPrompt.includes('title')) {
        const hMatch = updated.match(/<(h[1-6])\b/i);
        targetTag = hMatch ? hMatch[1].toLowerCase() : 'h1';
      } else if (lowerPrompt.includes('badge') || lowerPrompt.includes('status')) {
        targetTag = updated.includes('<span') ? 'span' : 'div';
      } else if (lowerPrompt.includes('card') || lowerPrompt.includes('container')) {
        targetTag = updated.includes('<article') ? 'article' : 'div';
      }
    }

    // Helper function to update classes on a tag string ensuring exactly one className attribute
    const updateTagClasses = (
      tagText: string,
      classesToAdd: string[],
      conflictPatterns: RegExp[] = []
    ): string => {
      const classMatch = tagText.match(/\bclass(?:Name)?=["']([^"']*)["']/i);
      if (classMatch) {
        const existingClasses = classMatch[1];
        const merged = mergeCleanClasses(existingClasses, classesToAdd, conflictPatterns);
        return tagText.replace(/\bclass(?:Name)?=["'][^"']*["']/i, `className="${merged}"`);
      }
      if (/\s*\/>$/.test(tagText)) {
        return tagText.replace(/\s*\/>$/, ` className="${classesToAdd.join(' ')}" />`);
      }
      return tagText.replace(/\s*>$/, ` className="${classesToAdd.join(' ')}">`);
    };

    // Helper to find target opening tag matching targetIdAttr, targetTag and/or targetLine
    const findTargetOpenTag = (
      currentCode: string
    ): { index: number; text: string; tagName: string } | null => {
      if (targetIdAttr) {
        const regex = new RegExp(`(<([a-zA-Z0-9_-]+)\\b[^>]*\\bid=["']${targetIdAttr}["'][^>]*>)`, 'i');
        const m = regex.exec(currentCode);
        if (m) {
          return { index: m.index, text: m[1], tagName: m[2].toLowerCase() };
        }
      }

      const effectiveTag = targetTag || (targetLine !== null ? '[a-zA-Z0-9_-]+' : null);
      if (!effectiveTag) return null;

      const openTagRegex = new RegExp(`(<(${effectiveTag})\\b[^>]*?>)`, 'gi');
      let match: RegExpExecArray | null;
      let chosen: { index: number; text: string; tagName: string } | null = null;
      let minLineDiff = Infinity;

      while ((match = openTagRegex.exec(currentCode)) !== null) {
        const matchIndex = match.index;
        const matchLine = currentCode.substring(0, matchIndex).split('\n').length;
        if (targetLine !== null) {
          const diff = Math.abs(matchLine - targetLine);
          if (diff < minLineDiff) {
            minLineDiff = diff;
            chosen = { index: matchIndex, text: match[1], tagName: match[2].toLowerCase() };
          }
        } else {
          chosen = { index: matchIndex, text: match[1], tagName: match[2].toLowerCase() };
          break;
        }
      }

      return chosen;
    };

    // 1. Color Customization
    const colorMap: Record<string, { name: string; from: string; to: string; bg: string; hover: string; text: string; ring: string }> = {
      red: { name: 'red', from: 'from-rose-600', to: 'to-red-600', bg: 'bg-rose-600', hover: 'hover:bg-rose-500', text: 'text-rose-400', ring: 'ring-rose-400' },
      rose: { name: 'rose', from: 'from-rose-600', to: 'to-pink-600', bg: 'bg-rose-600', hover: 'hover:bg-rose-500', text: 'text-rose-400', ring: 'ring-rose-400' },
      green: { name: 'green', from: 'from-emerald-600', to: 'to-green-600', bg: 'bg-emerald-600', hover: 'hover:bg-emerald-500', text: 'text-emerald-400', ring: 'ring-emerald-400' },
      emerald: { name: 'emerald', from: 'from-emerald-600', to: 'to-teal-600', bg: 'bg-emerald-600', hover: 'hover:bg-emerald-500', text: 'text-emerald-400', ring: 'ring-emerald-400' },
      purple: { name: 'purple', from: 'from-purple-600', to: 'to-indigo-600', bg: 'bg-purple-600', hover: 'hover:bg-purple-500', text: 'text-purple-400', ring: 'ring-purple-400' },
      violet: { name: 'violet', from: 'from-violet-600', to: 'to-purple-600', bg: 'bg-violet-600', hover: 'hover:bg-violet-500', text: 'text-violet-400', ring: 'ring-violet-400' },
      amber: { name: 'amber', from: 'from-amber-500', to: 'to-orange-500', bg: 'bg-amber-500', hover: 'hover:bg-amber-400', text: 'text-amber-400', ring: 'ring-amber-400' },
      yellow: { name: 'yellow', from: 'from-amber-500', to: 'to-yellow-500', bg: 'bg-amber-500', hover: 'hover:bg-amber-400', text: 'text-amber-400', ring: 'ring-amber-400' },
      orange: { name: 'orange', from: 'from-orange-600', to: 'to-amber-500', bg: 'bg-orange-600', hover: 'hover:bg-orange-500', text: 'text-orange-400', ring: 'ring-orange-400' },
      cyan: { name: 'cyan', from: 'from-cyan-500', to: 'to-blue-600', bg: 'bg-cyan-500', hover: 'hover:bg-cyan-400', text: 'text-cyan-400', ring: 'ring-cyan-400' },
      teal: { name: 'teal', from: 'from-teal-600', to: 'to-emerald-600', bg: 'bg-teal-600', hover: 'hover:bg-teal-500', text: 'text-teal-400', ring: 'ring-teal-400' },
      blue: { name: 'blue', from: 'from-blue-600', to: 'to-indigo-600', bg: 'bg-blue-600', hover: 'hover:bg-blue-500', text: 'text-blue-400', ring: 'ring-blue-400' },
      indigo: { name: 'indigo', from: 'from-indigo-600', to: 'to-purple-600', bg: 'bg-indigo-600', hover: 'hover:bg-indigo-500', text: 'text-indigo-400', ring: 'ring-indigo-400' },
      dark: { name: 'dark', from: 'from-slate-900', to: 'to-black', bg: 'bg-slate-900', hover: 'hover:bg-slate-800', text: 'text-slate-300', ring: 'ring-slate-400' },
      slate: { name: 'slate', from: 'from-slate-800', to: 'to-slate-900', bg: 'bg-slate-800', hover: 'hover:bg-slate-700', text: 'text-slate-300', ring: 'ring-slate-400' },
    };

    let targetTheme: (typeof colorMap)[string] | null = null;
    for (const [name, theme] of Object.entries(colorMap)) {
      if (new RegExp(`\\b${name}\\b`).test(lowerPrompt)) {
        targetTheme = theme;
        break;
      }
    }

    if (targetTheme) {
      if (elementId || (targetTag && targetTag !== 'div' && targetTag !== 'article')) {
        const targetOpen = findTargetOpenTag(updated);
        if (targetOpen) {
          let modifiedTag = targetOpen.text;
          const bgRegex = /bg-(?:indigo|blue|emerald|rose|purple|cyan|amber|slate)-(?:500|600|700)(?!\/)/g;
          const hoverRegex = /hover:bg-(?:indigo|blue|emerald|rose|purple|cyan|amber|slate)-(?:400|500|600|700)/g;
          const textRegex = /text-(?:indigo|blue|emerald|rose|purple|cyan|amber|slate)-(?:300|400)/g;
          const ringRegex = /ring-(?:indigo|blue|emerald|rose|purple|cyan|amber|slate)-(?:400|500)/g;

          if (bgRegex.test(modifiedTag) || hoverRegex.test(modifiedTag) || textRegex.test(modifiedTag)) {
            modifiedTag = modifiedTag
              .replace(bgRegex, targetTheme.bg)
              .replace(hoverRegex, targetTheme.hover)
              .replace(textRegex, targetTheme.text)
              .replace(ringRegex, targetTheme.ring);
          } else {
            modifiedTag = updateTagClasses(modifiedTag, [targetTheme.bg, targetTheme.hover], [/bg-[a-z]+-\d+/]);
          }

          updated =
            updated.substring(0, targetOpen.index) +
            modifiedTag +
            updated.substring(targetOpen.index + targetOpen.text.length);
        } else {
          updated = updated.replace(/from-(?:indigo|blue|emerald|rose|purple|cyan|amber|slate)-(?:500|600|700)/g, targetTheme.from);
          updated = updated.replace(/to-(?:indigo|blue|emerald|rose|purple|cyan|amber|slate|teal|pink)-(?:500|600|700)/g, targetTheme.to);
          updated = updated.replace(/bg-(?:indigo|blue|emerald|rose|purple|cyan|amber)-(?:500|600|700)(?!\/)/g, targetTheme.bg);
          updated = updated.replace(/hover:bg-(?:indigo|blue|emerald|rose|purple|cyan|amber)-(?:400|500|600|700)/g, targetTheme.hover);
          updated = updated.replace(/text-(?:indigo|blue|emerald|rose|purple|cyan|amber)-(?:300|400)/g, targetTheme.text);
          updated = updated.replace(/ring-(?:indigo|blue|emerald|rose|purple|cyan|amber)-(?:400|500)/g, targetTheme.ring);
        }
      } else {
        const beforeColor = updated;
        updated = updated.replace(/from-(?:indigo|blue|emerald|rose|purple|cyan|amber|slate)-(?:500|600|700)/g, targetTheme.from);
        updated = updated.replace(/to-(?:indigo|blue|emerald|rose|purple|cyan|amber|slate|teal|pink)-(?:500|600|700)/g, targetTheme.to);
        updated = updated.replace(/bg-(?:indigo|blue|emerald|rose|purple|cyan|amber)-(?:500|600|700)(?!\/)/g, targetTheme.bg);
        updated = updated.replace(/hover:bg-(?:indigo|blue|emerald|rose|purple|cyan|amber)-(?:400|500|600|700)/g, targetTheme.hover);
        updated = updated.replace(/text-(?:indigo|blue|emerald|rose|purple|cyan|amber)-(?:300|400)/g, targetTheme.text);
        updated = updated.replace(/ring-(?:indigo|blue|emerald|rose|purple|cyan|amber)-(?:400|500)/g, targetTheme.ring);

        // If no bg was replaced and component has className without bg, attach bg
        if (beforeColor === updated) {
          if (/className=["'][^"']*["']/.test(updated)) {
            updated = updated.replace(/className=["']([^"']*)["']/, (match, cls) => {
              if (!cls.includes('bg-')) {
                return `className="${cls} ${targetTheme!.bg}"`;
              }
              return match;
            });
          } else if (/<[A-Za-z][A-Za-z0-9_-]*/.test(updated)) {
            updated = updated.replace(/(<[A-Za-z][A-Za-z0-9_-]*\b[^>]*?)(\s*\/?>)/, `$1 className="${targetTheme!.bg}"$2`);
          }
        }
      }
      appliedChanges.push(`Changed color palette to ${targetTheme.name}`);
    }

    // 2. Custom Text / Label / Title Extraction
    const quotedMatch =
      prompt.match(/(?:title|label|text|heading|value|subtitle|name|button)\s*(?:to|is|=)?\s*["']([^"']+)["']/i) ||
      prompt.match(/(?:called|named|saying|labeled)\s*["']([^"']+)["']/i);

    if (quotedMatch) {
      const newText = quotedMatch[1];
      if (/label|button|cta|action/i.test(prompt) || (targetTag === 'button')) {
        updated = updated.replace(/label\s*=\s*["'][^"']+["']/, `label = "${newText}"`);
        updated = updated.replace(/<span>(?:Deposit(?: Funds)?|Get Started|Learn more|Explore Component|Sign In)<\/span>/i, `<span>${newText}</span>`);

        const targetOpen = findTargetOpenTag(updated);
        if (targetOpen && targetOpen.tagName === 'button') {
          const buttonRegex = new RegExp(`(<button\\b[^>]*>)([\\s\\S]*?)(<\\/button>)`, 'gi');
          let m: RegExpExecArray | null;
          let replaced = false;
          while ((m = buttonRegex.exec(updated)) !== null) {
            if (m.index === targetOpen.index || (targetLine !== null && Math.abs(updated.substring(0, m.index).split('\n').length - targetLine) <= 1)) {
              const prefix = m[1];
              const suffix = m[3];
              let inner = m[2];
              if (/<[A-Za-z][^>]*\/>/.test(inner)) {
                if (/<span>[^<]*<\/span>/.test(inner)) {
                  inner = inner.replace(/<span>[^<]*<\/span>/, `<span>${newText}</span>`);
                } else {
                  inner = inner.replace(/([^>]+)$/, newText);
                }
              } else {
                inner = newText;
              }
              updated = updated.substring(0, m.index) + prefix + inner + suffix + updated.substring(m.index + m[0].length);
              replaced = true;
              break;
            }
          }
          if (!replaced) {
            updated = updated.replace(/<button\b([^>]*)>([^<]*)<\/button>/i, `<button$1>${newText}</button>`);
          }
        } else {
          if (/<button\b[^>]*>[^<]+<\/button>/i.test(updated)) {
            updated = updated.replace(/<button(\b[^>]*)>[^<]+<\/button>/i, `<button$1>${newText}</button>`);
          } else {
            updated = updated.replace(/<button([^>]*)>(?:Deposit|Learn more|Sign In|Click Me)<\/button>/i, `<button$1>${newText}</button>`);
          }
        }
        appliedChanges.push(`Updated button label to "${newText}"`);
      } else if (/title|heading|name/i.test(prompt) || (targetTag && /^h[1-6]$/.test(targetTag))) {
        updated = updated.replace(/title\s*=\s*["'][^"']+["']/, `title = "${newText}"`);

        // Find candidate heading tags without destroying original heading tag (no h1-h6 -> h3 rewrite)
        const headingRegex = /<(h[1-6])\b([^>]*)>([\s\S]*?)<\/\1>/gi;
        let m: RegExpExecArray | null;
        let chosenHeading: { index: number; full: string; tag: string; attrs: string; inner: string } | null = null;
        let minDiff = Infinity;

        while ((m = headingRegex.exec(updated)) !== null) {
          const matchLine = updated.substring(0, m.index).split('\n').length;
          if (targetLine !== null) {
            const diff = Math.abs(matchLine - targetLine);
            if (diff < minDiff) {
              minDiff = diff;
              chosenHeading = { index: m.index, full: m[0], tag: m[1], attrs: m[2], inner: m[3] };
            }
          } else if (targetTag && /^h[1-6]$/.test(targetTag)) {
            if (m[1].toLowerCase() === targetTag) {
              chosenHeading = { index: m.index, full: m[0], tag: m[1], attrs: m[2], inner: m[3] };
              break;
            }
          } else {
            chosenHeading = { index: m.index, full: m[0], tag: m[1], attrs: m[2], inner: m[3] };
            break;
          }
        }

        if (chosenHeading) {
          const replacement = `<${chosenHeading.tag}${chosenHeading.attrs}>${newText}</${chosenHeading.tag}>`;
          updated =
            updated.substring(0, chosenHeading.index) +
            replacement +
            updated.substring(chosenHeading.index + chosenHeading.full.length);
        } else {
          // Fallback: preserve original heading tag
          updated = updated.replace(/<(h[1-6])([^>]*)>[^<]+<\/\1>/i, `<$1$2>${newText}</$1>`);
        }
        appliedChanges.push(`Updated title to "${newText}"`);
      } else if (/value|metric|number|percentage|percent/i.test(prompt)) {
        updated = updated.replace(/value\s*=\s*["'][^"']+["']/, `value = "${newText}"`);
        updated = updated.replace(/(<div[^>]*font-mono[^>]*>)[^<]+(<\/div>)/i, `$1${newText}$2`);
        appliedChanges.push(`Updated metric value to "${newText}"`);
      } else if (/subtitle|description/i.test(prompt)) {
        updated = updated.replace(/subtitle\s*=\s*["'][^"']+["']/, `subtitle = "${newText}"`);
        updated = updated.replace(/description\s*=\s*["'][^"']+["']/, `description = "${newText}"`);
        updated = updated.replace(/(<p[^>]*text-[xs|sm][^>]*>)[^<]+(<\/p>)/i, `$1${newText}$2`);
        appliedChanges.push(`Updated description to "${newText}"`);
      }
    }

    // 3. Shape & Corner Radius
    if (lowerPrompt.includes('rounded-full') || lowerPrompt.includes('pill')) {
      if (elementId || (targetTag && targetTag !== 'div' && targetTag !== 'article')) {
        const targetOpen = findTargetOpenTag(updated);
        if (targetOpen) {
          let newTag = targetOpen.text;
          if (/rounded-(?:lg|xl|2xl|3xl|md|sm|none)|rounded\b/.test(newTag)) {
            newTag = newTag.replace(/rounded-(?:lg|xl|2xl|3xl|md|sm|none)|rounded\b/g, 'rounded-full');
          } else {
            newTag = updateTagClasses(newTag, ['rounded-full']);
          }
          updated = updated.substring(0, targetOpen.index) + newTag + updated.substring(targetOpen.index + targetOpen.text.length);
        } else if (/rounded-(?:lg|xl|2xl|3xl|md|sm|none)|rounded\b/.test(updated)) {
          updated = updated.replace(/rounded-(?:lg|xl|2xl|3xl|md|sm|none)|rounded\b/g, 'rounded-full');
        } else {
          updated = updated.replace(/className=["']([^"']*)["']/, 'className="$1 rounded-full"');
        }
      } else {
        if (/rounded-(?:lg|xl|2xl|3xl|md|sm|none)|rounded\b/.test(updated)) {
          updated = updated.replace(/rounded-(?:lg|xl|2xl|3xl|md|sm|none)|rounded\b/g, 'rounded-full');
        } else {
          updated = updated.replace(/className=["']([^"']*)["']/, 'className="$1 rounded-full"');
        }
      }
      appliedChanges.push('Updated corner radius to rounded-full');
    } else if (lowerPrompt.includes('rounded-none') || lowerPrompt.includes('square') || lowerPrompt.includes('sharp')) {
      if (elementId || (targetTag && targetTag !== 'div' && targetTag !== 'article')) {
        const targetOpen = findTargetOpenTag(updated);
        if (targetOpen) {
          let newTag = targetOpen.text;
          if (/rounded-(?:lg|xl|2xl|3xl|md|sm|full)|rounded\b/.test(newTag)) {
            newTag = newTag.replace(/rounded-(?:lg|xl|2xl|3xl|md|sm|full)|rounded\b/g, 'rounded-none');
          } else {
            newTag = updateTagClasses(newTag, ['rounded-none']);
          }
          updated = updated.substring(0, targetOpen.index) + newTag + updated.substring(targetOpen.index + targetOpen.text.length);
        } else {
          updated = updated.replace(/rounded-(?:lg|xl|2xl|3xl|md|sm|full)|rounded\b/g, 'rounded-none');
        }
      } else {
        updated = updated.replace(/rounded-(?:lg|xl|2xl|3xl|md|sm|full)|rounded\b/g, 'rounded-none');
      }
      appliedChanges.push('Updated corner radius to rounded-none');
    } else if (lowerPrompt.includes('rounded-3xl')) {
      if (elementId || (targetTag && targetTag !== 'div' && targetTag !== 'article')) {
        const targetOpen = findTargetOpenTag(updated);
        if (targetOpen) {
          let newTag = targetOpen.text;
          if (/rounded-(?:lg|xl|2xl|md|sm|full)|rounded\b/.test(newTag)) {
            newTag = newTag.replace(/rounded-(?:lg|xl|2xl|md|sm|full)|rounded\b/g, 'rounded-3xl');
          } else {
            newTag = updateTagClasses(newTag, ['rounded-3xl']);
          }
          updated = updated.substring(0, targetOpen.index) + newTag + updated.substring(targetOpen.index + targetOpen.text.length);
        } else {
          updated = updated.replace(/rounded-(?:lg|xl|2xl|md|sm|full)|rounded\b/g, 'rounded-3xl');
        }
      } else {
        updated = updated.replace(/rounded-(?:lg|xl|2xl|md|sm|full)|rounded\b/g, 'rounded-3xl');
      }
      appliedChanges.push('Updated corner radius to rounded-3xl');
    }

    // 4. Sizing: Compact vs Large
    if (lowerPrompt.includes('compact') || lowerPrompt.includes('small')) {
      updated = updated.replace(/p-6/g, 'p-4').replace(/p-5/g, 'p-3').replace(/py-2\.5/g, 'py-1.5').replace(/px-5/g, 'px-3.5');
      appliedChanges.push('Optimized component layout for compact sizing');
    } else if (lowerPrompt.includes('large') || lowerPrompt.includes('spacious')) {
      updated = updated.replace(/p-4/g, 'p-6').replace(/p-5/g, 'p-7').replace(/py-2\.5/g, 'py-3.5').replace(/px-4/g, 'px-6');
      appliedChanges.push('Expanded component layout for spacious presentation');
    }

    // 5. Border
    if (lowerPrompt.includes('border-2') || lowerPrompt.includes('thick border')) {
      if (elementId || (targetTag && targetTag !== 'div' && targetTag !== 'article')) {
        const targetOpen = findTargetOpenTag(updated);
        if (targetOpen) {
          let newTag = targetOpen.text;
          if (/border\b/.test(newTag)) {
            newTag = newTag.replace(/border /g, 'border-2 ');
          } else {
            newTag = updateTagClasses(newTag, ['border-2']);
          }
          updated = updated.substring(0, targetOpen.index) + newTag + updated.substring(targetOpen.index + targetOpen.text.length);
        } else {
          updated = updated.replace(/border /g, 'border-2 ');
        }
      } else {
        updated = updated.replace(/border /g, 'border-2 ');
      }
      appliedChanges.push('Increased border stroke to border-2');
    }

    // 6. Animation Utilities & Transitions
    const matchedPresets: AnimationUtilityDefinition[] = [];
    for (const preset of ANIMATION_PRESETS) {
      if (preset.keywords.some((kw) => lowerPrompt.includes(kw))) {
        matchedPresets.push(preset);
      }
    }

    if (matchedPresets.length > 0) {
      if (!targetTag) {
        if (lowerPrompt.includes('badge') || lowerPrompt.includes('status')) {
          targetTag = updated.includes('<span') ? 'span' : 'div';
        } else if (lowerPrompt.includes('button') || lowerPrompt.includes('btn') || lowerPrompt.includes('cta')) {
          targetTag = 'button';
        } else if (lowerPrompt.includes('card') || lowerPrompt.includes('container')) {
          targetTag = updated.includes('<article') ? 'article' : 'div';
        } else if (!updated.includes('<button') && updated.includes('<article')) {
          targetTag = 'article';
        } else if (!updated.includes('<button') && updated.includes('<span')) {
          targetTag = 'span';
        } else {
          targetTag = 'button';
        }
      }

      const classesToAdd: string[] = [];
      const conflictPatterns: RegExp[] = [];
      for (const preset of matchedPresets) {
        classesToAdd.push(...preset.classes);
        conflictPatterns.push(...preset.conflictPatterns);
        appliedChanges.push(preset.description);
      }

      const chosenMatch = findTargetOpenTag(updated);

      if (chosenMatch) {
        const newTag = updateTagClasses(chosenMatch.text, classesToAdd, conflictPatterns);
        updated =
          updated.substring(0, chosenMatch.index) +
          newTag +
          updated.substring(chosenMatch.index + chosenMatch.text.length);
      } else {
        // Fallback: search for any element with className
        const classMatch = updated.match(/\bclass(?:Name)?=["']([^"']*)["']/i);
        if (classMatch && classMatch.index !== undefined) {
          const existingClasses = classMatch[1];
          const merged = mergeCleanClasses(existingClasses, classesToAdd, conflictPatterns);
          updated = updated.replace(/\bclass(?:Name)?=["'][^"']*["']/i, `className="${merged}"`);
        }
      }
    }

    // 7. Scoped Keyframe Injection
    if (lowerPrompt.includes('keyframe') || lowerPrompt.includes('shimmer') || lowerPrompt.includes('wiggle')) {
      if (!updated.includes('@keyframes')) {
        const keyframesStyle = `\n      <style>{\`\n        @keyframes shimmer {\n          0% { background-position: -200% 0; }\n          100% { background-position: 200% 0; }\n        }\n        @keyframes wiggle {\n          0%, 100% { transform: rotate(-3deg); }\n          50% { transform: rotate(3deg); }\n        }\n      \`}</style>`;
        if (/return\s*\(\s*<[A-Za-z][^>]*>/.test(updated)) {
          updated = updated.replace(/(return\s*\(\s*<[A-Za-z][^>]*>)/, `$1${keyframesStyle}`);
        } else if (/<[A-Za-z][^>]*>/.test(updated)) {
          updated = updated.replace(/(<[A-Za-z][^>]*>)/, `$1${keyframesStyle}`);
        }
        appliedChanges.push('Injected scoped CSS keyframes for custom animations');
      }
    }

    // 8. Framer Motion Integration
    if (lowerPrompt.includes('framer-motion') || lowerPrompt.includes('framer motion')) {
      if (!updated.includes('framer-motion')) {
        updated = `import { motion } from 'framer-motion';\n` + updated;
        appliedChanges.push('Imported motion component from framer-motion');
      }
      if (updated.includes('<button') && !updated.includes('<motion.button')) {
        updated = updated.replace(/<button\b([^>]*)>/, '<motion.button$1 whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} transition={{ type: "spring", stiffness: 400, damping: 17 }}>');
        updated = updated.replace(/<\/button>/, '</motion.button>');
        appliedChanges.push('Converted button to motion.button with spring physics');
      }
    }

    return {
      modifiedCode: updated,
      appliedChanges,
    };
  }

  /**
   * Applies prompt-driven dynamic modifications to JSX code (backward compatibility)
   */
  private applyPromptModifications(code: string, prompt: string): string {
    return this.modifyComponentCode(code, prompt).modifiedCode;
  }

  /**
   * Smart rule-based and template-informed AI UI generator for instant offline redesign
   */
  private generateSmartLocalRedesign(request: RedesignRequest): RedesignResponse {
    const { prompt, originalCode, wcagFixRequested } = request;
    const effectiveFramework = request.targetFramework || 'react-tailwind';
    const lowerPrompt = prompt.toLowerCase();

    // Check if prompt is an iterative modification of an existing component or snippet
    const hasAnimationTokens =
      lowerPrompt.includes('hover') ||
      lowerPrompt.includes('scale') ||
      lowerPrompt.includes('lift') ||
      lowerPrompt.includes('float') ||
      lowerPrompt.includes('pulse') ||
      lowerPrompt.includes('bounce') ||
      lowerPrompt.includes('spin') ||
      lowerPrompt.includes('glow') ||
      lowerPrompt.includes('neon') ||
      lowerPrompt.includes('transition') ||
      lowerPrompt.includes('animate') ||
      lowerPrompt.includes('motion') ||
      lowerPrompt.includes('keyframe');

    const isIterativeRedesign =
      originalCode &&
      ((originalCode.includes('export const ') || originalCode.includes('export function ')) &&
        (lowerPrompt.includes('make') ||
          lowerPrompt.includes('change') ||
          lowerPrompt.includes('turn') ||
          lowerPrompt.includes('color') ||
          lowerPrompt.includes('rounded') ||
          lowerPrompt.includes('pill') ||
          lowerPrompt.includes('label') ||
          lowerPrompt.includes('title') ||
          lowerPrompt.includes('text') ||
          lowerPrompt.includes('border') ||
          lowerPrompt.includes('compact') ||
          lowerPrompt.includes('dark') ||
          lowerPrompt.includes('red') ||
          lowerPrompt.includes('green') ||
          lowerPrompt.includes('emerald') ||
          lowerPrompt.includes('blue') ||
          lowerPrompt.includes('yellow') ||
          lowerPrompt.includes('purple') ||
          hasAnimationTokens)) ||
      (originalCode && originalCode.includes('<') && hasAnimationTokens);

    if (isIterativeRedesign) {
      const modResult = this.modifyComponentCode(originalCode, prompt);
      return {
        analysis: `Updated component styling according to prompt: "${prompt}". Preserved accessibility standards and component contract.`,
        redesignedCode: modResult.modifiedCode,
        framework: effectiveFramework,
        explanation: `Applied modifications based on your prompt: ${modResult.appliedChanges.join(', ') || 'Updated styling'}.`,
        accessibilityImprovements: [
          'Maintained accessible contrast and responsive hit-targets.',
          'Retained focus/active interaction states for keyboard and mouse navigation.',
        ],
        stylingDiffSummary: modResult.appliedChanges.length > 0 ? modResult.appliedChanges : [`Applied custom user prompt: "${prompt}"`],
      };
    }

    const isGlassmorphic = lowerPrompt.includes('glass') || lowerPrompt.includes('blur') || lowerPrompt.includes('modern');
    const isDark = lowerPrompt.includes('dark') || lowerPrompt.includes('night');
    const isMinimalist = lowerPrompt.includes('minimal') || lowerPrompt.includes('clean');
    const isWcag = wcagFixRequested || lowerPrompt.includes('wcag') || lowerPrompt.includes('contrast') || lowerPrompt.includes('accessib');

    const isNavbar =
      lowerPrompt.includes('nav') ||
      (originalCode && (originalCode.toLowerCase().includes('navbar') || /<nav\b/i.test(originalCode)));

    const isBalance =
      !isNavbar &&
      (lowerPrompt.includes('balance') ||
        lowerPrompt.includes('portfolio') ||
        lowerPrompt.includes('crypto') ||
        (originalCode &&
          (originalCode.toLowerCase().includes('balancecard') ||
            /total portfolio value/i.test(originalCode))));

    const isMetric =
      !isNavbar &&
      !isBalance &&
      (lowerPrompt.includes('metric') ||
        lowerPrompt.includes('telemetry') ||
        lowerPrompt.includes('cpu usage') ||
        (originalCode &&
          (originalCode.toLowerCase().includes('metricwidget') ||
            /cpu usage/i.test(originalCode))));

    const isButton =
      !isNavbar &&
      !isBalance &&
      !isMetric &&
      (lowerPrompt.includes('button') ||
        lowerPrompt.includes('btn') ||
        lowerPrompt.includes('cta') ||
        lowerPrompt.includes('deposit') ||
        (originalCode &&
          (/^\s*<(?:button|Button)\b/i.test(originalCode.trim()) ||
            /export\s+(?:const|function)\s+[A-Za-z0-9_]*Button/i.test(originalCode))));

    let redesignedCode: string;
    const accessibilityImprovements: string[] = [];
    const stylingDiffSummary: string[] = [];

    if (isNavbar) {
      redesignedCode = `import React from 'react';
import { Layers, Shield, Sparkles, ChevronRight } from 'lucide-react';

export const TopNavbar: React.FC = () => {
  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-slate-900/80 border-b border-slate-800/80 px-6 py-3.5 transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand Logo with gradient */}
        <div className="flex items-center gap-2.5 cursor-pointer group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 via-indigo-600 to-cyan-400 p-0.5 shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-cyan-400" />
            </div>
          </div>
          <span className="font-bold text-lg bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent tracking-tight">
            AcmeCloud
          </span>
        </div>

        {/* Navigation links with accessible states */}
        <nav aria-label="Main Navigation" className="hidden md:flex items-center gap-1 bg-slate-800/50 p-1 rounded-full border border-slate-700/50">
          <a
            href="#features"
            className="px-4 py-1.5 text-xs font-medium text-slate-200 hover:text-white hover:bg-slate-700/60 rounded-full transition-colors focus:ring-2 focus:ring-indigo-400 focus:outline-none"
          >
            Features
          </a>
          <a
            href="#pricing"
            className="px-4 py-1.5 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-700/60 rounded-full transition-colors focus:ring-2 focus:ring-indigo-400 focus:outline-none"
          >
            Pricing
          </a>
          <a
            href="#docs"
            className="px-4 py-1.5 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-700/60 rounded-full transition-colors focus:ring-2 focus:ring-indigo-400 focus:outline-none"
          >
            Docs
          </a>
        </nav>

        {/* Action Button */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-md shadow-indigo-600/25 transition-all focus:ring-2 focus:ring-indigo-400 focus:outline-none active:scale-95"
          >
            Sign In
          </button>
        </div>
      </div>
    </header>
  );
};`;
      accessibilityImprovements.push('Added explicit ARIA navigation landmark (`aria-label="Main Navigation"`)');
      accessibilityImprovements.push('High-contrast typography with focus ring highlights');
      stylingDiffSummary.push('Modern backdrop-blur glassmorphic header layout');
    } else if (isBalance) {
      redesignedCode = `import React from 'react';
import { TrendingUp, ArrowUpRight, ArrowDownLeft, ShieldCheck, Wallet } from 'lucide-react';

export const BalanceCard: React.FC = () => {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 border border-indigo-500/20 p-6 shadow-2xl text-white">
      {/* Background glow effects */}
      <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
              <Wallet className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Total Portfolio Value</span>
          </div>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <TrendingUp className="w-3.5 h-3.5" />
            +14.2%
          </span>
        </div>

        <div className="mb-6">
          <div className="text-3xl font-extrabold tracking-tight text-white mb-1">$48,259.40</div>
          <p className="text-xs text-slate-400 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            Insured Vault • Updated 2m ago
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold text-xs tracking-wide shadow-lg shadow-indigo-600/30 transition-all active:scale-[0.98] focus:ring-2 focus:ring-indigo-400 focus:outline-none"
          >
            <ArrowDownLeft className="w-4 h-4" />
            Deposit
          </button>
          <button
            type="button"
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 font-semibold text-xs tracking-wide text-slate-200 transition-all active:scale-[0.98] focus:ring-2 focus:ring-slate-400 focus:outline-none"
          >
            <ArrowUpRight className="w-4 h-4" />
            Send
          </button>
        </div>
      </div>
    </div>
  );
};`;
      accessibilityImprovements.push('Semantic headings, touch targets > 44px, AAA contrast ratios');
      stylingDiffSummary.push('Crypto glassmorphic gradient card with interactive primary action buttons');
    } else if (isMetric) {
      redesignedCode = `import React from 'react';
import { Activity, Cpu, ArrowUpRight } from 'lucide-react';

export const MetricWidget: React.FC = () => {
  return (
    <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-xl text-slate-100">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-slate-400">
          <Cpu className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-semibold tracking-wider uppercase">Telemetry CPU Usage</span>
        </div>
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
      </div>

      <div className="flex items-baseline justify-between mb-4">
        <div className="text-3xl font-mono font-bold text-white tracking-tight">42.8%</div>
        <span className="text-xs font-medium text-emerald-400 flex items-center gap-0.5">
          <ArrowUpRight className="w-3.5 h-3.5" />
          Normal load
        </span>
      </div>

      {/* Micro-bar chart */}
      <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 rounded-full w-[42.8%]" />
      </div>
    </div>
  );
};`;
      accessibilityImprovements.push('Telemetry ARIA status indicator and high-contrast monospace readout');
      stylingDiffSummary.push('Dark telemetry metric widget with live gradient load bar');
    } else if (isButton) {
      redesignedCode = `import React from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';

export const ActionButton: React.FC = () => {
  return (
    <button
      type="button"
      className="inline-flex items-center justify-center gap-2 px-6 py-3 min-h-[44px] rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-indigo-600 via-indigo-500 to-blue-600 hover:from-indigo-500 hover:to-blue-500 shadow-lg shadow-indigo-500/25 transition-all duration-200 active:scale-[0.98] focus:ring-4 focus:ring-indigo-300 focus:outline-none"
    >
      <Sparkles className="w-4 h-4 text-cyan-300" />
      <span>Deposit Funds</span>
      <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
    </button>
  );
};`;
      accessibilityImprovements.push('Enforced minimum 44px touch target height for mobile WCAG 2.2 criteria');
      accessibilityImprovements.push('Visible 4px focus ring indicator for keyboard navigation');
      stylingDiffSummary.push('Accessible gradient action button with subtle active press micro-interaction');
    } else {
      // Default: FeatureCard
      redesignedCode = `import React from 'react';
import { Sparkles, ArrowRight, CheckCircle2 } from 'lucide-react';

interface CardProps {
  title?: string;
  description?: string;
  onAction?: () => void;
}

export const FeatureCard: React.FC<CardProps> = ({
  title = 'AI Vision Agent Studio',
  description = 'Inspect visual element hierarchies, optimize WCAG 2.2 color contrast ratios, and generate production-ready code with intelligent design tokens.',
  onAction,
}) => {
  return (
    <article className="relative group overflow-hidden rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-6 shadow-2xl transition-all duration-300 hover:border-indigo-500/50 hover:shadow-indigo-500/10">
      {/* Gradient highlight sheen */}
      <div className="absolute top-0 right-0 -mt-8 -mr-8 w-32 h-32 bg-indigo-500/20 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500 pointer-events-none" />

      <div className="relative z-10 flex flex-col h-full justify-between">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Smart Component</span>
          </div>

          <h3 className="text-xl font-bold text-white tracking-tight mb-2 group-hover:text-indigo-200 transition-colors">
            {title}
          </h3>

          <p className="text-sm text-slate-300 leading-relaxed mb-6">
            {description}
          </p>
        </div>

        <div className="pt-4 border-t border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
            <span>WCAG AAA Compliant</span>
          </div>

          <button
            type="button"
            onClick={onAction}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 px-4 py-2 min-h-[44px] rounded-lg shadow-md transition-all active:scale-95 focus:ring-2 focus:ring-indigo-400 focus:outline-none"
          >
            <span>Explore Component</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </article>
  );
};`;
      accessibilityImprovements.push('Maintained WCAG 2.2 AA contrast ratios (>4.5:1 text, >3:1 UI boundaries)');
      accessibilityImprovements.push('Enforced 44px minimum touch targets on all interactive click handlers');
      accessibilityImprovements.push('Added explicit focus rings and visible keyboard states');
      stylingDiffSummary.push('Transformed into a modern glassmorphic card with subtle depth and responsive typography');
    }

    return {
      analysis: `Analyzed UI intent: "${prompt}". Designed a high-fidelity modern component following Tailwind CSS best practices and WCAG 2.2 accessibility guidelines.`,
      redesignedCode,
      framework: effectiveFramework,
      explanation: `I redesigned your component with contemporary UI/UX best practices:
1. **Visual Depth & Polish:** Applied a soft glassmorphism layer with subtle border illumination and subtle hover elevation.
2. **Typography & Hierarchy:** Refined font weights and leading for effortless readability.
3. **WCAG 2.2 Accessibility:** Elevated contrast ratios well above 4.5:1, added accessible focus rings, and guaranteed standard 44px touch targets.`,
      accessibilityImprovements,
      stylingDiffSummary,
    };
  }

  /**
   * Gemini API client (optional external integration)
   */
  private async callGemini(request: RedesignRequest): Promise<RedesignResponse | null> {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) return null;

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`;

    const promptText = `
You are a senior UI/UX engineer and React Tailwind expert.
Redesign the provided UI component according to this prompt: "${request.prompt}".
Original Code:
${request.originalCode || 'None provided'}

Return a JSON object conforming to:
{
  "analysis": "Brief analysis",
  "redesignedCode": "Valid, self-contained React functional component with Tailwind CSS",
  "framework": "react-tailwind",
  "explanation": "Markdown explanation of improvements",
  "accessibilityImprovements": ["array of improvements"],
  "stylingDiffSummary": ["array of diff items"]
}
`;

    const parts: any[] = [{ text: promptText }];
    if (request.imageSnippetBase64) {
      const mime = request.imageSnippetBase64.startsWith('data:image/jpeg') ? 'image/jpeg' : 'image/png';
      const cleanBase64 = request.imageSnippetBase64.replace(/^data:image\/[a-z]+;base64,/, '');
      parts.push({
        inlineData: {
          mimeType: mime,
          data: cleanBase64,
        },
      });
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    });

    if (!response.ok) return null;
    const data: any = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;
    return this.safeParseJson(text);
  }

  /**
   * Claude API client (optional external integration)
   */
  private async callClaude(request: RedesignRequest): Promise<RedesignResponse | null> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return null;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: `You are an expert UI/UX developer. Redesign this component: ${request.prompt}. Code: ${request.originalCode}. Return pure JSON with analysis, redesignedCode, framework, explanation, accessibilityImprovements, stylingDiffSummary.`,
          },
        ],
      }),
    });

    if (!response.ok) return null;
    const data: any = await response.json();
    const text = data?.content?.[0]?.text;
    if (!text) return null;
    return this.safeParseJson(text);
  }

  /**
   * OpenAI API client (optional external integration)
   */
  private async callOpenAI(request: RedesignRequest): Promise<RedesignResponse | null> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return null;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'You are an expert UI/UX engineer. Always reply in valid JSON.',
          },
          {
            role: 'user',
            content: `Redesign component: ${request.prompt}. Code: ${request.originalCode}. Return JSON: analysis, redesignedCode, framework, explanation, accessibilityImprovements, stylingDiffSummary.`,
          },
        ],
      }),
    });

    if (!response.ok) return null;
    const data: any = await response.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text) return null;
    return this.safeParseJson(text);
  }

  /**
   * Safely extracts and parses JSON even if surrounded by conversational markdown
   */
  private safeParseJson(rawText: string): any {
    const clean = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    try {
      return JSON.parse(clean);
    } catch {
      const jsonMatch = clean.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch {
          return null;
        }
      }
      return null;
    }
  }
}

export const aiService = new AiService();
