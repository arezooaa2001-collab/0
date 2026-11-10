// Builds the whole app into ONE self-contained HTML file (JS, CSS, fonts and icon inlined).
//   npm run build:single   →   release/echowords.html
import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

const icon = `data:image/png;base64,${readFileSync(new URL('./android/res/mipmap-xxhdpi/ic_launcher.png', import.meta.url)).toString('base64')}`;

/** Remove links to separate files (manifest/service worker need a web server) and inline the icon. */
const standalone: Plugin = {
  name: 'echowords-standalone-html',
  transformIndexHtml(html) {
    return html
      .replace(/\s*<link rel="manifest"[^>]*>/, '')
      .replace(/href="\/logo\.png"/g, `href="${icon}"`);
  },
};

export default defineConfig({
  plugins: [react(), standalone, viteSingleFile()],
  define: { 'import.meta.env.VITE_SINGLE_FILE': JSON.stringify('1') },
  publicDir: false,
  build: {
    outDir: 'release',
    emptyOutDir: false,
    assetsInlineLimit: 100_000_000,
    rollupOptions: { output: { entryFileNames: 'echowords.js' } },
  },
});
