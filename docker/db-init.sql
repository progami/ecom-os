CREATE DATABASE portal_db;

\connect portal_db;

-- Portal auth schema/user
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'portal_auth') THEN
    CREATE ROLE portal_auth LOGIN PASSWORD 'portal_auth';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.schemata WHERE schema_name = 'auth') THEN
    EXECUTE 'CREATE SCHEMA auth AUTHORIZATION portal_auth';
  ELSE
    EXECUTE 'ALTER SCHEMA auth OWNER TO portal_auth';
  END IF;
END$$;

ALTER ROLE portal_auth IN DATABASE portal_db SET search_path TO auth;

-- WMS schema/user
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'portal_wms') THEN
    CREATE ROLE portal_wms LOGIN PASSWORD 'portal_wms';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.schemata WHERE schema_name = 'wms') THEN
    EXECUTE 'CREATE SCHEMA wms AUTHORIZATION portal_wms';
  ELSE
    EXECUTE 'ALTER SCHEMA wms OWNER TO portal_wms';
  END IF;
END$$;

ALTER ROLE portal_wms IN DATABASE portal_db SET search_path TO wms;

-- XPlan schema/user
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'portal_xplan') THEN
    CREATE ROLE portal_xplan LOGIN PASSWORD 'portal_xplan';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.schemata WHERE schema_name = 'xplan') THEN
    EXECUTE 'CREATE SCHEMA xplan AUTHORIZATION portal_xplan';
  ELSE
    EXECUTE 'ALTER SCHEMA xplan OWNER TO portal_xplan';
  END IF;
END$$;

ALTER ROLE portal_xplan IN DATABASE portal_db SET search_path TO xplan;
