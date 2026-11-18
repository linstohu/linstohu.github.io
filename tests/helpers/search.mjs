import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Use the generated client and WASM. Only the transport is replaced by local files.
export async function openSearch(t, output) {
  const fragments = [];
  t.mock.method(globalThis, 'fetch', async (url) => {
    const file = new URL(url).pathname;
    if (file.endsWith('.pf_fragment')) fragments.push(file);
    return new Response(await readFile(path.join(output, file)));
  });
  const api = await import(
    pathToFileURL(path.join(output, 'pagefind/pagefind.js')).href
  );
  const index = api.createInstance({
    basePath: 'https://example.org/pagefind/',
    baseUrl: '/',
    noWorker: true,
  });
  t.after(() => index.destroy());
  return { index, fragments };
}
