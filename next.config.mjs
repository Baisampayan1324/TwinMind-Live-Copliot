/** @type {import('next').NextConfig} */
const nextConfig = {
  // Exclude the 'twinmind' reference folder from being treated as Next.js routes.
  // It's a reference implementation only and uses dependencies not installed here.
  transpilePackages: [],
  experimental: {
    outputFileTracingExcludes: {
      '*': ['./twinmind/**'],
    },
  },
};

export default nextConfig;
