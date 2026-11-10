import {
  readFile,
  mkdir,
  writeFile,
  lstat,
  rename,
  rm,
  stat,
  open,
  readdir,
} from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parse, stringify } from 'yaml';
import { randomUUID } from 'node:crypto';
import { writingDirectory } from '../src/lib/publication.ts';
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

async function withWritingLock(directory, operation) {
  await mkdir(directory, { recursive: true });
  const file = path.join(directory, '.authoring.lock');
  let lock;
  try {
    lock = await open(file, 'wx');
  } catch (error) {
    if (error.code === 'EEXIST')
      throw new Error(
        `文章写入正在进行。请稍后重试；若上次命令已异常退出，确认没有发布命令运行后删除锁文件 ${file}。`,
      );
    throw error;
  }
  try {
    await lock.writeFile(String(process.pid) + '\n');
    return await operation();
  } finally {
    await lock.close();
    await rm(file, { force: true });
  }
}

export async function createWriting(directory, data, body) {
  const parsed = editorialSchemas.writing.parse(data);
  return withWritingLock(directory, async () => {
    for (const item of await readdir(directory, { withFileTypes: true })) {
      if (!item.isDirectory() || item.name.startsWith('.')) continue;
      let existing;
      try {
        existing = await readDocument(
          path.join(directory, item.name, 'index.md'),
        );
      } catch (error) {
        if (error.code === 'ENOENT') continue;
        throw error;
      }
      if (existing.data.slug === parsed.slug)
        throw new Error(`文章 slug 已存在：${parsed.slug}`);
    }
    const file = path.join(
      directory,
      writingDirectory(parsed.slug, parsed.publishedAt),
      'index.md',
    );
    await createDocument(file, data, body);
    return file;
  });
}

export async function publishDocument(file, kind, requestedDate) {
  if (kind === 'writing')
    return withWritingLock(path.dirname(path.dirname(file)), () =>
      updatePublication(file, kind, requestedDate),
    );
  return updatePublication(file, kind, requestedDate);
}

async function updatePublication(file, kind, requestedDate) {
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
  const originalDirectory = path.dirname(file);
  const destination =
    kind === 'writing'
      ? path.join(
          path.dirname(originalDirectory),
          writingDirectory(parsed.slug, parsed.publishedAt),
          'index.md',
        )
      : file;
  const destinationDirectory = path.dirname(destination);
  const moving = destinationDirectory !== originalDirectory;
  if (moving) await mustNotExist(destinationDirectory);
  const temporaryName = `.${path.basename(file)}.${randomUUID()}.tmp`;
  let currentDirectory = originalDirectory;
  try {
    const original = await stat(file);
    await writeFile(
      path.join(currentDirectory, temporaryName),
      document(next, body),
      {
        flag: 'wx',
        mode: original.mode,
      },
    );
    if ((await readFile(file, 'utf8')) !== raw)
      throw new Error('文件刚被修改，请重新检查后再发布。');
    if (moving) {
      await rename(originalDirectory, destinationDirectory);
      currentDirectory = destinationDirectory;
    }
    try {
      await rename(path.join(currentDirectory, temporaryName), destination);
    } catch (error) {
      if (moving) {
        try {
          await rename(destinationDirectory, originalDirectory);
          currentDirectory = originalDirectory;
        } catch (rollbackError) {
          throw new AggregateError(
            [error, rollbackError],
            `发布失败，目录位于 ${currentDirectory}，原文与配图保留，请检查后重试。`,
          );
        }
      }
      throw error;
    }
  } finally {
    await rm(path.join(currentDirectory, temporaryName), { force: true });
  }
  return { file: destination, publishedAt };
}
