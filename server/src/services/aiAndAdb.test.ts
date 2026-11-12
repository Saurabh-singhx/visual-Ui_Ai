import { describe, it, expect } from 'vitest';
import { aiService } from './aiService';
import { adbService } from './adbService';

describe('AiService', () => {
  it('generates a high-quality smart redesign for a feature card with modern Tailwind styling', async () => {
    const response = await aiService.redesignComponent({
      prompt: 'Make this feature card modern with glassmorphism',
      originalCode: '<div className="p-4 bg-gray-100 text-black">Title</div>',
    });

    expect(response).toBeDefined();
    expect(response.redesignedCode).toContain('FeatureCard');
    expect(response.redesignedCode).toContain('backdrop-blur');
    expect(response.accessibilityImprovements.length).toBeGreaterThan(0);
    expect(response.stylingDiffSummary.length).toBeGreaterThan(0);
    expect(response.explanation).toContain('UI/UX');
  });

  it('generates accessible redesign when WCAG contrast fix is requested', async () => {
    const response = await aiService.redesignComponent({
      prompt: 'Fix accessibility and contrast',
      wcagFixRequested: true,
      originalCode: '<div className="text-gray-400 bg-gray-300">Hard to read</div>',
    });

    expect(response.accessibilityImprovements.some((item) => item.toLowerCase().includes('contrast') || item.includes('WCAG'))).toBe(true);
    expect(response.redesignedCode).toBeDefined();
  });

  it('generates modernized navigation bar with ARIA landmarks', async () => {
    const response = await aiService.redesignComponent({
      prompt: 'Redesign top navbar with clean minimalist glassmorphism',
      originalCode: '<nav><div>Acme</div><a href="#">Link</a></nav>',
    });

    expect(response.redesignedCode).toContain('TopNavbar');
    expect(response.redesignedCode).toContain('aria-label');
    expect(response.accessibilityImprovements.some((a) => a.includes('ARIA'))).toBe(true);
  });

  it('generates high-contrast accessible button for CTA prompts', async () => {
    const response = await aiService.redesignComponent({
      prompt: 'Redesign deposit button CTA',
      originalCode: '<button className="px-3 py-1 bg-white text-blue-700">Deposit</button>',
    });

    expect(response.redesignedCode).toContain('ActionButton');
    expect(response.accessibilityImprovements.some((a) => a.includes('44'))).toBe(true);
  });

  it('generates crypto balance card for mobile finance screen prompts', async () => {
    const response = await aiService.redesignComponent({
      prompt: 'Redesign mobile balance card with gradient glass',
      originalCode: '<div className="p-6 bg-blue-700">Portfolio Value</div>',
    });

    expect(response.redesignedCode).toContain('BalanceCard');
    expect(response.redesignedCode).toContain('Portfolio');
    expect(response.accessibilityImprovements.length).toBeGreaterThan(0);
  });

  it('generates dark telemetry widget for server metric prompts', async () => {
    const response = await aiService.redesignComponent({
      prompt: 'Redesign telemetry CPU metric widget',
      originalCode: '<div className="p-4 bg-slate-800">42.8%</div>',
    });

    expect(response.redesignedCode).toContain('MetricWidget');
    expect(response.redesignedCode).toContain('Telemetry');
  });

  it('does not misclassify cards containing child buttons as ActionButton', async () => {
    const cardWithButton = `export const FeatureCard: React.FC<CardProps> = ({ title, description, onAction }) => (
      <div className="p-4 bg-gray-100">
        <h3>{title}</h3>
        <p>{description}</p>
        <button onClick={onAction} className="px-3 py-1 bg-blue-600">Learn more</button>
      </div>
    );`;

    const response = await aiService.redesignComponent({
      prompt: 'Make this modern with glassmorphism',
      originalCode: cardWithButton,
    });

    expect(response.redesignedCode).toContain('FeatureCard');
    expect(response.redesignedCode).not.toContain('ActionButton');
  });

  it('does not misclassify balance card containing child buttons as ActionButton', async () => {
    const balanceWithButton = `export const BalanceCard = () => (
      <div className="p-6 bg-blue-700">
        <span>Total Portfolio Value</span>
        <button>Deposit</button>
      </div>
    );`;

    const response = await aiService.redesignComponent({
      prompt: 'Clean Minimalist',
      originalCode: balanceWithButton,
    });

    expect(response.redesignedCode).toContain('BalanceCard');
    expect(response.redesignedCode).not.toContain('ActionButton');
  });
});

describe('AdbService', () => {
  it('provides a structured sample mobile hierarchy when testing or no device is attached', () => {
    const nodes = adbService.getSampleMobileHierarchy();
    expect(nodes.length).toBeGreaterThan(0);
    expect(nodes[0]).toHaveProperty('bounds');
    expect(nodes[0].bounds).toHaveProperty('x');
    expect(nodes[0].bounds).toHaveProperty('y');
    expect(nodes[0].bounds.width).toBeGreaterThan(0);
    expect(nodes[0].bounds.height).toBeGreaterThan(0);
    expect(nodes[0]).toHaveProperty('className');
  });

  it('checks devices gracefully without throwing an uncaught exception', async () => {
    const devices = await adbService.getDevices();
    expect(Array.isArray(devices)).toBe(true);
  });
});
