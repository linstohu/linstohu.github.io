import test from 'node:test';
import assert from 'node:assert/strict';
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import { parseFragment } from 'parse5';
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
  const elements = parseFragment(code).childNodes.filter(
    (node) => 'tagName' in node,
  );
  assert.deepEqual(
    elements.map((node) => node.tagName),
    ['p', 'section', 'section', 'hr', 'p', 'section', 'section'],
  );
  const turns = elements.filter((node) => node.tagName === 'section');
  assert.deepEqual(
    turns.map(
      (node) => node.attrs.find((attr) => attr.name === 'data-speaker')?.value,
    ),
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
      topLevel.filter((node) =>
        node.attrs.some((attr) => attr.name === 'data-speaker'),
      ).length,
      answer ? 2 : 1,
    );
  }
});
