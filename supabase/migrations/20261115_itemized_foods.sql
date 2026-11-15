-- Existing records automatically receive an empty list. RLS stays owner-only.
alter table public.daily_entries
  add column if not exists meal_items jsonb not null default '[]'::jsonb;

-- Limit stored JSON size while allowing multiple foods and serving edits.
alter table public.daily_entries
  add constraint daily_entries_meal_items_valid
  check (
    jsonb_typeof(meal_items) = 'array'
    and octet_length(meal_items::text) <= 30000
  );

-- Shared summary RPCs intentionally do not return meal_items or meals.
