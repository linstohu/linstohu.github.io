import {
  readFile,
  mkdir,
  writeFile,
  lstat,
  link,
  rename,
  rm,
  stat,
  open,
  glob,
} from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseDocument, stringify } from 'yaml';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
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
  const frontmatter = parseDocument(match[1]);
  if (frontmatter.errors.length) throw frontmatter.errors[0];
  return { data: frontmatter.toJS(), frontmatter, body: match[2], raw: text };
}
export function document(data, body) {
  return `---\n${stringify(data, { defaultKeyType: 'PLAIN', defaultStringType: 'QUOTE_DOUBLE' }).trimEnd()}\n---\n${body}`;
}
export async function createDocument(file, data, body) {
  const directory = path.dirname(file);
  await mkdir(directory, { recursive: true });
  const temporary = path.join(
    directory,
    `.${path.basename(file)}.${randomUUID()}.tmp`,
  );
  try {
    await writeFile(temporary, document(data, `\n${body.trim()}\n`), {
      flag: 'wx',
    });
    // Readers see a complete draft, and an existing target still yields EEXIST.
    await link(temporary, file);
  } finally {
    await rm(temporary, { force: true });
  }
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

async function withFileLock(file, operation, waitMs = 0) {
  const deadline = performance.now() + waitMs;
  let lock;
  while (!lock) {
    try {
      lock = await open(file, 'wx');
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      if (performance.now() >= deadline)
        throw new Error(
          `内容写入正在进行。请稍后重试。若上次命令异常退出，请确认原进程已结束，再删除锁文件 ${file}。`,
        );
      await delay(25);
    }
  }
  try {
    await lock.writeFile(String(process.pid) + '\n');
    return await operation();
  } finally {
    await lock.close();
    await rm(file, { force: true });
  }
}

async function checkSlug(directory, id, label) {
  for await (const relative of glob('**/index.md', { cwd: directory })) {
    const entry = await readDocument(path.join(directory, relative));
    if (entry.data.slug === id) throw new Error(`${label} slug 已存在：${id}`);
  }
}

export async function createWriting(directory, data, body) {
  const parsed = editorialSchemas.writing.parse(data);
  await mkdir(directory, { recursive: true });
  return withFileLock(path.join(directory, '.authoring.lock'), async () => {
    await checkSlug(directory, parsed.slug, '文章');
    const file = path.join(
      directory,
      writingDirectory(parsed.slug, parsed.publishedAt),
      'index.md',
    );
    await createDocument(file, data, body);
    return file;
  });
}

/**
 * Reserve a new audio slug before either command can write remotely.
 * @param {string} directory
 * @param {string} id
 * @param {(file: string) => unknown} operation
 * @param {{dryRun?: boolean}} [options]
 */
export async function withNewAudio(
  directory,
  id,
  operation,
  { dryRun = false } = {},
) {
  const target = path.join(directory, slug(id), 'index.md');
  async function run() {
    await checkSlug(directory, id, '声音');
    await mustNotExist(target);
    await operation(target);
    return target;
  }
  if (dryRun) return run();
  await mkdir(directory, { recursive: true });
  return withFileLock(path.join(directory, `.${id}.authoring.lock`), run);
}

export async function publishDocument(file, kind, requestedDate) {
  const directory = path.dirname(file);
  const lock =
    kind === 'writing'
      ? path.join(path.dirname(directory), '.authoring.lock')
      : path.join(directory, `.${path.basename(file)}.authoring.lock`);
  // A per-entry publication only rewrites local metadata. Wait for a short overlap,
  // while keeping contention on the collection-wide writing lock explicit.
  return withFileLock(
    lock,
    () => updatePublication(file, kind, requestedDate),
    kind === 'writing' ? 0 : 1500,
  );
}

async function updatePublication(file, kind, requestedDate) {
  const { data, frontmatter, body, raw } = await readDocument(file);
  const schema = editorialSchemas[kind];
  if (!schema) throw new Error('不支持的内容类型。');
  const now = timestamp();
  const publishedAt =
    requestedDate || (data?.draft === false ? data.publishedAt : now);
  timestampSchema.parse(publishedAt);
  const changes = { draft: false, publishedAt };
  if (kind === 'writing' && data.draft === false) changes.updatedAt = now;
  const parsed = schema.parse({ ...data, ...changes });
  for (const [key, value] of Object.entries(changes))
    frontmatter.set(key, value);
  const eol = raw.startsWith('---\r\n') ? '\r\n' : '\n';
  const header = frontmatter
    .toString({ defaultKeyType: 'PLAIN', defaultStringType: 'QUOTE_DOUBLE' })
    .replaceAll('\n', eol);
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
      `---${eol}${header}---${eol}${body}`,
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
