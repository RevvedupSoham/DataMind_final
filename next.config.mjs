/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Never expose server-only env vars to the client bundle.
  // Only NEXT_PUBLIC_* variables are ever inlined by Next.js.
};

export default nextConfig;
