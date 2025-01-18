/** @type {import('next').NextConfig} */
const { withSentryConfig } = require('@sentry/nextjs');

const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.ctfassets.net',
      },
    ],
  },
  productionBrowserSourceMaps: true,
  env: {
    CONTENTFUL_ACCESS_TOKEN: process.env.CONTENTFUL_ACCESS_TOKEN,
    CONTENTFUL_SPACE_ID: process.env.CONTENTFUL_SPACE_ID,
    CONTENTFUL_PREVIEW_TOKEN: process.env.CONTENTFUL_PREVIEW_TOKEN,
    CONTENTFUL_MANAGEMENT_TOKEN: process.env.CONTENTFUL_MANAGEMENT_TOKEN,
    CONTENTFUL_ENVIRONMENT: process.env.CONTENTFUL_ENVIRONMENT || 'master',
    SENTRY_DSN: process.env.SENTRY_DSN,
    // Use DEPLOY_ID instead of COMMIT_REF for more reliable releases
    SENTRY_RELEASE: process.env.COMMIT_REF || 'development',
  }
};

const sentryWebpackPluginOptions = {
  silent: false, // Enable Sentry output for debugging
  org: process.env.SENTRY_ORG || 'cloud-perry', // Add your org as fallback
  project: process.env.SENTRY_PROJECT || 'codo9', // Add your project as fallback
  release: process.env.COMMIT_REF || 'development',
  include: '.next',
  ignore: ['node_modules'],
  urlPrefix: '~/_next',
  dryRun: process.env.NODE_ENV !== 'production',
  setCommits: {
    auto: true,
    commit: process.env.COMMIT_REF,
  },
  debug: true
};

// Add error handling for withSentryConfig
const config = withSentryConfig(
  nextConfig,
  sentryWebpackPluginOptions,
  { silent: false } // Enable console output for debugging
);

module.exports = {
  productionBrowserSourceMaps: true,
};
