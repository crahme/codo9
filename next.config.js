/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,

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
  webpack: (config, { isServer, dev }) => {
    config.devtool = dev ? 'eval-source-map' : 'source-map';
    if (!isServer) {
      config.module.rules.push({
        test: /\.js$/,
        enforce: 'pre',
        use: ['source-map-loader'],
      });
    }
    return config;
  },
  // Uncomment and adjust if you use custom caching:
  // cacheHandler: require('./cache-handler.js'),
  // cacheMaxMemorySize: 0,
};

export default nextConfig;
