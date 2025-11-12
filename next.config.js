/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true,
    serverActions: {
      allowedOrigins: ["*"]
    }
  }
}

module.exports = nextConfig
