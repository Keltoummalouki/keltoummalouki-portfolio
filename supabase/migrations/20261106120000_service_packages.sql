-- =============================================================================
-- Freelance packages on public.services.
--
--   * price_from: the "starting from" price in whole euros. NULL shows "quote
--     on request", so a package can be published before it has a price.
--   * includes: what the package includes, as a {fr,en,ar} JSONB map with one
--     item per line (same i18n convention as title and description).
--
-- The table's RLS policies and grants are table-wide, so they already cover
-- the new columns: visitors read published rows, admins manage everything.
-- =============================================================================

alter table public.services
  add column price_from integer check (price_from is null or price_from between 0 and 1000000),
  add column includes jsonb not null default '{}'::jsonb;

comment on column public.services.price_from is
  'Starting price in whole euros; NULL shows "quote on request".';
comment on column public.services.includes is
  'What the package includes: per-locale JSONB map, one item per line.';
