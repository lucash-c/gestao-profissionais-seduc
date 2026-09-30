SELECT 'CREATE DATABASE seduc_test'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'seduc_test')\gexec
