function revealLinkedSection() {
  if (!location.hash) return;
  let id: string;
  try {
    id = decodeURIComponent(location.hash.slice(1));
  } catch {
    return;
  }
  const target = document.getElementById(id);
  if (!target) return;
  let section = target.closest<HTMLDetailsElement>('details.reply-section');
  let opened = false;
  while (section) {
    if (!section.open) {
      section.open = true;
      opened = true;
    }
    section = section.parentElement?.closest('details.reply-section') ?? null;
  }
  if (opened) target.scrollIntoView();
}

function enableReplyControls(reply: HTMLElement) {
  const button = reply.querySelector<HTMLButtonElement>('.reply-toggle');
  if (!button) return;
  const sections = [
    ...reply.querySelectorAll<HTMLDetailsElement>('details.reply-section'),
  ];
  const allOpen = () => sections.every((section) => section.open);
  const update = () => {
    const verb = allOpen() ? '收起' : '展开';
    button.textContent = verb + '全部';
    button.setAttribute('aria-label', verb + '本条回答的全部小节');
  };
  button.hidden = false;
  update();
  reply.addEventListener('toggle', update, true);
  button.addEventListener('click', () => {
    const open = !allOpen();
    for (const section of sections) section.open = open;
    update();
  });
}

function traceReplies(replies: NodeListOf<HTMLElement>) {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const visible = new Set<HTMLElement>();
  const paths = new Map<
    HTMLElement,
    { path: SVGPathElement; head: SVGCircleElement; length: number }
  >();
  let frame = 0;
  function draw() {
    frame = 0;
    if (reducedMotion.matches) return;
    for (const reply of visible) {
      const trace = paths.get(reply);
      if (!trace) continue;
      const { top, height } = reply.getBoundingClientRect();
      const progress = Math.max(
        0,
        Math.min(1, (innerHeight * 0.72 - top) / height),
      );
      trace.path.style.strokeDashoffset = String(1 - progress);
      const point = trace.path.getPointAtLength(progress * trace.length);
      trace.head.setAttribute('cx', String(point.x));
      trace.head.setAttribute('cy', String(point.y));
      trace.head.style.opacity = progress > 0 && progress < 1 ? '1' : '0';
    }
  }
  function schedule() {
    if (!frame && !reducedMotion.matches) frame = requestAnimationFrame(draw);
  }
  const size = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const reply = entry.target as HTMLElement;
      const rail = reply.querySelector<SVGSVGElement>('.reply-trace')!;
      const path = rail.querySelector('path')!;
      const width = rail.clientWidth;
      const height = reply.offsetHeight;
      if (!width || !height) continue;
      const r = Math.min(13, width / 2, height / 2);
      path.setAttribute(
        'd',
        `M ${width} .75 H ${r} Q .75 .75 .75 ${r} V ${height - r} Q .75 ${height - 0.75} ${r} ${height - 0.75} H ${width}`,
      );
      paths.set(reply, {
        path,
        head: rail.querySelector('circle')!,
        length: path.getTotalLength(),
      });
    }
    schedule();
  });
  const visibility = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const reply = entry.target as HTMLElement;
      if (entry.isIntersecting) visible.add(reply);
      else visible.delete(reply);
    }
    schedule();
  });
  for (const reply of replies) {
    size.observe(reply);
    visibility.observe(reply);
  }
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  reducedMotion.addEventListener('change', schedule);
}

const replies = document.querySelectorAll<HTMLElement>(
  '.dialogue-page [data-speaker="assistant"]',
);
if (replies.length) {
  replies.forEach(enableReplyControls);
  traceReplies(replies);
  revealLinkedSection();
  window.addEventListener('hashchange', revealLinkedSection);
  let closedForPrint: HTMLDetailsElement[] = [];
  window.addEventListener('beforeprint', () => {
    closedForPrint = [
      ...document.querySelectorAll<HTMLDetailsElement>(
        '.dialogue-page details.reply-section:not([open])',
      ),
    ];
    for (const section of closedForPrint) section.open = true;
  });
  window.addEventListener('afterprint', () => {
    for (const section of closedForPrint) section.open = false;
    closedForPrint = [];
  });
}
