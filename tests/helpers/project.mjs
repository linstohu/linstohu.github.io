import { mkdtemp, cp, mkdir, readdir, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

export const repository = fileURLToPath(new URL('../../', import.meta.url));
export const astroCLI = path.join(
  repository,
  'node_modules/astro/bin/astro.mjs',
);
export async function createTestProject() {
  const directory = await mkdtemp(path.join(tmpdir(), 'linsto-test-'));
  try {
    for (const item of [
      'src',
      'scripts',
      'public',
      'content/settings',
      'content/quotes',
      'content/pages',
      'content/series',
      'astro.config.mjs',
      'package.json',
      'tsconfig.json',
    ])
      await cp(path.join(repository, item), path.join(directory, item), {
        recursive: true,
      });
    for (const collection of ['writing', 'audio', 'now'])
      await mkdir(path.join(directory, 'content', collection), {
        recursive: true,
      });
    await mkdir(path.join(directory, 'node_modules'));
    for (const name of await readdir(path.join(repository, 'node_modules')))
      if (!name.startsWith('.'))
        await symlink(
          path.join(repository, 'node_modules', name),
          path.join(directory, 'node_modules', name),
          'junction',
        );
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
  return {
    directory,
    output: path.join(directory, 'dist'),
    build() {
      execFileSync(process.execPath, [astroCLI, 'build'], {
        cwd: directory,
        env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' },
        stdio: 'pipe',
        timeout: 75000,
      });
    },
    dispose: () => rm(directory, { recursive: true, force: true }),
  };
}
