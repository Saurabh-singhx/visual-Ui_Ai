import { Router, Request, Response } from 'express';
import { aiService } from '../services/aiService';

const router = Router();

router.get('/providers', (req: Request, res: Response) => {
  const providers = {
    gemini: !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY),
    claude: !!process.env.ANTHROPIC_API_KEY,
    openai: !!process.env.OPENAI_API_KEY,
    localEngine: true, // Always ready and available
    activeDefault:
      process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
        ? 'Gemini 2.0 / 1.5'
        : process.env.ANTHROPIC_API_KEY
        ? 'Claude 3.5 Sonnet'
        : process.env.OPENAI_API_KEY
        ? 'OpenAI GPT-4o'
        : 'Smart Local UI Engine (Built-in)',
  };

  res.json({ success: true, providers });
});

router.post('/redesign', async (req: Request, res: Response) => {
  try {
    const { prompt, originalCode, imageSnippetBase64, targetFramework, extractedStyles, wcagFixRequested } = req.body;

    if (!prompt && !originalCode && !imageSnippetBase64) {
      return res.status(400).json({
        success: false,
        error: 'Please provide either a prompt, original code, or a component image.',
      });
    }

    const result = await aiService.redesignComponent({
      prompt: prompt || 'Redesign this component with modern UI/UX principles',
      originalCode,
      imageSnippetBase64,
      targetFramework,
      extractedStyles,
      wcagFixRequested,
    });

    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/presets', (req: Request, res: Response) => {
  const presets = [
    {
      id: 'modern-glass',
      label: '✨ Modern Glassmorphism',
      prompt: 'Redesign with soft backdrop blur, glowing borders, high-contrast typography, and smooth hover elevation.',
    },
    {
      id: 'wcag-accessible',
      label: '♿ Fix WCAG 2.2 Contrast & Accessibility',
      prompt: 'Fix accessibility issues: ensure 4.5:1 text contrast ratio, add keyboard focus rings, and enforce 44px touch targets.',
    },
    {
      id: 'clean-minimal',
      label: '📐 Clean Minimalist',
      prompt: 'Refine into an ultra-clean, minimalist design with balanced whitespace, subtle borders, and crisp typography.',
    },
    {
      id: 'mobile-touch',
      label: '📱 Mobile-First Responsive',
      prompt: 'Optimize for mobile viewports with full-width touch targets, fluid typography, and thumb-friendly padding.',
    },
    {
      id: 'dark-cyber',
      label: '🌙 Cyber Dark Mode',
      prompt: 'Convert into a sleek deep-slate dark theme with cyan/violet neon accents and crisp micro-borders.',
    },
  ];

  res.json({ success: true, presets });
});

export default router;
