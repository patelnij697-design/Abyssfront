import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const distDir = path.join(__dirname, 'dist');
const distIndex = path.join(distDir, 'index.html');
const isProd =
  process.env.NODE_ENV === 'production' ||
  (process.env.npm_lifecycle_event === 'start' && fs.existsSync(distIndex));

async function startServer() {
  const app = express();
  app.disable('x-powered-by');

  // Health check endpoint for Render Web Service
  app.get('/api/health', (_req, res) => {
    res.status(200).json({
      ok: true,
      service: 'abyssfront',
      mode: isProd ? 'production' : 'development',
      uptimeSec: Math.round(process.uptime()),
    });
  });

  if (isProd && fs.existsSync(distIndex)) {
    app.use(
      express.static(distDir, {
        maxAge: '1h',
        index: 'index.html',
      })
    );

    // Express 5 safe SPA fallback
    app.use((req, res, next) => {
      if (req.method === 'GET' && !req.path.startsWith('/api')) {
        res.sendFile(distIndex);
        return;
      }
      next();
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ABYSSFRONT web service listening on http://0.0.0.0:${PORT} (${isProd ? 'production' : 'dev'})`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start ABYSSFRONT server:', err);
  process.exit(1);
});
