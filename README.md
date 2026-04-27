# RoadReach

RoadReach is a dark, map-first reachability MVP built with React, TypeScript, Leaflet, and an Express backend. A user picks a starting point, enters a travel distance, chooses driving/cycling/walking, and the app renders how the reachable road network stretches out from that origin using real openrouteservice road-based calculations.

## Stack

- Frontend: Vite + React + TypeScript + Leaflet
- Backend: Node.js + Express + TypeScript
- Shared contract: Type-safe `zod` schemas in `packages/contracts`
- External provider: openrouteservice isochrone, routing, and geocoding APIs

## File Structure

```text
.
├── client
│   ├── src
│   │   ├── api
│   │   ├── components
│   │   ├── hooks
│   │   ├── lib
│   │   └── App.tsx
├── packages
│   └── contracts
│       └── src
├── server
│   └── src
│       ├── lib
│       ├── routes
│       └── index.ts
├── .env.example
└── package.json
```

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a local env file:

   ```bash
   cp .env.example .env
   ```

3. Add your openrouteservice API key to `.env`:

   ```bash
   OPENROUTESERVICE_API_KEY=your_key_here
   ```

4. Start the app in development:

   ```bash
   npm run dev
   ```

5. Open the frontend at [http://localhost:5173](http://localhost:5173).

The Express API runs on `http://localhost:8787` and the Vite dev server proxies `/api` requests to it.

## Scripts

- `npm run dev` starts contracts watch mode, the Express server, and the Vite client.
- `npm run build` builds the shared contracts, server, and client for production.
- `npm run start` builds everything and serves the production client from the Express server.
- `npm run typecheck` runs TypeScript validation across all packages.

## Environment Variables

- `PORT`: Express server port. Default `8787`.
- `GEOCODING_PROVIDER`: Optional. `openrouteservice` or `demo`. Default `openrouteservice`.
- `REACHABILITY_PROVIDER`: Optional. `openrouteservice` or `demo`. Default `openrouteservice`.
- `OPENROUTESERVICE_API_KEY`: Required for the public openrouteservice API. Optional if you later point to a self-hosted compatible backend.
- `OPENROUTESERVICE_BASE_URL`: Optional override for routing and isochrones. Default `https://api.openrouteservice.org`.
- `OPENROUTESERVICE_GEOCODE_BASE_URL`: Optional override for geocoding. Defaults to `OPENROUTESERVICE_BASE_URL`.

## API Endpoints

- `GET /api/geocode?q=...`
- `GET /api/reverse-geocode?lat=...&lng=...`
- `GET /api/reachability?lat=...&lng=...&distanceKm=...&mode=...`

`mode` accepts `driving`, `cycling`, or `walking`.

## Root-Like Visualization

The root effect is practical rather than purely geometric:

1. The backend asks openrouteservice for a real road-network isodistance polygon using distance-based isochrones.
2. It samples multiple target points around the outer reachability ring, plus a few interpolated inner targets.
3. For each sampled target, it asks openrouteservice for an actual road route from the origin to that target.
4. The frontend draws the returned routes as layered glow/core strokes on top of the subtle polygon fill.

That means the blob is still present as context, but the primary visual character comes from real routed linework that branches outward through the road network.

## Notes

- The app supports three origin flows: search, map click, and browser geolocation.
- URL query params store shareable state for origin, distance, and mode.
- If no live provider key is configured, the server still starts and falls back to demo results.
