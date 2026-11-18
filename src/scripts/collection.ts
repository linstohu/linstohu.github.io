interface Pagefind {
  filters(): Promise<unknown>;
  search(
    query: string,
    options: { filters: Record<string, string> },
  ): Promise<{
    results: unknown[];
    filters: { entry_key?: Record<string, number> };
  }>;
}
let indexPromise: Promise<Pagefind> | undefined;
function getSearchIndex(): Promise<Pagefind> {
  const path = '/pagefind/pagefind.js';
  return (indexPromise ??= (
    import(/* @vite-ignore */ path) as Promise<Pagefind>
  )
    .then(async (index) => {
      // Load facet counts once. Each hit can then identify its row without downloading its body.
      await index.filters();
      return index;
    })
    .catch((error) => {
      indexPromise = undefined;
      throw error;
    }));
}

export function initCollection() {
  const collection = document.querySelector<HTMLElement>('[data-collection]');
  if (!collection) return;
  const input = collection.querySelector<HTMLInputElement>(
    'input[type="search"]',
  )!;
  const rows = Array.from(
    collection.querySelectorAll<HTMLElement>('[data-entry-key]'),
    (row) => ({
      row,
      key: row.dataset.entryKey!,
      tags: JSON.parse(row.dataset.tags!) as string[],
      text: row.dataset.searchText ?? '',
    }),
  );
  const buttons = [
    ...collection.querySelectorAll<HTMLButtonElement>('[data-filter]'),
  ];
  const feature = collection.querySelector<HTMLElement>('[data-feature]');
  const results = collection.querySelector<HTMLElement>('#rows');
  const status = collection.querySelector('[role="status"]');
  const notice = collection.querySelector<HTMLElement>('.search-notice');
  const empty = collection.querySelector<HTMLElement>('.empty-list');
  const parameters = new URLSearchParams(location.search);
  const group = collection.dataset.group!;
  const requestedTag = parameters.get('tag') ?? '';
  const oldNames = buttons.filter((button) => {
    const aliases = button.dataset.legacyTags;
    return aliases && (JSON.parse(aliases) as string[]).includes(requestedTag);
  });
  let selected = buttons.some(
    (button) => button.dataset.filter === requestedTag,
  )
    ? requestedTag
    : oldNames.length === 1
      ? oldNames[0].dataset.filter!
      : '';
  let generation = 0;
  let timeout: ReturnType<typeof setTimeout>;
  const archiveTypes: Record<string, string> = {
    文字: 'writing',
    声音: 'audio',
    此刻: 'now',
  };
  const noun =
    group === 'writing' ? '篇文字' : group === 'audio' ? '条声音' : '条记录';
  async function update() {
    const current = ++generation;
    const query = input.value.trim();
    const browsing = !selected && !query;
    const url = new URL(location.href);
    query ? url.searchParams.set('q', query) : url.searchParams.delete('q');
    selected
      ? url.searchParams.set('tag', selected)
      : url.searchParams.delete('tag');
    history.replaceState(null, '', url);
    for (const button of buttons)
      button.setAttribute(
        'aria-pressed',
        String(button.dataset.filter === selected),
      );
    for (const note of collection!.querySelectorAll<HTMLElement>(
      '[data-category-note]',
    ))
      note.hidden = note.dataset.categoryNote !== selected;
    let hits: Record<string, number> | undefined;
    if (notice) notice.hidden = true;
    if (query && !import.meta.env.DEV) {
      if (status) status.textContent = '正在查找…';
      try {
        const index = await getSearchIndex();
        if (current !== generation) return;
        const filters: Record<string, string> = {};
        if (group === 'archive') {
          if (selected) filters.type = archiveTypes[selected];
        } else {
          filters.type = group;
          if (selected) filters.tag = selected;
        }
        const result = await index.search(query, { filters });
        hits = result.filters.entry_key;
        if (!result.results.length) hits = {};
      } catch {
        // The rendered row metadata is also searchable offline.
      }
    }
    if (current !== generation) return;
    if (query && !hits && notice) {
      notice.hidden = false;
      notice.textContent = import.meta.env.DEV
        ? '本地编辑预览仅搜索标题、摘要等信息。完整正文搜索请运行构建预览。'
        : '全文索引暂未载入，当前按标题、摘要等信息查找。';
    }
    // Keep the visible results area steady when narrowing the list. Cap the
    // reserved space at one viewport so long archives do not leave a large gap.
    if (feature && results) {
      results.style.minBlockSize = `min(${results.getBoundingClientRect().height}px, 100svh)`;
    }
    let count = 0;
    const term = query.toLowerCase();
    for (const { row, key, tags, text } of rows) {
      const matches =
        (!selected || tags.includes(selected)) &&
        (!term || text.includes(term) || (hits?.[key] ?? 0) > 0) &&
        !(browsing && key === collection!.dataset.latest);
      row.hidden = !matches;
      if (matches) count++;
    }
    if (status) status.textContent = `${count} ${noun}`;
    if (empty) {
      empty.hidden = count !== 0;
      empty.textContent =
        query || selected
          ? '没有找到这份记录，换个词再试试。'
          : '下一份记录，会留在这里。';
    }
  }
  input.addEventListener('input', () => {
    generation++;
    clearTimeout(timeout);
    timeout = setTimeout(update, 180);
  });
  for (const button of buttons)
    button.addEventListener('click', () => {
      selected = button.dataset.filter!;
      clearTimeout(timeout);
      void update();
    });
  void update();
}
