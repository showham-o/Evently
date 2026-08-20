// Generates public/sitemap.xml from the live, published events in Supabase.
//
// This is a BUILD-TIME generator, not a live server endpoint - this project
// deploys as a static SPA (no backend of its own), so "dynamic sitemap
// routing" here means "regenerate the static file before each deploy" rather
// than a server computing it per-request. Run it manually with
// `npm run generate-sitemap` once VITE_SITE_URL is set to a real domain, or
// wire it into the `build` script in package.json once you're ready for it
// to run automatically on every deploy.
//
// Deliberately NOT auto-run yet: VITE_SITE_URL isn't set to a real domain
// as of this writing, and baking a placeholder URL into a deployed
// sitemap.xml would be actively wrong, not just incomplete.

import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const siteUrl = process.env.VITE_SITE_URL;
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!siteUrl || siteUrl.includes('your-domain')) {
  console.error(
    'VITE_SITE_URL is not set to a real domain (see .env.example) - refusing to generate a sitemap with a placeholder URL. Set it in .env and re-run.',
  );
  process.exit(1);
}
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are required to fetch published events.');
  process.exit(1);
}

const baseUrl = siteUrl.replace(/\/$/, '');
const supabase = createClient(supabaseUrl, supabaseAnonKey);

function xmlEscape(value) {
  return value.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]);
}

async function main() {
  const { data: events, error } = await supabase
    .from('events')
    .select('id, event_date')
    .eq('status', 'published')
    .order('event_date', { ascending: true });

  if (error) {
    console.error('Failed to fetch published events:', error.message);
    process.exit(1);
  }

  const urls = [
    { loc: `${baseUrl}/`, changefreq: 'hourly', priority: '1.0' },
    ...(events ?? []).map((event) => ({
      loc: `${baseUrl}/e/${event.id}`,
      lastmod: new Date(event.event_date).toISOString().slice(0, 10),
      changefreq: 'daily',
      priority: '0.8',
    })),
  ];

  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls
      .map(
        (u) =>
          '  <url>\n' +
          `    <loc>${xmlEscape(u.loc)}</loc>\n` +
          (u.lastmod ? `    <lastmod>${u.lastmod}</lastmod>\n` : '') +
          `    <changefreq>${u.changefreq}</changefreq>\n` +
          `    <priority>${u.priority}</priority>\n` +
          '  </url>\n',
      )
      .join('') +
    '</urlset>\n';

  const outPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'sitemap.xml');
  writeFileSync(outPath, xml, 'utf-8');
  console.log(`Wrote ${urls.length} URLs to ${outPath}`);
}

main();
