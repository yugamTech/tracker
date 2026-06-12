-- dev DB is created by POSTGRES_DB env var
-- create a separate test DB for e2e tests
CREATE DATABASE saarthi_test;
GRANT ALL PRIVILEGES ON DATABASE saarthi_test TO saarthi;
