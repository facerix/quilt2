/**
 * Node module-resolution hooks for `node --test`.
 *
 * App source imports with browser-absolute specifiers ending in `.js`
 * (`/src/game/truck.js`) because that is what the browser loads out of `dist/`.
 * Tests run the TypeScript sources directly under Node's type stripping, so a
 * bare `/src/...` would be resolved against the filesystem root.
 *
 * Without this, app source could only be tested when every one of its imports
 * was `import type` (erased before runtime). The mapping lets modules use real
 * cross-module value imports and still be reachable from tests.
 */

const projectRoot = new URL('../', import.meta.url);

const BROWSER_ABSOLUTE_PREFIXES = ['/src/', '/components/'];

export function resolve(specifier, context, nextResolve) {
  if (BROWSER_ABSOLUTE_PREFIXES.some(prefix => specifier.startsWith(prefix))) {
    const sourcePath = specifier.replace(/^\//, '').replace(/\.js$/, '.ts');
    return nextResolve(new URL(sourcePath, projectRoot).href, context);
  }
  return nextResolve(specifier, context);
}
