BEGIN;

CREATE TABLE alembic_version (
    version_num VARCHAR(32) NOT NULL, 
    CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
);

-- Running upgrade  -> 0001_create_users

CREATE TABLE users (
    id UUID NOT NULL, 
    auth_provider_user_id VARCHAR(255) NOT NULL, 
    email VARCHAR(320) NOT NULL, 
    email_verified_at TIMESTAMP WITH TIME ZONE, 
    display_name VARCHAR(80), 
    display_name_normalized VARCHAR(80), 
    status VARCHAR(32) DEFAULT 'pending_verification' NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL, 
    last_login_at TIMESTAMP WITH TIME ZONE, 
    CONSTRAINT pk_users PRIMARY KEY (id), 
    CONSTRAINT ck_users_status CHECK (status IN ('pending_verification', 'active', 'restricted', 'suspended', 'banned')), 
    CONSTRAINT uq_users_auth_provider_user_id UNIQUE (auth_provider_user_id), 
    CONSTRAINT uq_users_display_name_normalized UNIQUE (display_name_normalized), 
    CONSTRAINT uq_users_email UNIQUE (email)
);

INSERT INTO alembic_version (version_num) VALUES ('0001_create_users') RETURNING alembic_version.version_num;

-- Running upgrade 0001_create_users -> 0002_create_user_roles

CREATE TABLE user_roles (
    user_id UUID NOT NULL, 
    role VARCHAR(32) NOT NULL, 
    verified_at TIMESTAMP WITH TIME ZONE, 
    CONSTRAINT pk_user_roles PRIMARY KEY (user_id, role), 
    CONSTRAINT ck_user_roles_role CHECK (role IN ('player', 'gm', 'venue_manager', 'moderator', 'admin')), 
    CONSTRAINT fk_user_roles_user_id_users FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

UPDATE alembic_version SET version_num='0002_create_user_roles' WHERE alembic_version.version_num = '0001_create_users';

-- Running upgrade 0002_create_user_roles -> 0003_priv_audit

CREATE TABLE privileged_audit_events (
    id UUID NOT NULL, 
    actor_user_id UUID NOT NULL, 
    actor_role VARCHAR(32) NOT NULL, 
    action VARCHAR(120) NOT NULL, 
    target_type VARCHAR(80) NOT NULL, 
    target_id VARCHAR(255), 
    outcome VARCHAR(16) NOT NULL, 
    reason_code VARCHAR(80), 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    CONSTRAINT pk_privileged_audit_events PRIMARY KEY (id), 
    CONSTRAINT ck_privileged_audit_events_actor_role CHECK (actor_role IN ('moderator', 'admin')), 
    CONSTRAINT ck_privileged_audit_events_outcome CHECK (outcome IN ('success', 'denied', 'error')), 
    CONSTRAINT fk_privileged_audit_events_actor_user_id_users FOREIGN KEY(actor_user_id) REFERENCES users (id) ON DELETE RESTRICT
);

CREATE INDEX ix_privileged_audit_events_actor_user_id ON privileged_audit_events (actor_user_id);

CREATE FUNCTION deny_privileged_audit_event_mutation()
        RETURNS trigger AS $$
        BEGIN
            RAISE EXCEPTION 'privileged audit events are append-only';
        END;
        $$ LANGUAGE plpgsql;;

CREATE TRIGGER privileged_audit_events_append_only
        BEFORE UPDATE OR DELETE ON privileged_audit_events
        FOR EACH ROW EXECUTE FUNCTION deny_privileged_audit_event_mutation();;

UPDATE alembic_version SET version_num='0003_priv_audit' WHERE alembic_version.version_num = '0002_create_user_roles';

-- Running upgrade 0003_priv_audit -> 0004_player_profile

CREATE TABLE player_profiles (
    id UUID NOT NULL, 
    user_id UUID NOT NULL, 
    bio TEXT, 
    postal_code VARCHAR(5) NOT NULL, 
    travel_radius_miles INTEGER NOT NULL, 
    preferred_format VARCHAR(32) DEFAULT 'any' NOT NULL, 
    willing_to_learn_new_system BOOLEAN DEFAULT true NOT NULL, 
    environment_preferences JSON DEFAULT '[]' NOT NULL, 
    accessibility_notes_private TEXT, 
    CONSTRAINT pk_player_profiles PRIMARY KEY (id), 
    CONSTRAINT ck_player_profiles_travel_radius_miles CHECK (travel_radius_miles BETWEEN 1 AND 100), 
    CONSTRAINT ck_player_profiles_postal_code_length CHECK (length(postal_code) = 5), 
    CONSTRAINT ck_player_profiles_preferred_format CHECK (preferred_format IN ('any', 'learn_to_play', 'one_shot', 'short_campaign', 'long_campaign', 'organized_play')), 
    CONSTRAINT fk_player_profiles_user_id_users FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
    CONSTRAINT uq_player_profiles_user_id UNIQUE (user_id)
);

CREATE INDEX ix_player_profiles_user_id ON player_profiles (user_id);

UPDATE alembic_version SET version_num='0004_player_profile' WHERE alembic_version.version_num = '0003_priv_audit';

-- Running upgrade 0004_player_profile -> 0005_gm_profile

CREATE TABLE gm_profiles (
    id UUID NOT NULL, 
    user_id UUID NOT NULL, 
    bio TEXT, 
    postal_code VARCHAR(5) NOT NULL, 
    travel_radius_miles INTEGER NOT NULL, 
    beginner_friendly BOOLEAN DEFAULT false NOT NULL, 
    gm_style TEXT NOT NULL, 
    CONSTRAINT pk_gm_profiles PRIMARY KEY (id), 
    CONSTRAINT ck_gm_profiles_travel_radius_miles CHECK (travel_radius_miles BETWEEN 1 AND 100), 
    CONSTRAINT ck_gm_profiles_postal_code_length CHECK (length(postal_code) = 5), 
    CONSTRAINT ck_gm_profiles_gm_style_length CHECK (length(trim(gm_style)) BETWEEN 1 AND 2000), 
    CONSTRAINT fk_gm_profiles_user_id_users FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
    CONSTRAINT uq_gm_profiles_user_id UNIQUE (user_id)
);

CREATE INDEX ix_gm_profiles_user_id ON gm_profiles (user_id);

UPDATE alembic_version SET version_num='0005_gm_profile' WHERE alembic_version.version_num = '0004_player_profile';

-- Running upgrade 0005_gm_profile -> 0006_venue_manager

CREATE TABLE venues (
    id UUID NOT NULL, 
    name VARCHAR(160) NOT NULL, 
    slug VARCHAR(180) NOT NULL, 
    venue_type VARCHAR(32) DEFAULT 'public_venue' NOT NULL, 
    address_line1 VARCHAR(200) NOT NULL, 
    address_line2 VARCHAR(200), 
    city VARCHAR(100) NOT NULL, 
    state_region VARCHAR(2) NOT NULL, 
    postal_code VARCHAR(5) NOT NULL, 
    latitude FLOAT, 
    longitude FLOAT, 
    website_url VARCHAR(500), 
    phone VARCHAR(40), 
    verified BOOLEAN DEFAULT false NOT NULL, 
    amenities JSON DEFAULT '[]' NOT NULL, 
    accessibility_notes TEXT, 
    parking_notes TEXT, 
    noise_notes TEXT, 
    lighting_notes TEXT, 
    active BOOLEAN DEFAULT true NOT NULL, 
    CONSTRAINT pk_venues PRIMARY KEY (id), 
    CONSTRAINT ck_venues_name_length CHECK (length(trim(name)) BETWEEN 1 AND 160), 
    CONSTRAINT ck_venues_slug_length CHECK (length(trim(slug)) BETWEEN 1 AND 180), 
    CONSTRAINT ck_venues_slug_lowercase CHECK (slug = lower(slug)), 
    CONSTRAINT ck_venues_venue_type CHECK (venue_type IN ('restaurant', 'brewery', 'cafe', 'game_store', 'library', 'community_center', 'public_venue', 'other')), 
    CONSTRAINT ck_venues_state_region_length CHECK (length(state_region) = 2), 
    CONSTRAINT ck_venues_state_region_uppercase CHECK (state_region = upper(state_region)), 
    CONSTRAINT ck_venues_postal_code_length CHECK (length(postal_code) = 5), 
    CONSTRAINT ck_venues_latitude_range CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90), 
    CONSTRAINT ck_venues_longitude_range CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180), 
    CONSTRAINT uq_venues_slug UNIQUE (slug)
);

