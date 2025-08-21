/** @type {import('next').NextConfig} */
const nextConfig = {
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
}

module.exports = nextConfig;