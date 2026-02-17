const config = require('../config');

let apiCallCount = 0;
let retryCount = 0;

function getApiStats() {
  return { apiCalls: apiCallCount, apiRetries: retryCount };
}

function resetApiStats() {
  apiCallCount = 0;
  retryCount = 0;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, options = {}) {
  const maxRetries = config.api.retryCount;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    apiCallCount++;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          Authorization: config.wb.apiToken,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (response.status === 429) {
        retryCount++;
        const waitTime = config.api.retryDelayMs * Math.pow(2, attempt);
        console.log(`  ⏳ Rate limit (429), ожидание ${waitTime}ms...`);
        await sleep(waitTime);
        continue;
      }

      if (response.status === 204) {
        return null;
      }

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorBody}`);
      }

      return response.json();
    } catch (error) {
      if (attempt < maxRetries && error.message.includes('429')) {
        retryCount++;
        await sleep(config.api.retryDelayMs * Math.pow(2, attempt));
        continue;
      }
      if (attempt === maxRetries) throw error;
      retryCount++;
      await sleep(config.api.retryDelayMs);
    }
  }
}

async function fetchCampaignsList() {
  console.log('\n📋 Получение списка рекламных кампаний...');

  const data = await fetchWithRetry(
    `${config.wb.baseUrl}/adv/v1/promotion/count`
  );

  if (!data || !data.adverts) {
    console.log('  Кампании не найдены');
    return [];
  }

  const relevantStatuses = [7, 9, 11];
  const campaignIds = [];

  for (const group of data.adverts) {
    if (relevantStatuses.includes(group.status) && group.advert_list) {
      for (const advert of group.advert_list) {
        campaignIds.push(advert.advertId);
      }
    }
  }

  console.log(`  Всего кампаний (статусы 7,9,11): ${campaignIds.length}`);
  return campaignIds;
}

async function fetchCampaignsInfo(campaignIds) {
  console.log('\n📊 Получение информации о кампаниях...');

  const campaignsMap = new Map();
  const batchSize = 50;

  for (let i = 0; i < campaignIds.length; i += batchSize) {
    const batch = campaignIds.slice(i, i + batchSize);
    const idsParam = batch.join(',');

    await sleep(config.api.requestDelayMs);

    const data = await fetchWithRetry(
      `${config.wb.baseUrl}/api/advert/v2/adverts?ids=${idsParam}`
    );

    if (data && data.adverts) {
      for (const advert of data.adverts) {
        const paymentType = advert.settings?.payment_type || 'unknown';
        campaignsMap.set(advert.id, {
          id: advert.id,
          name: advert.settings?.name || '',
          paymentType,
          status: advert.status,
          bidType: advert.bid_type || 'unknown',
        });
      }
    }

    console.log(
      `  Обработано ${Math.min(i + batchSize, campaignIds.length)}/${campaignIds.length}`
    );
  }

  const cpmCount = [...campaignsMap.values()].filter(
    (c) => c.paymentType === 'cpm'
  ).length;
  const cpcCount = [...campaignsMap.values()].filter(
    (c) => c.paymentType === 'cpc'
  ).length;
  console.log(`  CPM кампаний: ${cpmCount}, CPC кампаний: ${cpcCount}`);

  return campaignsMap;
}

async function fetchFullStats(campaignIds, beginDate, endDate) {
  console.log('\n📈 Получение статистики кампаний...');

  const allStats = [];
  const batchSize = config.api.statsBatchSize;

  for (let i = 0; i < campaignIds.length; i += batchSize) {
    const batch = campaignIds.slice(i, i + batchSize);
    const idsParam = batch.join(',');

    if (i > 0) {
      console.log(
        `  ⏳ Пауза ${config.api.fullstatsDelayMs}ms (rate limit: 3 req/min)...`
      );
      await sleep(config.api.fullstatsDelayMs);
    }

    try {
      const data = await fetchWithRetry(
        `${config.wb.baseUrl}/adv/v3/fullstats?ids=${idsParam}&beginDate=${beginDate}&endDate=${endDate}`
      );

      if (Array.isArray(data)) {
        allStats.push(...data);
      }
    } catch (error) {
      console.error(
        `  ⚠️ Ошибка для batch ${i / batchSize + 1}: ${error.message}`
      );
    }

    console.log(
      `  Получена статистика: ${Math.min(i + batchSize, campaignIds.length)}/${campaignIds.length} кампаний`
    );
  }

  return allStats;
}

module.exports = {
  fetchCampaignsList,
  fetchCampaignsInfo,
  fetchFullStats,
  getApiStats,
  resetApiStats,
};
