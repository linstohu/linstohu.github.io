import { parseFragment, type DefaultTreeAdapterTypes } from 'parse5';

function textOf(node: DefaultTreeAdapterTypes.Node): string {
  if ('value' in node) return node.value;
  if (node.nodeName === 'br') return ' ';
  return 'childNodes' in node ? node.childNodes.map(textOf).join('') : '';
}

export function articleExcerpt(html: string, description: string): string {
  const prose: DefaultTreeAdapterTypes.Node[] = [];
  function collect(node: DefaultTreeAdapterTypes.Node) {
    if (node.nodeName === 'p') prose.push(node);
    else if (
      node.nodeName === '#document-fragment' ||
      ('attrs' in node &&
        node.attrs.some(
          (attr) =>
            attr.name === 'class' &&
            /\bdialogue-(turn|content)\b/.test(attr.value),
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
