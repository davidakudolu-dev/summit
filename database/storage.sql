-- Run after the migration on Supabase. No client storage access policy is granted.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('digital-products','digital-products',false,52428800,array['application/pdf','application/zip','application/epub+zip'])
on conflict(id) do nothing;
