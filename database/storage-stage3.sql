-- Apply to the configured development project after the additive Stage 3 migration.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('site-media','site-media',true,4194304,array['image/jpeg','image/png','image/webp']),
 ('quarantine','quarantine',false,8388608,array['application/pdf','application/zip'])
on conflict(id) do nothing;
-- No client upload or quarantine read policy is granted. Existing digital-products stays private.
