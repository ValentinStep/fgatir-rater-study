import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

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
  plugins: [react(), serveDicomData()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Configurable base path for deployment
  base: process.env.VITE_BASE_PATH || '/',
  // WASM support for cornerstone codecs
  // Only exclude dicom-image-loader (needs raw ESM for Worker URL resolution).
  // Core and tools MUST be prebundled so Vite handles CJS interop for fast-deep-equal etc.
  optimizeDeps: {
    exclude: ['@cornerstonejs/dicom-image-loader'],
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
