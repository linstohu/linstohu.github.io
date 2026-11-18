import test from 'node:test';
import assert from 'node:assert/strict';
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import { parseFragment } from 'parse5';
import { attr, elements, textOf } from './helpers/html.ts';
import rehypeDialogue from '../src/lib/rehype-dialogue.mjs';
import { articleExcerpt } from '../src/lib/excerpt.ts';

const processor = await createMarkdownProcessor({
  rehypePlugins: [[rehypeDialogue, { userName: 'Linsto' }]],
  syntaxHighlight: false,
});
const frontmatter = {
  category: 'prompted',
  conversation: { assistant: 'ChatGPT' },
};

test('dialogue preserves multiple turns, rich Markdown and notes outside the conversation', async () => {
  const { code } = await processor.render(
    [
      '缘起。',
      '**我：** *提问原文*',
      '问题的第一段。\n\n问题的第二段。',
      '**AI：** *回答整理*',
      '## 一个解释',
      '- 第一条\n- 第二条',
      '```md\n**我：**\n这是代码，不是下一轮对话。\n```',
      '> **我：**\n>\n> 这是引用，不是下一轮对话。',
      '---',
      '这是对话后的笔记。',
      '**我：**',
      '再追问。',
      '**ChatGPT：**',
      '再回答。',
    ].join('\n\n'),
    { frontmatter },
  );
  const topLevel = parseFragment(code).childNodes.filter(
    (node) => 'tagName' in node,
  );
  assert.deepEqual(
    topLevel.map((node) => node.tagName),
    ['p', 'div', 'hr', 'p', 'div'],
  );
  const rounds = topLevel.filter(
    (node) => attr(node, 'class') === 'dialogue-round',
  );
  assert.deepEqual(
    rounds.map((node) => attr(node, 'id')),
    ['dialogue:1', 'dialogue:2'],
  );
  const turns = rounds.flatMap((round) => elements(round, 'section'));
  assert.deepEqual(
    turns.map((node) => attr(node, 'data-speaker')),
    ['user', 'assistant', 'user', 'assistant'],
  );
  assert.match(code, /aria-label="ChatGPT · 回答整理"/);
  assert.match(code, /class="dialogue-avatar" aria-hidden="true"/);
  assert.match(code, /class="dialogue-avatar"[^>]*>L<\/span>/);
  assert.match(code, /<svg[^>]*viewBox="0 0 24 24"/);
  assert.match(code, /<h2 id="一个解释">一个解释<\/h2>/);
  assert.match(code, /<ul>\s*<li>第一条<\/li>/);
  assert.match(code, /<pre><code class="language-md">\*\*我：\*\*/);
  assert.match(code, /<blockquote>\s*<p><strong>我：<\/strong><\/p>/);
  assert.match(code, /<hr>\s*<p>这是对话后的笔记。<\/p>/);
});

