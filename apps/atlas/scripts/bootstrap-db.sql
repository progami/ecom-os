-- Bootstrap local Postgres for ATLAS (matches production-style privileges)
-- Run as a superuser (postgres). Examples:
--   macOS:   psql -v ON_ERROR_STOP=1 -h localhost -U postgres -f apps/atlas/scripts/bootstrap-db.sql
--   Linux:   sudo -u postgres psql -v ON_ERROR_STOP=1 -f apps/atlas/scripts/bootstrap-db.sql

-- 1) Create role if missing
DO $$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'atlas') THEN
      CREATE ROLE atlas LOGIN PASSWORD 'atlas';
   END IF;
END $$;

-- 2) Recreate database owned by atlas (drop if exists; safe for empty dev env)
--    Comment out DROP if you already have data you want to keep.
DROP DATABASE IF EXISTS atlas;
CREATE DATABASE atlas OWNER atlas;

-- 3) Ensure schema ownership and privileges
\connect atlas
ALTER SCHEMA public OWNER TO atlas;
GRANT USAGE, CREATE ON SCHEMA public TO atlas;
GRANT ALL PRIVILEGES ON ALL TABLES    IN SCHEMA public TO atlas;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO atlas;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO atlas;

-- 4) Default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES    TO atlas;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO atlas;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO atlas;

-- 5) Explicit connect grant (usually implicit for owner, but keep for clarity)
\connect postgres
GRANT CONNECT ON DATABASE atlas TO atlas;

