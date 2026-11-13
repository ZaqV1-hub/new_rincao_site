-- Preserve existing grants and allow the explicit counting/gate resource names.
ALTER TABLE acl ALTER COLUMN idrecurso TYPE VARCHAR(40);
