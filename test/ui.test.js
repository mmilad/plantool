import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderAppHtml } from '../src/ui.js';

test('the web UI has a decisions view and its script parses', () => {
  const html = renderAppHtml('token');
  assert.ok(html.includes('id="decisions-page"'));
  assert.ok(html.includes('data-view="decisions"'));
  assert.ok(html.includes('id="decision-needs-person"'));
  const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1];
  assert.ok(script, 'page has an inline script');
  assert.doesNotThrow(() => new Function(script));
});
