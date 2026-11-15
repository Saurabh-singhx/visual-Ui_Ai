import { describe, it, expect } from 'vitest';
import { aiService } from './aiService';

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

describe('aiService - Animated Modifications', () => {
  const initialButton = `export const ActionButton: React.FC = () => {
  return (
    <button type="button" className="px-5 py-2.5 bg-blue-600 text-white rounded-lg">
      Click Me
    </button>
  );
};`;

  it('injects hover scale transition utilities into className', async () => {
    const result = await aiService.redesignComponent({
      prompt: 'Make button smoothly scale up on hover with ease-in-out',
      originalCode: initialButton,
    });

    expect(result.redesignedCode).toContain('hover:scale-105');
    expect(result.redesignedCode).toMatch(/transition-all|transition/);
    expect(result.redesignedCode).toMatch(/duration-300|duration-200/);
    expect(result.redesignedCode).toContain('ease-in-out');
  });

  it('injects pulse animation for status badges or alerts', async () => {
    const badgeCode = `<span className="px-2 py-1 bg-emerald-500 text-white">Live</span>`;
    const result = await aiService.redesignComponent({
      prompt: 'Add pulse animation to status badge',
      originalCode: badgeCode,
    });

    expect(result.redesignedCode).toContain('animate-pulse');
  });

  it('injects bounce animation for action prompts', async () => {
    const result = await aiService.redesignComponent({
      prompt: 'Make button bounce on hover',
      originalCode: initialButton,
    });

    expect(result.redesignedCode).toMatch(/animate-bounce|hover:animate-bounce/);
  });

  it('handles compound prompt: animations + color palette + shape', async () => {
    const result = await aiService.redesignComponent({
      prompt: 'Add hover scale transition and change to emerald rounded pill',
      originalCode: initialButton,
    });

    expect(result.redesignedCode).toContain('hover:scale-105');
    expect(result.redesignedCode).toContain('rounded-full');
    expect(result.redesignedCode).toMatch(/emerald|teal/);
  });

  it('modifyComponentCode returns structured modifiedCode and appliedChanges', () => {
    const res = aiService.modifyComponentCode(initialButton, 'Add hover lift and make red rounded-full');
    expect(res.modifiedCode).toContain('hover:-translate-y-1');
    expect(res.modifiedCode).toContain('rounded-full');
    expect(res.modifiedCode).toContain('rose-600');
    expect(res.appliedChanges.length).toBeGreaterThan(0);
  });

  it('injects scoped keyframes for custom animation prompts', () => {
    const res = aiService.modifyComponentCode(initialButton, 'Add shimmer keyframe animation');
    expect(res.modifiedCode).toContain('@keyframes shimmer');
    expect(res.appliedChanges.some((c) => c.includes('keyframes'))).toBe(true);
  });

  it('emits exactly one className attribute when modifying elements with existing className (no duplicate className TS17001)', () => {
    const codeWithAttributes = `<button type="button" id="submit-btn" className="px-5 py-2.5 bg-blue-600 text-white rounded-lg">Click Me</button>`;
    const res = aiService.modifyComponentCode(codeWithAttributes, 'Add hover scale');

    const classNameCount = (res.modifiedCode.match(/className=/g) || []).length;
    expect(classNameCount).toBe(1);
    expect(res.modifiedCode).toContain('type="button"');
    expect(res.modifiedCode).toContain('id="submit-btn"');
    expect(res.modifiedCode).toContain('bg-blue-600');
    expect(res.modifiedCode).toContain('hover:scale-105');
    expect(res.modifiedCode).toContain('Click Me</button>');

    // Check with class="..." (HTML style)
    const codeWithClass = `<button type="button" class="px-4 py-2 bg-slate-700">Submit</button>`;
    const resClass = aiService.modifyComponentCode(codeWithClass, 'Add hover scale');
    expect((resClass.modifiedCode.match(/className=/g) || []).length).toBe(1);
    expect(resClass.modifiedCode).not.toMatch(/\bclass=["']/);

    // Check with plain element having no className attribute
    const codePlain = `<button type="button">Plain</button>`;
    const resPlain = aiService.modifyComponentCode(codePlain, 'Add hover scale');
    expect((resPlain.modifiedCode.match(/className=/g) || []).length).toBe(1);
    expect(resPlain.modifiedCode).toContain('hover:scale-105');

    // Check with self-closing element
    const codeSelfClosing = `<button type="button" />`;
    const resSelfClosing = aiService.modifyComponentCode(codeSelfClosing, 'Add hover scale');
    expect((resSelfClosing.modifiedCode.match(/className=/g) || []).length).toBe(1);
    expect(resSelfClosing.modifiedCode).toMatch(/\/>$/);
  });

  it('accurately targets element by line number using elementId (tag-line)', () => {
    const multiButtonCode = `import React from 'react';
export const MultiButton = () => {
  return (
    <div>
      <button className="btn-first">First</button>
      <button className="btn-second">Second</button>
      <button className="btn-third">Third</button>
    </div>
  );
};`;

    // Target line 6 (btn-second)
    const resSecond = aiService.modifyComponentCode(multiButtonCode, 'Add hover scale', 'button-6');
    expect(resSecond.modifiedCode).toContain('btn-second transition-all duration-300 ease-in-out hover:scale-105');
    expect(resSecond.modifiedCode).toContain('<button className="btn-first">First</button>');
    expect(resSecond.modifiedCode).toContain('<button className="btn-third">Third</button>');
    expect((resSecond.modifiedCode.match(/hover:scale-105/g) || []).length).toBe(1);

    // Target line 7 (btn-third)
    const resThird = aiService.modifyComponentCode(multiButtonCode, 'Add hover lift', 'button-7');
    expect(resThird.modifiedCode).toContain('btn-third transition-all duration-300 ease-in-out hover:-translate-y-1');
    expect(resThird.modifiedCode).toContain('<button className="btn-first">First</button>');
    expect(resThird.modifiedCode).toContain('<button className="btn-second">Second</button>');
    expect((resThird.modifiedCode.match(/hover:-translate-y-1/g) || []).length).toBe(1);
  });

  it('purges conflicting transitions, durations, and ease curves when applying animation presets', () => {
    // 1. hover-scale preset purging
    const conflictingScale = `<button className="transition-none duration-700 ease-linear hover:scale-50 text-white">Action</button>`;
    const resScale = aiService.modifyComponentCode(conflictingScale, 'Add hover scale');
    expect(resScale.modifiedCode).toContain('hover:scale-105');
    expect(resScale.modifiedCode).toContain('transition-all');
    expect(resScale.modifiedCode).toContain('duration-300');
    expect(resScale.modifiedCode).toContain('ease-in-out');
    expect(resScale.modifiedCode).not.toContain('transition-none');
    expect(resScale.modifiedCode).not.toContain('duration-700');
    expect(resScale.modifiedCode).not.toContain('ease-linear');
    expect(resScale.modifiedCode).not.toContain('hover:scale-50');

    // 2. hover-lift preset purging
    const conflictingLift = `<button className="transition-none duration-500 ease-out hover:-translate-x-2 hover:shadow-none">Lift</button>`;
    const resLift = aiService.modifyComponentCode(conflictingLift, 'Add hover lift');
    expect(resLift.modifiedCode).toContain('hover:-translate-y-1');
    expect(resLift.modifiedCode).toContain('hover:shadow-xl');
    expect(resLift.modifiedCode).not.toContain('transition-none');
    expect(resLift.modifiedCode).not.toContain('duration-500');
    expect(resLift.modifiedCode).not.toContain('ease-out');
    expect(resLift.modifiedCode).not.toContain('hover:shadow-none');

    // 3. glow preset purging
    const conflictingGlow = `<button className="transition-none duration-1000 hover:shadow-sm">Glow</button>`;
    const resGlow = aiService.modifyComponentCode(conflictingGlow, 'Add neon glow');
    expect(resGlow.modifiedCode).toContain('hover:shadow-[0_0_15px_rgba(99,102,241,0.5)]');
    expect(resGlow.modifiedCode).not.toContain('transition-none');
    expect(resGlow.modifiedCode).not.toContain('duration-1000');
    expect(resGlow.modifiedCode).not.toContain('hover:shadow-sm');
  });

  it('preserves h1 and h2 heading tags without rewriting to h3', () => {
    const codeWithH1 = `<div className="card-box p-4 bg-white"><h1 className="title-text text-2xl font-bold">Original Heading</h1><p>Copy</p></div>`;
    const res = aiService.modifyComponentCode(codeWithH1, 'change title to "Supercharged Title"');
    expect(res.modifiedCode).toMatch(/<h1[^>]*>Supercharged Title<\/h1>/i);
    expect(res.modifiedCode).not.toMatch(/<h3/i);

    const codeWithH2 = `<div className="card-box p-4"><h2 className="sub-title">Sub Heading</h2></div>`;
    const resH2 = aiService.modifyComponentCode(codeWithH2, 'update heading to "New Subtitle"');
    expect(resH2.modifiedCode).toMatch(/<h2[^>]*>New Subtitle<\/h2>/i);
    expect(resH2.modifiedCode).not.toMatch(/<h3/i);
  });

  it('targets specific element without indiscriminately modifying only the first className', () => {
    const code = `<div className="card-box p-4 bg-white shadow rounded">
      <h1 className="title-text text-2xl font-bold">Original Heading</h1>
      <button id="submit-btn" className="btn-primary bg-indigo-600 text-white px-4 py-2">Submit Action</button>
    </div>`;

    // Target button label
    const resBtn = aiService.modifyComponentCode(code, 'update button to "Confirm Action"');
    expect(resBtn.modifiedCode).toContain('Confirm Action');
    expect(resBtn.modifiedCode).toContain('card-box p-4 bg-white shadow rounded');

    // Target button styling by elementId
    const resBtnId = aiService.modifyComponentCode(code, 'Make button red rounded-full', 'button-3');
    expect(resBtnId.modifiedCode).toContain('card-box p-4 bg-white shadow rounded');
    expect(resBtnId.modifiedCode).toContain('btn-primary');
    expect(resBtnId.modifiedCode).toMatch(/bg-rose-600|rounded-full/);
  });

  it('defaults targetFramework to react-native when originalCode contains React Native elements', async () => {
    const rnCode = `import React from 'react';
import { View, Text } from 'react-native';
export const MobileCard = () => (
  <View style={{ padding: 16 }}>
    <Text>Mobile Text</Text>
  </View>
);`;
    const res = await aiService.redesignComponent({
      prompt: 'Make card compact and modern',
      originalCode: rnCode,
    });
    expect(res.framework).toBe('react-native');
  });

  it('defaults targetFramework to vue when originalCode contains Vue template', async () => {
    const vueCode = `<template>
  <div class="p-4 bg-white">
    <h1>Vue Title</h1>
  </div>
</template>`;
    const res = await aiService.redesignComponent({
      prompt: 'Make it clean and dark',
      originalCode: vueCode,
    });
    expect(res.framework).toBe('vue');
  });

  it('defaults targetFramework to react-tailwind for standard React code', async () => {
    const reactCode = `export const WebButton = () => (
  <button className="px-4 py-2 bg-blue-500 text-white">Click</button>
);`;
    const res = await aiService.redesignComponent({
      prompt: 'Make button red',
      originalCode: reactCode,
    });
    expect(res.framework).toBe('react-tailwind');
  });
});
