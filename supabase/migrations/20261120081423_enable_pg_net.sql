-- Applied in production before the round-2 migrations (pg_net is also created idempotently in 20261120000300).
create extension if not exists pg_net with schema extensions;
