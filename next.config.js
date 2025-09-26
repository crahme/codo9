// next.config.js
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: 'true',
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // 👇 This tells the Visual Editor to ignore API routes
  experimental: {
    stackbit: {
      guard: (context) => {
        // If the request is for our invoices API route -> block it
        if (context?.url?.startsWith('/api/invoices')) {
          return false
        }
        return true
      },
    },
  },
}

module.exports = withBundleAnalyzer(nextConfig)
