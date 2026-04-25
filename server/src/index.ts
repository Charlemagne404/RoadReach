import { env } from './config.js';
import { createApp } from './app.js';

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`RoadReach server listening on http://localhost:${env.PORT}`);
});
