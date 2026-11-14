import { describe, it, expect } from 'vitest';
import { propSynthesisService } from './propSynthesisService';

describe('PropSynthesisService', () => {
  it('parses TypeScript interface props cleanly', () => {
    const code = `
      interface UserCardProps {
        title: string;
        count?: number;
        isActive: boolean;
        tags: string[];
      }
      export const UserCard = (props: UserCardProps) => <div>{props.title}</div>;
    `;

    const propTypes = propSynthesisService.parsePropTypes(code);
    expect(propTypes.title).toBeDefined();
    expect(propTypes.title.type).toBe('string');
    expect(propTypes.count).toBeDefined();
    expect(propTypes.count.optional).toBe(true);
    expect(propTypes.isActive.type).toBe('boolean');
    expect(propTypes.tags.type).toBe('string[]');
  });

  it('synthesizes realistic sample values for parsed props', () => {
    const code = `
      interface FeatureProps {
        title: string;
        description: string;
        count: number;
        isActive: boolean;
        items: Array<{ id: string; name: string }>;
      }
      export const Feature = ({ title = 'Custom Title', count = 10 }: FeatureProps) => <div>{title}</div>;
    `;

    const props = propSynthesisService.synthesizeProps(code, undefined, 'Feature');
    expect(props.title).toBe('Custom Title');
    expect(props.description).toContain('Comprehensive visual interface');
    expect(props.count).toBe(10);
    expect(props.isActive).toBe(true);
    expect(Array.isArray(props.items)).toBe(true);
    expect(props.items.length).toBeGreaterThan(0);
  });

  it('allows user props to override synthesized and default props', () => {
    const code = `
      interface CardProps {
        title: string;
        rating: number;
      }
      export const Card = ({ title = 'Default' }: CardProps) => <div>{title}</div>;
    `;

    const props = propSynthesisService.synthesizeProps(code, { title: 'User Specified Title', rating: 5.0 });
    expect(props.title).toBe('User Specified Title');
    expect(props.rating).toBe(5.0);
  });

  it('adapts imports by stripping CSS and asset imports', () => {
    const code = `
      import React from 'react';
      import './styles.css';
      import icon from './assets/logo.svg';
      import { motion } from 'framer-motion';

      export const Banner = () => <div className="banner">Hello</div>;
    `;

    const adapted = propSynthesisService.adaptImports(code);
    expect(adapted).not.toContain("import './styles.css'");
    expect(adapted).not.toContain("import icon from './assets/logo.svg'");
    expect(adapted).not.toContain("import { motion } from 'framer-motion'");
  });

  it('converts Framer Motion tags and strips motion props', () => {
    const code = `
      export const MotionBox = () => (
        <motion.div whileHover={{ scale: 1.05 }} transition={{ duration: 0.2 }} className="box">
          <motion.button whileTap={{ scale: 0.95 }}>Click</motion.button>
        </motion.div>
      );
    `;

    const adapted = propSynthesisService.adaptImports(code);
    expect(adapted).toContain('<div');
    expect(adapted).toContain('</div');
    expect(adapted).toContain('<button');
    expect(adapted).toContain('</button');
    expect(adapted).not.toContain('motion.div');
    expect(adapted).not.toContain('whileHover');
    expect(adapted).not.toContain('whileTap');
  });

  it('converts common components like Button, Badge, Card into styled primitives', () => {
    const code = `
      export const DashboardCard = () => (
        <Card>
          <CardHeader>
            <CardTitle>Overview</CardTitle>
            <Badge>New</Badge>
          </CardHeader>
          <CardContent>
            <Button>Action</Button>
          </CardContent>
        </Card>
      );
    `;

    const adapted = propSynthesisService.adaptImports(code);
    expect(adapted).toContain('<div className="bg-slate-900 border border-slate-800');
    expect(adapted).toContain('<span className="inline-flex items-center');
    expect(adapted).toContain('<button className="px-4 py-2 bg-indigo-600');
    expect(adapted).toContain('<h3 className="font-semibold text-lg text-white"');
  });

  it('correctly synthesizes number[] and boolean[] arrays and avoids scalar collisions', () => {
    const code = `
      interface MetricCardProps {
        rates: number[];
        flags: boolean[];
        scores: Array<number>;
        toggles: Array<boolean>;
        scalarRate: number;
        scalarFlag: boolean;
      }
      export const MetricCard = (props: MetricCardProps) => <div>Metrics</div>;
    `;

    const props = propSynthesisService.synthesizeProps(code);

    // Number arrays
    expect(Array.isArray(props.rates)).toBe(true);
    expect(props.rates).toEqual([10, 20, 30]);
    expect(props.rates.map((x: number) => x * 2)).toEqual([20, 40, 60]);

    expect(Array.isArray(props.scores)).toBe(true);
    expect(props.scores).toEqual([10, 20, 30]);

    // Boolean arrays
    expect(Array.isArray(props.flags)).toBe(true);
    expect(props.flags).toEqual([true, false, true]);
    expect(props.flags.map((b: boolean) => !b)).toEqual([false, true, false]);

    expect(Array.isArray(props.toggles)).toBe(true);
    expect(props.toggles).toEqual([true, false, true]);

    // Scalars remain scalar
    expect(typeof props.scalarRate).toBe('number');
    expect(typeof props.scalarFlag).toBe('boolean');
  });

  it('correctly parses interfaces with nested objects and optional extends without truncating sibling props', () => {
    const code = `
      interface DashboardProps extends BaseProps, React.HTMLAttributes<HTMLDivElement> {
        user: {
          id: string;
          profile: {
            avatarUrl: string;
          };
        };
        title: string;
        count: number;
        isActive?: boolean;
      }
      export const Dashboard = (props: DashboardProps) => <div>{props.title}</div>;
    `;

    const propTypes = propSynthesisService.parsePropTypes(code);
    expect(propTypes.user).toBeDefined();
    expect(propTypes.title).toBeDefined();
    expect(propTypes.title.type).toBe('string');
    expect(propTypes.count).toBeDefined();
    expect(propTypes.count.type).toBe('number');
    expect(propTypes.isActive).toBeDefined();
    expect(propTypes.isActive.optional).toBe(true);

    const synthesized = propSynthesisService.synthesizeProps(code);
    expect(synthesized.title).toBeDefined();
    expect(typeof synthesized.title).toBe('string');
    expect(synthesized.count).toBe(42);
    expect(typeof synthesized.user).toBe('object');
    expect(synthesized.user.name).toBeDefined();
  });

  it('cleanly transforms motion elements with double-curly braces without leaving trailing dangling braces', () => {
    const code = `
      export const AnimatedCard = () => (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          whileHover={{ scale: 1.02 }}
          className="p-4"
        >
          <motion.h2 variants={{ hidden: { opacity: 0 } }}>Title</motion.h2>
        </motion.div>
      );
    `;

    const adapted = propSynthesisService.adaptImports(code);
    expect(adapted).not.toContain('motion.div');
    expect(adapted).not.toContain('motion.h2');
    expect(adapted).not.toContain('initial=');
    expect(adapted).not.toContain('animate=');
    expect(adapted).not.toContain('whileHover=');
    expect(adapted).not.toContain('transition=');
    expect(adapted).not.toContain('variants=');
    // Ensure no dangling '}}' or '}}}' left behind attached to tag
    expect(adapted).not.toMatch(/<div[\s\S]*?\}\}+/);
    expect(adapted).toContain('<div');
    expect(adapted).toContain('className="p-4"');
  });

  it('strips mixed and wildcard asset imports while preserving code imports', () => {
    const code = `
      import React, { useState } from 'react';
      import icon, { ReactComponent as Logo } from './assets/logo.svg';
      import * as banner from './assets/banner.png';
      import './theme.css';
      import './styles.scss';
      import { motion } from 'framer-motion';

      export const Header = () => <header>App</header>;
    `;

    const adapted = propSynthesisService.adaptImports(code);
    expect(adapted).toContain("import React, { useState } from 'react'");
    expect(adapted).not.toContain('./assets/logo.svg');
    expect(adapted).not.toContain('./assets/banner.png');
    expect(adapted).not.toContain('./theme.css');
    expect(adapted).not.toContain('./styles.scss');
    expect(adapted).not.toContain('framer-motion');
  });

  it('handles nested same-tag subcomponents without leaving orphaned closing tags', () => {
    const code = `
      <Card className="outer-card">
        <CardContent>
          <Card className="inner-card">
            <CardTitle>Nested Card</CardTitle>
          </Card>
        </CardContent>
      </Card>
    `;

    const adapted = propSynthesisService.adaptImports(code);
    expect(adapted).toContain('<div className="outer-card">');
    expect(adapted).toContain('<div className="inner-card">');
    expect(adapted).not.toContain('<Card');
    expect(adapted).not.toContain('</Card>');
  });

  it('correctly prioritizes callback functions over scalar numbers and booleans', () => {
    const code = `
      interface CallbackProps {
        onChange: (value: number) => void;
        validator: (text: string) => boolean;
        filter: (x: string) => boolean;
        onSelect: (id: string, active: boolean) => void;
        countFn: () => number;
        onClick: () => void;
      }
      export const CallbackComponent = (props: CallbackProps) => <button onClick={props.onClick}>Click</button>;
    `;

    const props = propSynthesisService.synthesizeProps(code);

    expect(typeof props.onChange).toBe('function');
    expect(typeof props.validator).toBe('function');
    expect(typeof props.filter).toBe('function');
    expect(typeof props.onSelect).toBe('function');
    expect(typeof props.countFn).toBe('function');
    expect(typeof props.onClick).toBe('function');

    // Executing callbacks should run safely without throwing
    expect(() => props.onChange(42)).not.toThrow();
    expect(() => props.validator('test')).not.toThrow();
    expect(() => props.filter('item')).not.toThrow();
    expect(() => props.onSelect('1', true)).not.toThrow();
    expect(() => props.countFn()).not.toThrow();
    expect(() => props.onClick()).not.toThrow();
  });

  it('correctly synthesizes objects with number or boolean fields instead of scalar collisions', () => {
    const code = `
      interface ObjectProps {
        user: {
          profile: { name: string };
          active: boolean;
          age: number;
        };
        stats: {
          count: number;
          total: number;
        };
        config: {
          enabled: boolean;
        };
      }
      export const ObjectComponent = (props: ObjectProps) => <div>{props.user.profile.name}</div>;
    `;

    const props = propSynthesisService.synthesizeProps(code);

    // Verify user object
    expect(typeof props.user).toBe('object');
    expect(props.user).not.toBeNull();
    expect(typeof props.user.active).toBe('boolean');
    expect(typeof props.user.age).toBe('number');
    expect(typeof props.user.profile).toBe('object');
    expect(typeof props.user.profile.name).toBe('string');
    expect(props.user.name).toBeDefined();

    // Verify stats object
    expect(typeof props.stats).toBe('object');
    expect(props.stats).not.toBeNull();
    expect(typeof props.stats.count).toBe('number');
    expect(typeof props.stats.total).toBe('number');

    // Verify config object
    expect(typeof props.config).toBe('object');
    expect(props.config).not.toBeNull();
    expect(typeof props.config.enabled).toBe('boolean');
  });

  it('correctly synthesizes object arrays with number or boolean fields', () => {
    const code = `
      interface ListProps {
        products: { id: string; title: string; price: number }[];
        features: Array<{ name: string; enabled: boolean }>;
        simplePrices: { price: number }[];
      }
      export const ListComponent = (props: ListProps) => (
        <ul>{props.products.map(p => <li key={p.id}>{p.title}: {p.price}</li>)}</ul>
      );
    `;

    const props = propSynthesisService.synthesizeProps(code);

    // Products array
    expect(Array.isArray(props.products)).toBe(true);
    expect(props.products.length).toBeGreaterThan(0);
    expect(typeof props.products[0]).toBe('object');
    expect(typeof props.products[0].price).toBe('number');
    expect(typeof props.products[0].title).toBe('string');
    expect(() => props.products.map((p: any) => `${p.title}: ${p.price}`)).not.toThrow();

    // Features array
    expect(Array.isArray(props.features)).toBe(true);
    expect(props.features.length).toBeGreaterThan(0);
    expect(typeof props.features[0]).toBe('object');
    expect(typeof props.features[0].enabled).toBe('boolean');
    expect(() => props.features.map((f: any) => f.name)).not.toThrow();

    // Simple prices array
    expect(Array.isArray(props.simplePrices)).toBe(true);
    expect(props.simplePrices.length).toBeGreaterThan(0);
    expect(typeof props.simplePrices[0]).toBe('object');
    expect(typeof props.simplePrices[0].price).toBe('number');
  });

  it('correctly parses generic types with multiple type arguments without comma splitting', () => {
    const code = `
      interface GenericProps {
        metadata: Record<string, number>;
        flags: Record<string, boolean>;
        map: Map<string, Array<{ id: number }>>;
        active: boolean;
        title: string;
      }
      export const GenericComponent = (props: GenericProps) => <div>{props.title}</div>;
    `;

    const propTypes = propSynthesisService.parsePropTypes(code);

    expect(propTypes.metadata).toBeDefined();
    expect(propTypes.metadata.type).toBe('Record<string, number>');

    expect(propTypes.flags).toBeDefined();
    expect(propTypes.flags.type).toBe('Record<string, boolean>');

    expect(propTypes.map).toBeDefined();
    expect(propTypes.map.type).toBe('Map<string, Array<{ id: number }>>');

    expect(propTypes.active).toBeDefined();
    expect(propTypes.active.type).toBe('boolean');

    expect(propTypes.title).toBeDefined();
    expect(propTypes.title.type).toBe('string');

    const synthesized = propSynthesisService.synthesizeProps(code);
    expect(typeof synthesized.metadata).toBe('object');
    expect(typeof synthesized.flags).toBe('object');
    expect(typeof synthesized.active).toBe('boolean');
    expect(typeof synthesized.title).toBe('string');
  });

  describe('Structural Array & Object Classification', () => {
    it('synthesizes objects containing array fields without stack overflow', () => {
      const code = `
        interface CardProps {
          user: { id: string; tags: string[] };
          config: { hosts: string[]; port: number };
        }
        export const Card = (props: CardProps) => <div>{props.user.id}</div>;
      `;

      const props = propSynthesisService.synthesizeProps(code);
      expect(typeof props.user).toBe('object');
      expect(props.user).not.toBeNull();
      expect(Array.isArray(props.user.tags)).toBe(true);
      expect(props.user.tags.length).toBeGreaterThan(0);
      expect(typeof props.user.tags[0]).toBe('string');

      expect(typeof props.config).toBe('object');
      expect(props.config).not.toBeNull();
      expect(Array.isArray(props.config.hosts)).toBe(true);
      expect(typeof props.config.port).toBe('number');
    });

    it('synthesizes arrays of objects containing array fields cleanly', () => {
      const code = `
        interface GroupProps {
          users: { id: string; roles: string[] }[];
          items: Array<{ id: string; tags: string[] }>;
        }
        export const Group = (props: GroupProps) => <div>{props.users.length}</div>;
      `;

      const props = propSynthesisService.synthesizeProps(code);
      expect(Array.isArray(props.users)).toBe(true);
      expect(props.users.length).toBeGreaterThan(0);
      expect(typeof props.users[0]).toBe('object');
      expect(Array.isArray(props.users[0].roles)).toBe(true);
      expect(props.users[0].roles.length).toBeGreaterThan(0);

      expect(Array.isArray(props.items)).toBe(true);
      expect(props.items.length).toBeGreaterThan(0);
      expect(typeof props.items[0]).toBe('object');
      expect(Array.isArray(props.items[0].tags)).toBe(true);
      expect(props.items[0].tags.length).toBeGreaterThan(0);
    });

    it('synthesizes objects containing callback members as objects with functions', () => {
      const code = `
        interface ActionPanelProps {
          actions: { onClick: () => void; isDark: boolean };
          handlers: { onSubmit: (data: string) => void; title: string };
        }
        export const ActionPanel = (props: ActionPanelProps) => <div onClick={props.actions.onClick}>{props.handlers.title}</div>;
      `;

      const props = propSynthesisService.synthesizeProps(code);
      expect(typeof props.actions).toBe('object');
      expect(props.actions).not.toBeNull();
      expect(typeof props.actions.onClick).toBe('function');
      expect(() => props.actions.onClick()).not.toThrow();
      expect(typeof props.actions.isDark).toBe('boolean');

      expect(typeof props.handlers).toBe('object');
      expect(props.handlers).not.toBeNull();
      expect(typeof props.handlers.onSubmit).toBe('function');
      expect(() => props.handlers.onSubmit('test')).not.toThrow();
      expect(typeof props.handlers.title).toBe('string');
    });

    it('synthesizes callbacks taking array arguments as callable functions', () => {
      const code = `
        interface SelectorProps {
          onSelect: (items: string[]) => void;
          onBatchProcess: (ids: number[], flag: boolean) => void;
        }
        export const Selector = (props: SelectorProps) => <div />;
      `;

      const props = propSynthesisService.synthesizeProps(code);
      expect(typeof props.onSelect).toBe('function');
      expect(Array.isArray(props.onSelect)).toBe(false);
      expect(() => props.onSelect(['a', 'b'])).not.toThrow();

      expect(typeof props.onBatchProcess).toBe('function');
      expect(Array.isArray(props.onBatchProcess)).toBe(false);
      expect(() => props.onBatchProcess([1, 2], true)).not.toThrow();
    });

    it('handles direct generateSampleValue calls for edge cases cleanly', () => {
      // Direct call on object with array
      const user = propSynthesisService.generateSampleValue('user', '{ id: string; tags: string[] }');
      expect(typeof user).toBe('object');
      expect(Array.isArray(user.tags)).toBe(true);

      // Direct call on array of objects with array
      const users = propSynthesisService.generateSampleValue('users', '{ id: string; roles: string[] }[]');
      expect(Array.isArray(users)).toBe(true);
      expect(Array.isArray(users[0].roles)).toBe(true);

      // Direct call on object with callback
      const actions = propSynthesisService.generateSampleValue('actions', '{ onClick: () => void; isDark: boolean }');
      expect(typeof actions).toBe('object');
      expect(typeof actions.onClick).toBe('function');

      // Direct call on callback with array parameter
      const cb = propSynthesisService.generateSampleValue('onSelect', '(items: string[]) => void');
      expect(typeof cb).toBe('function');
      expect(Array.isArray(cb)).toBe(false);
    });
  });
});
