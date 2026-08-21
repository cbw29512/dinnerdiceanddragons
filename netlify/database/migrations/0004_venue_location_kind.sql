BEGIN;

ALTER TABLE venues
    ADD COLUMN location_kind VARCHAR(24) NOT NULL DEFAULT 'business';

ALTER TABLE venues
    ADD CONSTRAINT ck_venues_location_kind
        CHECK (location_kind IN ('business', 'private_residence'));

COMMIT;
