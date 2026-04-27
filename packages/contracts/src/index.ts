import { z } from 'zod';
import type { LineString, MultiPolygon, Polygon } from 'geojson';

export const travelModeSchema = z.enum(['driving', 'cycling', 'walking']);
export const reachabilityProviderSchema = z.enum(['openrouteservice', 'demo']);

const latSchema = z.coerce.number().finite().min(-90).max(90);
const lngSchema = z.coerce.number().finite().min(-180).max(180);

const lonLatCoordinateSchema = z.tuple([lngSchema, latSchema]);
const polygonCoordinatesSchema = z.array(z.array(lonLatCoordinateSchema));
const multiPolygonCoordinatesSchema = z.array(polygonCoordinatesSchema);

const polygonGeometrySchema = z.union([
  z.object({
    type: z.literal('Polygon'),
    coordinates: polygonCoordinatesSchema,
  }),
  z.object({
    type: z.literal('MultiPolygon'),
    coordinates: multiPolygonCoordinatesSchema,
  }),
]);

const lineStringGeometrySchema = z.object({
  type: z.literal('LineString'),
  coordinates: z.array(lonLatCoordinateSchema).min(2),
});

const geoJsonPropertiesSchema = z.record(z.unknown()).nullable().default(null);

export const polygonFeatureSchema = z.object({
  type: z.literal('Feature'),
  properties: geoJsonPropertiesSchema,
  geometry: polygonGeometrySchema,
});

export const branchFeatureSchema = z.object({
  type: z.literal('Feature'),
  properties: geoJsonPropertiesSchema,
  geometry: lineStringGeometrySchema,
});

export const geocodeResultSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  label: z.string().min(1),
  lat: latSchema,
  lng: lngSchema,
  country: z.string().optional(),
  region: z.string().optional(),
  locality: z.string().optional(),
});

export const geocodeResponseSchema = z.object({
  query: z.string(),
  results: z.array(geocodeResultSchema),
});

export const reverseGeocodeResponseSchema = z.object({
  location: geocodeResultSchema.nullable(),
});

export const reachabilityQuerySchema = z.object({
  lat: latSchema,
  lng: lngSchema,
  distanceKm: z.coerce.number().finite().min(0.5).max(250),
  mode: travelModeSchema,
});

export const geocodeQuerySchema = z.object({
  q: z.string().trim().min(2).max(120),
});

export const reverseGeocodeQuerySchema = z.object({
  lat: latSchema,
  lng: lngSchema,
});

export const reachabilityResponseSchema = z.object({
  origin: z.object({
    lat: latSchema,
    lng: lngSchema,
    label: z.string().optional(),
  }),
  distanceKm: z.number().finite().positive(),
  mode: travelModeSchema,
  provider: reachabilityProviderSchema,
  polygon: polygonFeatureSchema,
  branches: z.array(branchFeatureSchema),
  meta: z.object({
    branchStrategy: z.literal('sampled-routes'),
    sampledTargetCount: z.number().int().nonnegative(),
    successfulBranchCount: z.number().int().nonnegative(),
    generatedAt: z.string(),
  }),
});

export const apiErrorSchema = z.object({
  error: z.string(),
});

export type TravelMode = z.infer<typeof travelModeSchema>;
export type GeocodeResult = z.infer<typeof geocodeResultSchema>;
export type GeocodeResponse = z.infer<typeof geocodeResponseSchema>;
export type ReverseGeocodeResponse = z.infer<typeof reverseGeocodeResponseSchema>;
export type ReachabilityQuery = z.infer<typeof reachabilityQuerySchema>;
export type ReachabilityResponse = z.infer<typeof reachabilityResponseSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
export type ReachabilityProvider = z.infer<typeof reachabilityProviderSchema>;
export type ReachabilityPolygonFeature = z.infer<typeof polygonFeatureSchema>;
export type ReachabilityBranchFeature = z.infer<typeof branchFeatureSchema>;
export type ReachabilityPolygonGeometry = Polygon | MultiPolygon;
export type ReachabilityBranchGeometry = LineString;
