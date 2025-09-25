-- session.sql
-- Table for storing sessions in Neon
CREATE TABLE IF NOT EXISTS public.session_store (
    sid TEXT PRIMARY KEY,
    sess JSON NOT NULL,
    expire TIMESTAMP(6) NOT NULL
);

-- Index to clean up expired sessions efficiently
CREATE INDEX IF NOT EXISTS idx_session_store_expire
ON public.session_store(expire);
