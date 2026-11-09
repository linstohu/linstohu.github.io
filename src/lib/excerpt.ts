import { parseFragment, type DefaultTreeAdapterTypes } from 'parse5';

function textOf(node: DefaultTreeAdapterTypes.Node): string {
  if ('value' in node) return node.value;
  if (node.nodeName === 'br') return ' ';
  return 'childNodes' in node ? node.childNodes.map(textOf).join('') : '';
}

export function articleExcerpt(html: string, description: string): string {
  const paragraphs = parseFragment(html)
    .childNodes.filter((node) => node.nodeName === 'p')
    .map((node) => textOf(node).replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const summary = description.replace(/\s+/g, '').replace(/…$/, '');
  const passage =
    paragraphs.find((paragraph) => {
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
