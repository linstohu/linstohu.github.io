import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'parse5';

export async function validateBuild(directory, origin) {
  const root = path.resolve(directory);
  const documents = new Map();
  async function walk(folder) {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      const filename = path.join(folder, entry.name);
      if (entry.isDirectory()) await walk(filename);
      else if (entry.name.endsWith('.html')) {
        const ids = new Set(),
          links = [];
        const tree = parse(await readFile(filename, 'utf8'));
        function visit(node) {
          for (const attr of node.attrs || []) {
            if (
              attr.name === 'id' ||
              (node.tagName === 'a' && attr.name === 'name')
            )
              ids.add(attr.value);
            if (
              ['href', 'src', 'poster'].includes(attr.name) &&
              attr.value.trim()
            )
              links.push(attr.value);
            if (attr.name === 'srcset' && !attr.value.startsWith('data:'))
              for (const candidate of attr.value.split(','))
                links.push(candidate.trim().split(/\s+/)[0]);
          }
          for (const child of node.childNodes || []) visit(child);
        }
        visit(tree);
        documents.set(filename, { ids, links });
      }
    }
  }
  await walk(root);
  let checked = 0;
  for (const [filename, { links }] of documents) {
    const current = new URL(
      '/' +
        path
          .relative(root, filename)
          .split(path.sep)
          .join('/')
          .replace(/index\.html$/, ''),
      origin,
    );
    for (const value of links) {
      const url = new URL(value, current);
      if (
        !['https:', 'http:'].includes(url.protocol) ||
        url.origin !== current.origin
      )
        continue;
      let target = path.resolve(root, '.' + decodeURIComponent(url.pathname));
      if (target !== root && !target.startsWith(root + path.sep))
        throw new Error(`地址超出站点目录：${value}`);
      try {
        if ((await stat(target)).isDirectory())
          target = path.join(target, 'index.html');
        await stat(target);
        if (
          url.hash &&
          documents.has(target) &&
          !documents.get(target).ids.has(decodeURIComponent(url.hash.slice(1)))
        )
          throw new Error('找不到页内锚点');
      } catch (error) {
        throw new Error(
          `站内地址失效：${path.relative(root, filename)} → ${value} (${error.message})`,
        );
      }
      checked++;
    }
  }
  return checked;
}
