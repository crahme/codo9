/** @type {import('next').NextConfig} */
const { withSentryConfig } = require('@sentry/nextjs');

const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.ctfassets.net', // Allow images from Contentful
      },
    ],
  },
  productionBrowserSourceMaps: true, // Enable source maps for production builds
  env: {
    CONTENTFUL_ACCESS_TOKEN: process.env.CONTENTFUL_ACCESS_TOKEN,
    CONTENTFUL_SPACE_ID: process.env.CONTENTFUL_SPACE_ID,
    CONTENTFUL_PREVIEW_TOKEN: process.env.CONTENTFUL_PREVIEW_TOKEN,
    CONTENTFUL_MANAGEMENT_TOKEN: process.env.CONTENTFUL_MANAGEMENT_TOKEN,
    CONTENTFUL_ENVIRONMENT: process.env.CONTENTFUL_ENVIRONMENT || 'master',
    SENTRY_DSN: process.env.SENTRY_DSN, // Sentry DSN for error tracking
    SENTRY_RELEASE: process.env.COMMIT_REF || 'development', // Release version for Sentry
  },
  webpack: (config, { isServer }) => {
    // Enable source maps for debugging
    config.devtool = 'source-map';

    // Add source-map-loader to process source maps
    if (!isServer) {
      config.module.rules.push({
        test: /\.js$/,
        enforce: 'pre',
        use: ['source-map-loader'],
      });
    }

    return config;
  },
};

const sentryWebpackPluginOptions = {
  silent: false, // Display logs for debugging
  org: process.env.SENTRY_ORG || 'cloud-perry', // Your Sentry organization slug
  project: process.env.SENTRY_PROJECT || 'codo9', // Your Sentry project slug
  release: process.env.COMMIT_REF || 'development', // Release version for Sentry
  include: '.next', // Include the .next directory for source map uploads
  ignore: ['node_modules'], // Ignore node_modules
  urlPrefix: '~/_next', // Set the URL prefix to match Next.js file paths
  dryRun: process.env.NODE_ENV !== 'production', // Only upload source maps in production
  setCommits: {
    auto: true, // Automatically detect commits
  },
  debug: false, // Set to false for production to avoid cluttering logs
deleteSourcemapsAfterUpload: true, // Prevent serving source maps to users
};

module.exports = withSentryConfig(nextConfig, sentryWebpackPluginOptions);