CREATE TABLE venue_managers (
    id UUID NOT NULL, 
    venue_id UUID NOT NULL, 
    user_id UUID NOT NULL, 
    role VARCHAR(24) DEFAULT 'manager' NOT NULL, 
    verified_at TIMESTAMP WITH TIME ZONE, 
    CONSTRAINT pk_venue_managers PRIMARY KEY (id), 
    CONSTRAINT ck_venue_managers_role CHECK (role IN ('owner', 'manager', 'staff')), 
    CONSTRAINT fk_venue_managers_venue_id_venues FOREIGN KEY(venue_id) REFERENCES venues (id) ON DELETE CASCADE, 
    CONSTRAINT fk_venue_managers_user_id_users FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
    CONSTRAINT uq_venue_managers_venue_id_user_id UNIQUE (venue_id, user_id)
);

CREATE INDEX ix_venue_managers_venue_id ON venue_managers (venue_id);

CREATE INDEX ix_venue_managers_user_id ON venue_managers (user_id);

UPDATE alembic_version SET version_num='0006_venue_manager' WHERE alembic_version.version_num = '0005_gm_profile';

-- Running upgrade 0006_venue_manager -> 0007_game_system

CREATE TABLE game_systems (
    id UUID NOT NULL, 
    name VARCHAR(120) NOT NULL, 
    edition VARCHAR(80), 
    slug VARCHAR(160) NOT NULL, 
    publisher_name VARCHAR(160), 
    active BOOLEAN DEFAULT true NOT NULL, 
    CONSTRAINT pk_game_systems PRIMARY KEY (id), 
    CONSTRAINT ck_game_systems_name_length CHECK (length(trim(name)) BETWEEN 1 AND 120), 
    CONSTRAINT ck_game_systems_edition_length CHECK (edition IS NULL OR length(trim(edition)) BETWEEN 1 AND 80), 
    CONSTRAINT ck_game_systems_slug_length CHECK (length(trim(slug)) BETWEEN 1 AND 160), 
    CONSTRAINT ck_game_systems_slug_lowercase CHECK (slug = lower(slug)), 
    CONSTRAINT ck_game_systems_publisher_name_length CHECK (publisher_name IS NULL OR length(trim(publisher_name)) BETWEEN 1 AND 160), 
    CONSTRAINT uq_game_systems_slug UNIQUE (slug)
);

UPDATE alembic_version SET version_num='0007_game_system' WHERE alembic_version.version_num = '0006_venue_manager';

-- Running upgrade 0007_game_system -> 0008_player_system_experience

CREATE TABLE player_system_experiences (
    id UUID NOT NULL, 
    player_profile_id UUID NOT NULL, 
    game_system_id UUID NOT NULL, 
    years_playing NUMERIC(4, 1) NOT NULL, 
    comfort_level VARCHAR(32) NOT NULL, 
    experience_notes TEXT, 
    CONSTRAINT pk_player_system_experiences PRIMARY KEY (id), 
    CONSTRAINT ck_player_system_experiences_years_playing CHECK (years_playing BETWEEN 0 AND 80), 
    CONSTRAINT ck_player_system_experiences_comfort_level CHECK (comfort_level IN ('new', 'learning', 'comfortable', 'very_experienced')), 
    CONSTRAINT ck_player_system_experiences_notes_length CHECK (experience_notes IS NULL OR length(trim(experience_notes)) BETWEEN 1 AND 2000), 
    CONSTRAINT fk_player_system_experiences_game_system_id_game_systems FOREIGN KEY(game_system_id) REFERENCES game_systems (id) ON DELETE RESTRICT, 
    CONSTRAINT fk_player_system_experiences_player_profile_id_player_profiles FOREIGN KEY(player_profile_id) REFERENCES player_profiles (id) ON DELETE CASCADE, 
    CONSTRAINT uq_player_system_experiences_profile_system UNIQUE (player_profile_id, game_system_id)
);

CREATE INDEX ix_player_system_experiences_player_profile_id ON player_system_experiences (player_profile_id);

CREATE INDEX ix_player_system_experiences_game_system_id ON player_system_experiences (game_system_id);

UPDATE alembic_version SET version_num='0008_player_system_experience' WHERE alembic_version.version_num = '0007_game_system';

-- Running upgrade 0008_player_system_experience -> 0009_gm_system_experience

CREATE TABLE gm_system_experiences (
    id UUID NOT NULL, 
    gm_profile_id UUID NOT NULL, 
    game_system_id UUID NOT NULL, 
    years_playing NUMERIC(4, 1) NOT NULL, 
    years_gming NUMERIC(4, 1) NOT NULL, 
    comfort_level VARCHAR(32) NOT NULL, 
    preferred_player_experience VARCHAR(32) NOT NULL, 
    experience_notes TEXT, 
    CONSTRAINT pk_gm_system_experiences PRIMARY KEY (id), 
    CONSTRAINT ck_gm_system_experiences_years_playing CHECK (years_playing BETWEEN 0 AND 80), 
    CONSTRAINT ck_gm_system_experiences_years_gming CHECK (years_gming BETWEEN 0 AND 80), 
    CONSTRAINT ck_gm_system_experiences_comfort_level CHECK (comfort_level IN ('learning', 'comfortable', 'very_comfortable', 'expert')), 
    CONSTRAINT ck_gm_system_experiences_preferred_player_experience CHECK (preferred_player_experience IN ('any', 'new_players', 'some_experience', 'experienced')), 
    CONSTRAINT ck_gm_system_experiences_notes_length CHECK (experience_notes IS NULL OR length(trim(experience_notes)) BETWEEN 1 AND 2000), 
    CONSTRAINT fk_gm_system_experiences_game_system_id_game_systems FOREIGN KEY(game_system_id) REFERENCES game_systems (id) ON DELETE RESTRICT, 
    CONSTRAINT fk_gm_system_experiences_gm_profile_id_gm_profiles FOREIGN KEY(gm_profile_id) REFERENCES gm_profiles (id) ON DELETE CASCADE, 
    CONSTRAINT uq_gm_system_experiences_profile_system UNIQUE (gm_profile_id, game_system_id)
);

