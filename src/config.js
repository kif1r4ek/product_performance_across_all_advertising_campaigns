require('dotenv').config();

module.exports = {
  wb: {
    apiToken: process.env.WB_API_TOKEN,
    baseUrl: 'https://advert-api.wildberries.ru',
  },
  db: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  },
  api: {
    retryCount: parseInt(process.env.API_RETRY_COUNT, 10) || 5,
    retryDelayMs: parseInt(process.env.API_RETRY_DELAY_MS, 10) || 2000,
    requestDelayMs: parseInt(process.env.API_REQUEST_DELAY_MS, 10) || 500,
    fullstatsDelayMs: parseInt(process.env.API_FULLSTATS_DELAY_MS, 10) || 21000,
    statsBatchSize: 50,
  },
  sync: {
    periodDays: 30,
  },
};
