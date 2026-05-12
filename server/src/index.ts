import { env } from './config.js';
import { createApp } from './app.js';

const app = createApp();

app.listen(env.PORT, env.HOST, () => {
  console.log(`RoadReach server listening on http://${env.HOST}:${env.PORT}`);
});
