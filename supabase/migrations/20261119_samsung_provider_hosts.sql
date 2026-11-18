-- Samsung Internet can use provider hostnames outside the old exact
-- host list. This remains restricted to HTTPS URLs from trusted vendors.
alter table public.fitness_push_subscriptions
  drop constraint if exists fitness_push_trusted_endpoint;
alter table public.fitness_push_subscriptions
  add constraint fitness_push_trusted_endpoint
  check (
    endpoint ~ '^https://([a-zA-Z0-9-]+[.])*(googleapis[.]com|samsungosp[.]com|push[.]apple[.]com|push[.]services[.]mozilla[.]com|notify[.]windows[.]com)(:[0-9]{2,5})?/'
  );