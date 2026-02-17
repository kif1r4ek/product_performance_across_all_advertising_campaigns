const { Pool } = require('pg');
const config = require('./config');

const pool = new Pool(config.db);

async function testConnection() {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT NOW() as now');
    return result.rows[0].now;
  } finally {
    client.release();
  }
}

async function query(text, params) {
  return pool.query(text, params);
}

async function getClient() {
  return pool.connect();
}

async function end() {
  return pool.end();
}

module.exports = { testConnection, query, getClient, end };
