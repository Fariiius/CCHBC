import { Pool } from 'pg';

// Initialize a connection pool for direct DDL/DML operations
// This is used for creating dynamic tables when Excel sheets are uploaded
let dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres';
if (!dbUrl.startsWith('postgres')) {
  dbUrl = 'postgresql://postgres:postgres@localhost:5432/postgres';
}

export const pool = new Pool({
  connectionString: dbUrl,
});
