// Turns the single-file build into the page body claude.ai expects for a published page:
// claude.ai adds <!doctype>, <html>, <head> and <body> itself, so this keeps only
// <title>, the inline <style>, the root element and the inline module script.
import { readFileSync, writeFileSync } from 'node:fs';

const html = readFileSync('release/echowords.html', 'utf8');
const title = /<title>[\s\S]*?<\/title>/.exec(html)?.[0];
const styles = [...html.matchAll(/<style[^>]*>[\s\S]*?<\/style>/g)].map((m) => m[0].replace(/<style[^>]*>/, '<style>'));
// A literal U+FFFD inside the bundled code (the Claude SDK uses one as a replacement character) is
// written as the JavaScript escape \uFFFD: same value, and the page has no raw replacement characters.
const scripts = [...html.matchAll(/<script type="module"[^>]*>[\s\S]*?<\/script>/g)].map((m) =>
  m[0].replace(/<script[^>]*>/, '<script type="module">').replaceAll('\uFFFD', '\\uFFFD'),
);
if (!title || !styles.length || !scripts.length) throw new Error('unexpected build output');
const out = [title, ...styles, '<div id="root"></div>', ...scripts].join('\n');
writeFileSync('release/echowords-claude.html', out);
console.log(`→ release/echowords-claude.html (${Math.round(out.length / 1024)} KB)`);
