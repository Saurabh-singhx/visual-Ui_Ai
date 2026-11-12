import { Router, Request, Response } from 'express';

const router = Router();

// Returns interactive sample mockups (Web, Mobile, Desktop)
router.get('/samples', (req: Request, res: Response) => {
  const samples = [
    {
      id: 'web-landing',
      platform: 'web',
      name: 'Modern SaaS Landing Page',
      viewport: { width: 1200, height: 750 },
      description: 'Web application with hero section, navigation bar, and feature cards',
      interactiveElements: [
        {
          id: 'web-elem-nav',
          name: 'Navigation Bar',
          selector: 'header.navbar',
          bounds: { x: 40, y: 20, width: 1120, height: 64 },
          tagName: 'nav',
          className: 'flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200',
          codeSnippet: `export const TopNavbar: React.FC = () => {
  return (
    <nav className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200">
      <div className="font-bold text-lg text-blue-600">AcmeCloud</div>
      <div className="flex gap-4 text-sm font-medium text-gray-600">
        <a href="#features" className="hover:text-blue-600">Features</a>
        <a href="#pricing" className="hover:text-blue-600">Pricing</a>
        <a href="#docs" className="hover:text-blue-600">Docs</a>
      </div>
      <button className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-semibold hover:bg-blue-700">
        Sign In
      </button>
    </nav>
  );
};`,
          styles: {
            backgroundColor: '#ffffff',
            textColor: '#4b5563',
            fontSize: '14px',
            borderRadius: '0px',
          },
        },
        {
          id: 'web-elem-card',
          name: 'Feature Card (Outdated Styling)',
          selector: 'div.feature-card',
          bounds: { x: 80, y: 160, width: 340, height: 220 },
          tagName: 'div',
          className: 'p-4 bg-gray-100 rounded border border-gray-300 text-black',
          codeSnippet: `export const FeatureCard: React.FC<CardProps> = ({
  title,
  description,
  badge = 'New',
  onAction,
}) => {
  return (
    <div className="p-4 bg-gray-100 rounded border border-gray-300 text-black">
      <span className="text-xs bg-gray-200 px-2 py-0.5 rounded text-gray-700 font-medium">
        {badge}
      </span>
      <h3 className="text-base font-bold mt-2 text-gray-900">{title}</h3>
      <p className="text-sm text-gray-600 mt-1 leading-relaxed">
        {description}
      </p>
      <button
        onClick={onAction}
        className="mt-3 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded hover:bg-blue-700"
      >
        Learn more
      </button>
    </div>
  );
};`,
          styles: {
            backgroundColor: '#f3f4f6',
            textColor: '#111827',
            fontSize: '16px',
            borderRadius: '4px',
          },
        },
        {
          id: 'web-elem-telemetry',
          name: 'Real-time Telemetry Card',
          selector: 'div.telemetry-card',
          bounds: { x: 460, y: 160, width: 340, height: 220 },
          tagName: 'div',
          className: 'p-5 bg-slate-800/80 rounded-xl border border-slate-700 text-white flex flex-col justify-between',
          codeSnippet: `export const TelemetryCard: React.FC = () => (
  <div className="p-5 bg-slate-800/80 rounded-xl border border-slate-700 text-white flex flex-col justify-between">
    <div>
      <span className="text-[10px] bg-indigo-500/20 px-2 py-0.5 rounded text-indigo-300 font-medium border border-indigo-500/30">Active</span>
      <h3 className="text-sm font-bold mt-2">Real-time Telemetry</h3>
      <p className="text-xs text-slate-400 mt-1 leading-relaxed">Live monitoring metrics, anomaly detection, and automated alerting system.</p>
    </div>
    <div className="flex items-center justify-between mt-3">
      <span className="text-xs font-mono text-emerald-400 font-bold">99.98% Uptime</span>
      <button className="px-3 py-1 bg-indigo-600 text-white text-[11px] rounded-lg hover:bg-indigo-500 font-medium">View Metrics</button>
    </div>
  </div>
);`,
          styles: {
            backgroundColor: '#1e293b',
            textColor: '#f8fafc',
            fontSize: '14px',
            borderRadius: '12px',
          },
        },
        {
          id: 'web-elem-hero',
          name: 'Hero Banner Section',
          selector: 'section.hero-banner',
          bounds: { x: 80, y: 410, width: 1040, height: 260 },
          tagName: 'section',
          className: 'p-6 bg-slate-800/30 rounded-2xl border border-slate-800 flex flex-col items-center justify-center text-center',
          codeSnippet: `export const HeroBanner: React.FC = () => (
  <section className="p-6 bg-slate-800/30 rounded-2xl border border-slate-800 flex flex-col items-center justify-center text-center">
    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">Next-Gen AI Platform</span>
    <h1 className="text-2xl font-extrabold mt-3 tracking-tight text-white">Supercharge Your Engineering Workflow</h1>
    <p className="text-slate-400 text-xs mt-2 max-w-lg mx-auto leading-relaxed">Inspect components across Web, Mobile, and Desktop. Redesign, refactor, and apply patches directly to your local codebase.</p>
  </section>
);`,
          styles: {
            backgroundColor: '#0f172a',
            textColor: '#f8fafc',
            fontSize: '24px',
            borderRadius: '16px',
          },
        },
        {
          id: 'web-elem-footer',
          name: 'Footer Bar',
          selector: 'footer.app-footer',
          bounds: { x: 40, y: 690, width: 1120, height: 44 },
          tagName: 'footer',
          className: 'text-[11px] text-slate-500 text-center py-2 border-t border-slate-800/80',
          codeSnippet: `export const Footer: React.FC = () => (
  <footer className="text-[11px] text-slate-500 text-center py-2 border-t border-slate-800/80">
    © 2026 AcmeCloud Inc. All rights reserved.
  </footer>
);`,
          styles: {
            backgroundColor: '#020617',
            textColor: '#64748b',
            fontSize: '11px',
            borderRadius: '0px',
          },
        },
      ],
    },
    {
      id: 'mobile-app',
      platform: 'mobile',
      name: 'Finance & Crypto Mobile App',
      viewport: { width: 390, height: 844 },
      description: 'Android/iOS mobile screen with balance card, action buttons, and transaction list',
      interactiveElements: [
        {
          id: 'mobile-elem-balance-card',
          name: 'Balance Card',
          selector: 'CardView#balanceCard',
          bounds: { x: 24, y: 90, width: 342, height: 180 },
          tagName: 'CardView',
          className: 'bg-gradient-to-r from-blue-700 to-indigo-800 rounded-3xl p-6 text-white',
          codeSnippet: `export const BalanceCard = () => {
  return (
    <div className="p-6 bg-blue-700 rounded-2xl text-white">
      <span className="text-xs text-blue-200">Total Portfolio Value</span>
      <h2 className="text-2xl font-bold mt-1">$48,295.40</h2>
      <div className="mt-3 flex gap-2">
        <button className="px-3 py-1 bg-white text-blue-700 rounded text-xs font-semibold">Deposit</button>
        <button className="px-3 py-1 bg-blue-800 text-white rounded text-xs">Send</button>
      </div>
    </div>
  );
};`,
          styles: {
            backgroundColor: '#1d4ed8',
            textColor: '#ffffff',
            fontSize: '24px',
            borderRadius: '16px',
          },
        },
        {
          id: 'mobile-elem-cta',
          name: 'Deposit CTA Button',
          selector: 'Button#btnDeposit',
          bounds: { x: 44, y: 200, width: 110, height: 42 },
          tagName: 'Button',
          className: 'px-3 py-1 bg-white text-blue-700 rounded text-xs font-semibold',
          codeSnippet: `<button className="px-3 py-1 bg-white text-blue-700 rounded text-xs font-semibold">Deposit</button>`,
          styles: {
            backgroundColor: '#ffffff',
            textColor: '#1d4ed8',
            fontSize: '12px',
            borderRadius: '6px',
          },
        },
        {
          id: 'mobile-elem-yield',
          name: 'Monthly Yield Widget',
          selector: 'div#monthlyYield',
          bounds: { x: 24, y: 290, width: 165, height: 95 },
          tagName: 'div',
          className: 'p-4 bg-slate-900 rounded-2xl border border-slate-800',
          codeSnippet: `export const MonthlyYieldWidget: React.FC = () => (
  <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800">
    <span className="text-xs text-slate-400">Monthly Yield</span>
    <div className="text-lg font-bold text-indigo-400 mt-1">8.4% APY</div>
  </div>
);`,
          styles: {
            backgroundColor: '#0f172a',
            textColor: '#818cf8',
            fontSize: '18px',
            borderRadius: '16px',
          },
        },
        {
          id: 'mobile-elem-rewards',
          name: 'Total Rewards Widget',
          selector: 'div#totalRewards',
          bounds: { x: 201, y: 290, width: 165, height: 95 },
          tagName: 'div',
          className: 'p-4 bg-slate-900 rounded-2xl border border-slate-800',
          codeSnippet: `export const TotalRewardsWidget: React.FC = () => (
  <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800">
    <span className="text-xs text-slate-400">Total Rewards</span>
    <div className="text-lg font-bold text-emerald-400 mt-1">+$320.12</div>
  </div>
);`,
          styles: {
            backgroundColor: '#0f172a',
            textColor: '#34d399',
            fontSize: '18px',
            borderRadius: '16px',
          },
        },
        {
          id: 'mobile-elem-transactions',
          name: 'Recent Transactions List',
          selector: 'div#recentTransactions',
          bounds: { x: 24, y: 400, width: 342, height: 140 },
          tagName: 'div',
          className: 'space-y-2',
          codeSnippet: `export const RecentTransactions: React.FC = () => (
  <div className="space-y-2">
    <span className="text-xs font-semibold text-slate-400 block mb-1">Recent Transactions</span>
    <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800/80 flex items-center justify-between text-xs">
      <div>
        <div className="font-medium text-white">Bitcoin Purchase</div>
        <div className="text-[10px] text-slate-500">Today, 2:15 PM</div>
      </div>
      <span className="text-emerald-400 font-bold">+0.045 BTC</span>
    </div>
  </div>
);`,
          styles: {
            backgroundColor: '#0f172a',
            textColor: '#f8fafc',
            fontSize: '12px',
            borderRadius: '12px',
          },
        },
        {
          id: 'mobile-elem-nav',
          name: 'Mobile Navigation Bar',
          selector: 'nav.mobile-bottom-nav',
          bounds: { x: 24, y: 760, width: 342, height: 56 },
          tagName: 'nav',
          className: 'bg-slate-900/90 rounded-2xl border border-slate-800 flex items-center justify-around text-xs text-slate-400',
          codeSnippet: `export const MobileNav: React.FC = () => (
  <nav className="bg-slate-900/90 rounded-2xl border border-slate-800 flex items-center justify-around text-xs text-slate-400 p-3">
    <span className="text-indigo-400 font-semibold">Home</span>
    <span>Markets</span>
    <span>Activity</span>
    <span>Settings</span>
  </nav>
);`,
          styles: {
            backgroundColor: '#0f172a',
            textColor: '#94a3b8',
            fontSize: '12px',
            borderRadius: '16px',
          },
        },
      ],
    },
    {
      id: 'desktop-admin',
      platform: 'desktop',
      name: 'Analytics Desktop Dashboard',
      viewport: { width: 1280, height: 800 },
      description: 'Native desktop application with sidebar, telemetry chart, and status widget',
      interactiveElements: [
        {
          id: 'desktop-elem-widget',
          name: 'Active Server Metric Widget',
          selector: 'QWidget#metricWidget',
          bounds: { x: 260, y: 110, width: 320, height: 150 },
          tagName: 'QWidget',
          className: 'bg-slate-800 rounded-lg p-4 border border-slate-700',
          codeSnippet: `export const MetricWidget = () => (
  <div className="p-4 bg-slate-800 rounded-lg border border-slate-700 text-slate-100">
    <div className="text-xs text-slate-400">CPU Usage</div>
    <div className="text-3xl font-mono font-bold mt-1 text-emerald-400">42.8%</div>
    <div className="text-xs text-slate-400 mt-2">16 Cores Online • 3.4 GHz</div>
  </div>
);`,
          styles: {
            backgroundColor: '#1e293b',
            textColor: '#34d399',
            fontSize: '30px',
            borderRadius: '8px',
          },
        },
        {
          id: 'desktop-elem-memory',
          name: 'Memory Utilization Widget',
          selector: 'div#memoryWidget',
          bounds: { x: 610, y: 110, width: 320, height: 150 },
          tagName: 'div',
          className: 'p-5 bg-slate-900 rounded-2xl border border-slate-800 flex flex-col justify-between',
          codeSnippet: `export const MemoryWidget = () => (
  <div className="p-5 bg-slate-900 rounded-2xl border border-slate-800 flex flex-col justify-between">
    <div>
      <div className="text-xs text-slate-400">Memory Utilization</div>
      <div className="text-3xl font-mono font-bold mt-1 text-cyan-400">18.2 / 64 GB</div>
    </div>
    <p className="text-xs text-slate-500">DDR5 ECC RAM • Low Latency</p>
  </div>
);`,
          styles: {
            backgroundColor: '#0f172a',
            textColor: '#22d3ee',
            fontSize: '30px',
            borderRadius: '16px',
          },
        },
        {
          id: 'desktop-elem-sidebar',
          name: 'Left Sidebar Navigation',
          selector: 'aside.sidebar',
          bounds: { x: 24, y: 60, width: 210, height: 710 },
          tagName: 'aside',
          className: 'bg-slate-900/60 rounded-xl p-3 border border-slate-800 flex flex-col gap-2 text-xs text-slate-400',
          codeSnippet: `export const DesktopSidebar = () => (
  <aside className="bg-slate-900/60 rounded-xl p-3 border border-slate-800 flex flex-col gap-2 text-xs text-slate-400">
    <span className="px-3 py-2 bg-indigo-600 text-white rounded-lg font-medium">Dashboard</span>
    <span className="px-3 py-2 hover:text-white rounded-lg hover:bg-slate-800">Nodes & Pods</span>
    <span className="px-3 py-2 hover:text-white rounded-lg hover:bg-slate-800">Network Traffic</span>
    <span className="px-3 py-2 hover:text-white rounded-lg hover:bg-slate-800">Security Audits</span>
  </aside>
);`,
          styles: {
            backgroundColor: '#0f172a',
            textColor: '#94a3b8',
            fontSize: '12px',
            borderRadius: '12px',
          },
        },
        {
          id: 'desktop-elem-telemetry',
          name: 'Live Node Telemetry Activity',
          selector: 'section#telemetryChart',
          bounds: { x: 260, y: 290, width: 980, height: 480 },
          tagName: 'section',
          className: 'p-6 bg-slate-900/40 rounded-2xl border border-slate-800/80 flex flex-col justify-between',
          codeSnippet: `export const TelemetryActivityTable = () => (
  <section className="p-6 bg-slate-900/40 rounded-2xl border border-slate-800/80 flex flex-col justify-between">
    <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800 pb-3">
      <span className="font-semibold text-white">Live Node Telemetry Activity</span>
      <span className="text-emerald-400 font-mono">16/16 Nodes Healthy</span>
    </div>
    <div className="h-64 flex items-end gap-2 pt-4">
      {/* 16 Telemetry Bar Columns */}
    </div>
    <div className="text-[11px] text-slate-500 flex justify-between pt-2 border-t border-slate-800">
      <span>15m ago</span>
      <span>10m ago</span>
      <span>5m ago</span>
      <span>Just now</span>
    </div>
  </section>
);`,
          styles: {
            backgroundColor: '#090d16',
            textColor: '#ffffff',
            fontSize: '14px',
            borderRadius: '16px',
          },
        },
        {
          id: 'desktop-elem-titlebar',
          name: 'Desktop Window Titlebar',
          selector: 'header.window-titlebar',
          bounds: { x: 0, y: 0, width: 1280, height: 36 },
          tagName: 'header',
          className: 'h-9 bg-slate-900 border-b border-slate-800 flex items-center px-4 justify-between text-xs text-slate-400',
          codeSnippet: `export const WindowTitlebar = () => (
  <header className="h-9 bg-slate-900 border-b border-slate-800 flex items-center px-4 justify-between text-xs text-slate-400">
    <div className="flex items-center gap-2">
      <div className="w-3 h-3 rounded-full bg-rose-500" />
      <div className="w-3 h-3 rounded-full bg-amber-500" />
      <div className="w-3 h-3 rounded-full bg-emerald-500" />
      <span className="ml-2 font-medium text-slate-300">Server Fleet Manager v2.4</span>
    </div>
    <span>Admin Session (US-East)</span>
  </header>
);`,
          styles: {
            backgroundColor: '#0f172a',
            textColor: '#cbd5e1',
            fontSize: '12px',
            borderRadius: '0px',
          },
        },
      ],
    },
  ];

  res.json({ success: true, samples });
});

export default router;
