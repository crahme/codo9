/** @type {import('next').NextConfig} */
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
    CONTENTFUL_MANAGEMENT_TOKEN: process.env.CONTENTFUL_MANAGEMENT_TOKEN,
    CONTENTFUL_DELIVERY_TOKEN: process.env.CONTENTFUL_DELIVERY_TOKEN,
    CONTENTFUL_SPACE_ID: process.env.CONTENTFUL_SPACE_ID,
  },
  allowedDevOrigins: [
    'https://devserver-preview--codo9.netlify.app',
    'http://localhost:3000',
    // Add more dev/preview URLs if needed
  ],
    webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      // Only suppress source map warnings, don't change devtool
      config.ignoreWarnings = [
        ...(config.ignoreWarnings || []),
        {
          module: /node_modules\/@next\/react-refresh-utils/,
          message: /Failed to parse source map/,
        },
      ];
    }
    return config;
  },

  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  }
  // Uncomment and adjust if you use custom caching:
  // cacheHandler: require('./cache-handler.js'),
  // cacheMaxMemorySize: 0,
};

export default nextConfig;
