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
    SENTRY_RELEASE: process.env.DEPLOY_ID || 'development',
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.devtool = 'source-map';
    }
    return config;
  },
};

const sentryWebpackPluginOptions = {
  silent: false,
  org: process.env.SENTRY_ORG || 'cloud-perry',
  project: process.env.SENTRY_PROJECT || 'codo9',
  release: process.env.DEPLOY_ID || 'development',
  include: '.next',
  ignore: ['node_modules'],
  urlPrefix: '~/_next',
  dryRun: process.env.NODE_ENV !== 'production',
  setCommits: {
    auto: true,
    commit: process.env.DEPLOY_ID,
  },
  debug: true,
  widenClientFileUpload: true,
};

module.exports = withSentryConfig(
  nextConfig,
  sentryWebpackPluginOptions,
  { silent: false }
);
