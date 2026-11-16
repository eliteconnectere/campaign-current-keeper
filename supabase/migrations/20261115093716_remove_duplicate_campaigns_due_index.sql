-- campaigns_worker_ready_idx already covers this exact due-campaign lookup.
drop index if exists public.campaigns_due_unleased_idx;
