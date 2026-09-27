/** @type {import('next').NextConfig} */
const nextConfig = {
  // Lets a dev server run beside a production build without sharing .next
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // Old URLs from the previous site and the /v2 preview keep working.
  async redirects() {
    return [
      { source: '/contact', destination: '/?lens=work#contact', permanent: true },
      { source: '/testimonials', destination: '/?lens=work#words', permanent: false },
      { source: '/notes/more-than-two-souls', destination: '/notes/steppenwolf', permanent: true },
      { source: '/notes/the-instagram-years', destination: '/notes', permanent: true },
      { source: '/notes/whats-left', destination: '/notes/worth-wanting', permanent: true },
      { source: '/v2', destination: '/', permanent: false },
      { source: '/v2/work', destination: '/projects', permanent: false },
      { source: '/v2/:path*', destination: '/:path*', permanent: false },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()'
          }
        ]
      }
    ];
  }
};

module.exports = nextConfig; 