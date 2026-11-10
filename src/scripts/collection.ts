export function initCollection() {
  interface SearchData {
    meta: Record<string, string>;
  }
  interface Pagefind {
    search(
      query: string,
      options?: { filters: { type: string } },
    ): Promise<{ results: { data(): Promise<SearchData> }[] }>;
  }
  let indexPromise: Promise<Pagefind> | undefined;
  function getSearchIndex() {
    const path = '/pagefind/pagefind.js';
    return (indexPromise ||= import(
      /* @vite-ignore */ path
    ) as Promise<Pagefind>);
  }
  const collection = document.querySelector<HTMLElement>('[data-collection]');
  if (collection) {
    const input = collection.querySelector<HTMLInputElement>(
      'input[type="search"]',
    )!;
    const rows = [
      ...collection.querySelectorAll<HTMLElement>('[data-entry-key]'),
    ];
    const buttons = [
      ...collection.querySelectorAll<HTMLButtonElement>('[data-filter]'),
    ];
    const feature = collection.querySelector<HTMLElement>('[data-feature]');
    const results = collection.querySelector<HTMLElement>('#rows');
    const status = collection.querySelector('[role="status"]');
    const notice = collection.querySelector<HTMLElement>('.search-notice');
    const empty = collection.querySelector<HTMLElement>('.empty-list');
    const parameters = new URLSearchParams(location.search);
    const requestedTag =
      collection.dataset.group === 'audio' &&
      parameters.get('tag') === '独立录音'
        ? '声音手记'
        : parameters.get('tag');
    let selected = buttons.some(
      (button) => button.dataset.filter === requestedTag,
    )
      ? requestedTag!
      : '全部';
    let generation = 0;
    let timeout: ReturnType<typeof setTimeout>;
    const archiveTypes: Record<string, string> = {
      文字: 'writing',
      声音: 'audio',
      此刻: 'now',
    };
    const noun =
      collection.dataset.group === 'writing'
        ? '篇文字'
        : collection.dataset.group === 'audio'
          ? '条声音'
          : '条记录';
    async function update() {
      const current = ++generation;
      const query = input.value.trim();
      const browsing = selected === '全部' && !query;
      const url = new URL(location.href);
      query ? url.searchParams.set('q', query) : url.searchParams.delete('q');
      selected !== '全部'
        ? url.searchParams.set('tag', selected)
        : url.searchParams.delete('tag');
      history.replaceState(null, '', url);
      for (const button of buttons)
        button.setAttribute(
          'aria-pressed',
          String(button.dataset.filter === selected),
        );
      let keys: Set<string> | undefined;
      if (notice) notice.hidden = true;
      if (query && !import.meta.env.DEV) {
        if (status) status.textContent = '正在查找…';
        try {
          const index = await getSearchIndex();
          const group = collection!.dataset.group;
          const type = group === 'archive' ? archiveTypes[selected] : group;
          const result = await index.search(
            query,
            type ? { filters: { type } } : undefined,
          );
          const records = await Promise.all(
            result.results.map((item) => item.data()),
          );
          keys = new Set(records.map((item) => item.meta.entry_key));
        } catch {
          /* Leave keys unset so title and summary search remains available. */
        }
      }
      if (current !== generation) return;
      if (query && !keys && notice) {
        notice.hidden = false;
        notice.textContent = import.meta.env.DEV
          ? '本地编辑预览仅搜索标题与摘要；完整正文搜索请运行构建预览。'
          : '全文索引暂未载入，当前按标题与摘要查找。';
      }
      // Keep the visible results area steady when narrowing the list. Cap the
      // reserved space at one viewport so long archives do not leave a large gap.
      if (feature && results) {
        results.style.minBlockSize = `min(${results.getBoundingClientRect().height}px, 100svh)`;
      }
      let count = 0;
      for (const row of rows) {
        const tags: string[] = JSON.parse(row.dataset.tags!);
        const matches =
          (selected === '全部' || tags.includes(selected)) &&
          (!query ||
            (keys
              ? keys.has(row.dataset.entryKey!)
              : row.dataset.searchText?.includes(query.toLowerCase()))) &&
          !(browsing && row.dataset.entryKey === collection!.dataset.latest);
        row.hidden = !matches;
        if (matches) count++;
      }
      if (status) status.textContent = `${count} ${noun}`;
      if (empty) {
        empty.hidden = count !== 0;
        empty.textContent =
          query || selected !== '全部'
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
}
