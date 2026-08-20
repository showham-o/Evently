import { Helmet } from 'react-helmet-async';

/**
 * Per-page SEO overrides, layered on top of the static defaults in
 * index.html. Only meaningfully used by pages that should actually be
 * indexed (HomePage, EventDetailsPage) - everything else relies on
 * index.html's site-wide `noindex, follow` default rather than needing to
 * render this component at all.
 *
 * IMPORTANT CAVEAT: this is a client-side-rendered SPA (no SSR/prerendering).
 * Google's crawler executes JavaScript, so it sees whatever <Seo> renders
 * for a given route. Social-media crawlers (Facebook/Twitter/LinkedIn)
 * generally do NOT execute JavaScript, so they only ever see index.html's
 * static tags - a shared link to a specific event will show the site-wide
 * OG title/description/image, not this event's. Real per-event social
 * previews would require server-side rendering or a prerendering step,
 * which is a larger change than this pass covers.
 */
export function getSiteUrl(): string {
  const configured = import.meta.env.VITE_SITE_URL as string | undefined;
  if (configured && !configured.includes('your-domain')) return configured.replace(/\/$/, '');
  return window.location.origin;
}

interface SeoProps {
  title: string;
  description: string;
  /** Path only, e.g. "/" or `/e/${eventId}` - combined with the site URL for canonical/og:url. */
  path: string;
  /** Defaults to indexable - only pass true for a page that should NOT be indexed despite rendering <Seo>. */
  noindex?: boolean;
  /** One or more JSON-LD objects to inject as separate <script type="application/ld+json"> tags. */
  jsonLd?: object | object[];
}

export function Seo({ title, description, path, noindex, jsonLd }: SeoProps) {
  const url = `${getSiteUrl()}${path}`;
  const jsonLdList = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta name="robots" content={noindex ? 'noindex, follow' : 'index, follow'} />

      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />

      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />

      {jsonLdList.map((obj, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(obj)}
        </script>
      ))}
    </Helmet>
  );
}
