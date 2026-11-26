/** @type {import('next').NextConfig} */
const nextConfig = {
  // Public runtime URL — used when the app is accessed via FRP at
  // http://general.cactusxpo.com/  Set NEXT_PUBLIC_API_BASE in .env
  // or the systemd service to override for production.
  env: {
    NEXT_PUBLIC_API_BASE: process.env.NEXT_PUBLIC_API_BASE || "http://general.cactusxpo.com",
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || "http://general.cactusxpo.com",
  },

  // Allow images served from the FRP domain
  images: {
    domains: ["general.cactusxpo.com", "localhost"],
  },

  // Allow the production build to be served behind a reverse proxy / FRP
  // without stripping headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
