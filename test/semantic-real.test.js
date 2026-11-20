import test from 'node:test';
import assert from 'node:assert/strict';

// Runs the real embedding model. Off by default because it needs the optional package
// @huggingface/transformers and downloads the model (~120 MB) on first use:
//   PLANTOOL_TEST_REAL_MODEL=1 node --test test/semantic-real.test.js
const enabled = process.env.PLANTOOL_TEST_REAL_MODEL === '1';

const unrelated = [
  'Export the board as CSV', 'Dark mode for the settings page', 'Rate limit the public API', 'Migrate the database to schema v2',
  'Add a privacy policy page', 'Fix the typo in the onboarding email', 'Cache product images on the device', 'Set up continuous integration',
  'Translate the app to French', 'Show order history in the profile', 'Compress uploaded photos', 'Add keyboard shortcuts to the editor',
  'Send a weekly summary email', 'Measure page load time', 'Let admins suspend an account', 'Print shipping labels',
  'Add two-factor sign in', 'Sort the catalogue by price', 'Archive tickets older than a year', 'Document the release process',
].map((title, i) => ({ id: `u${i}`, title }));

test('real model: related tickets stand out among unrelated ones', { skip: enabled ? false : 'set PLANTOOL_TEST_REAL_MODEL=1 to run' }, async () => {
  delete process.env.PLANTOOL_EMBEDDER;
  const { getEmbedder, DEFAULT_MODEL } = await import('../src/embedder.js');
  const { relatedByEmbedding, HINT_STRENGTH } = await import('../src/semantic.js');
  const embedder = await getEmbedder();
  assert.equal(embedder.model, process.env.PLANTOOL_EMBED_MODEL || DEFAULT_MODEL);
  assert.ok(embedder.dim > 0);
  const p = { config: {} };
  const ticket = { title: 'Burger menu on mobile', description: 'On phones the navigation collapses behind a menu button.' };
  const twin = { id: 'twin', title: 'Hamburger navigation for small screens', description: 'Hide the nav links behind a toggle on narrow viewports.' };
  const sibling = { id: 'sibling', title: 'Desktop navigation bar', description: 'Horizontal nav links in the header on wide screens.' };
  const show = rows => rows.slice(0, 4).map(h => `${h.ticket.id} ${h.score.toFixed(3)}/${h.strength.toFixed(1)}`).join(', ');
  for (const related of [[twin], [twin, sibling]]) {
    const all = await relatedByEmbedding(p, ticket, [...unrelated, ...related], { embedder, minStrength: -Infinity, limit: 100 });
    const hits = await relatedByEmbedding(p, ticket, [...unrelated, ...related], { embedder });
    assert.deepEqual(hits.map(h => h.ticket.id).sort(), related.map(r => r.id).sort(), `score/strength: ${show(all)} (rule: >= ${HINT_STRENGTH})`);
  }
  // Without related tickets nothing should stand out.
  assert.deepEqual(await relatedByEmbedding(p, ticket, unrelated, { embedder }), []);
});
