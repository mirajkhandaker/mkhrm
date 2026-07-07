require('dotenv').config();

module.exports = {
  apps: [
    {
      name: 'hrm-api',
      cwd: './apps/api',
      script: 'pnpm',
      args: 'run dev',
      watch: false,
      env: {
        NODE_ENV: 'development',
        API_PORT: process.env.API_PORT || 6000,
        DB_HOST: process.env.DB_HOST,
        DB_PORT: process.env.DB_PORT,
        DB_NAME: process.env.DB_NAME,
        DB_USER: process.env.DB_USER,
        DB_PASS: process.env.DB_PASS,
        JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
        JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
        JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN,
        JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN,
      },
    },
    {
      name: 'hrm-web',
      cwd: './apps/web',
      script: 'pnpm',
      args: 'run dev',
      watch: false,
      env: {
        NODE_ENV: 'development',
        PORT: process.env.WEB_PORT || 6001,
        NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
      },
    },
  ],
};
