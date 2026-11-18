import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { hiddenMonths, writeReaderEntries } from './fixtures/reader.mjs';
import { attr, elements, textOf } from './helpers/html.ts';
import { createTestProject } from './helpers/project.mjs';
import { openSearch } from './helpers/search.mjs';

describe('monthly snapshots and collection search', () => {
  let project: Awaited<ReturnType<typeof createTestProject>>;
  before(async () => {
    project = await createTestProject();
    await writeReaderEntries(project);
    project.build();
    project.index();
  });
  after(() => project?.dispose());

  it('renders current Markdown, historical notes and list-only monthly summaries', async () => {
    for (const route of ['now', 'now/2025/11']) {
      const html = await project.page(route);
      assert.match(html, /我的 <strong>月度正文<\/strong>/);
      assert.match(html, /href="\/about\/">一条链接<\/a>/);
    }
    const old = await project.page('now/2024/11');
    assert.match(old, /<code>Supported Regions Policy<\/code>/);
    assert.match(old, /这也是正文。/);
    assert.match(
      await project.page('now/archive'),
      /<p>只用列表记录近况。<\/p>/,
    );
    assert.match(await project.page(''), /我的 月度正文/);
  });

  it('keeps unpublished months out of detail pages, navigation, both archives and sitemap', async () => {
    const routes = ['', 'now', 'now/2025/11', 'now/archive', 'archive'];
    const docs = await Promise.all(routes.map((route) => project.page(route)));
    docs.push(await readFile(path.join(project.output, 'sitemap.xml'), 'utf8'));
    for (const doc of docs)
      assert.ok(
        doc.includes('/now/2025/11/'),
        'The published control must be present',
      );
    for (const month of hiddenMonths) {
      const route = '/now/' + month.period.replace('-', '/') + '/';
      await assert.rejects(
        stat(path.join(project.output, route, 'index.html')),
        { code: 'ENOENT' },
      );
      for (const [i, doc] of docs.entries())
        for (const value of [route, month.title, month.marker])
          assert.ok(
            !doc.includes(value),
            (routes[i] ?? 'sitemap.xml') + ' exposes ' + value,
          );
    }
  });

  it('indexes public monthly text and omits both private bodies and entry keys', async (t) => {
    const { index } = await openSearch(t, project.output);
    const filters = await index.filters();
    assert.ok(filters.entry_key['now:2025-11']);
    const { results } = await index.search('publicmonthword', {
      filters: { type: 'now' },
    });
    assert.equal(results.length, 1);
    for (const { period, marker } of hiddenMonths) {
      assert.equal(filters.entry_key['now:' + period], undefined);
      assert.equal((await index.search(marker)).results.length, 0, marker);
    }
  });

  it('shows the full date on the corresponding archive row across years', async () => {
    const rows = elements(await project.page('archive'), 'a');
    for (const year of ['2024', '2025']) {
      const row = rows.find(
        (el) => attr(el, 'href') === '/now/' + year + '/11/',
      );
      assert.ok(row);
      assert.equal(textOf(elements(row, 'time')[0]).trim(), year + '.11.17');
    }
  });

  it('keeps each same-named show’s count and subscription with its own ID', async () => {
    const cards = elements(await project.page('audio'), 'div').filter(
      (el) => attr(el, 'class') === 'audio-source-card',
    );
    for (const id of ['recording', 'autumn']) {
      const card = cards.find((el) =>
        elements(el, 'button').some(
          (button) => attr(button, 'data-filter') === id,
        ),
      );
      assert.ok(card, id);
      assert.equal(textOf(elements(card, 'strong')[0]), '同名栏目');
      assert.match(textOf(card), /1 期/);
      assert.deepEqual(
        elements(card, 'a').map((el) => attr(el, 'href')),
        ['https://example.org/' + id],
      );
    }
  });

  it('matches indexed writing metadata and scopes shared body terms without fetching result fragments', async (t) => {
    const sections = elements(
      await project.page('writing/conversation'),
      'details',
    ).filter((el) => attr(el, 'class') === 'reply-section');
    assert.equal(sections.length, 1);
    assert.equal(attr(sections[0], 'open'), undefined);
    assert.match(textOf(sections[0]), /leafmargin/);
    assert.doesNotMatch(textOf(sections[0]), /sharedorchard/);
    const { index, fragments } = await openSearch(t, project.output);
    await index.filters();
    const cases = [
      ...[
        'ChatGPT',
        'orcharddescription',
        'orchardmodel',
        'orchardtag',
        'Rowan',
        'sharedorchard',
        'leafmargin',
      ].map((q) => [q, 'writing', 'prompted', 'writing:conversation']),
      ['sharedorchard', 'audio', 'recording', 'audio:recording'],
      ['sharedorchard', 'audio', 'kind:recording', 'audio:field-note'],
      ['sharedorchard', 'audio', 'autumn', 'audio:autumn'],
    ];
    for (const [query, type, tag, key] of cases) {
      const result = await index.search(query, { filters: { type, tag } });
      assert.equal(result.results.length, 1, query);
      assert.equal(result.filters.entry_key[key], 1, query + ' / ' + tag);
    }
    assert.deepEqual(fragments, []);
  });
});
