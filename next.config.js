/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Expose Supabase credentials to the client bundle so OAuth can run in the browser
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.supabase_url || "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.supabase_anon_key || ""
  },
  experimental: {
    typedRoutes: true,
    serverActions: {
      allowedOrigins: ["*"]
    }
  }
}

module.exports = nextConfig