test('speaker labels are optional, scoped to prompted, and do not create empty turns', async () => {
  const content = '**我：**\n\n自由书写。\n\n**AI：**';
  const ordinary = await processor.render(content, {
    frontmatter: { category: '随笔' },
  });
  assert.doesNotMatch(ordinary.code, /dialogue-turn/);
  const prompted = await processor.render(content, {
    frontmatter: { category: 'prompted' },
  });
  assert.equal((prompted.code.match(/data-speaker=/g) || []).length, 1);
  assert.match(prompted.code, /<p><strong>AI：<\/strong><\/p>$/);
  const free = await processor.render('只有一句想法。', { frontmatter });
  assert.equal(free.code, '<p>只有一句想法。</p>');
  const named = await processor.render('**A&B：**\n\n回答。', {
    frontmatter: { category: 'prompted', conversation: { assistant: 'A&B' } },
  });
  assert.match(named.code, /data-speaker="assistant"/);
  assert.match(named.code, /<span class="dialogue-speaker">A&#x26;B<\/span>/);
});

test('automatic excerpts select message content rather than speaker labels', async () => {
  const { code } = await processor.render(
    '**我：**\n\n我的问题。\n\n**AI：** *回答整理*\n\n没有预设章节的回答。',
    { frontmatter },
  );
  assert.equal(articleExcerpt(code, '我的问题。'), '没有预设章节的回答。');
});

test('document footnotes remain outside the last speaker, including an empty assistant turn', async () => {
  for (const answer of ['', '确实如此。']) {
    const { code } = await processor.render(
      [
        '**我：**',
        '资料来自这里[^1]。',
        '**AI：**',
        answer,
        '[^1]: 作者的出处。',
      ].join('\n\n'),
      { frontmatter },
    );
    const topLevel = parseFragment(code).childNodes.filter(
      (node) => 'tagName' in node,
    );
    const last = topLevel.at(-1)!;
    assert.ok(last.attrs.some((attr) => attr.name === 'data-footnotes'));
    assert.equal(
      elements(topLevel[0], 'section').filter((node) =>
        attr(node, 'data-speaker'),
      ).length,
      answer ? 2 : 1,
    );
  }
});

test('each question owns the replies that follow it and has a linkable title taken from the question', async () => {
  const { code, metadata } = await processor.render(
    [
      '**AI：**',
      '一句开场白。',
      '**我：**',
      '先说背景。**你的建议**是什么？',
      '**AI：**',
      '一个选项。',
      '**AI：**',
      '还有一个。',
      '**我：**',
      '我再想想。',
      '**我：**',
      '先说背景。你的建议是什么？',
      '---',
      '一段手记。',
      '**AI：**',
      '单独的补充。',
    ].join('\n\n'),
    { frontmatter },
  );
  assert.deepEqual(metadata.frontmatter.dialogueRounds, [
    { id: 'dialogue:1', title: '你的建议是什么？' },
    { id: 'dialogue:2', title: '我再想想。' },
    { id: 'dialogue:3', title: '你的建议是什么？' },
  ]);
  const groups = elements(code, 'div').filter(
    (node) => attr(node, 'role') === 'group',
  );
  assert.deepEqual(
    groups.map((group) =>
      elements(group, 'section').map((el) => attr(el, 'data-speaker')),
    ),
    [['user', 'assistant', 'assistant'], ['user'], ['user']],
  );
  assert.equal(elements(code, 'section').length, 7);
  assert.doesNotMatch(code, /dialogue-recall/);
  assert.equal(
    articleExcerpt(code, '一句开场白。'),
    '先说背景。你的建议是什么？',
  );
});

test('a single exchange links back to its question without adding a round divider', async () => {
  const { code } = await processor.render(
    '**我：**\n\n只问一次。\n\n**AI：**\n\n回答。',
    { frontmatter },
  );
  assert.doesNotMatch(code, /dialogue-round-label/);
  const link = elements(code, 'a')[0];
  assert.equal(attr(link, 'href'), '#dialogue:1');
  assert.equal(attr(link, 'data-pagefind-ignore'), '');
});

test('assistant sections preserve the heading hierarchy, rich content, preamble and original anchors', async () => {
  const { code } = await processor.render(
    [
      '**我：**',
      '## 我的提问',
      '我想先听结论。',
      '**AI：**',
      '先说结论。',
      '## 一个角度',
      '原来的内容。',
      '### 再具体一些',
      '> 保留这个引用。',
      '#### 一个例子',
      '- 保留这份清单',
      '## 另一个角度',
      '后面的内容。',
    ].join('\n\n'),
    { frontmatter },
  );
  const [user, answer] = elements(code, 'section');
  assert.equal(elements(user, 'details').length, 0);
  const sections = elements(answer, 'details');
  assert.deepEqual(
    sections.map((section) => textOf(elements(section, 'summary')[0])),
    ['一个角度', '再具体一些', '一个例子', '另一个角度'],
  );
  assert.deepEqual(
    sections.map((section) => elements(section, 'details').length),
    [2, 1, 0, 0],
  );
  assert.ok(sections.every((section) => attr(section, 'open') === undefined));
  assert.ok(
    elements(answer, 'h3').some((node) => attr(node, 'id') === '再具体一些'),
  );
  assert.equal(elements(sections[1], 'blockquote').length, 1);
  assert.equal(textOf(elements(sections[2], 'li')[0]), '保留这份清单');
  assert.match(code, /<p>先说结论。<\/p>\s*<details/);
});
test('a long unheaded reply keeps the opening paragraph and short replies read uninterrupted', async () => {
  const lead = '从一句话开始。';
  const rest = '把当时发生的事情写清楚。'.repeat(35);
  const { code } = await processor.render(
    [
      '**AI：**',
      lead,
      rest,
      '**我：**',
      '我明白了。',
      '**AI：**',
      '## 下一步',
      '试一次。',
    ].join('\n\n'),
    { frontmatter },
  );
  const sections = elements(code, 'details');
  assert.equal(sections.length, 1);
  assert.equal(textOf(elements(sections[0], 'summary')[0]), '后续回答');
  assert.equal(textOf(elements(sections[0], 'p')[0]), rest);
  assert.equal(
    articleExcerpt(code, lead),
    articleExcerpt('<p>' + rest + '</p>', ''),
  );
});

test('long lists, tables and code fold intact with useful labels between the original paragraphs', async () => {
  const list = Array.from(
    { length: 8 },
    (_, i) => `${i + 3}. 第 ${i + 1} 项`,
  ).join('\n');
  const table =
    '| 项目 | 说明 |\n| --- | --- |\n' + '| 一项 | 详情 |\n'.repeat(9);
  const program = Array.from({ length: 12 }, (_, i) => `line ${i + 1}`).join(
    '\n',
  );
  const { code } = await processor.render(
    [
      '**我：**',
      list,
      '**AI：**',
      '先说结论。',
      list,
      '下面是数据。',
      table,
      '最后看代码。',
      '```text\n' + program + '\n```',
      '以上是这些材料的用途。',
      '**我：**',
      '有简版吗？',
      '**AI：**',
      '- 一\n- 二',
      '**我：**',
      '长代码对应什么标题？',
      '**AI：**',
      '## 完整代码',
      '```text\n' + program + '\n```',
    ].join('\n\n'),
    { frontmatter },
  );
  const [user, answer, , short, , headed] = elements(code, 'section');
  assert.equal(elements(user, 'details').length, 0);
  const folds = elements(answer, 'details');
  assert.deepEqual(
    folds.map((el) => textOf(elements(el, 'summary')[0])),
    ['清单（8 项）', '表格（9 行）', '代码（12 行）'],
  );
  assert.ok(folds.every((el) => attr(el, 'open') === undefined));
  assert.equal(attr(elements(folds[0], 'ol')[0], 'start'), '3');
  assert.equal(elements(folds[0], 'li').length, 8);
  assert.equal(elements(elements(folds[1], 'tbody')[0], 'tr').length, 9);
  assert.equal(textOf(elements(folds[2], 'code')[0]).trimEnd(), program);
  assert.deepEqual(elements(answer, 'p').map(textOf), [
    '先说结论。',
    '下面是数据。',
    '最后看代码。',
    '以上是这些材料的用途。',
  ]);
  assert.equal(elements(short, 'details').length, 0);
  assert.deepEqual(elements(headed, 'summary').map(textOf), ['完整代码']);
});
