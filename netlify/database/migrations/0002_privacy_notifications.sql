BEGIN;

CREATE TABLE notification_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    email_match_alerts BOOLEAN NOT NULL DEFAULT true,
    email_event_updates BOOLEAN NOT NULL DEFAULT true,
    browser_push BOOLEAN NOT NULL DEFAULT false,
    digest_mode VARCHAR(16) NOT NULL DEFAULT 'immediate',
    matching_paused BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT ck_notification_preferences_digest_mode
        CHECK (digest_mode IN ('immediate', 'daily'))
);

CREATE TABLE opportunity_responses (
    id UUID PRIMARY KEY,
    table_match_id UUID NOT NULL REFERENCES table_matches(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(24) NOT NULL,
    decision VARCHAR(24) NOT NULL DEFAULT 'pending',
    offered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    responded_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT ck_opportunity_responses_role
        CHECK (role IN ('player', 'gm', 'venue_manager')),
    CONSTRAINT ck_opportunity_responses_decision
        CHECK (decision IN ('pending', 'interested', 'accepted', 'declined', 'waitlisted', 'expired')),
    CONSTRAINT ck_opportunity_responses_expiry_order
        CHECK (expires_at > offered_at),
    CONSTRAINT uq_opportunity_responses_match_user_role
        UNIQUE (table_match_id, user_id, role)
);

CREATE INDEX ix_opportunity_responses_match_decision
    ON opportunity_responses(table_match_id, decision);
CREATE INDEX ix_opportunity_responses_user_decision
    ON opportunity_responses(user_id, decision);
CREATE INDEX ix_opportunity_responses_expires_at
    ON opportunity_responses(expires_at);

CREATE TABLE notifications (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    table_match_id UUID REFERENCES table_matches(id) ON DELETE CASCADE,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    type VARCHAR(32) NOT NULL,
    state VARCHAR(16) NOT NULL DEFAULT 'queued',
    channel VARCHAR(16) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    sent_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,
    acted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT ck_notifications_type CHECK (type IN (
        'match_available', 'seat_offered', 'table_formed', 'waitlist_promoted',
        'event_disrupted', 'event_cancelled', 'event_changed', 'attendance_reminder'
    )),
    CONSTRAINT ck_notifications_state
        CHECK (state IN ('queued', 'sent', 'read', 'acted', 'expired', 'cancelled')),
    CONSTRAINT ck_notifications_channel
        CHECK (channel IN ('in_app', 'email', 'browser_push')),
    CONSTRAINT ck_notifications_subject
        CHECK (table_match_id IS NOT NULL OR event_id IS NOT NULL)
);

CREATE INDEX ix_notifications_user_created
    ON notifications(user_id, created_at DESC);
CREATE INDEX ix_notifications_state_channel
    ON notifications(state, channel, created_at);
CREATE INDEX ix_notifications_expiry
    ON notifications(expires_at)
    WHERE expires_at IS NOT NULL;

COMMIT;