CREATE INDEX ix_gm_system_experiences_gm_profile_id ON gm_system_experiences (gm_profile_id);

CREATE INDEX ix_gm_system_experiences_game_system_id ON gm_system_experiences (game_system_id);

CREATE TABLE gm_system_formats (
    gm_system_experience_id UUID NOT NULL, 
    format VARCHAR(32) NOT NULL, 
    CONSTRAINT pk_gm_system_formats PRIMARY KEY (gm_system_experience_id, format), 
    CONSTRAINT ck_gm_system_formats_format CHECK (format IN ('learn_to_play', 'one_shot', 'short_campaign', 'long_campaign', 'organized_play')), 
    CONSTRAINT fk_gm_system_formats_experience_id FOREIGN KEY(gm_system_experience_id) REFERENCES gm_system_experiences (id) ON DELETE CASCADE
);

UPDATE alembic_version SET version_num='0009_gm_system_experience' WHERE alembic_version.version_num = '0008_player_system_experience';

-- Running upgrade 0009_gm_system_experience -> 0010_recurring_availability_rule

CREATE TABLE recurring_availability_rules (
    id UUID NOT NULL, 
    day_of_week VARCHAR(16) NOT NULL, 
    start_time TIME WITHOUT TIME ZONE NOT NULL, 
    end_time TIME WITHOUT TIME ZONE NOT NULL, 
    pattern_type VARCHAR(32) NOT NULL, 
    week_interval SMALLINT, 
    anchor_date DATE, 
    monthly_ordinal VARCHAR(16), 
    month_interval SMALLINT, 
    timezone VARCHAR(64) NOT NULL, 
    starts_on DATE, 
    ends_on DATE, 
    active BOOLEAN DEFAULT true NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    CONSTRAINT pk_recurring_availability_rules PRIMARY KEY (id), 
    CONSTRAINT ck_recurring_availability_rules_day_of_week CHECK (day_of_week IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')), 
    CONSTRAINT ck_recurring_availability_rules_pattern_type CHECK (pattern_type IN ('weekly_interval', 'monthly_ordinal_weekday')), 
    CONSTRAINT ck_recurring_availability_rules_time_order CHECK (start_time < end_time), 
    CONSTRAINT ck_recurring_availability_rules_date_order CHECK (starts_on IS NULL OR ends_on IS NULL OR starts_on <= ends_on), 
    CONSTRAINT ck_recurring_availability_rules_timezone_length CHECK (length(trim(timezone)) BETWEEN 1 AND 64), 
    CONSTRAINT ck_recurring_availability_rules_pattern_fields CHECK ((pattern_type = 'weekly_interval' AND week_interval IS NOT NULL AND week_interval BETWEEN 1 AND 4 AND monthly_ordinal IS NULL AND month_interval IS NULL AND ((week_interval = 1 AND anchor_date IS NULL) OR (week_interval BETWEEN 2 AND 4 AND anchor_date IS NOT NULL))) OR (pattern_type = 'monthly_ordinal_weekday' AND week_interval IS NULL AND monthly_ordinal IS NOT NULL AND monthly_ordinal IN ('first', 'second', 'third', 'fourth', 'last') AND month_interval IS NOT NULL AND month_interval BETWEEN 1 AND 3 AND ((month_interval = 1 AND anchor_date IS NULL) OR (month_interval BETWEEN 2 AND 3 AND anchor_date IS NOT NULL))))
);

UPDATE alembic_version SET version_num='0010_recurring_availability_rule' WHERE alembic_version.version_num = '0009_gm_system_experience';

-- Running upgrade 0010_recurring_availability_rule -> 0011_profile_availability

CREATE TABLE player_availability_windows (
    id UUID NOT NULL, 
    player_profile_id UUID NOT NULL, 
    recurring_rule_id UUID NOT NULL, 
    active BOOLEAN DEFAULT true NOT NULL, 
    CONSTRAINT pk_player_availability_windows PRIMARY KEY (id), 
    CONSTRAINT fk_player_avail_profile FOREIGN KEY(player_profile_id) REFERENCES player_profiles (id) ON DELETE CASCADE, 
    CONSTRAINT fk_player_avail_rule FOREIGN KEY(recurring_rule_id) REFERENCES recurring_availability_rules (id) ON DELETE CASCADE, 
    CONSTRAINT uq_player_availability_windows_recurring_rule_id UNIQUE (recurring_rule_id)
);

CREATE INDEX ix_player_availability_windows_player_profile_id ON player_availability_windows (player_profile_id);

CREATE TABLE gm_availability_windows (
    id UUID NOT NULL, 
    gm_profile_id UUID NOT NULL, 
    recurring_rule_id UUID NOT NULL, 
    active BOOLEAN DEFAULT true NOT NULL, 
    CONSTRAINT pk_gm_availability_windows PRIMARY KEY (id), 
    CONSTRAINT fk_gm_avail_profile FOREIGN KEY(gm_profile_id) REFERENCES gm_profiles (id) ON DELETE CASCADE, 
    CONSTRAINT fk_gm_avail_rule FOREIGN KEY(recurring_rule_id) REFERENCES recurring_availability_rules (id) ON DELETE CASCADE, 
    CONSTRAINT uq_gm_availability_windows_recurring_rule_id UNIQUE (recurring_rule_id)
);

CREATE INDEX ix_gm_availability_windows_gm_profile_id ON gm_availability_windows (gm_profile_id);

UPDATE alembic_version SET version_num='0011_profile_availability' WHERE alembic_version.version_num = '0010_recurring_availability_rule';

-- Running upgrade 0011_profile_availability -> 0012_seed_game_systems

INSERT INTO game_systems (id, name, edition, slug) VALUES ('10000000-0000-0000-0000-000000000001', 'Dungeons & Dragons', '5e (2014)', 'dnd-5e-2014');

INSERT INTO game_systems (id, name, edition, slug) VALUES ('10000000-0000-0000-0000-000000000002', 'Dungeons & Dragons', '5e (2024)', 'dnd-5e-2024');

INSERT INTO game_systems (id, name, edition, slug) VALUES ('10000000-0000-0000-0000-000000000003', 'Pathfinder', '2e', 'pathfinder-2e');

INSERT INTO game_systems (id, name, edition, slug) VALUES ('10000000-0000-0000-0000-000000000004', 'Call of Cthulhu', NULL, 'call-of-cthulhu');

INSERT INTO game_systems (id, name, edition, slug) VALUES ('10000000-0000-0000-0000-000000000005', 'Cyberpunk RED', NULL, 'cyberpunk-red');

INSERT INTO game_systems (id, name, edition, slug) VALUES ('10000000-0000-0000-0000-000000000006', 'Shadowrun', NULL, 'shadowrun');

INSERT INTO game_systems (id, name, edition, slug) VALUES ('10000000-0000-0000-0000-000000000007', 'Other RPG', NULL, 'other-rpg');

UPDATE alembic_version SET version_num='0012_seed_game_systems' WHERE alembic_version.version_num = '0011_profile_availability';

-- Running upgrade 0012_seed_game_systems -> 0013_table_match_signals

CREATE TABLE player_demand_signals (
    id UUID NOT NULL, 
    player_profile_id UUID NOT NULL, 
    game_system_id UUID NOT NULL, 
    preferred_format VARCHAR(32) DEFAULT 'any' NOT NULL, 
    preferred_cadence VARCHAR(32), 
    minimum_age_preference SMALLINT, 
    table_style_preferences JSON DEFAULT '[]' NOT NULL, 
    environment_preferences JSON DEFAULT '[]' NOT NULL, 
    status VARCHAR(16) DEFAULT 'active' NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    CONSTRAINT pk_player_demand_signals PRIMARY KEY (id), 
    CONSTRAINT ck_player_demand_signals_preferred_format CHECK (preferred_format IN ('any', 'learn_to_play', 'one_shot', 'short_campaign', 'long_campaign', 'organized_play')), 
    CONSTRAINT ck_player_demand_signals_status CHECK (status IN ('active', 'paused', 'matched', 'expired')), 
    CONSTRAINT ck_player_demand_signals_minimum_age CHECK (minimum_age_preference IS NULL OR minimum_age_preference >= 0), 
    CONSTRAINT fk_player_demand_profile FOREIGN KEY(player_profile_id) REFERENCES player_profiles (id) ON DELETE CASCADE, 
    CONSTRAINT fk_player_demand_system FOREIGN KEY(game_system_id) REFERENCES game_systems (id) ON DELETE RESTRICT
);

CREATE INDEX ix_player_demand_signals_player_profile_id ON player_demand_signals (player_profile_id);

CREATE INDEX ix_player_demand_signals_game_system_id ON player_demand_signals (game_system_id);

CREATE INDEX ix_player_demand_signals_status ON player_demand_signals (status);

CREATE TABLE gm_supply_signals (
    id UUID NOT NULL, 
    gm_profile_id UUID NOT NULL, 
    game_system_id UUID NOT NULL, 
    preferred_format VARCHAR(32) DEFAULT 'one_shot' NOT NULL, 
    preferred_cadence VARCHAR(32), 
    minimum_players SMALLINT NOT NULL, 
    maximum_players SMALLINT NOT NULL, 
    table_style TEXT, 
    status VARCHAR(16) DEFAULT 'active' NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    CONSTRAINT pk_gm_supply_signals PRIMARY KEY (id), 
    CONSTRAINT ck_gm_supply_signals_preferred_format CHECK (preferred_format IN ('learn_to_play', 'one_shot', 'short_campaign', 'long_campaign', 'organized_play')), 
    CONSTRAINT ck_gm_supply_signals_status CHECK (status IN ('active', 'paused', 'matched', 'expired')), 
    CONSTRAINT ck_gm_supply_signals_minimum_players CHECK (minimum_players >= 1), 
    CONSTRAINT ck_gm_supply_signals_player_range CHECK (maximum_players >= minimum_players), 
    CONSTRAINT fk_gm_supply_profile FOREIGN KEY(gm_profile_id) REFERENCES gm_profiles (id) ON DELETE CASCADE, 
    CONSTRAINT fk_gm_supply_system FOREIGN KEY(game_system_id) REFERENCES game_systems (id) ON DELETE RESTRICT
);

CREATE INDEX ix_gm_supply_signals_gm_profile_id ON gm_supply_signals (gm_profile_id);

CREATE INDEX ix_gm_supply_signals_game_system_id ON gm_supply_signals (game_system_id);

CREATE INDEX ix_gm_supply_signals_status ON gm_supply_signals (status);

CREATE TABLE venue_table_windows (
    id UUID NOT NULL, 
    venue_id UUID NOT NULL, 
    recurring_rule_id UUID NOT NULL, 
    table_count SMALLINT NOT NULL, 
    max_people_per_table SMALLINT NOT NULL, 
    purchase_policy TEXT, 
    approval_required BOOLEAN NOT NULL, 
    environment_notes TEXT, 
    active BOOLEAN DEFAULT true NOT NULL, 
    CONSTRAINT pk_venue_table_windows PRIMARY KEY (id), 
    CONSTRAINT ck_venue_table_windows_table_count CHECK (table_count >= 1), 
    CONSTRAINT ck_venue_table_windows_max_people CHECK (max_people_per_table >= 1), 
    CONSTRAINT fk_venue_window_venue FOREIGN KEY(venue_id) REFERENCES venues (id) ON DELETE CASCADE, 
    CONSTRAINT fk_venue_window_rule FOREIGN KEY(recurring_rule_id) REFERENCES recurring_availability_rules (id) ON DELETE CASCADE, 
    CONSTRAINT uq_venue_table_windows_recurring_rule_id UNIQUE (recurring_rule_id)
);

CREATE INDEX ix_venue_table_windows_venue_id ON venue_table_windows (venue_id);

CREATE INDEX ix_venue_table_windows_active ON venue_table_windows (active);

UPDATE alembic_version SET version_num='0013_table_match_signals' WHERE alembic_version.version_num = '0012_seed_game_systems';

-- Running upgrade 0013_table_match_signals -> 0014_supabase_rls_hardening



















ALTER FUNCTION public.deny_privileged_audit_event_mutation() SET search_path = pg_catalog;

UPDATE alembic_version SET version_num='0014_supabase_rls_hardening' WHERE alembic_version.version_num = '0013_table_match_signals';

-- Running upgrade 0014_supabase_rls_hardening -> 0015_table_match_persistence

CREATE TABLE table_matches (
    id UUID NOT NULL, 
    gm_supply_signal_id UUID NOT NULL, 
    venue_table_window_id UUID NOT NULL, 
    game_system_id UUID NOT NULL, 
    proposed_start TIMESTAMP WITH TIME ZONE NOT NULL, 
    proposed_end TIMESTAMP WITH TIME ZONE NOT NULL, 
    timezone VARCHAR(64) NOT NULL, 
    minimum_players SMALLINT NOT NULL, 
    maximum_players SMALLINT NOT NULL, 
    compatible_player_count SMALLINT DEFAULT '0' NOT NULL, 
    distance_summary JSON DEFAULT '{}' NOT NULL, 
    fit_score NUMERIC(5, 2) DEFAULT '0' NOT NULL, 
    status VARCHAR(16) DEFAULT 'potential' NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    CONSTRAINT pk_table_matches PRIMARY KEY (id), 
    CONSTRAINT ck_table_matches_status CHECK (status IN ('potential', 'invited', 'forming', 'rejected', 'expired', 'converted')), 
    CONSTRAINT ck_table_matches_time_order CHECK (proposed_end > proposed_start), 
    CONSTRAINT ck_table_matches_minimum_players CHECK (minimum_players >= 1), 
    CONSTRAINT ck_table_matches_player_range CHECK (maximum_players >= minimum_players), 
    CONSTRAINT ck_table_matches_compatible_player_count CHECK (compatible_player_count >= 0), 
    CONSTRAINT ck_table_matches_fit_score CHECK (fit_score >= 0 AND fit_score <= 100), 
    CONSTRAINT ck_table_matches_timezone_length CHECK (length(timezone) >= 1 AND length(timezone) <= 64), 
    CONSTRAINT fk_table_matches_gm_supply_signal FOREIGN KEY(gm_supply_signal_id) REFERENCES gm_supply_signals (id) ON DELETE CASCADE, 
    CONSTRAINT fk_table_matches_venue_table_window FOREIGN KEY(venue_table_window_id) REFERENCES venue_table_windows (id) ON DELETE CASCADE, 
    CONSTRAINT fk_table_matches_game_system FOREIGN KEY(game_system_id) REFERENCES game_systems (id) ON DELETE RESTRICT, 
    CONSTRAINT uq_table_matches_gm_venue_occurrence UNIQUE (gm_supply_signal_id, venue_table_window_id, proposed_start, proposed_end)
);

CREATE INDEX ix_table_matches_gm_supply_signal_id ON table_matches (gm_supply_signal_id);

CREATE INDEX ix_table_matches_venue_table_window_id ON table_matches (venue_table_window_id);

CREATE INDEX ix_table_matches_game_system_id ON table_matches (game_system_id);

CREATE INDEX ix_table_matches_proposed_start ON table_matches (proposed_start);

CREATE INDEX ix_table_matches_status ON table_matches (status);

CREATE TABLE table_match_players (
    table_match_id UUID NOT NULL, 
    player_demand_signal_id UUID NOT NULL, 
    fit_flags JSON DEFAULT '[]' NOT NULL, 
    distance_miles NUMERIC(8, 2) NOT NULL, 
    availability_overlap JSON DEFAULT '{}' NOT NULL, 
    status VARCHAR(16) DEFAULT 'eligible' NOT NULL, 
    CONSTRAINT pk_table_match_players PRIMARY KEY (table_match_id, player_demand_signal_id), 
    CONSTRAINT ck_table_match_players_status CHECK (status IN ('eligible', 'notified', 'interested', 'declined', 'committed')), 
    CONSTRAINT ck_table_match_players_distance_miles CHECK (distance_miles >= 0), 
    CONSTRAINT fk_table_match_players_match FOREIGN KEY(table_match_id) REFERENCES table_matches (id) ON DELETE CASCADE, 
    CONSTRAINT fk_table_match_players_player_demand FOREIGN KEY(player_demand_signal_id) REFERENCES player_demand_signals (id) ON DELETE CASCADE
);

CREATE INDEX ix_table_match_players_player_demand_signal_id ON table_match_players (player_demand_signal_id);

CREATE INDEX ix_table_match_players_status ON table_match_players (status);

CREATE TABLE match_explanations (
    id UUID NOT NULL, 
    table_match_id UUID NOT NULL, 
    criterion VARCHAR(32) NOT NULL, 
    result VARCHAR(16) NOT NULL, 
    summary TEXT NOT NULL, 
    weight NUMERIC(8, 4), 
    CONSTRAINT pk_match_explanations PRIMARY KEY (id), 
    CONSTRAINT ck_match_explanations_result CHECK (result IN ('pass', 'fail', 'info')), 
    CONSTRAINT ck_match_explanations_criterion_nonblank CHECK (length(trim(criterion)) >= 1), 
    CONSTRAINT ck_match_explanations_summary_nonblank CHECK (length(trim(summary)) >= 1), 
    CONSTRAINT fk_match_explanations_match FOREIGN KEY(table_match_id) REFERENCES table_matches (id) ON DELETE CASCADE, 
    CONSTRAINT uq_match_explanations_match_criterion UNIQUE (table_match_id, criterion)
);

CREATE INDEX ix_match_explanations_table_match_id ON match_explanations (table_match_id);




UPDATE alembic_version SET version_num='0015_table_match_persistence' WHERE alembic_version.version_num = '0014_supabase_rls_hardening';

-- Running upgrade 0015_table_match_persistence -> 0016_postal_centroid_cache

CREATE TABLE postal_code_centroids (
    id UUID NOT NULL, 
    country_code VARCHAR(2) NOT NULL, 
    postal_code VARCHAR(5) NOT NULL, 
    latitude FLOAT NOT NULL, 
    longitude FLOAT NOT NULL, 
    provider VARCHAR(32) NOT NULL, 
    accuracy FLOAT NOT NULL, 
    accuracy_type VARCHAR(32) NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    CONSTRAINT pk_postal_code_centroids PRIMARY KEY (id), 
    CONSTRAINT ck_postal_code_centroids_country_us CHECK (country_code = 'US'), 
    CONSTRAINT ck_postal_code_centroids_postal_length CHECK (length(postal_code) = 5), 
    CONSTRAINT ck_postal_code_centroids_latitude_range CHECK (latitude BETWEEN -90 AND 90), 
    CONSTRAINT ck_postal_code_centroids_longitude_range CHECK (longitude BETWEEN -180 AND 180), 
    CONSTRAINT ck_postal_code_centroids_accuracy_range CHECK (accuracy >= 0 AND accuracy <= 1), 
    CONSTRAINT uq_postal_code_centroids_country_postal UNIQUE (country_code, postal_code)
);

CREATE INDEX ix_postal_code_centroids_postal_code ON postal_code_centroids (postal_code);


UPDATE alembic_version SET version_num='0016_postal_centroid_cache' WHERE alembic_version.version_num = '0015_table_match_persistence';

-- Running upgrade 0016_postal_centroid_cache -> 0017_table_formation_lifecycle

CREATE TABLE game_series (
    id UUID NOT NULL, 
    table_match_id UUID, 
    title VARCHAR(200) NOT NULL, 
    gm_profile_id UUID NOT NULL, 
    game_system_id UUID NOT NULL, 
    venue_id UUID NOT NULL, 
    recurring_rule_id UUID, 
    expected_sessions SMALLINT DEFAULT '1' NOT NULL, 
    starts_on DATE NOT NULL, 
    ends_on DATE, 
    active BOOLEAN DEFAULT true NOT NULL, 
    CONSTRAINT pk_game_series PRIMARY KEY (id), 
    CONSTRAINT ck_game_series_title_length CHECK (length(trim(title)) BETWEEN 1 AND 200), 
    CONSTRAINT ck_game_series_expected_sessions CHECK (expected_sessions >= 1), 
    CONSTRAINT ck_game_series_date_order CHECK (ends_on IS NULL OR starts_on <= ends_on), 
    FOREIGN KEY(table_match_id) REFERENCES table_matches (id) ON DELETE SET NULL, 
    FOREIGN KEY(gm_profile_id) REFERENCES gm_profiles (id) ON DELETE RESTRICT, 
    FOREIGN KEY(game_system_id) REFERENCES game_systems (id) ON DELETE RESTRICT, 
    FOREIGN KEY(venue_id) REFERENCES venues (id) ON DELETE RESTRICT, 
    FOREIGN KEY(recurring_rule_id) REFERENCES recurring_availability_rules (id) ON DELETE SET NULL, 
    CONSTRAINT uq_game_series_table_match_id UNIQUE (table_match_id), 
    CONSTRAINT uq_game_series_recurring_rule_id UNIQUE (recurring_rule_id)
);

CREATE INDEX ix_game_series_gm_profile_id ON game_series (gm_profile_id);

CREATE INDEX ix_game_series_game_system_id ON game_series (game_system_id);

CREATE INDEX ix_game_series_venue_id ON game_series (venue_id);

CREATE TABLE events (
    id UUID NOT NULL, 
    game_series_id UUID, 
    table_match_id UUID, 
    slug VARCHAR(180) NOT NULL, 
    title VARCHAR(200) NOT NULL, 
    description TEXT NOT NULL, 
    gm_profile_id UUID NOT NULL, 
    game_system_id UUID NOT NULL, 
    venue_id UUID NOT NULL, 
    event_type VARCHAR(32) NOT NULL, 
    join_mode VARCHAR(32) NOT NULL, 
    status VARCHAR(24) DEFAULT 'draft' NOT NULL, 
    starts_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    ends_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    min_players SMALLINT NOT NULL, 
    max_players SMALLINT NOT NULL, 
    minimum_age SMALLINT, 
    beginner_friendly BOOLEAN DEFAULT true NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    CONSTRAINT pk_events PRIMARY KEY (id), 
    CONSTRAINT ck_events_slug_length CHECK (length(trim(slug)) BETWEEN 1 AND 180), 
    CONSTRAINT ck_events_slug_lowercase CHECK (slug = lower(slug)), 
    CONSTRAINT ck_events_title_length CHECK (length(trim(title)) BETWEEN 1 AND 200), 
    CONSTRAINT ck_events_time_order CHECK (ends_at > starts_at), 
    CONSTRAINT ck_events_min_players CHECK (min_players >= 1), 
    CONSTRAINT ck_events_player_range CHECK (max_players >= min_players), 
    CONSTRAINT ck_events_minimum_age CHECK (minimum_age IS NULL OR minimum_age BETWEEN 0 AND 125), 
    CONSTRAINT ck_events_event_type CHECK (event_type IN ('one_shot','campaign_session','new_campaign','learn_to_play','organized_play')), 
    CONSTRAINT ck_events_join_mode CHECK (join_mode IN ('request_to_join','instant_join')), 
    CONSTRAINT ck_events_status CHECK (status IN ('draft','venue_requested','forming','confirmed','full','cancelled','completed')), 
    FOREIGN KEY(game_series_id) REFERENCES game_series (id) ON DELETE SET NULL, 
    FOREIGN KEY(table_match_id) REFERENCES table_matches (id) ON DELETE SET NULL, 
    FOREIGN KEY(gm_profile_id) REFERENCES gm_profiles (id) ON DELETE RESTRICT, 
    FOREIGN KEY(game_system_id) REFERENCES game_systems (id) ON DELETE RESTRICT, 
    FOREIGN KEY(venue_id) REFERENCES venues (id) ON DELETE RESTRICT, 
    CONSTRAINT uq_events_slug UNIQUE (slug), 
    CONSTRAINT uq_events_table_match_id UNIQUE (table_match_id)
);

CREATE INDEX ix_events_game_series_id ON events (game_series_id);

CREATE INDEX ix_events_gm_profile_id ON events (gm_profile_id);

CREATE INDEX ix_events_game_system_id ON events (game_system_id);

CREATE INDEX ix_events_venue_id ON events (venue_id);

CREATE INDEX ix_events_status ON events (status);

CREATE INDEX ix_events_starts_at ON events (starts_at);

CREATE TABLE table_expectations (
    id UUID NOT NULL, 
    event_id UUID NOT NULL, 
    tone VARCHAR(200), 
    age_environment VARCHAR(120), 
    play_style TEXT NOT NULL, 
    boundaries TEXT NOT NULL, 
    pvp_policy VARCHAR(300), 
    homebrew_policy TEXT, 
    character_death_policy VARCHAR(500), 
    mature_content_notes TEXT, 
    alcohol_policy VARCHAR(500), 
    new_players_welcome BOOLEAN DEFAULT true NOT NULL, 
    break_policy VARCHAR(500), 
    safety_framework VARCHAR(1000), 
    environment_notes TEXT, 
    accessibility_notes TEXT, 
    other_notes TEXT, 
    CONSTRAINT pk_table_expectations PRIMARY KEY (id), 
    CONSTRAINT ck_table_expectations_play_style CHECK (length(trim(play_style)) BETWEEN 1 AND 2000), 
    CONSTRAINT ck_table_expectations_boundaries CHECK (length(trim(boundaries)) BETWEEN 1 AND 4000), 
    FOREIGN KEY(event_id) REFERENCES events (id) ON DELETE CASCADE, 
    CONSTRAINT uq_table_expectations_event_id UNIQUE (event_id)
);

CREATE TABLE registrations (
    id UUID NOT NULL, 
    event_id UUID NOT NULL, 
    player_profile_id UUID NOT NULL, 
    status VARCHAR(16) DEFAULT 'requested' NOT NULL, 
    expectations_acknowledged_at TIMESTAMP WITH TIME ZONE, 
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    responded_at TIMESTAMP WITH TIME ZONE, 
    cancelled_at TIMESTAMP WITH TIME ZONE, 
    CONSTRAINT pk_registrations PRIMARY KEY (id), 
    CONSTRAINT ck_registrations_status CHECK (status IN ('requested','confirmed','waitlisted','declined','cancelled','removed')), 
    FOREIGN KEY(event_id) REFERENCES events (id) ON DELETE CASCADE, 
    FOREIGN KEY(player_profile_id) REFERENCES player_profiles (id) ON DELETE CASCADE, 
    CONSTRAINT uq_registrations_event_player UNIQUE (event_id, player_profile_id)
);

CREATE INDEX ix_registrations_event_id ON registrations (event_id);

CREATE INDEX ix_registrations_player_profile_id ON registrations (player_profile_id);

CREATE INDEX ix_registrations_status ON registrations (status);

CREATE TABLE venue_booking_requests (
    id UUID NOT NULL, 
    venue_table_window_id UUID NOT NULL, 
    gm_profile_id UUID NOT NULL, 
    table_match_id UUID, 
    game_series_id UUID, 
    event_id UUID, 
    requested_start TIMESTAMP WITH TIME ZONE NOT NULL, 
    requested_end TIMESTAMP WITH TIME ZONE NOT NULL, 
    tables_requested SMALLINT DEFAULT '1' NOT NULL, 
    expected_guests SMALLINT DEFAULT '1' NOT NULL, 
    status VARCHAR(16) DEFAULT 'requested' NOT NULL, 
    venue_message TEXT, 
    gm_message TEXT, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    CONSTRAINT pk_venue_booking_requests PRIMARY KEY (id), 
    CONSTRAINT ck_venue_booking_requests_time_order CHECK (requested_end > requested_start), 
    CONSTRAINT ck_venue_booking_requests_tables_requested CHECK (tables_requested >= 1), 
    CONSTRAINT ck_venue_booking_requests_expected_guests CHECK (expected_guests >= 1), 
    CONSTRAINT ck_venue_booking_requests_status CHECK (status IN ('requested','question','approved','declined','cancelled')), 
    FOREIGN KEY(venue_table_window_id) REFERENCES venue_table_windows (id) ON DELETE RESTRICT, 
    FOREIGN KEY(gm_profile_id) REFERENCES gm_profiles (id) ON DELETE RESTRICT, 
    FOREIGN KEY(table_match_id) REFERENCES table_matches (id) ON DELETE SET NULL, 
    FOREIGN KEY(game_series_id) REFERENCES game_series (id) ON DELETE SET NULL, 
    FOREIGN KEY(event_id) REFERENCES events (id) ON DELETE SET NULL, 
    CONSTRAINT uq_venue_booking_requests_table_match_id UNIQUE (table_match_id), 
    CONSTRAINT uq_venue_booking_requests_event_id UNIQUE (event_id)
);

CREATE INDEX ix_venue_booking_requests_venue_table_window_id ON venue_booking_requests (venue_table_window_id);

CREATE INDEX ix_venue_booking_requests_gm_profile_id ON venue_booking_requests (gm_profile_id);

CREATE INDEX ix_venue_booking_requests_game_series_id ON venue_booking_requests (game_series_id);

CREATE INDEX ix_venue_booking_requests_requested_start ON venue_booking_requests (requested_start);

CREATE INDEX ix_venue_booking_requests_status ON venue_booking_requests (status);






UPDATE alembic_version SET version_num='0017_table_formation_lifecycle' WHERE alembic_version.version_num = '0016_postal_centroid_cache';

-- Running upgrade 0017_table_formation_lifecycle -> 0018_game_hub_messages

CREATE TABLE messages (
    id UUID NOT NULL, 
    event_id UUID NOT NULL, 
    sender_user_id UUID NOT NULL, 
    channel_type VARCHAR(32) NOT NULL, 
    recipient_user_id UUID, 
    venue_id UUID, 
    category VARCHAR(32), 
    body TEXT NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    read_at TIMESTAMP WITH TIME ZONE, 
    moderation_status VARCHAR(16) DEFAULT 'visible' NOT NULL, 
    CONSTRAINT pk_messages PRIMARY KEY (id), 
    CONSTRAINT ck_messages_channel_type CHECK (channel_type IN ('table_announcement','table_discussion','gm_venue','player_gm','player_venue_question','system_notification')), 
    CONSTRAINT ck_messages_moderation_status CHECK (moderation_status IN ('visible','flagged','hidden','removed')), 
    CONSTRAINT ck_messages_body_length CHECK (length(trim(body)) BETWEEN 1 AND 4000), 
    CONSTRAINT ck_messages_category CHECK (category IS NULL OR category IN ('accessibility','food_allergies','parking','seating','venue_policy','other')), 
    CONSTRAINT ck_messages_player_venue_fields CHECK (channel_type <> 'player_venue_question' OR (venue_id IS NOT NULL AND category IS NOT NULL)), 
    CONSTRAINT ck_messages_gm_venue_fields CHECK (channel_type <> 'gm_venue' OR venue_id IS NOT NULL), 
    CONSTRAINT ck_messages_player_gm_fields CHECK (channel_type <> 'player_gm' OR recipient_user_id IS NOT NULL), 
    FOREIGN KEY(event_id) REFERENCES events (id) ON DELETE CASCADE, 
    FOREIGN KEY(sender_user_id) REFERENCES users (id) ON DELETE RESTRICT, 
    FOREIGN KEY(recipient_user_id) REFERENCES users (id) ON DELETE SET NULL, 
    FOREIGN KEY(venue_id) REFERENCES venues (id) ON DELETE SET NULL
);

CREATE INDEX ix_messages_event_id ON messages (event_id);

CREATE INDEX ix_messages_sender_user_id ON messages (sender_user_id);

CREATE INDEX ix_messages_channel_type ON messages (channel_type);

CREATE INDEX ix_messages_recipient_user_id ON messages (recipient_user_id);

CREATE INDEX ix_messages_venue_id ON messages (venue_id);

CREATE INDEX ix_messages_created_at ON messages (created_at);

CREATE INDEX ix_messages_moderation_status ON messages (moderation_status);

CREATE INDEX ix_messages_event_channel_created ON messages (event_id, channel_type, created_at);


UPDATE alembic_version SET version_num='0018_game_hub_messages' WHERE alembic_version.version_num = '0017_table_formation_lifecycle';

-- Running upgrade 0018_game_hub_messages -> 0019_distributed_api_rate_limits

CREATE TABLE api_rate_limit_buckets (
    user_id UUID NOT NULL, 
    scope VARCHAR(48) NOT NULL, 
    tokens FLOAT NOT NULL, 
    last_refill_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    CONSTRAINT pk_api_rate_limit_buckets PRIMARY KEY (user_id, scope), 
    CONSTRAINT ck_api_rate_limit_buckets_scope_length CHECK (length(trim(scope)) BETWEEN 1 AND 48), 
    CONSTRAINT ck_api_rate_limit_buckets_tokens_nonnegative CHECK (tokens >= 0), 
    FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX ix_api_rate_limit_buckets_updated_at ON api_rate_limit_buckets (updated_at);


UPDATE alembic_version SET version_num='0019_distributed_api_rate_limits' WHERE alembic_version.version_num = '0018_game_hub_messages';

-- Running upgrade 0019_distributed_api_rate_limits -> 0020_game_table_aggregate

ALTER TABLE venues ADD COLUMN host_support_offerings JSON DEFAULT '[]' NOT NULL;

ALTER TABLE venues ADD COLUMN host_support_notes TEXT;

ALTER TABLE venue_table_windows ADD COLUMN special_support_offerings JSON DEFAULT '[]' NOT NULL;

ALTER TABLE venue_table_windows ADD COLUMN special_support_notes TEXT;

CREATE TABLE game_tables (
    id UUID NOT NULL, 
    game_system_id UUID NOT NULL, 
    created_by_user_id UUID NOT NULL, 
    source_table_match_id UUID, 
    title VARCHAR(200) NOT NULL, 
    lifecycle_status VARCHAR(20) DEFAULT 'draft' NOT NULL, 
    game_format VARCHAR(32) NOT NULL, 
    minimum_players SMALLINT NOT NULL, 
    maximum_players SMALLINT NOT NULL, 
    join_policy VARCHAR(20) DEFAULT 'request' NOT NULL, 
    visibility VARCHAR(16) DEFAULT 'public' NOT NULL, 
    table_style TEXT, 
    minimum_age SMALLINT, 
    gm_profile_id UUID, 
    venue_id UUID, 
    venue_table_window_id UUID, 
    proposed_start TIMESTAMP WITH TIME ZONE, 
    proposed_end TIMESTAMP WITH TIME ZONE, 
    timezone VARCHAR(64), 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    CONSTRAINT pk_game_tables PRIMARY KEY (id), 
    CONSTRAINT ck_game_tables_title_length CHECK (length(trim(title)) BETWEEN 1 AND 200), 
    CONSTRAINT ck_game_tables_lifecycle_status CHECK (lifecycle_status IN ('draft', 'forming', 'ready', 'confirmed', 'in_progress', 'completed', 'cancelled', 'archived')), 
    CONSTRAINT ck_game_tables_game_format CHECK (game_format IN ('learn_to_play', 'one_shot', 'short_campaign', 'long_campaign', 'organized_play')), 
    CONSTRAINT ck_game_tables_join_policy CHECK (join_policy IN ('open', 'request', 'invite_only')), 
    CONSTRAINT ck_game_tables_visibility CHECK (visibility IN ('public', 'unlisted', 'private')), 
    CONSTRAINT ck_game_tables_minimum_players CHECK (minimum_players >= 1), 
    CONSTRAINT ck_game_tables_player_range CHECK (maximum_players >= minimum_players), 
    CONSTRAINT ck_game_tables_minimum_age CHECK (minimum_age IS NULL OR minimum_age >= 0), 
    CONSTRAINT ck_game_tables_proposed_schedule CHECK ((proposed_start IS NULL AND proposed_end IS NULL AND timezone IS NULL) OR (proposed_start IS NOT NULL AND proposed_end IS NOT NULL AND timezone IS NOT NULL AND proposed_end > proposed_start)), 
    FOREIGN KEY(game_system_id) REFERENCES game_systems (id) ON DELETE RESTRICT, 
    FOREIGN KEY(created_by_user_id) REFERENCES users (id) ON DELETE RESTRICT, 
    FOREIGN KEY(source_table_match_id) REFERENCES table_matches (id) ON DELETE SET NULL, 
    FOREIGN KEY(gm_profile_id) REFERENCES gm_profiles (id) ON DELETE SET NULL, 
    FOREIGN KEY(venue_id) REFERENCES venues (id) ON DELETE SET NULL, 
    FOREIGN KEY(venue_table_window_id) REFERENCES venue_table_windows (id) ON DELETE SET NULL, 
    CONSTRAINT uq_game_tables_source_table_match_id UNIQUE (source_table_match_id)
);

CREATE INDEX ix_game_tables_game_system_id ON game_tables (game_system_id);

CREATE INDEX ix_game_tables_created_by_user_id ON game_tables (created_by_user_id);

CREATE INDEX ix_game_tables_lifecycle_status ON game_tables (lifecycle_status);

CREATE INDEX ix_game_tables_gm_profile_id ON game_tables (gm_profile_id);

CREATE INDEX ix_game_tables_venue_id ON game_tables (venue_id);

CREATE TABLE game_table_players (
    game_table_id UUID NOT NULL, 
    player_profile_id UUID NOT NULL, 
    source_player_demand_signal_id UUID, 
    status VARCHAR(16) DEFAULT 'requested' NOT NULL, 
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    responded_at TIMESTAMP WITH TIME ZONE, 
    ended_at TIMESTAMP WITH TIME ZONE, 
    CONSTRAINT pk_game_table_players PRIMARY KEY (game_table_id, player_profile_id), 
    CONSTRAINT ck_game_table_players_status CHECK (status IN ('requested', 'invited', 'confirmed', 'declined', 'removed', 'left')), 
    FOREIGN KEY(game_table_id) REFERENCES game_tables (id) ON DELETE CASCADE, 
    FOREIGN KEY(player_profile_id) REFERENCES player_profiles (id) ON DELETE CASCADE, 
    FOREIGN KEY(source_player_demand_signal_id) REFERENCES player_demand_signals (id) ON DELETE SET NULL
);

CREATE INDEX ix_game_table_players_player_profile_id ON game_table_players (player_profile_id);

CREATE INDEX ix_game_table_players_status ON game_table_players (status);



UPDATE alembic_version SET version_num='0020_game_table_aggregate' WHERE alembic_version.version_num = '0019_distributed_api_rate_limits';

-- Running upgrade 0020_game_table_aggregate -> 0021_event_game_table_link

ALTER TABLE events ADD COLUMN game_table_id UUID;

ALTER TABLE events ADD CONSTRAINT fk_events_game_table_id FOREIGN KEY(game_table_id) REFERENCES game_tables (id) ON DELETE SET NULL;

CREATE INDEX ix_events_game_table_id ON events (game_table_id);

UPDATE alembic_version SET version_num='0021_event_game_table_link' WHERE alembic_version.version_num = '0020_game_table_aggregate';

-- Running upgrade 0021_event_game_table_link -> 0022_signal_availability

CREATE TABLE player_demand_availability_windows (
    id UUID NOT NULL, 
    player_demand_signal_id UUID NOT NULL, 
    recurring_rule_id UUID NOT NULL, 
    active BOOLEAN DEFAULT true NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(player_demand_signal_id) REFERENCES player_demand_signals (id) ON DELETE CASCADE, 
    FOREIGN KEY(recurring_rule_id) REFERENCES recurring_availability_rules (id) ON DELETE CASCADE, 
    CONSTRAINT uq_player_demand_availability_windows_rule_id UNIQUE (recurring_rule_id)
);

CREATE INDEX ix_player_demand_availability_windows_player_demand_signal_id ON player_demand_availability_windows (player_demand_signal_id);

CREATE INDEX ix_player_demand_availability_windows_active ON player_demand_availability_windows (active);


CREATE TABLE gm_supply_availability_windows (
    id UUID NOT NULL, 
    gm_supply_signal_id UUID NOT NULL, 
    recurring_rule_id UUID NOT NULL, 
    active BOOLEAN DEFAULT true NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(gm_supply_signal_id) REFERENCES gm_supply_signals (id) ON DELETE CASCADE, 
    FOREIGN KEY(recurring_rule_id) REFERENCES recurring_availability_rules (id) ON DELETE CASCADE, 
    CONSTRAINT uq_gm_supply_availability_windows_rule_id UNIQUE (recurring_rule_id)
);

CREATE INDEX ix_gm_supply_availability_windows_gm_supply_signal_id ON gm_supply_availability_windows (gm_supply_signal_id);

CREATE INDEX ix_gm_supply_availability_windows_active ON gm_supply_availability_windows (active);


UPDATE alembic_version SET version_num='0022_signal_availability' WHERE alembic_version.version_num = '0021_event_game_table_link';

COMMIT;


INSERT INTO game_systems (id, name, edition, slug, publisher_name, active) VALUES
  ('10000000-0000-0000-0000-000000000001', 'Dungeons & Dragons', '5e (2014)', 'dnd-5e-2014', NULL, true),
  ('10000000-0000-0000-0000-000000000002', 'Dungeons & Dragons', '5e (2024)', 'dnd-5e-2024', NULL, true),
  ('10000000-0000-0000-0000-000000000003', 'Pathfinder', '2e', 'pathfinder-2e', NULL, true),
  ('10000000-0000-0000-0000-000000000004', 'Call of Cthulhu', NULL, 'call-of-cthulhu', NULL, true),
  ('10000000-0000-0000-0000-000000000005', 'Cyberpunk RED', NULL, 'cyberpunk-red', NULL, true),
  ('10000000-0000-0000-0000-000000000006', 'Shadowrun', NULL, 'shadowrun', NULL, true),
  ('10000000-0000-0000-0000-000000000007', 'Other RPG', NULL, 'other-rpg', NULL, true)
ON CONFLICT (id) DO NOTHING;
