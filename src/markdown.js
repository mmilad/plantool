/**
 * Minimal, safe Markdown renderer for untrusted repository text.
 * Everything is HTML-escaped first; raw HTML is never interpreted. Supported: ATX headings,
 * paragraphs, ordered/unordered lists, blockquotes, fenced code, horizontal rules, inline
 * code, **bold**, *italic*, [links](target). Only http(s) links and internal plantool IDs that
 * resolve(id) knows are clickable; images and other targets render as plain text.
 * The function is self-contained so the UI can embed it with Function.prototype.toString().
 *
 * @param {string} source
 * @param {{ resolve?: (id: string) => ({ href: string, label: string, type: string } | null), headingOffset?: number }} [options]
 * @returns {string} HTML
 */
export function renderMarkdown(source, options = {}) {
  const resolve = options.resolve || (() => null);
  const offset = options.headingOffset ?? 2;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const internal = (id, text) => {
    const hit = resolve(id);
    if (!hit) return '<span class="md-missing" title="Unresolved plantool reference">' + esc(text || id) + '</span>';
    return '<a class="md-internal" href="' + esc(hit.href) + '" data-internal-type="' + esc(hit.type) + '" data-internal-id="' + esc(id) + '">' + esc(text || hit.label) + ' <span class="md-type">' + esc(hit.type) + '</span></a>';
  };
  const link = (text, target) => {
    const t = target.trim().replace(/^<|>$/g, '');
    const id = t.replace(/^plantool:/i, '');
    if (UUID.test(id)) return internal(id, text);
    if (/^https?:\/\/[^\s]+$/i.test(t)) return '<a class="md-external" href="' + esc(t) + '" target="_blank" rel="noopener noreferrer nofollow">' + esc(text) + ' <span aria-label="(external link)">↗</span></a>';
    return esc(text) + ' <span class="md-unsafe">(' + esc(t) + ')</span>';
  };
  const inline = text => {
    const out = []; let i = 0;
    const tokens = /(`+)([\s\S]*?)\1|!\[([^\]]*)\]\(([^)\s]*)[^)]*\)|\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*\s][^*]*)\*|\b_([^_\s][^_]*)_\b|\b([0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\b|(https?:\/\/[^\s<>()]+[^\s<>().,;:!?])/gi;
    let m;
    while ((m = tokens.exec(text))) {
      out.push(esc(text.slice(i, m.index))); i = tokens.lastIndex;
      if (m[1]) out.push('<code>' + esc(m[2]) + '</code>');
      else if (m[3] !== undefined || m[4] !== undefined) out.push('<span class="md-image">[image: ' + esc(m[3] || m[4] || '') + ']</span>');
      else if (m[5]) out.push(link(m[5], m[6]));
      else if (m[7] || m[8]) out.push('<strong>' + inline(m[7] || m[8]) + '</strong>');
      else if (m[9] || m[10]) out.push('<em>' + inline(m[9] || m[10]) + '</em>');
      else if (m[11]) out.push(resolve(m[11]) ? internal(m[11], '') : esc(m[11]));
      else if (m[12]) out.push(link(m[12], m[12]));
    }
    out.push(esc(text.slice(i)));
    return out.join('');
  };
  const lines = String(source ?? '').replace(/\r\n?/g, '\n').split('\n');
  const html = []; let para = []; let list = null; let quote = [];
  const flushPara = () => { if (para.length) { html.push('<p>' + inline(para.join(' ')) + '</p>'); para = []; } };
  const flushList = () => { if (list) { html.push('<' + list.tag + '>' + list.items.map(x => '<li>' + inline(x) + '</li>').join('') + '</' + list.tag + '>'); list = null; } };
  const flushQuote = () => { if (quote.length) { html.push('<blockquote>' + renderMarkdown(quote.join('\n'), options) + '</blockquote>'); quote = []; } };
  const flushAll = () => { flushPara(); flushList(); flushQuote(); };
  for (let n = 0; n < lines.length; n++) {
    const line = lines[n];
    const fence = /^\s*(```+|~~~+)\s*([\w-]*)\s*$/.exec(line);
    if (fence) {
      flushAll(); const body = []; n++;
      while (n < lines.length && !lines[n].trim().startsWith(fence[1])) body.push(lines[n++]);
      html.push('<pre class="md-code"><code>' + esc(body.join('\n')) + '</code></pre>'); continue;
    }
    if (/^\s*>/.test(line)) { flushPara(); flushList(); quote.push(line.replace(/^\s*>\s?/, '')); continue; } else flushQuote();
    const h = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (h) { flushAll(); const level = Math.min(6, h[1].length + offset); html.push('<h' + level + '>' + inline(h[2]) + '</h' + level + '>'); continue; }
    if (/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(line)) { flushAll(); html.push('<hr>'); continue; }
    const li = /^\s*([-*+]|\d+[.)])\s+(.*)$/.exec(line);
    if (li) { flushPara(); const tag = /\d/.test(li[1]) ? 'ol' : 'ul'; if (!list || list.tag !== tag) { flushList(); list = { tag, items: [] }; } list.items.push(li[2]); continue; }
    if (!line.trim()) { flushAll(); continue; }
    if (list && /^\s{2,}\S/.test(line)) { list.items[list.items.length - 1] += ' ' + line.trim(); continue; }
    flushList(); para.push(line.trim());
  }
  flushAll();
  return html.join('\n');
}

/** Plain-text preview from Markdown: strips syntax, cuts at a word boundary and marks truncation. */
export function markdownPreview(source, max = 160) {
  const text = String(source ?? '').replace(/```[\s\S]*?```/g, ' ').replace(/^\s*#{1,6}\s+/gm, '').replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*_`>#]/g, '').replace(/^\s*([-+]|\d+[.)])\s+/gm, '').replace(/\s+/g, ' ').trim();
  if (text.length <= max) return { text, truncated: false };
  const cut = text.slice(0, max); const at = cut.lastIndexOf(' ');
  return { text: (at > max * 0.6 ? cut.slice(0, at) : cut).replace(/[\s,;:.-]+$/, '') + ' …', truncated: true };
}
