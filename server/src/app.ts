import express from 'express';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { apiRouter } from './routes/api.js';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const clientDistDirectory = path.resolve(currentDirectory, '../../client/dist');

export function createApp() {
  const app = express();

  app.use(express.json());
  app.use('/api', apiRouter);

  if (existsSync(clientDistDirectory)) {
    app.use(express.static(clientDistDirectory));

    app.get(/^(?!\/api).*/, (_request, response) => {
      response.sendFile(path.join(clientDistDirectory, 'index.html'));
    });
  }

  return app;
}
