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
  webpack: (config, { isServer, dev }) => {
    config.devtool = dev ? 'eval-source-map' : 'source-map';
    if (!isServer) {
      config.module.rules.push({
        test: /\.js$/,
        enforce: 'pre',
        use: ['source-map-loader'],
      });
    }
     allowedDevOrigins: [
    'https://devserver-preview--codo9.netlify.app',
    // add any other allowed origins here
  ]
    return config;
  },
  // Uncomment and fix these lines if needed:
  // cacheHandler: require('./cache-handler.js'),
  // cacheMaxMemorySize: 0,
};

module.exports = nextConfig;
