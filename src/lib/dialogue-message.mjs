export function element(tagName, properties, children = []) {
  return {
    type: 'element',
    tagName,
    properties,
    children: children.map((child) =>
      typeof child === 'string' ? { type: 'text', value: child } : child,
    ),
  };
}

export function readableText(node) {
  if (node.type === 'text') return node.value;
  if (node.tagName === 'br') return ' ';
  if (node.tagName === 'img') return node.properties.alt || '';
  if (node.tagName === 'pre' || node.tagName === 'sup') return '';
  return node.children?.map(readableText).join('') ?? '';
}

function avatar(role, initial) {
  const mark =
    role === 'user'
      ? initial
      : element(
          'svg',
          {
            viewBox: '0 0 24 24',
            width: 20,
            height: 20,
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: 1.5,
          },
          [
            element('path', {
              d: 'M12 3c0 5-4 9-9 9 5 0 9 4 9 9 0-5 4-9 9-9-5 0-9-4-9-9Z',
            }),
          ],
        );
  return element(
    'span',
    {
      className: ['dialogue-avatar'],
      ariaHidden: 'true',
      dataPagefindIgnore: true,
    },
    [mark],
  );
}

const headingDepth = (node) =>
  Number(node.tagName?.match(/^h([1-6])$/)?.[1] ?? 0);
const hasContent = (node) => node.type !== 'text' || !!node.value.trim();
const isLong = (blocks) =>
  blocks.map(readableText).join('').trim().length >= 320;

function materialLabel(node) {
  if (node.tagName === 'pre') {
    const lines = node.children
      .map(readableText)
      .join('')
      .trimEnd()
      .split('\n').length;
    if (lines >= 12) return `代码（${lines} 行）`;
  } else if (node.tagName === 'table') {
    const rows = node.children
      .flatMap((child) =>
        child.tagName === 'tbody' ? child.children : [child],
      )
      .filter((child) => child.tagName === 'tr').length;
    if (rows >= 8 || (rows && isLong([node]))) return `表格（${rows} 行）`;
  } else if (node.tagName === 'ul' || node.tagName === 'ol') {
    const items = node.children.filter(
      (child) => child.tagName === 'li',
    ).length;
    if (items >= 8 || (items && isLong([node]))) return `清单（${items} 项）`;
  }
}

function foldUnheaded(body) {
  const nodes = [];
  let count = 0;
  function addFold(label, blocks) {
    nodes.push(
      element('details', { className: ['reply-section'] }, [
        element('summary', { dataPagefindIgnore: true }, [label]),
        ...blocks,
      ]),
    );
    count++;
  }
  function addProse(blocks) {
    const lead = blocks.findIndex(hasContent);
    const rest = blocks.slice(lead + 1);
    if (lead < 0 || !rest.some(hasContent) || !isLong(blocks)) {
      nodes.push(...blocks);
      return;
    }
    nodes.push(...blocks.slice(0, lead + 1));
    addFold('后续回答', rest);
  }
  let start = 0;
  body.forEach((node, index) => {
    const label = materialLabel(node);
    if (!label) return;
    addProse(body.slice(start, index));
    addFold(label, [node]);
    start = index + 1;
  });
  addProse(body.slice(start));
  return { nodes, count };
}

function foldReply(body) {
  const firstHeading = body.findIndex(headingDepth);
  if (firstHeading < 0) return foldUnheaded(body);
  const sections = body.slice(firstHeading);
  const introduction = foldUnheaded(body.slice(0, firstHeading));
  if (
    sections.filter(headingDepth).length === 1 &&
    !isLong(body) &&
    !sections.some(materialLabel)
  )
    return {
      nodes: [...introduction.nodes, ...sections],
      count: introduction.count,
    };

  // Only headings at message level start sections. Quotes and code keep their own structure.
  const root = { depth: 0, children: [] };
  const stack = [root];
  for (const node of sections) {
    const depth = headingDepth(node);
    if (!depth) {
      stack.at(-1).children.push(node);
      continue;
    }
    while (stack.at(-1).depth >= depth) stack.pop();
    const section = { depth, heading: node, children: [] };
    stack.at(-1).children.push(section);
    stack.push(section);
  }

  let count = introduction.count;
  function renderSections(children) {
    return children.flatMap((node) => {
      if (!node.heading) return [node];
      const content = renderSections(node.children);
      if (!content.some(hasContent)) return [node.heading, ...content];
      count++;
      return [
        element('details', { className: ['reply-section'] }, [
          element('summary', {}, [node.heading]),
          ...content,
        ]),
      ];
    });
  }
  const nodes = [...introduction.nodes, ...renderSections(root.children)];
  return { nodes, count };
}

export function message({ role, name, caption }, body, initial) {
  const reply = role === 'assistant';
  const { nodes, count } = reply ? foldReply(body) : { nodes: body, count: 0 };
  const label = [element('span', { className: ['dialogue-speaker'] }, [name])];
  if (caption)
    label.push(element('span', { className: ['dialogue-caption'] }, [caption]));
  if (count > 1)
    label.push(
      element(
        'button',
        { type: 'button', className: ['reply-toggle'], hidden: true },
        ['展开全部'],
      ),
    );
  const children = [
    avatar(role, initial),
    element(
      'div',
      { className: ['dialogue-label'], dataPagefindIgnore: true },
      label,
    ),
    element('div', { className: ['dialogue-content'] }, nodes),
  ];
  if (reply)
    children.push(
      element(
        'svg',
        {
          className: ['reply-trace'],
          ariaHidden: 'true',
          focusable: 'false',
          dataPagefindIgnore: true,
        },
        [
          element('path', {
            pathLength: 1,
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: 1.25,
          }),
          element('circle', { r: 2, fill: 'currentColor' }),
        ],
      ),
    );
  return element(
    'section',
    {
      className: ['dialogue-turn'],
      dataSpeaker: role,
      ariaLabel: caption ? `${name} · ${caption}` : name,
    },
    children,
  );
}
