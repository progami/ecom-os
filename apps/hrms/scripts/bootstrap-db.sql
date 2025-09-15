-- Bootstrap local Postgres for HRMS (matches production-style privileges)
-- Run as a superuser (postgres). Examples:
--   macOS:   psql -v ON_ERROR_STOP=1 -h localhost -U postgres -f apps/hrms/scripts/bootstrap-db.sql
--   Linux:   sudo -u postgres psql -v ON_ERROR_STOP=1 -f apps/hrms/scripts/bootstrap-db.sql

-- 1) Create role if missing
DO $$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'hrms') THEN
      CREATE ROLE hrms LOGIN PASSWORD 'hrms';
   END IF;
END $$;

-- 2) Recreate database owned by hrms (drop if exists; safe for empty dev env)
--    Comment out DROP if you already have data you want to keep.
DROP DATABASE IF EXISTS hrms;
CREATE DATABASE hrms OWNER hrms;

-- 3) Ensure schema ownership and privileges
\connect hrms
ALTER SCHEMA public OWNER TO hrms;
GRANT USAGE, CREATE ON SCHEMA public TO hrms;
GRANT ALL PRIVILEGES ON ALL TABLES    IN SCHEMA public TO hrms;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO hrms;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO hrms;

-- 4) Default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES    TO hrms;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO hrms;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO hrms;

-- 5) Explicit connect grant (usually implicit for owner, but keep for clarity)
\connect postgres
GRANT CONNECT ON DATABASE hrms TO hrms;

