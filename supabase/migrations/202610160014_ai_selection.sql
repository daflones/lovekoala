begin;
-- Keep pre-existing artwork selections; new images wait for the creator's choice.
alter table public.lk_image_jobs alter column included set default false;
commit;
