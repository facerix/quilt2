import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import vm from 'node:vm';

/**
 * There is no bundler, so every module the browser loads is its own request and
 * has to be precached by name in `sw-core.js`. Forgetting one doesn't break the
 * build or any other test — it breaks *offline*, silently, and only on a cold
 * install. So it gets its own test.
 */

const root = join(import.meta.dirname, '..', '..');

interface CacheConfigShape {
  getCoreResources(): string[];
  getStaticAssets(): string[];
}

const loadCacheConfig = (): CacheConfigShape => {
  const source = readFileSync(join(root, 'sw-core.js'), 'utf8');
  const sandbox: { self: Record<string, unknown> } = { self: {} };
  sandbox.self = sandbox as unknown as Record<string, unknown>;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);

  const cacheConfig = sandbox.self.CacheConfig as CacheConfigShape | undefined;
  assert.ok(cacheConfig, 'sw-core.js should expose self.CacheConfig');

  // Arrays built inside the vm belong to another realm, so their prototype
  // isn't this realm's Array and assert.deepStrictEqual would reject them even
  // when the contents match. Copy them into host arrays at the boundary.
  return {
    getCoreResources: () => [...cacheConfig.getCoreResources()],
    getStaticAssets: () => [...cacheConfig.getStaticAssets()],
  };
};

/** Every compilable .ts file under a directory, as the URL the browser will request. */
const emittedModuleUrls = (dir: string): string[] => {
  const walk = (current: string): string[] =>
    readdirSync(current, { withFileTypes: true }).flatMap(entry => {
      const full = join(current, entry.name);
      if (entry.isDirectory()) return walk(full);
      if (!entry.name.endsWith('.ts') || entry.name.endsWith('.d.ts')) return [];
      return [`/${relative(root, full).replace(/\.ts$/, '.js')}`];
    });
  return walk(join(root, dir));
};

const filesIn = (dir: string): string[] =>
  readdirSync(join(root, dir), { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name !== '.gitkeep')
    .map(entry => `/${dir}/${entry.name}`);

test('every emitted module is precached in getCoreResources()', () => {
  const core = new Set(loadCacheConfig().getCoreResources());

  const expected = [
    ...emittedModuleUrls('src'),
    ...emittedModuleUrls('components'),
    '/index.js',
    '/about.js',
  ];

  const missing = expected.filter(url => !core.has(url));
  assert.deepEqual(
    missing,
    [],
    `these modules ship but are not precached — offline will break:\n  ${missing.join('\n  ')}`
  );
});

test('getCoreResources() lists the app shell', () => {
  const core = new Set(loadCacheConfig().getCoreResources());

  ['/', '/index.html', '/about.html', '/main.css', '/manifest.json'].forEach(url => {
    assert.ok(core.has(url), `${url} should be precached`);
  });
});

test('getCoreResources() has no duplicate entries', () => {
  const core = loadCacheConfig().getCoreResources();
  assert.equal(new Set(core).size, core.length, 'duplicate precache entries');
});

test('every icon and image is registered in getStaticAssets()', () => {
  const staticAssets = new Set(loadCacheConfig().getStaticAssets());
  const expected = [...filesIn('icons'), ...filesIn('images')];

  const missing = expected.filter(url => !staticAssets.has(url));
  assert.deepEqual(missing, [], `unregistered static assets:\n  ${missing.join('\n  ')}`);
});

test('precached module paths do not point at TypeScript sources', () => {
  const core = loadCacheConfig().getCoreResources();
  const wrong = core.filter(url => url.endsWith('.ts'));
  assert.deepEqual(wrong, [], 'precache should reference compiled .js, not .ts');
});
