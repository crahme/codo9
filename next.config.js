/** @type {import('next').NextConfig} */
// const { withSentryConfig } = require('@sentry/nextjs');

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
  cacheHandler: './cache-handler.js', // String path for Netlify compatibility
  cacheMaxMemorySize: 0, // Disable in-memory caching if needed
};

// const sentryWebpackPluginOptions = {
//   silent: false,
//   org: process.env.SENTRY_ORG || 'cloud-perry',
//   project: process.env.SENTRY_PROJECT || 'codo9',
//   release: process.env.COMMIT_REF || 'development',
//   include: '.next',
//   ignore: ['node_modules'],
//   urlPrefix: '~/_next',
//   dryRun: process.env.NODE_ENV !== 'production',
//   setCommits: { auto: true },
//   debug: false,
//   deleteSourcemapsAfterUpload: true,
// };

// module.exports = nextConfig;
module.exports = nextConfig;
