-- Runs only once, when the Postgres data volume is first created.
-- The test suite uses its own database so it can empty tables freely.
CREATE DATABASE ownsprint_test;
