import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  mkdir,
  readdir,
  writeFile,
  rename,
  rm,
} from 'node:fs/promises';
import { openSearch } from './helpers/search.mjs';
import * as pagefind from 'pagefind';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  validateBuild,
  validateArtifacts,
  validateSearchIndex,
} from '../scripts/build-validation.mjs';
test('build validation covers relative assets and actual page anchors', async () => {
  const folder = await mkdtemp(path.join(tmpdir(), 'linsto-links-'));
  try {
    await mkdir(path.join(folder, 'essay'));
    await writeFile(
      path.join(folder, 'essay/index.html'),
      '<h1 id="title">文章</h1><a href="#title">标题</a><img src="./photo.png">',
    );
    await assert.rejects(
      validateBuild(folder, 'https://example.org'),
      /photo.png/,
    );
    await writeFile(path.join(folder, 'essay/photo.png'), 'fixture');
    assert.equal(await validateBuild(folder, 'https://example.org'), 2);
    await writeFile(
      path.join(folder, 'essay/index.html'),
      '<a href="#missing">标题</a>',
    );
    await assert.rejects(validateBuild(folder, 'https://example.org'), /锚点/);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});

test('srcset checks each URL including candidates after data URLs and filenames with commas', async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'linsto-srcset-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await writeFile(
    path.join(dir, 'index.html'),
    '<picture><source srcset="data:image/png;base64,AAAA 1x, photo,blue.png 2x"><img srcset="photo,blue.png 640w"></picture>',
  );
  await assert.rejects(
    validateBuild(dir, 'https://example.org'),
    /photo,blue\.png/,
  );
  await writeFile(path.join(dir, 'photo,blue.png'), 'image');
  assert.equal(await validateBuild(dir, 'https://example.org'), 2);
});

test('build verification follows the real Pagefind manifest, grouped fragments, indexes and filters', async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'linsto-index-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const dest = path.join(dir, 'pagefind');
  const { index } = await pagefind.createIndex({ maxFragments: 1 });
  assert.ok(index);
  try {
    for (const url of ['/first/', '/second/']) {
      await index.addHTMLFile({
        url,
        content:
          '<html lang="en"><body data-pagefind-body><h1>Orchards</h1><span data-pagefind-filter="type">writing</span></body></html>',
      });
    }
    assert.deepEqual((await index.writeFiles({ outputPath: dest })).errors, []);
  } finally {
    await index.deleteIndex();
    await pagefind.close();
  }
  await mkdir(path.join(dir, 'audio'));
  const rss = '<rss version="2.0"><channel><title>Test</title></channel></rss>';
  for (const name of ['rss.xml', 'audio/rss.xml'])
    await writeFile(path.join(dir, name), rss);
  await writeFile(path.join(dir, 'sitemap.xml'), '<urlset/>');
  for (const file of ['index.html', '404.html', 'robots.txt'])
    await writeFile(path.join(dir, file), 'fixture');
  await validateArtifacts(dir);

  const { index: search } = await openSearch(t, dir);
  const result = await search.search('Orchards');
  assert.equal(result.results.length, 2);
  assert.match((await result.results[0].data()).url, /^\/(first|second)\/$/);

  const bundle = await readdir(dest);
  const required = [
    'pagefind-entry.json',
    bundle.find((f) => f.endsWith('.pf_meta'))!,
    bundle.find((f) => f.startsWith('wasm.en'))!,
  ];
  for (const subdir of ['fragment', 'index', 'filter'])
    required.push(
      path.join(subdir, (await readdir(path.join(dest, subdir)))[0]),
    );
  for (const relative of required) {
    const file = path.join(dest, relative);
    await rename(file, file + '.missing');
    await assert.rejects(validateSearchIndex(dest), (err: Error) =>
      err.message.includes(path.basename(file)),
    );
    await rename(file + '.missing', file);
  }
  await writeFile(path.join(dir, 'rss.xml'), '<rss><channel></rss>');
  await assert.rejects(validateArtifacts(dir), /rss\.xml/);
  await writeFile(path.join(dir, 'rss.xml'), '');
  await assert.rejects(validateArtifacts(dir), /rss\.xml/);
  await writeFile(path.join(dest, 'pagefind-entry.json'), '{');
  await assert.rejects(validateSearchIndex(dest));
});
