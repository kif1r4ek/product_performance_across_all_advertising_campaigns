const db = require('../database');
const config = require('../config');
const wbApi = require('../api/wb');
const logger = require('../utils/logger');

function buildDateRange() {
  const endDate = new Date();
  endDate.setDate(endDate.getDate() - 1);

  const beginDate = new Date();
  beginDate.setDate(beginDate.getDate() - config.sync.periodDays);

  const format = (d) => d.toISOString().split('T')[0];
  return { beginDate: format(beginDate), endDate: format(endDate) };
}

function parseStatsRecords(statsData, campaignsMap) {
  const cpmRecords = [];
  const cpcRecords = [];

  for (const campaign of statsData) {
    const advertId = campaign.advertId;
    const campaignInfo = campaignsMap.get(advertId);
    const paymentType = campaignInfo?.paymentType || 'unknown';
    const campaignName = campaignInfo?.name || '';

    if (!campaign.days) continue;

    for (const day of campaign.days) {
      const date = day.date ? day.date.split('T')[0] : null;
      if (!date) continue;

      if (!day.apps) continue;

      for (const app of day.apps) {
        const appType = app.appType;

        if (!app.nms) continue;

        for (const nm of app.nms) {
          const record = {
            advertId,
            campaignName,
            paymentType,
            nmId: nm.nmId,
            productName: nm.name || '',
            date,
            appType,
            views: nm.views || 0,
            clicks: nm.clicks || 0,
            ctr: nm.ctr || 0,
            cpc: nm.cpc || 0,
            sum: nm.sum || 0,
            atbs: nm.atbs || 0,
            orders: nm.orders || 0,
            cr: nm.cr || 0,
            shks: nm.shks || 0,
            sumPrice: nm.sum_price || 0,
            canceled: nm.canceled || 0,
          };

          if (paymentType === 'cpc') {
            cpcRecords.push(record);
          } else {
            cpmRecords.push(record);
          }
        }
      }
    }
  }

  return { cpmRecords, cpcRecords };
}

