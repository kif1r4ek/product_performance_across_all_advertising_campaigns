const { syncAdvertStats } = require('./services/syncAdvertStats');
const db = require('./database');

async function main() {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] 🚀 Запуск скрипта синхронизации статистики рекламных кампаний WB`);

  try {
    await syncAdvertStats();
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Критическая ошибка: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await db.end();
    console.log(`[${new Date().toISOString()}] 🏁 Скрипт завершён`);
  }
}

main();
