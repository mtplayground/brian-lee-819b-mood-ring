CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    slot SMALLINT NOT NULL CHECK (slot IN (1, 2)),
    identity_key TEXT NOT NULL CHECK (
        length(identity_key) BETWEEN 1 AND 128
    ),
    latest_mood JSONB,
    latest_mood_updated_at TIMESTAMPTZ,
    last_used_theme_id TEXT NOT NULL DEFAULT 'organic' CHECK (
        length(last_used_theme_id) BETWEEN 1 AND 64
        AND last_used_theme_id ~ '^[A-Za-z0-9_-]+$'
    ),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT participants_latest_mood_snapshot_check CHECK (
        (
            latest_mood IS NULL
            AND latest_mood_updated_at IS NULL
        )
        OR (
            latest_mood IS NOT NULL
            AND jsonb_typeof(latest_mood) = 'object'
            AND latest_mood_updated_at IS NOT NULL
        )
    ),
    CONSTRAINT participants_identity_key_shape_check CHECK (
        btrim(identity_key) = identity_key
    )
);

CREATE UNIQUE INDEX participants_room_slot_idx ON participants(room_id, slot);
CREATE UNIQUE INDEX participants_room_identity_key_idx ON participants(room_id, identity_key);
CREATE INDEX participants_room_id_idx ON participants(room_id);
