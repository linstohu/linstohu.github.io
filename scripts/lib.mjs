import {
  readFile,
  mkdir,
  writeFile,
  lstat,
  rename,
  rm,
  stat,
} from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parse, stringify } from 'yaml';
import { randomUUID } from 'node:crypto';
import { editorialSchemas, timestampSchema } from '../src/lib/schemas.ts';
export const root = fileURLToPath(new URL('../', import.meta.url));
export const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export function slug(value) {
  if (!value || !slugPattern.test(value))
    throw new Error('固定地址请使用小写英文、数字和连字符。');
  return value;
}
export function required(value, name) {
  if (!value?.trim()) throw new Error(`请提供 ${name}`);
  return value.trim();
}
export function timestamp() {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date());
  return parts.replace(' ', 'T') + '+08:00';
}
export async function readDocument(file) {
  const text = await readFile(file, 'utf8');
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/);
  if (!match) throw new Error('文件缺少 YAML 内容信息。');
  return { data: parse(match[1]), body: match[2], raw: text };
}
export function document(data, body) {
  return `---\n${stringify(data, { defaultKeyType: 'PLAIN', defaultStringType: 'QUOTE_DOUBLE' }).trimEnd()}\n---\n${body}`;
}
export async function createDocument(file, data, body) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, document(data, `\n${body.trim()}\n`), { flag: 'wx' });
}
export async function mustNotExist(file) {
  try {
    await lstat(file);
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }
  throw new Error(`已存在同名内容，未覆盖：${path.relative(root, file)}`);
}
export function reportError(error) {
  console.error(error.message);
  process.exitCode = 1;
}

export async function publishDocument(file, kind, requestedDate) {
  const { data, body, raw } = await readDocument(file);
  const schema = editorialSchemas[kind];
  if (!schema) throw new Error('不支持的内容类型。');
  const now = timestamp();
  const publishedAt =
    requestedDate || (data?.draft === false ? data.publishedAt : now);
  timestampSchema.parse(publishedAt);
  const next = { ...data, draft: false, publishedAt };
  if (kind === 'writing' && data.draft === false) next.updatedAt = now;
  const parsed = schema.parse(next);
  if (kind === 'now' && path.basename(file, '.md') !== parsed.period)
    throw new Error('月份与文件名不符。');
  if ((await readFile(file, 'utf8')) !== raw)
    throw new Error('文件刚被修改，请重新检查后再发布。');
  const temporary = path.join(
    path.dirname(file),
    `.${path.basename(file)}.${randomUUID()}.tmp`,
  );
  try {
    const original = await stat(file);
    await writeFile(temporary, document(next, body), {
      flag: 'wx',
      mode: original.mode,
    });
    await rename(temporary, file);
  } finally {
    await rm(temporary, { force: true });
  }
  return publishedAt;
}
