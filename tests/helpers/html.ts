import { parse, type DefaultTreeAdapterTypes } from 'parse5';

type Node = DefaultTreeAdapterTypes.Node;
type Element = DefaultTreeAdapterTypes.Element;

export function elements(root: string | Element, tag: string): Element[] {
  const matches: Element[] = [];
  function visit(parent: DefaultTreeAdapterTypes.ParentNode) {
    for (const child of parent.childNodes) {
      if (!('tagName' in child)) continue;
      if (child.tagName === tag) matches.push(child);
      visit(child);
    }
  }
  visit(typeof root === 'string' ? parse(root) : root);
  return matches;
}

export function attr(element: Element, name: string) {
  return element.attrs.find((item) => item.name === name)?.value;
}

export function textOf(node: Node): string {
  if ('value' in node) return node.value;
  return 'childNodes' in node ? node.childNodes.map(textOf).join('') : '';
}
