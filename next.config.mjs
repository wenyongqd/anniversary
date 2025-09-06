/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: [],
  },
  serverExternalPackages: ['@vercel/blob'],
}

export default nextConfig