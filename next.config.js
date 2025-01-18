/** @type {import('next').NextConfig} */
const { withSentryConfig } = require('@sentry/nextjs');
const { SentryWebpackPlugin } = require('@sentry/webpack-plugin');

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
    SENTRY_DSN: process.env.SENTRY_DSN, // Sentry DSN for client-side error reporting
    SENTRY_RELEASE: process.env.SENTRY_RELEASE || `release-${process.env.COMMIT_REF}`, // Dynamically generated release name
  },
  webpack: (config, { isServer, buildId }) => {
    if (!isServer) {
      config.plugins.push(
        new SentryWebpackPlugin({
          include: '.next',
          ignore: ['node_modules'],
          urlPrefix: '~/_next',
          release: process.env.SENTRY_RELEASE || `release-${buildId}`,
          dryRun: process.env.NODE_ENV !== 'production', // Only upload source maps in production
        })
      );
    }

    return config;
  },
};

const sentryWebpackPluginOptions = {
  silent: true, // Suppress logs
  org: process.env.SENTRY_ORG, // Sentry organization slug
  project: process.env.SENTRY_PROJECT, // Sentry project slug
  release: process.env.SENTRY_RELEASE || `release-${process.env.COMMIT_REF}`, // Sentry release name
};

module.exports = withSentryConfig(nextConfig, sentryWebpackPluginOptions);
