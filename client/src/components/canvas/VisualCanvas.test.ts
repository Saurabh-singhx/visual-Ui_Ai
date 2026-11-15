import { describe, it, expect } from 'vitest';
import { sanitizeHtml } from './VisualCanvas';

describe('sanitizeHtml in VisualCanvas', () => {
  it('strips <script> tags and malicious inline payloads', () => {
    const malicious = `
      <div className="card">
        <h1>Title</h1>
        <script>alert("pwned");</script>
        <script src="https://evil.com/malware.js"></script>
        <p>Safe content</p>
      </div>
    `;

    const clean = sanitizeHtml(malicious);
    expect(clean).not.toContain('<script');
    expect(clean).not.toContain('alert(');
    expect(clean).not.toContain('malware.js');
    expect(clean).toContain('<h1>Title</h1>');
    expect(clean).toContain('<p>Safe content</p>');
  });

  it('strips inline on* event handler attributes (onerror, onload, onclick)', () => {
    const malicious = `<img src="nonexistent.jpg" onerror="alert('xss')" onload="evil()" />`;
    const clean = sanitizeHtml(malicious);
    expect(clean).not.toContain('onerror');
    expect(clean).not.toContain('onload');
    expect(clean).not.toContain('alert(');
  });

  it('neutralizes javascript: URLs in href and src attributes', () => {
    const malicious = `<a href="javascript:alert(1)">Click Me</a><iframe src="javascript:evil()"></iframe>`;
    const clean = sanitizeHtml(malicious);
    expect(clean).not.toContain('javascript:alert(1)');
    expect(clean).not.toContain('<iframe');
    expect(clean).toContain('href="#"');
  });

  it('strips dangerous embed tags (<object>, <embed>, <applet>)', () => {
    const malicious = `
      <object data="malicious.swf"></object>
      <embed src="exploit.pdf"></embed>
      <applet code="Malicious.class"></applet>
    `;
    const clean = sanitizeHtml(malicious);
    expect(clean).not.toContain('<object');
    expect(clean).not.toContain('<embed');
    expect(clean).not.toContain('<applet');
  });
});
