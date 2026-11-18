import { parseFragment, type DefaultTreeAdapterTypes } from 'parse5';

const proseContainers = new Set([
  'dialogue-round',
  'dialogue-turn',
  'dialogue-content',
  'reply-chapter',
  'reply-section',
  'snapshot-note',
  'snapshot-note-body',
]);

function textOf(node: DefaultTreeAdapterTypes.Node): string {
  if ('value' in node) return node.value;
  if (node.nodeName === 'br') return ' ';
  return 'childNodes' in node ? node.childNodes.map(textOf).join('') : '';
}

export function articleExcerpt(html: string, description: string): string {
  const prose: DefaultTreeAdapterTypes.Node[] = [];
  function collect(node: DefaultTreeAdapterTypes.Node) {
    if (
      'attrs' in node &&
      node.attrs.some((attr) => attr.name === 'data-pagefind-ignore')
    )
      return;
    if (node.nodeName === 'p' || (!description && node.nodeName === 'li'))
      prose.push(node);
    else if (
      node.nodeName === '#document-fragment' ||
      (!description && ['ul', 'ol', 'blockquote'].includes(node.nodeName)) ||
      ('attrs' in node &&
        node.attrs.some(
          (attr) =>
            attr.name === 'class' &&
            attr.value.split(/\s+/).some((name) => proseContainers.has(name)),
        ))
    ) {
      if ('childNodes' in node) node.childNodes.forEach(collect);
    }
  }
  collect(parseFragment(html));
  const paragraphs = prose
    .map((node) => textOf(node).replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const summary = description.replace(/\s+/g, '').replace(/…$/, '');
  const passage =
    paragraphs.find((paragraph) => {
      if (!summary) return true;
      const text = paragraph.replace(/\s+/g, '');
      return !summary.includes(text) && !text.startsWith(summary);
    }) ??
    paragraphs[0] ??
    description;
  if (passage.length <= 110) return passage;
  const opening = passage.slice(0, 110);
  const end = Math.max(
    ...['。', '！', '？'].map((mark) => opening.lastIndexOf(mark)),
  );
  return end >= 20 ? opening.slice(0, end + 1) : opening + '…';
}
