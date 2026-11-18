// Standalone Markdown speaker labels opt into dialogue; all other prose stays free-form.
export default function rehypeDialogue({ userName = '我' } = {}) {
  const initial = [...userName.trim()][0]?.toUpperCase() || '我';
  return (tree, file) => {
    const frontmatter = file.data.astro?.frontmatter;
    if (frontmatter?.category !== 'prompted') return;
    const assistant = frontmatter.conversation?.assistant || 'AI';

    function speaker(node) {
      if (node.type !== 'element' || node.tagName !== 'p') return;
      const [label, ...rest] = node.children;
      if (
        label?.tagName !== 'strong' ||
        label.children.length !== 1 ||
        label.children[0].type !== 'text' ||
        rest.some(
          (part) =>
            !(part.type === 'text' && !part.value.trim()) &&
            !(
              part.tagName === 'em' &&
              part.children.every((child) => child.type === 'text')
            ),
        )
      )
        return;
      const match = label.children[0].value.trim().match(/^(.+?)[：:]$/);
      if (!match) return;
      const name = match[1].trim();
      const role =
        name === '我'
          ? 'user'
          : [assistant, 'AI'].includes(name)
            ? 'assistant'
            : undefined;
      if (!role) return;
      const caption = rest
        .filter((part) => part.tagName === 'em')
        .flatMap((part) => part.children.map((child) => child.value))
        .join(' ')
        .trim();
      return { role, name: role === 'assistant' ? assistant : name, caption };
    }

    const children = [];
    let turn;
    function finish() {
      if (!turn) return;
      if (
        !turn.body.some((node) => node.type !== 'text' || node.value.trim())
      ) {
        children.push(turn.marker, ...turn.body);
      } else {
        const { role, name, caption } = turn.speaker;
        children.push({
          type: 'element',
          tagName: 'section',
          properties: {
            className: ['dialogue-turn'],
            dataSpeaker: role,
            ariaLabel: caption ? `${name} · ${caption}` : name,
          },
          children: [
            {
              type: 'element',
              tagName: 'span',
              properties: {
                className: ['dialogue-avatar'],
                ariaHidden: 'true',
                dataPagefindIgnore: true,
              },
              children:
                role === 'assistant'
                  ? [
                      {
                        type: 'element',
                        tagName: 'svg',
                        properties: {
                          viewBox: '0 0 24 24',
                          width: 20,
                          height: 20,
                          fill: 'none',
                          stroke: 'currentColor',
                          strokeWidth: 1.5,
                        },
                        children: [
                          {
                            type: 'element',
                            tagName: 'path',
                            properties: {
                              d: 'M12 3c0 5-4 9-9 9 5 0 9 4 9 9 0-5 4-9 9-9-5 0-9-4-9-9Z',
                            },
                            children: [],
                          },
                        ],
                      },
                    ]
                  : [{ type: 'text', value: initial }],
            },
            {
              type: 'element',
              tagName: 'div',
              properties: {
                className: ['dialogue-label'],
                dataPagefindIgnore: true,
              },
              children: [
                {
                  type: 'element',
                  tagName: 'span',
                  properties: { className: ['dialogue-speaker'] },
                  children: [{ type: 'text', value: name }],
                },
                ...(caption
                  ? [
                      {
                        type: 'element',
                        tagName: 'span',
                        properties: { className: ['dialogue-caption'] },
                        children: [{ type: 'text', value: caption }],
                      },
                    ]
                  : []),
              ],
            },
            {
              type: 'element',
              tagName: 'div',
              properties: { className: ['dialogue-content'] },
              children: turn.body,
            },
          ],
        });
      }
      turn = undefined;
    }
    for (const node of tree.children) {
      const label = speaker(node);
      if (label) {
        finish();
        turn = { speaker: label, marker: node, body: [] };
      } else if (
        node.tagName === 'hr' ||
        (node.tagName === 'section' &&
          Object.hasOwn(node.properties ?? {}, 'dataFootnotes'))
      ) {
        finish();
        children.push(node);
      } else if (turn) turn.body.push(node);
      else children.push(node);
    }
    finish();
    tree.children = children;
  };
}
