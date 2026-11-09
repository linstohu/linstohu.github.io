import { readFileSync } from 'node:fs';
const { packageManager } = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
);
const expected = packageManager.replace('@', '/').split('+')[0];
const actual = (process.env.npm_config_user_agent || '').split(' ')[0];
if (actual !== expected) {
  console.error(
    `本项目统一使用 ${packageManager}，请运行 pnpm install --frozen-lockfile。`,
  );
  process.exitCode = 1;
}
