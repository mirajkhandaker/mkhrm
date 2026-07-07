/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@hrm/types'],
  async rewrites() {
    const apiPort = process.env.API_PORT || '6000';
    return [
      {
        source: '/api/:path*',
        destination: `http://localhost:${apiPort}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
