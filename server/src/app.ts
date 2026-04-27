import express from 'express';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { apiRouter } from './routes/api.js';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const clientDistDirectory = path.resolve(currentDirectory, '../../client/dist');

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json());
  app.use((_request, response, next) => {
    response.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "base-uri 'self'",
        "connect-src 'self'",
        "font-src 'self' https://fonts.gstatic.com data:",
        "form-action 'self'",
        "frame-ancestors 'none'",
        "img-src 'self' data: blob: https:",
        "manifest-src 'self'",
        "object-src 'none'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      ].join('; '),
    );
    response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    response.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    response.setHeader('Permissions-Policy', 'geolocation=(self), camera=(), microphone=()');
    response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');

    if (_request.secure) {
      response.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains; preload',
      );
    }

    next();
  });
  app.use('/api', apiRouter);
  app.get('/robots.txt', (request, response) => {
    const origin = `${request.protocol}://${request.get('host') ?? 'localhost'}`;

    response.type('text/plain').send([
      'User-agent: *',
      'Allow: /',
      '',
      `Sitemap: ${origin}/sitemap.xml`,
    ].join('\n'));
  });

  app.get('/sitemap.xml', (request, response) => {
    const origin = `${request.protocol}://${request.get('host') ?? 'localhost'}`;
    const urls = ['/', '/privacy-policy.html', '/terms-of-service.html'];

    response.type('application/xml').send([
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...urls.flatMap((pathname, index) => [
        '  <url>',
        `    <loc>${origin}${pathname}</loc>`,
        '    <changefreq>weekly</changefreq>',
        `    <priority>${index === 0 ? '1.0' : '0.3'}</priority>`,
        '  </url>',
      ]),
      '</urlset>',
    ].join('\n'));
  });

  if (existsSync(clientDistDirectory)) {
    app.use(express.static(clientDistDirectory));

    app.get(/^(?!\/api).*/, (_request, response) => {
      response.sendFile(path.join(clientDistDirectory, 'index.html'));
    });
  }

  return app;
}
