-- Storage for user fits. Public read (images are shown on public pages);
-- uploads only by a signed-in user into their own folder (<user id>/...).
-- The server re-encodes every upload (strips EXIF/GPS) before storing it.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('fits', 'fits', true, 2097152, ARRAY['image/webp'])
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;
--> statement-breakpoint
DROP POLICY IF EXISTS "fits_insert_own_folder" ON storage.objects;
--> statement-breakpoint
CREATE POLICY "fits_insert_own_folder" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'fits' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
--> statement-breakpoint
DROP POLICY IF EXISTS "fits_delete_own_folder" ON storage.objects;
--> statement-breakpoint
CREATE POLICY "fits_delete_own_folder" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'fits' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
