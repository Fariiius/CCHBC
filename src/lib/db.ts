import { Pool } from 'pg';

// Initialize a connection pool for direct DDL/DML operations
// This is used for creating dynamic tables when Excel sheets are uploaded
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres',
});
