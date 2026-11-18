import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { parse } from 'parse5';
import parseSrcset from '@prettier/parse-srcset';
import { cbor } from '@smithy/core/cbor';
import sax from 'sax';

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
            if (attr.name === 'srcset' && attr.value.trim()) {
              for (const candidate of parseSrcset(attr.value))
                links.push(candidate.source.value);
            }
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

async function requireFile(file) {
  const info = await stat(file);
  if (!info.isFile() || !info.size)
    throw new Error(`构建产物为空或不是文件：${file}`);
}

// Pagefind 1.6 bundles carry this signature, with or without gzip compression.
async function readBundle(file) {
  const bytes = await readFile(file);
  const data =
    bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes) : bytes;
  if (
    !data.subarray(0, 12).equals(Buffer.from('pagefind_dcd')) ||
    data.length <= 12
  )
    throw new Error(`无效的 Pagefind 文件：${file}`);
  return data.subarray(12);
}

function indexId(value) {
  if (typeof value !== 'string' || !/^[\w-]+$/.test(value))
    throw new Error('Pagefind 索引标识无效。');
  return value;
}

export async function validateSearchIndex(folder) {
  await requireFile(path.join(folder, 'pagefind.js'));
  await requireFile(path.join(folder, 'pagefind-worker.js'));
  const manifest = JSON.parse(
    await readFile(path.join(folder, 'pagefind-entry.json'), 'utf8'),
  );
  if (
    !manifest.languages ||
    Array.isArray(manifest.languages) ||
    typeof manifest.languages !== 'object' ||
    !manifest.version
  )
    throw new Error('Pagefind 索引清单缺少版本或语言列表。');
  const languages = Object.values(manifest.languages);
  if (
    !languages.length &&
    (await readdir(folder)).some((file) => file.endsWith('.pf_meta'))
  )
    throw new Error('Pagefind 索引清单遗漏了已生成的语言索引。');
  const files = new Set();
  for (const language of languages) {
    files.add(`wasm.${indexId(language.wasm ?? 'unknown')}.pagefind`);
    const meta = path.join(
      folder,
      `pagefind.${indexId(language.hash)}.pf_meta`,
    );
    const [version, pages, indexes, filters] = cbor.deserialize(
      await readBundle(meta),
    );
    if (
      version !== manifest.version ||
      !Array.isArray(pages) ||
      pages.length !== language.page_count ||
      !Array.isArray(indexes) ||
      !Array.isArray(filters)
    )
      throw new Error(`Pagefind 语言索引与清单不符：${meta}`);
    // A bundled page points at a shared fragment; an unbundled page uses its own hash.
    for (const [hash, , group] of pages)
      files.add(`fragment/${indexId(group || hash)}.pf_fragment`);
    for (const [, , hash] of indexes)
      files.add(`index/${indexId(hash)}.pf_index`);
    for (const [, hash] of filters)
      files.add(`filter/${indexId(hash)}.pf_filter`);
  }
  for (const name of files) await readBundle(path.join(folder, name));
}

export async function validateArtifacts(root) {
  await validateSearchIndex(path.join(root, 'pagefind'));
  for (const file of ['index.html', 'robots.txt', '404.html'])
    await requireFile(path.join(root, file));
  for (const [file, expectedRoot] of [
    ['rss.xml', 'rss'],
    ['audio/rss.xml', 'rss'],
    ['sitemap.xml', 'urlset'],
  ]) {
    const parser = sax.parser(true);
    let rootTag;
    parser.onopentag = (tag) => {
      rootTag ??= tag.name;
    };
    parser.onerror = (error) => {
      throw new Error(`无效的 XML：${file}`, { cause: error });
    };
    parser.write(await readFile(path.join(root, file), 'utf8')).close();
    if (rootTag !== expectedRoot)
      throw new Error(`XML 根元素应为 ${expectedRoot}：${file}`);
  }
}
