/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.ctfassets.net', // Allow Contentful image assets
      },
    ],
  },
  productionBrowserSourceMaps: true, // Generate source maps for production builds
  env: {
    CONTENTFUL_ACCESS_TOKEN: process.env.CONTENTFUL_ACCESS_TOKEN,
    CONTENTFUL_SPACE_ID: process.env.CONTENTFUL_SPACE_ID,
    CONTENTFUL_PREVIEW_TOKEN: process.env.CONTENTFUL_PREVIEW_TOKEN,
    CONTENTFUL_MANAGEMENT_TOKEN: process.env.CONTENTFUL_MANAGEMENT_TOKEN,
    CONTENTFUL_ENVIRONMENT: process.env.CONTENTFUL_ENVIRONMENT || 'master',
    SENTRY_DSN: process.env.SENTRY_DSN, // Add Sentry DSN for client-side error reporting
    SENTRY_RELEASE: process.env.SENTRY_RELEASE || 'default-release', // Release name for Sentry
  },
  webpack: (config, { isServer, buildId }) => {
    // Sentry source map configuration
    if (!isServer) {
      const { SentryWebpackPlugin } = require('@sentry/webpack-plugin');

      config.plugins.push(
        new SentryWebpackPlugin({
          include: '.next',
          ignore: ['node_modules'],
          urlPrefix: '~/_next',
          release: process.env.SENTRY_RELEASE || `release-${buildId}`,
        })
      );
    }

    return config;
  },
};

module.exports = nextConfig;
