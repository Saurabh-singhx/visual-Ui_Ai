import { describe, it, expect } from 'vitest';
import { extractRenderableHtml } from './LivePreview';

describe('extractRenderableHtml', () => {
  it('extracts real component markup and does not inject hardcoded SaaS strings', () => {
    const componentCode = `
      export const UserCard = ({ title, description }) => {
        return (
          <div className="card p-4">
            <h2>{title}</h2>
            <p>{description}</p>
          </div>
        );
      };
    `;

    const html = extractRenderableHtml(componentCode, 'UserCard');
    expect(html).toContain('class="card p-4"');
    expect(html).toContain('<h2>UserCard</h2>');
    expect(html).toContain('Component details and overview information.');

    // Crucial check: MUST NOT contain hardcoded SaaS / AcmeCloud strings
    expect(html).not.toContain('Intelligent AI Redesign');
    expect(html).not.toContain('Deposit Funds');
    expect(html).not.toContain('$48,295.40');
    expect(html).not.toContain('16 Cores Online');
  });

  it('respects parameter default values (strings, numbers, booleans)', () => {
    const code = `
      export const StatusBadge = ({ badge = 'Pending Review', count = 42, active = true }) => {
        return (
          <div className="badge flex gap-2">
            <span className="status">{badge}</span>
            <span className="count">{count}</span>
          </div>
        );
      };
    `;

    const html = extractRenderableHtml(code, 'StatusBadge');
    expect(html).toContain('Pending Review');
    expect(html).toContain('42');
    expect(html).not.toContain('{badge}');
    expect(html).not.toContain('{count}');
  });

  it('handles JSX conditional rendering cleanly without broken js syntax', () => {
    const code = `
      export const Alert = ({ hasWarning = true, message = 'System Alert' }) => {
        return (
          <div className="alert">
            {hasWarning && (
              <span className="warning-icon">⚠️</span>
            )}
            <p>{message}</p>
          </div>
        );
      };
    `;

    const html = extractRenderableHtml(code, 'Alert');
    expect(html).toContain('⚠️');
    expect(html).toContain('System Alert');
    expect(html).not.toContain('hasWarning &&');
  });

  it('handles class template literals cleanly', () => {
    const code = `
      export const CustomButton = ({ variant = 'primary' }) => {
        return (
          <button className={\`px-4 py-2 rounded \${variant === 'primary' ? 'bg-blue-600' : 'bg-gray-600'}\`}>
            Submit
          </button>
        );
      };
    `;

    const html = extractRenderableHtml(code, 'CustomButton');
    expect(html).toContain('class="px-4 py-2 rounded"');
    expect(html).toContain('Submit');
  });

  it('renders Lucide icon tags as stylized visual placeholders', () => {
    const code = `
      import { Sparkles, Check } from 'lucide-react';
      export const IconRow = () => {
        return (
          <div>
            <Sparkles className="w-4 h-4" />
            <Check className="w-4 h-4" />
          </div>
        );
      };
    `;

    const html = extractRenderableHtml(code, 'IconRow');
    expect(html).toContain('✨');
    expect(html).toContain('✓');
    expect(html).not.toContain('<Sparkles');
  });

  it('interpolates synthesized props cleanly into component preview', () => {
    const code = `
      export const ProfileWidget = (props: { title: string; count: number; active: boolean }) => {
        return (
          <div className="profile">
            <h3>{props.title}</h3>
            <span>Count: {props.count}</span>
            {props.active && <div className="badge">Active Member</div>}
          </div>
        );
      };
    `;

    const synthesizedProps = {
      title: 'Synthesized Title',
      count: 99,
      active: true,
    };

    const html = extractRenderableHtml(code, 'ProfileWidget', synthesizedProps);
    expect(html).toContain('Synthesized Title');
    expect(html).toContain('Count: 99');
    expect(html).toContain('Active Member');
  });

  it('converts Framer Motion motion.div tags and hover props to Tailwind transition classes', () => {
    const motionCode = `
      import { motion } from 'framer-motion';
      export const AnimatedCard = () => {
        return (
          <motion.div
            whileHover={{ scale: 1.05 }}
            transition={{ duration: 0.3 }}
            className="p-6 bg-slate-900 rounded-xl"
          >
            <motion.button whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.05 }} className="btn">
              Action
            </motion.button>
          </motion.div>
        );
      };
    `;

    const html = extractRenderableHtml(motionCode, 'AnimatedCard');
    expect(html).not.toContain('motion.div');
    expect(html).not.toContain('motion.button');
    expect(html).not.toContain('whileHover');
    expect(html).not.toContain('whileTap');
    expect(html).toContain('<div');
    expect(html).toContain('hover:scale-105');
    expect(html).toContain('transition-all');
    expect(html).toContain('<button');
    expect(html).toContain('active:scale-95');
  });
});
