const db = require('../database');

async function createSyncLog(syncType) {
  const result = await db.query(
    `INSERT INTO advert_sync_logs (sync_type, started_at, status)
     VALUES ($1, NOW(), 'running') RETURNING id`,
    [syncType]
  );
  return result.rows[0].id;
}

async function completeSyncLog(logId, stats) {
  await db.query(
    `UPDATE advert_sync_logs SET
       status = 'success',
       finished_at = NOW(),
       campaigns_processed = $2,
       records_received = $3,
       records_inserted = $4,
       records_updated = $5,
       api_calls = $6,
       api_retries = $7,
       execution_time_ms = $8
     WHERE id = $1`,
    [
      logId,
      stats.campaignsProcessed,
      stats.recordsReceived,
      stats.recordsInserted,
      stats.recordsUpdated,
      stats.apiCalls,
      stats.apiRetries,
      stats.executionTimeMs,
    ]
  );
}

async function failSyncLog(logId, errorMessage, stats = {}) {
  await db.query(
    `UPDATE advert_sync_logs SET
       status = 'error',
       finished_at = NOW(),
       error_message = $2,
       campaigns_processed = $3,
       records_received = $4,
       records_inserted = $5,
       records_updated = $6,
       api_calls = $7,
       api_retries = $8,
       execution_time_ms = $9
     WHERE id = $1`,
    [
      logId,
      errorMessage.substring(0, 2000),
      stats.campaignsProcessed || 0,
      stats.recordsReceived || 0,
      stats.recordsInserted || 0,
      stats.recordsUpdated || 0,
      stats.apiCalls || 0,
      stats.apiRetries || 0,
      stats.executionTimeMs || 0,
    ]
  );
}

module.exports = { createSyncLog, completeSyncLog, failSyncLog };
