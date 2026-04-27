import type { GeocodeResult, TravelMode } from '@roadreach/contracts';
import type { ReachabilityInsights } from './reachability';
import { formatDistance, formatWalkDuration } from './reachability';

type SeoState = {
  distanceKm: number;
  insights: ReachabilityInsights | null;
  location: GeocodeResult | null;
  mode: TravelMode;
};

const defaultTitle = 'RoadReach | Walking catchment and travel reachability maps';
const defaultDescription =
  'RoadReach is a road-network reachability map for exploring walksheds, cycling range, and driving access from any address or dropped pin.';
const siteName = 'RoadReach';
const structuredDataId = 'roadreach-structured-data';

function formatModeLabel(mode: TravelMode) {
  switch (mode) {
    case 'walking':
      return 'walking';
    case 'cycling':
      return 'cycling';
    case 'driving':
      return 'driving';
  }
}

function buildTitle({ location, distanceKm, mode }: SeoState) {
  if (!location) {
    return defaultTitle;
  }

  if (mode === 'walking') {
    return `${location.name} ${formatWalkDuration(distanceKm)} walkshed | ${siteName}`;
  }

  return `${location.name} ${formatDistance(distanceKm)} ${formatModeLabel(mode)} reach | ${siteName}`;
}

function buildDescription({ location, distanceKm, mode, insights }: SeoState) {
  if (!location) {
    return defaultDescription;
  }

  if (mode === 'walking') {
    const distanceLabel = formatWalkDuration(distanceKm);
    const areaLabel = insights ? ` covering about ${Math.round(insights.areaKm2)} km²` : '';
    return `Explore a ${distanceLabel} walkshed from ${location.label} with road-network routing${areaLabel}.`;
  }

  const rangeLabel = formatDistance(distanceKm);
  const branchLabel = insights ? ` across ${insights.branchCount} sampled routes` : '';
  return `See what is reachable from ${location.label} within ${rangeLabel} by ${formatModeLabel(mode)}${branchLabel} using road-network analysis.`;
}

function getAbsoluteUrl(includeSearch: boolean) {
  const { origin, pathname, search } = window.location;
  return `${origin}${pathname}${includeSearch ? search : ''}`;
}

function upsertMeta(selector: string, attributes: Record<string, string>) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);

  if (!element) {
    element = document.createElement('meta');
    document.head.append(element);
  }

  Object.entries(attributes).forEach(([name, value]) => {
    element?.setAttribute(name, value);
  });
}

function upsertLink(rel: string, href: string) {
  let element = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);

  if (!element) {
    element = document.createElement('link');
    element.rel = rel;
    document.head.append(element);
  }

  element.href = href;
}

function upsertStructuredData(data: Record<string, unknown>) {
  let element = document.getElementById(structuredDataId) as HTMLScriptElement | null;

  if (!element) {
    element = document.createElement('script');
    element.id = structuredDataId;
    element.type = 'application/ld+json';
    document.head.append(element);
  }

  element.textContent = JSON.stringify(data);
}

export function applyPageSeo(state: SeoState) {
  const title = buildTitle(state);
  const description = buildDescription(state);
  const canonicalUrl = getAbsoluteUrl(false);
  const shareUrl = getAbsoluteUrl(true);

  document.title = title;

  upsertLink('canonical', canonicalUrl);
  upsertMeta('meta[name="description"]', { name: 'description', content: description });
  upsertMeta('meta[property="og:title"]', { property: 'og:title', content: title });
  upsertMeta('meta[property="og:description"]', {
    property: 'og:description',
    content: description,
  });
  upsertMeta('meta[property="og:url"]', { property: 'og:url', content: shareUrl });
  upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: title });
  upsertMeta('meta[name="twitter:description"]', {
    name: 'twitter:description',
    content: description,
  });

  upsertStructuredData({
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    applicationCategory: 'TravelApplication',
    description,
    isAccessibleForFree: true,
    name: title,
    operatingSystem: 'Any',
    url: shareUrl,
    featureList: [
      'Walking catchment maps',
      'Cycling reachability maps',
      'Driving reachability maps',
      'Address and map-pin origin selection',
      'Shareable route scenarios',
    ],
    areaServed: state.location
      ? {
          '@type': 'Place',
          geo: {
            '@type': 'GeoCoordinates',
            latitude: state.location.lat,
            longitude: state.location.lng,
          },
          name: state.location.label,
        }
      : undefined,
  });
}
