import test from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown, markdownPreview } from '../src/markdown.js';

const ID = '01a189ac-28ff-73c2-8a77-2320703d3924', MISSING = '01a189ac-28ff-73c2-8a77-000000000000';
const resolve = id => id === ID ? { href: '/?document=' + id, label: 'UI goal', type: 'goal' } : null;

test('raw HTML, scripts and event handlers are escaped, never interpreted', () => {
  const html = renderMarkdown('<script>alert(1)</script>\n\n<img src=x onerror=alert(1)> **<b>x</b>**');
  assert.ok(!/<script|<img|<b>/i.test(html)); assert.match(html, /&lt;script&gt;/); assert.match(html, /<strong>&lt;b&gt;x&lt;\/b&gt;<\/strong>/);
});

test('only http(s) and resolvable internal links become clickable', () => {
  const html = renderMarkdown(`[a](javascript:alert(1)) [b](data:text/html,x) [c](file:///etc/passwd) [d](https://example.com/x) [e](${ID}) [f](heist:${MISSING})`, { resolve });
  assert.equal((html.match(/<a /g) || []).length, 2);
  assert.match(html, /href="https:\/\/example\.com\/x" target="_blank" rel="noopener noreferrer nofollow"/);
  assert.match(html, new RegExp(`href="/\\?document=${ID}"`)); assert.match(html, /md-missing/);
  assert.ok(!/href="(javascript|data|file):/i.test(html));
});

test('images are never loaded and bare IDs resolve only when known', () => {
  const html = renderMarkdown(`![logo](https://evil.example/x.png) ${ID} ${MISSING}`, { resolve });
  assert.ok(!html.includes('<img')); assert.match(html, /\[image: logo\]/);
  assert.match(html, /UI goal/); assert.ok(html.includes(MISSING) && !html.includes(`data-internal-id="${MISSING}"`));
});

test('block structure: headings are offset, lists, quotes, fenced code and rules', () => {
  const html = renderMarkdown('# Goal\n\nText *em* `code`\n\n- one\n- two\n\n1. first\n\n> quoted\n\n```\n<b>raw</b>\n```\n\n---', { headingOffset: 2 });
  assert.match(html, /<h3>Goal<\/h3>/); assert.match(html, /<ul><li>one<\/li><li>two<\/li><\/ul>/); assert.match(html, /<ol><li>first<\/li><\/ol>/);
  assert.match(html, /<blockquote><p>quoted<\/p><\/blockquote>/); assert.match(html, /<pre class="md-code"><code>&lt;b&gt;raw&lt;\/b&gt;<\/code><\/pre>/); assert.match(html, /<hr>/);
  assert.match(html, /<em>em<\/em> <code>code<\/code>/);
});

test('previews strip syntax and mark truncation at a word boundary', () => {
  assert.deepEqual(markdownPreview('## Goal\nShort.'), { text: 'Goal Short.', truncated: false });
  const p = markdownPreview('## Goal\n' + 'word '.repeat(80), 40);
  assert.equal(p.truncated, true); assert.ok(p.text.endsWith(' …')); assert.ok(!p.text.includes('#'));
});
