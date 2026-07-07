import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';
import { config } from 'dotenv';
import { join } from 'path';

// Walk up to repo root to find .env when run from apps/api
config({ path: join(__dirname, '../../../../.env') });

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME ?? 'hrm_dev',
  username: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASS ?? '',
  synchronize: false,
  logging: process.env.DB_LOGGING !== 'false',
  entities: [join(__dirname, 'entities', '**', '*.entity{.ts,.js}')],
  migrations: [join(__dirname, 'migrations', '*{.ts,.js}')],
};

const AppDataSource = new DataSource(dataSourceOptions);
export default AppDataSource;
