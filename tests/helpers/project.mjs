import { execFileSync } from 'node:child_process';
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = fileURLToPath(new URL('../../', import.meta.url));
export const astroCLI = path.join(
  repository,
  'node_modules/astro/bin/astro.mjs',
);
export const fixtures = path.join(repository, 'tests/fixtures');

export async function createTestProject() {
  const directory = await mkdtemp(path.join(tmpdir(), 'linsto-test-'));
  const output = path.join(directory, 'dist');
  const dispose = () => rm(directory, { recursive: true, force: true });
  try {
    await cp(path.join(fixtures, 'site'), directory, { recursive: true });
    for (const item of [
      'src',
      'scripts',
      'public/favicon.svg',
      'astro.config.mjs',
      'package.json',
      'tsconfig.json',
    ])
      await cp(path.join(repository, item), path.join(directory, item), {
        recursive: true,
      });
    for (const name of ['writing', 'audio', 'now'])
      await mkdir(path.join(directory, 'content', name), { recursive: true });
    const modules = path.join(repository, 'node_modules');
    await mkdir(path.join(directory, 'node_modules'));
    for (const name of await readdir(modules))
      if (!name.startsWith('.'))
        await symlink(
          path.join(modules, name),
          path.join(directory, 'node_modules', name),
          'junction',
        );
  } catch (error) {
    await dispose();
    throw error;
  }
  function run(script, ...args) {
    return execFileSync(process.execPath, [script, ...args], {
      cwd: directory,
      encoding: 'utf8',
      stdio: 'pipe',
      timeout: 75000,
      env: {
        ...process.env,
        ASTRO_TELEMETRY_DISABLED: '1',
        SITE_URL: 'https://example.org',
      },
    });
  }
  return {
    directory,
    output,
    dispose,
    content: (name) => path.join(directory, 'content', name),
    page: (route) => readFile(path.join(output, route, 'index.html'), 'utf8'),
    cli: (command, ...args) => run('scripts/' + command + '.mjs', ...args),
    build: () => run(astroCLI, 'build'),
    index: () =>
      run(
        path.join(repository, 'node_modules/pagefind/lib/runner/bin.cjs'),
        '--site',
        output,
      ),
  };
}
