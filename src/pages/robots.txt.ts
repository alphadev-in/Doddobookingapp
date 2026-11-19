import type { APIRoute } from 'astro';

export const prerender = true;

/** robots.txt generated from the configured site URL, so the sitemap link always matches the domain. */
export const GET: APIRoute = ({ site }) => {
  const origin = (site ?? new URL('https://doddo.app')).toString().replace(/\/$/, '');
  const body = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /dashboard',
    'Disallow: /onboarding',
    'Disallow: /booking/',
    'Disallow: /api/',
    '',
    `Sitemap: ${origin}/sitemap-index.xml`,
    '',
  ].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
