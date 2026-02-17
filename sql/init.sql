CREATE TABLE IF NOT EXISTS wb_advert_stats_cpm (
    id              BIGSERIAL PRIMARY KEY,
    advert_id       BIGINT NOT NULL,
    campaign_name   VARCHAR(255) DEFAULT '',
    payment_type    VARCHAR(10) DEFAULT 'cpm',
    nm_id           BIGINT NOT NULL,
    product_name    VARCHAR(500) DEFAULT '',
    date            DATE NOT NULL,
    app_type        INTEGER NOT NULL DEFAULT 0,
    views           INTEGER DEFAULT 0,
    clicks          INTEGER DEFAULT 0,
    ctr             NUMERIC(10,2) DEFAULT 0,
    cpc             NUMERIC(10,2) DEFAULT 0,
    sum             NUMERIC(12,2) DEFAULT 0,
    atbs            INTEGER DEFAULT 0,
    orders          INTEGER DEFAULT 0,
    cr              NUMERIC(10,2) DEFAULT 0,
    shks            INTEGER DEFAULT 0,
    sum_price       NUMERIC(12,2) DEFAULT 0,
    canceled        INTEGER DEFAULT 0,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_cpm_advert_nm_date_app UNIQUE (advert_id, nm_id, date, app_type)
);

CREATE TABLE IF NOT EXISTS wb_advert_stats_cpc (
    id              BIGSERIAL PRIMARY KEY,
    advert_id       BIGINT NOT NULL,
    campaign_name   VARCHAR(255) DEFAULT '',
    payment_type    VARCHAR(10) DEFAULT 'cpc',
    nm_id           BIGINT NOT NULL,
    product_name    VARCHAR(500) DEFAULT '',
    date            DATE NOT NULL,
    app_type        INTEGER NOT NULL DEFAULT 0,
    views           INTEGER DEFAULT 0,
    clicks          INTEGER DEFAULT 0,
    ctr             NUMERIC(10,2) DEFAULT 0,
    cpc             NUMERIC(10,2) DEFAULT 0,
    sum             NUMERIC(12,2) DEFAULT 0,
    atbs            INTEGER DEFAULT 0,
    orders          INTEGER DEFAULT 0,
    cr              NUMERIC(10,2) DEFAULT 0,
    shks            INTEGER DEFAULT 0,
    sum_price       NUMERIC(12,2) DEFAULT 0,
    canceled        INTEGER DEFAULT 0,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_cpc_advert_nm_date_app UNIQUE (advert_id, nm_id, date, app_type)
);

CREATE TABLE IF NOT EXISTS advert_sync_logs (
    id                    SERIAL PRIMARY KEY,
    sync_type             VARCHAR(50) NOT NULL DEFAULT 'advert_stats',
    started_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    finished_at           TIMESTAMP WITH TIME ZONE,
    status                VARCHAR(20) NOT NULL DEFAULT 'running',
    campaigns_processed   INTEGER DEFAULT 0,
    records_received      INTEGER DEFAULT 0,
    records_inserted      INTEGER DEFAULT 0,
    records_updated       INTEGER DEFAULT 0,
    api_calls             INTEGER DEFAULT 0,
    api_retries           INTEGER DEFAULT 0,
    execution_time_ms     INTEGER DEFAULT 0,
    error_message         TEXT
);

CREATE INDEX IF NOT EXISTS idx_cpm_advert_id ON wb_advert_stats_cpm (advert_id);
CREATE INDEX IF NOT EXISTS idx_cpm_nm_id ON wb_advert_stats_cpm (nm_id);
CREATE INDEX IF NOT EXISTS idx_cpm_date ON wb_advert_stats_cpm (date);
CREATE INDEX IF NOT EXISTS idx_cpm_advert_date ON wb_advert_stats_cpm (advert_id, date);

CREATE INDEX IF NOT EXISTS idx_cpc_advert_id ON wb_advert_stats_cpc (advert_id);
CREATE INDEX IF NOT EXISTS idx_cpc_nm_id ON wb_advert_stats_cpc (nm_id);
CREATE INDEX IF NOT EXISTS idx_cpc_date ON wb_advert_stats_cpc (date);
CREATE INDEX IF NOT EXISTS idx_cpc_advert_date ON wb_advert_stats_cpc (advert_id, date);

CREATE INDEX IF NOT EXISTS idx_sync_logs_started ON advert_sync_logs (started_at);
CREATE INDEX IF NOT EXISTS idx_sync_logs_status ON advert_sync_logs (status);