async function upsertRecords(records, tableName) {
  if (records.length === 0) return { inserted: 0, updated: 0 };

  const client = await db.getClient();
  let inserted = 0;
  let updated = 0;

  try {
    await client.query('BEGIN');

    const upsertQuery = `
      INSERT INTO ${tableName} (
        advert_id, campaign_name, payment_type, nm_id, product_name,
        date, app_type, views, clicks, ctr, cpc, sum, atbs,
        orders, cr, shks, sum_price, canceled
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
      ON CONFLICT (advert_id, nm_id, date, app_type)
      DO UPDATE SET
        campaign_name = EXCLUDED.campaign_name,
        payment_type = EXCLUDED.payment_type,
        product_name = EXCLUDED.product_name,
        views = EXCLUDED.views,
        clicks = EXCLUDED.clicks,
        ctr = EXCLUDED.ctr,
        cpc = EXCLUDED.cpc,
        sum = EXCLUDED.sum,
        atbs = EXCLUDED.atbs,
        orders = EXCLUDED.orders,
        cr = EXCLUDED.cr,
        shks = EXCLUDED.shks,
        sum_price = EXCLUDED.sum_price,
        canceled = EXCLUDED.canceled,
        updated_at = NOW()
      RETURNING (xmax = 0) AS is_insert`;

    for (const r of records) {
      const result = await client.query(upsertQuery, [
        r.advertId, r.campaignName, r.paymentType, r.nmId, r.productName,
        r.date, r.appType, r.views, r.clicks, r.ctr, r.cpc, r.sum, r.atbs,
        r.orders, r.cr, r.shks, r.sumPrice, r.canceled,
      ]);

      if (result.rows[0]?.is_insert) {
        inserted++;
      } else {
        updated++;
      }
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  return { inserted, updated };
}

async function syncAdvertStats() {
  const startTime = Date.now();
  const logId = await logger.createSyncLog('advert_stats');

  const stats = {
    campaignsProcessed: 0,
    recordsReceived: 0,
    recordsInserted: 0,
    recordsUpdated: 0,
    apiCalls: 0,
    apiRetries: 0,
    executionTimeMs: 0,
  };

  try {
    wbApi.resetApiStats();

    console.log('\n════════════════════════════════════════════════════════════');
    console.log(' СИНХРОНИЗАЦИЯ СТАТИСТИКИ РЕКЛАМНЫХ КАМПАНИЙ WB');
    console.log(`   Версия: 1.0.0`);
    console.log(`   Время старта: ${new Date().toISOString()}`);
    console.log('════════════════════════════════════════════════════════════');

    const dbTime = await db.testConnection();
    console.log(`\n✅ Подключение к БД: ${dbTime}`);

    const campaignIds = await wbApi.fetchCampaignsList();

    if (campaignIds.length === 0) {
      console.log('\n⚠️ Нет кампаний для обработки');
      stats.executionTimeMs = Date.now() - startTime;
      await logger.completeSyncLog(logId, stats);
      return;
    }

    const campaignsMap = await wbApi.fetchCampaignsInfo(campaignIds);
    stats.campaignsProcessed = campaignsMap.size;

    const { beginDate, endDate } = buildDateRange();
    console.log(`\n📅 Период: ${beginDate} — ${endDate}`);

    const allCampaignIds = [...campaignsMap.keys()];
    const fullStats = await wbApi.fetchFullStats(allCampaignIds, beginDate, endDate);

    const { cpmRecords, cpcRecords } = parseStatsRecords(fullStats, campaignsMap);
    stats.recordsReceived = cpmRecords.length + cpcRecords.length;

    console.log(`\n💾 Сохранение CPM записей: ${cpmRecords.length}`);
    const cpmResult = await upsertRecords(cpmRecords, 'wb_advert_stats_cpm');

    console.log(`💾 Сохранение CPC записей: ${cpcRecords.length}`);
    const cpcResult = await upsertRecords(cpcRecords, 'wb_advert_stats_cpc');

    stats.recordsInserted = cpmResult.inserted + cpcResult.inserted;
    stats.recordsUpdated = cpmResult.updated + cpcResult.updated;

    const apiStats = wbApi.getApiStats();
    stats.apiCalls = apiStats.apiCalls;
    stats.apiRetries = apiStats.apiRetries;
    stats.executionTimeMs = Date.now() - startTime;

    await logger.completeSyncLog(logId, stats);

    console.log('\n╔════════════════════════════════════════════════════╗');
    console.log('║       СТАТИСТИКА СИНХРОНИЗАЦИИ РЕКЛАМЫ             ║');
    console.log('╠════════════════════════════════════════════════════╣');
    console.log(`║ Кампаний обработано:              ${String(stats.campaignsProcessed).padStart(8)} ║`);
    console.log(`║ CPM записей (получено/нов/обнов): ${String(cpmRecords.length).padStart(4)}/${String(cpmResult.inserted).padStart(4)}/${String(cpmResult.updated).padStart(4)} ║`);
    console.log(`║ CPC записей (получено/нов/обнов): ${String(cpcRecords.length).padStart(4)}/${String(cpcResult.inserted).padStart(4)}/${String(cpcResult.updated).padStart(4)} ║`);
    console.log(`║ Вызовов API:                      ${String(stats.apiCalls).padStart(8)} ║`);
    console.log(`║ Повторных попыток:                ${String(stats.apiRetries).padStart(8)} ║`);
    console.log(`║ Время выполнения:             ${String(stats.executionTimeMs).padStart(7)}ms ║`);
    console.log('╚════════════════════════════════════════════════════╝');

    console.log('\n✅ Синхронизация успешно завершена!');
  } catch (error) {
    stats.executionTimeMs = Date.now() - startTime;
    const apiStats = wbApi.getApiStats();
    stats.apiCalls = apiStats.apiCalls;
    stats.apiRetries = apiStats.apiRetries;

    await logger.failSyncLog(logId, error.message, stats);

    console.error(`\n❌ Ошибка синхронизации: ${error.message}`);
    throw error;
  }
}

module.exports = { syncAdvertStats };
