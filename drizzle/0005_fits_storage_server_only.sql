-- Users no longer write to Storage at all: the server (service key) stores
-- only photos it re-encoded with sharp. Remove the user upload/delete policies.
DROP POLICY IF EXISTS "fits_insert_own_folder" ON storage.objects;
--> statement-breakpoint
DROP POLICY IF EXISTS "fits_delete_own_folder" ON storage.objects;
--> statement-breakpoint
-- Hidden fits' photos move here: private, so a hidden image stops being served.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('fits-quarantine', 'fits-quarantine', false, 2097152, ARRAY['image/webp'])
ON CONFLICT (id) DO UPDATE SET public = false;
--> statement-breakpoint
-- Re-encoded WebPs at 1440px are well under 1 MB.
UPDATE storage.buckets SET file_size_limit = 1048576 WHERE id = 'fits';
