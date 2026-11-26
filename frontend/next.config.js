/** @type {import('next').NextConfig} */
const nextConfig = {
  // Proxy API calls seamlessly to FastAPI backend so the browser
  // uses the same origin (no CORS or cookie issues over FRP tunnels)
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: "http://127.0.0.1:8000/api/v1/:path*",
      },
      {
        source: "/docs",
        destination: "http://127.0.0.1:8000/docs",
      },
      {
        source: "/openapi.json",
        destination: "http://127.0.0.1:8000/openapi.json",
      },
    ];
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
