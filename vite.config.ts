import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

/**
 * Custom Vite plugin to wrap CJS codec files from @cornerstonejs with ESM default exports.
 * These codec files (emscripten-generated WASM loaders) use `module.exports = ...` pattern
 * and are imported with `import factory from '...'` in the dicom-image-loader Worker.
 * Without this wrapper, the browser throws: "does not provide an export named 'default'".
 */
function cornerstoneCodecEsmWrapper(): Plugin {
  // Match the CJS codec factory files used by @cornerstonejs/dicom-image-loader
  const codecFilePattern = /node_modules\/@cornerstonejs\/codec-[^/]+\/dist\/[^/]+\.js(\?.*)?$/;

  return {
    name: 'cornerstone-codec-esm-wrapper',
    enforce: 'pre',
    transform(code, id) {
      // Only transform CJS codec files that lack ESM exports
      if (!codecFilePattern.test(id)) return null;
      // Skip if already has export default or export {
      if (/\bexport\s+(default|{)/.test(code)) return null;
      // Detect CJS pattern: `module.exports = ...` or IIFE factory pattern
      if (!/module\.exports\s*=/.test(code) && !/var \w+ = \(\(\) => {/.test(code)) return null;

      // Wrap with ESM: execute the CJS code in a synthetic module scope, then export default
      const wrapped = `
var __cjs_module__ = { exports: {} };
var module = __cjs_module__;
var exports = __cjs_module__.exports;
${code}
export default __cjs_module__.exports;
`;
      return { code: wrapped, map: null };
    },
  };
}

/**
 * Custom Vite plugin to serve local-data/ directory at /dicom-data/ during development.
 * This allows the browser to fetch DICOM files via relative URLs without copying them to public/.
 */
function serveDicomData(): Plugin {
  return {
    name: 'serve-dicom-data',
    configureServer(server) {
      server.middlewares.use('/dicom-data', (req, res, next) => {
        const localDataDir = path.resolve(__dirname, 'local-data');
        const filePath = path.join(localDataDir, req.url || '');

        // Security: prevent path traversal
        if (!filePath.startsWith(localDataDir)) {
          res.statusCode = 403;
          res.end('Forbidden');
          return;
        }

        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          const ext = path.extname(filePath).toLowerCase();
          const contentType =
            ext === '.json'
              ? 'application/json'
              : 'application/dicom';
          res.setHeader('Content-Type', contentType);
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
          const stream = fs.createReadStream(filePath);
          stream.pipe(res);
        } else {
          next();
        }
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [cornerstoneCodecEsmWrapper(), react(), serveDicomData()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Configurable base path for deployment
  base: process.env.VITE_BASE_PATH || '/',
  // Include ALL cornerstone packages for prebundling so Vite handles CJS→ESM interop.
  // The Worker URL in dicom-image-loader uses an absolute path which Vite resolves correctly.
  optimizeDeps: {
    include: [
      '@cornerstonejs/core',
      '@cornerstonejs/dicom-image-loader',
      '@cornerstonejs/tools',
      '@cornerstonejs/metadata',
      '@cornerstonejs/calculate-suv',
    ],
  },
  worker: {
    format: 'es',
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Resource-Policy': 'same-origin',
    },
  },
});
