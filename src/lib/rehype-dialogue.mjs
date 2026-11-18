import { element, message, readableText } from './dialogue-message.mjs';

function speaker(node, assistant) {
  if (node.tagName !== 'p') return;
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
  if (!['我', assistant, 'AI'].includes(name)) return;
  const user = name === '我';
  const caption = rest
    .filter((part) => part.tagName === 'em')
    .flatMap((part) => part.children.map((child) => child.value))
    .join(' ')
    .trim();
  return {
    role: user ? 'user' : 'assistant',
    name: user ? name : assistant,
    caption,
  };
}

function questionTitle(body) {
  let opening = '';
  for (const block of body) {
    const text = readableText(block).replace(/\s+/g, ' ').trim();
    if (!text) continue;
    opening ||= text;
    const question = text.match(/[^。！？!?]+[？?]/u);
    if (question) {
      opening = question[0].trim();
      break;
    }
  }
  const characters = Array.from(opening || '查看提问');
  return characters.length > 50
    ? characters.slice(0, 49).join('') + '…'
    : characters.join('');
}

// Only standalone speaker markers opt into dialogue. Editorial prose stays at the document level.
export default function rehypeDialogue({ userName = '我' } = {}) {
  const initial = [...userName.trim()][0]?.toUpperCase() || '我';
  return (tree, file) => {
    const frontmatter = file.data.astro?.frontmatter;
    if (frontmatter?.category !== 'prompted') return;
    const assistant = frontmatter.conversation?.assistant || 'AI';
    const children = [];
    const rounds = [];
    let round;
    let turn;

    function finishTurn() {
      if (!turn) return;
      const { label, marker, body } = turn;
      turn = undefined;
      if (!body.some((node) => node.type !== 'text' || node.value.trim())) {
        round = undefined;
        children.push(marker, ...body);
        return;
      }
      if (label.role === 'user') {
        const number = rounds.length + 1;
        // A colon keeps these anchors distinct from Astro's generated heading slugs.
        const id = 'dialogue:' + number;
        round = element('div', {
          id,
          className: ['dialogue-round'],
          role: 'group',
          ariaLabel: `第 ${number} 轮对话`,
          tabIndex: -1,
        });
        rounds.push({ id, title: questionTitle(body), node: round });
        children.push(round);
      }
      (round?.children ?? children).push(message(label, body, initial));
    }

    for (const node of tree.children) {
      const label = speaker(node, assistant);
      if (label) {
        finishTurn();
        turn = { label, marker: node, body: [] };
      } else if (
        node.tagName === 'hr' ||
        (node.tagName === 'section' &&
          Object.hasOwn(node.properties ?? {}, 'dataFootnotes'))
      ) {
        finishTurn();
        round = undefined;
        children.push(node);
      } else if (turn) turn.body.push(node);
      else children.push(node);
    }
    finishTurn();
    if (rounds.length > 1) {
      rounds.forEach(({ node }, index) =>
        node.children.unshift(
          element(
            'div',
            {
              className: ['dialogue-round-label'],
              ariaHidden: 'true',
              dataPagefindIgnore: true,
            },
            [`第 ${index + 1} 轮`],
          ),
        ),
      );
    } else if (rounds[0]?.node.children.length > 1) {
      const { id, node } = rounds[0];
      node.children.push(
        element(
          'a',
          {
            className: ['dialogue-recall'],
            href: '#' + id,
            dataPagefindIgnore: true,
          },
          ['↑ 回看提问'],
        ),
      );
    }
    frontmatter.dialogueRounds = rounds.map(({ id, title }) => ({ id, title }));
    tree.children = children;
  };
}
