const root = document.documentElement;
const themeButton = document.querySelector<HTMLButtonElement>('.theme');
function syncTheme() {
  const dark = root.dataset.theme === 'dark';
  if (themeButton) {
    themeButton.textContent = dark ? '☀ 浅色模式' : '☾ 深色模式';
    themeButton.setAttribute(
      'aria-label',
      dark ? '切换到浅色主题' : '切换到深色主题',
    );
  }
}
themeButton?.addEventListener('click', () => {
  root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
  try {
    localStorage.setItem('linsto-theme', root.dataset.theme);
  } catch {
    /* Storage may be disabled. */
  }
  syncTheme();
});
syncTheme();

const header = document.querySelector('body > header');
const menu = document.querySelector<HTMLButtonElement>('.mobile-menu');
function setMenu(open: boolean) {
  header?.setAttribute('data-menu-open', String(open));
  menu?.setAttribute('aria-expanded', String(open));
  menu?.setAttribute('aria-label', open ? '收起网站导航' : '展开网站导航');
}
menu?.addEventListener('click', () =>
  setMenu(menu.getAttribute('aria-expanded') !== 'true'),
);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') setMenu(false);
});
document.addEventListener('click', (event) => {
  if (!header?.contains(event.target as Node)) setMenu(false);
});
matchMedia('(min-width: 761px)').addEventListener('change', () =>
  setMenu(false),
);
document.querySelector('[data-back-top]')?.addEventListener('click', () => {
  window.scrollTo({
    top: 0,
    behavior: matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 'instant'
      : 'smooth',
  });
  document.querySelector<HTMLElement>('.brand')?.focus({ preventScroll: true });
});

interface Classic {
  id: string;
  text: string;
  author: string;
  work: string;
  url: string;
}
try {
  const quotes: Classic[] = JSON.parse(
    document.querySelector('#classics-library')?.textContent || '[]',
  );
  let last = '';
  try {
    last = sessionStorage.getItem('linsto-last-classic') || '';
  } catch {
    /* Optional preference. */
  }
  const candidates = quotes.filter((quote) => quote.id !== last);
  const pool = candidates.length ? candidates : quotes;
  const quote = pool[Math.floor(Math.random() * pool.length)];
  if (quote) {
    const copy = document.querySelector('.quote-copy');
    if (copy) {
      const text = document.createElement('p');
      text.textContent = quote.text;
      const cite = document.createElement('cite');
      const link = document.createElement('a');
      link.textContent = `${quote.author}《${quote.work}》`;
      link.href = quote.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      cite.append(link);
      copy.replaceChildren(text, cite);
    }
    try {
      sessionStorage.setItem('linsto-last-classic', quote.id);
    } catch {
      /* Optional preference. */
    }
  }
} catch {
  /* The server-rendered first quote remains available. */
}

if (document.querySelector('[data-collection]'))
  import('./collection').then((module) => module.initCollection());
if (document.querySelector('[data-audio-player]'))
  import('./audio').then((module) => module.initAudio());
if (document.querySelector('.image-open'))
  import('./images').then((module) => module.initImages());

document.querySelectorAll<HTMLElement>('[data-home-art]').forEach((artwork) => {
  for (const event of ['contextmenu', 'dragstart', 'selectstart']) {
    artwork.addEventListener(event, (event) => event.preventDefault());
  }
});
