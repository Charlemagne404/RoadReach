import {
  type TravelMode,
  apiErrorSchema,
  geocodeResponseSchema,
  reachabilityResponseSchema,
  reverseGeocodeResponseSchema,
} from '@roadreach/contracts';

type FetchOptions = {
  signal?: AbortSignal;
};

async function parseResponse<T>(
  response: Response,
  schema: { parse: (value: unknown) => T },
) {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const parsedError = apiErrorSchema.safeParse(payload);
    throw new Error(parsedError.success ? parsedError.data.error : 'Request failed.');
  }

  return schema.parse(payload);
}

export async function searchLocations(query: string, options?: FetchOptions) {
  const response = await fetch(`/api/geocode?${new URLSearchParams({ q: query })}`, {
    signal: options?.signal,
  });

  return parseResponse(response, geocodeResponseSchema);
}

export async function reverseGeocode(lat: number, lng: number, options?: FetchOptions) {
  const response = await fetch(
    `/api/reverse-geocode?${new URLSearchParams({
      lat: String(lat),
      lng: String(lng),
    })}`,
    { signal: options?.signal },
  );

  return parseResponse(response, reverseGeocodeResponseSchema);
}

export async function fetchReachability(
  lat: number,
  lng: number,
  distanceKm: number,
  mode: TravelMode,
  options?: FetchOptions,
) {
  const response = await fetch(
    `/api/reachability?${new URLSearchParams({
      lat: String(lat),
      lng: String(lng),
      distanceKm: String(distanceKm),
      mode,
    })}`,
    { signal: options?.signal },
  );

  return parseResponse(response, reachabilityResponseSchema);
}
