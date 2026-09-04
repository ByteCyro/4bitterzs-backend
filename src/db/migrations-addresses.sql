ALTER TABLE addresses ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON addresses(user_id);

CREATE INDEX IF NOT EXISTS idx_addresses_user_default ON addresses(user_id, is_default);
