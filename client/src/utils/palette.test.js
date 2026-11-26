import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contrast } from './contrast.js';

// services.js pulls in browser-only modules, so its colours are read from the
// source text: every entry's fill/onFill and text pairs must stay legible.
const source = readFileSync(new URL('./services.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
const token = (name) => {
    const m = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,8})`).exec(css);
    assert.ok(m, `token --${name} is defined`);
    return m[1];
};
const entries = [...source.matchAll(/(\w+): \{\s*name: '(\w+)'([\s\S]*?)\n {4}\}/g)].map((m) => {
    const field = (k) => (new RegExp(`${k}: '(#[0-9a-fA-F]{6})'`).exec(m[3]) || [])[1];
    return { name: m[2], color: field('color'), fill: field('fill'), onFill: field('onFill') || '#ffffff', text: field('text') };
});

test('the registry lists every service with all three colours', () => {
    assert.deepEqual(entries.map((e) => e.name).sort(), ['audius', 'custom', 'deezer', 'local', 'soundcloud', 'youtube']);
    for (const e of entries) assert.ok(e.color && e.fill && e.text, `${e.name} has color, fill and text`);
});

test('labels on a service fill pass 4.5:1', () => {
    for (const e of entries) assert.ok(contrast(e.fill, e.onFill) >= 4.5, `${e.name}: ${e.onFill} on ${e.fill}`);
});

test('service text passes 4.5:1 on the page and on cards', () => {
    for (const e of entries) {
        for (const ground of ['bg-base', 'surface-100']) {
            assert.ok(contrast(e.text, token(ground)) >= 4.5, `${e.name} text on ${ground}`);
        }
    }
});

test('text tokens pass 4.5:1 on the surfaces they sit on', () => {
    for (const t of ['text-primary', 'text-secondary', 'text-muted', 'text-subtle', 'text-faint-aa', 'accent', 'danger', 'danger-soft', 'warning']) {
        assert.ok(contrast(token(t), token('bg-base')) >= 4.5, `${t} on bg-base`);
        assert.ok(contrast(token(t), token('surface-100')) >= 4.5, `${t} on surface-100`);
    }
    assert.ok(contrast(token('text-faint-aa'), token('surface-300')) >= 4.5, 'text-faint-aa on surface-300');
    assert.ok(contrast(token('on-accent'), token('accent')) >= 4.5, 'on-accent on accent');
});

test('control borders pass 3:1', () => {
    for (const ground of ['bg-black', 'bg-base', 'surface-100']) {
        assert.ok(contrast(token('border-400-aa'), token(ground)) >= 3, `border-400-aa on ${ground}`);
    }
});

// Colours live in index.css (tokens) and services.js (one entry per service).
// Two places cannot use them: @property initial values must be literal
// colours (App.css), and the placeholder cover is a data: image (artwork.js).
test('no hex colours outside the token definitions and the service registry', async () => {
    const { readdirSync, statSync } = await import('node:fs');
    const { join, relative } = await import('node:path');
    const root = new URL('..', import.meta.url).pathname;
    const allowed = new Set(['index.css', 'utils/services.js', 'utils/artwork.js']);
    const files = [];
    const walk = (dir) => {
        for (const name of readdirSync(dir)) {
            const path = join(dir, name);
            if (statSync(path).isDirectory()) walk(path);
            else if (/\.(jsx?|css)$/.test(name) && !/\.test\.js$/.test(name)) files.push(path);
        }
    };
    walk(root);
    const offenders = [];
    for (const path of files) {
        const rel = relative(root, path);
        if (allowed.has(rel) || rel === 'utils/contrast.js') continue;
        readFileSync(path, 'utf8').split('\n').forEach((line, i) => {
            if (/^@property /.test(line)) return;
            if (/#[0-9a-fA-F]{3,8}(?![0-9a-zA-Z])/.test(line) && !/^\s*(\/\/|\*|\/\*)/.test(line)) offenders.push(`${rel}:${i + 1}`);
        });
    }
    assert.deepEqual(offenders, []);
});
