BEGIN;

ALTER TABLE notification_preferences
    ADD COLUMN default_reminder_minutes INTEGER[] NOT NULL DEFAULT ARRAY[1440, 60];

ALTER TABLE notification_preferences
    ADD CONSTRAINT ck_notification_preferences_default_reminders_count
        CHECK (cardinality(default_reminder_minutes) BETWEEN 0 AND 5),
    ADD CONSTRAINT ck_notification_preferences_default_reminders_range
        CHECK (
            cardinality(default_reminder_minutes) = 0 OR
            (15 <= ALL(default_reminder_minutes) AND 20160 >= ALL(default_reminder_minutes))
        );

CREATE TABLE game_reminders (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    table_match_id UUID NOT NULL REFERENCES table_matches(id) ON DELETE CASCADE,
    minutes_before INTEGER NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    sent_for_start_at TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT ck_game_reminders_minutes_before
        CHECK (minutes_before BETWEEN 15 AND 20160),
    CONSTRAINT uq_game_reminders_user_match_offset
        UNIQUE (user_id, table_match_id, minutes_before)
);

CREATE INDEX ix_game_reminders_user_match
    ON game_reminders(user_id, table_match_id);
CREATE INDEX ix_game_reminders_enabled
    ON game_reminders(enabled, table_match_id);

COMMIT;
