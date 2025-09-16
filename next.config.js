// @ts-check

/**
 * @type {import("next").NextConfig}
 **/
const nextConfig = {
  output: "standalone",
  images: {
    // Disable Next.js image optimization to avoid needing `sharp` in production
    unoptimized: true,

    // Replace deprecated `images.domains` with `remotePatterns`
    remotePatterns: [
      {
        protocol: "https",
        hostname: "api.dicebear.com",
      },
    ],
  },
  async headers() {
    return [
      {
        // apply headers to all routes
        source: "/:path*",
        headers: [
          { key: "X-DNS-Prefetch-Control", value: "on" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ]
  },
}

module.exports = nextConfig