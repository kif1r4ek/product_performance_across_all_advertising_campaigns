# Инструкция по развертыванию Product Performance Across All Advertising Campaigns

Пошаговая инструкция для развертывания скрипта выгрузки **статистики рекламных кампаний Wildberries (CPM/CPC)** на сервере Ubuntu 24.04 с FASTPANEL.

## Описание

Скрипт:
- Использует **WB Advertising API** (Promotion)
- Получает список всех рекламных кампаний (статусы: завершённые, активные, приостановленные)
- Определяет тип оплаты (CPM/CPC) для каждой кампании
- Выгружает полную статистику по всем товарам за 30 дней (без сегодня)
- Сохраняет CPM-данные в таблицу `wb_advert_stats_cpm`, CPC-данные — в `wb_advert_stats_cpc`
- Защита от дубликатов через UPSERT (по ключу: advert_id + nm_id + date + app_type)
- Ведёт логи синхронизации в `advert_sync_logs`
- Запускается каждые 30 минут через cron

## API Wildberries

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| GET | `/adv/v1/promotion/count` | Списки кампаний по типам и статусам |
| GET | `/api/advert/v2/adverts` | Информация о кампаниях (тип оплаты) |
| GET | `/adv/v3/fullstats` | Полная статистика кампаний |

### Важные ограничения API

| Эндпоинт | Лимит | Интервал |
|----------|-------|----------|
| `/adv/v1/promotion/count` | 5 req/s | 200ms |
| `/api/advert/v2/adverts` | 5 req/s | 200ms |
| `/adv/v3/fullstats` | 3 req/min | 20s |

### Ключевые поля ответа fullstats

| Поле | Описание |
|------|----------|
| `advertId` | ID рекламной кампании |
| `nmId` | Артикул WB |
| `views` | Показы |
| `clicks` | Клики |
| `ctr` | CTR (%) |
| `cpc` | Цена клика (руб.) |
| `sum` | Расход (руб.) |
| `atbs` | Добавления в корзину |
| `orders` | Заказы |
| `cr` | Конверсия (%) |
| `shks` | Единиц заказано |
| `sum_price` | Сумма заказов (руб.) |
| `canceled` | Технические отмены |
| `appType` | Тип площадки (1=сайт, 32=поиск, 64=рекомендации) |

---

## Требования

- Ubuntu 24.04
- Node.js 18.x или выше
- PostgreSQL (доступ к БД)
- API токен Wildberries (категория: Продвижение)

---

## Шаг 1: Подключение к серверу

### Через SSH:
```bash
ssh root@46.149.66.40
# Пароль: j9@uvFffSk-i88
```

### Через FASTPANEL:
- URL: http://46.149.66.40:8888
- Логин: fastuser
- Пароль: VFd0mwh27MoIcuMS

---

## Шаг 2: Установка PostgreSQL клиента

```bash
apt install postgresql-client
```

Проверка установки:
```bash
psql --version
# Ожидается: psql (PostgreSQL) 16.x
```

---

## Шаг 3: Проверка Node.js

```bash
node --version
# Ожидается: v18.19.1 или выше

npm --version
# Ожидается: 10.x или выше
```

Если Node.js не установлен:
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt-get install -y nodejs
```

---

## Шаг 4: Копирование проекта на сервер

### Вариант A: Через SCP
```bash
scp -r product_performance_across_all_advertising_campaigns root@46.149.66.40:/opt/
# Пароль: j9@uvFffSk-i88
```

### Вариант B: Через SFTP/FASTPANEL
1. Загрузить архив через файловый менеджер
2. Распаковать в `/opt/product_performance_across_all_advertising_campaigns`

### Вариант C: Через Git
```bash
cd /opt
git clone <URL_репозитория> product_performance_across_all_advertising_campaigns
```

---

## Шаг 5: Установка зависимостей

```bash
cd /opt/product_performance_across_all_advertising_campaigns
npm install
```

---

## Шаг 6: Настройка конфигурации (.env)

```bash
cd /opt/product_performance_across_all_advertising_campaigns
cp .env.example .env
nano .env
```

Заполните `.env`:

```env
# Wildberries API (токен категории Продвижение)
WB_API_TOKEN=ваш_токен_wildberries

# PostgreSQL Database
DB_HOST=217.199.253.234
DB_PORT=5432
DB_NAME=grg
DB_USER=grg
DB_PASSWORD=Y_Q!ug8NB|Gj$y

# Настройки API
API_RETRY_COUNT=5
API_RETRY_DELAY_MS=2000
API_REQUEST_DELAY_MS=500
API_FULLSTATS_DELAY_MS=21000
```

Сохраните: `Ctrl+X`, затем `Y`, затем `Enter`.

---

## Шаг 7: Создание таблиц в БД

### Способ 1: Через psql
```bash
psql -h 217.199.253.234 -U grg -d grg -f /opt/product_performance_across_all_advertising_campaigns/sql/init.sql
# Введите пароль БД: Y_Q!ug8NB|Gj$y
```

### Способ 2: Подключиться и выполнить вручную
```bash
psql -h 217.199.253.234 -U grg -d grg
# Введите пароль

# В psql:
\i /opt/product_performance_across_all_advertising_campaigns/sql/init.sql

# Проверьте создание таблиц:
\dt

# Должны появиться:
#  wb_advert_stats_cpm
#  wb_advert_stats_cpc
#  advert_sync_logs

\q
```

---

## Шаг 8: Тестовый запуск

```bash
cd /opt/product_performance_across_all_advertising_campaigns
node src/app.js
```

### Ожидаемый вывод:

```
[2025-xx-xxT...] 🚀 Запуск скрипта синхронизации статистики рекламных кампаний WB

════════════════════════════════════════════════════════════
 СИНХРОНИЗАЦИЯ СТАТИСТИКИ РЕКЛАМНЫХ КАМПАНИЙ WB
   Версия: 1.0.0
   Время старта: ...
════════════════════════════════════════════════════════════

✅ Подключение к БД: ...

📋 Получение списка рекламных кампаний...
  Всего кампаний (статусы 7,9,11): XX

📊 Получение информации о кампаниях...
  Обработано XX/XX
  CPM кампаний: X, CPC кампаний: X

📅 Период: 2025-xx-xx — 2025-xx-xx

📈 Получение статистики кампаний...
  Получена статистика: XX/XX кампаний

💾 Сохранение CPM записей: XXX
💾 Сохранение CPC записей: XXX

╔════════════════════════════════════════════════════╗
║       СТАТИСТИКА СИНХРОНИЗАЦИИ РЕКЛАМЫ             ║
╠════════════════════════════════════════════════════╣
║ Кампаний обработано:                    XX ║
║ CPM записей (получено/нов/обнов):  XXX/ XXX/   0 ║
║ CPC записей (получено/нов/обнов):  XXX/ XXX/   0 ║
║ Вызовов API:                             X ║
║ Повторных попыток:                       0 ║
║ Время выполнения:                   XXXXms ║
╚════════════════════════════════════════════════════╝

✅ Синхронизация успешно завершена!

[2025-xx-xxT...] 🏁 Скрипт завершён
```

---

## Шаг 9: Настройка Cron (каждые 30 минут)

```bash
crontab -e
```

Добавьте строку:
```cron
*/30 * * * * cd /opt/product_performance_across_all_advertising_campaigns && /usr/bin/node src/app.js >> /var/log/wb_advert_stats.log 2>&1
```

Сохраните и выйдите.

### Проверка cron:
```bash
crontab -l
```

### Создание файла лога:
```bash
touch /var/log/wb_advert_stats.log
chmod 644 /var/log/wb_advert_stats.log
```

---

## Шаг 10: Проверка работы

### Просмотр логов в реальном времени:
```bash
tail -f /var/log/wb_advert_stats.log
```

### Проверка данных в БД:
```bash
psql -h 217.199.253.234 -U grg -d grg
# Введите пароль БД: Y_Q!ug8NB|Gj$y
```

```sql
-- Количество записей CPM
SELECT COUNT(*) FROM wb_advert_stats_cpm;

-- Количество записей CPC
SELECT COUNT(*) FROM wb_advert_stats_cpc;

-- Последние CPM записи
SELECT advert_id, nm_id, date, campaign_name, views, clicks, 
       sum, orders, sum_price, updated_at
FROM wb_advert_stats_cpm
ORDER BY updated_at DESC
LIMIT 10;

-- Последние CPC записи
SELECT advert_id, nm_id, date, campaign_name, views, clicks,
       sum, orders, sum_price, updated_at
FROM wb_advert_stats_cpc
ORDER BY updated_at DESC
LIMIT 10;

-- Топ кампаний CPM по расходу
SELECT advert_id, campaign_name,
       SUM(views) as total_views,
       SUM(clicks) as total_clicks,
       SUM(sum) as total_spend,
       SUM(orders) as total_orders,
       SUM(sum_price) as total_revenue
FROM wb_advert_stats_cpm
GROUP BY advert_id, campaign_name
ORDER BY total_spend DESC
LIMIT 10;

-- Топ кампаний CPC по расходу
SELECT advert_id, campaign_name,
       SUM(views) as total_views,
       SUM(clicks) as total_clicks,
       SUM(sum) as total_spend,
       SUM(orders) as total_orders,
       SUM(sum_price) as total_revenue
FROM wb_advert_stats_cpc
GROUP BY advert_id, campaign_name
ORDER BY total_spend DESC
LIMIT 10;

-- Статистика по товарам (nm_id) за последние 7 дней
SELECT nm_id, product_name,
       SUM(views) as views,
       SUM(clicks) as clicks,
       SUM(sum) as spend,
       SUM(orders) as orders
FROM wb_advert_stats_cpm
WHERE date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY nm_id, product_name
ORDER BY spend DESC
LIMIT 20;

-- Логи синхронизации
SELECT id, started_at, status, campaigns_processed,
       records_received, records_inserted, records_updated,
       execution_time_ms, error_message
FROM advert_sync_logs
ORDER BY started_at DESC
LIMIT 10;
```

---

## Структура проекта

```
product_performance_across_all_advertising_campaigns/
├── src/
│   ├── app.js                      # Точка входа
│   ├── config.js                   # Конфигурация
│   ├── database.js                 # Подключение к PostgreSQL
│   ├── api/
│   │   └── wb.js                   # WB Advertising API
│   ├── services/
│   │   └── syncAdvertStats.js      # Логика синхронизации
│   └── utils/
│       └── logger.js               # Логирование в БД
├── sql/
│   └── init.sql                    # SQL создания таблиц
├── .env.example                    # Пример конфигурации
├── package.json
└── deploy.md                       # Эта инструкция
```

---

## Структура таблиц БД

### wb_advert_stats_cpm / wb_advert_stats_cpc

| Поле | Тип | Описание |
|------|-----|----------|
| id | BIGSERIAL | PK |
| advert_id | BIGINT | ID рекламной кампании |
| campaign_name | VARCHAR(255) | Название кампании |
| payment_type | VARCHAR(10) | Тип оплаты (cpm/cpc) |
| nm_id | BIGINT | Артикул WB |
| product_name | VARCHAR(500) | Название товара |
| date | DATE | Дата |
| app_type | INTEGER | Тип площадки |
| views | INTEGER | Показы |
| clicks | INTEGER | Клики |
| ctr | NUMERIC(10,2) | CTR (%) |
| cpc | NUMERIC(10,2) | CPC (руб.) |
| sum | NUMERIC(12,2) | Расход (руб.) |
| atbs | INTEGER | В корзину |
| orders | INTEGER | Заказы |
| cr | NUMERIC(10,2) | CR (%) |
| shks | INTEGER | Штук заказано |
| sum_price | NUMERIC(12,2) | Сумма заказов |
| canceled | INTEGER | Отмены |

Уникальный ключ: `(advert_id, nm_id, date, app_type)`

---

## Устранение неполадок

### Ошибка подключения к БД

1. Проверьте доступность:
   ```bash
   nc -zv 217.199.253.234 5432
   ```
2. Проверьте данные в `.env`
3. Проверьте whitelist IP в PostgreSQL (`pg_hba.conf`)

### Ошибка API (401 Unauthorized)

1. Проверьте токен в `.env`
2. Убедитесь, что токен имеет доступ к категории **Продвижение**

### Ошибка API (429 Too Many Requests)

Скрипт автоматически обрабатывает rate limiting с экспоненциальным backoff. Для `/adv/v3/fullstats` встроена пауза 21 секунда между запросами.

### Нет данных за некоторые дни

API возвращает данные только для дней, когда кампания была активна. Пустые дни не являются ошибкой.

### Cron не работает

1. Проверьте статус cron:
   ```bash
   systemctl status cron
   ```
2. Проверьте логи:
   ```bash
   grep CRON /var/log/syslog
   ```
3. Перезапустите cron:
   ```bash
   systemctl restart cron
   ```

---

## Полезные команды

```bash
# Ручной запуск
cd /opt/product_performance_across_all_advertising_campaigns && node src/app.js

# Просмотр последних логов
tail -100 /var/log/wb_advert_stats.log

# Статистика синхронизаций
psql -h 217.199.253.234 -U grg -d grg -c \
  "SELECT status, COUNT(*), AVG(execution_time_ms)::int as avg_ms,
          SUM(records_received) as total_records
   FROM advert_sync_logs GROUP BY status;"

# Очистка старых логов (старше 30 дней)
psql -h 217.199.253.234 -U grg -d grg -c \
  "DELETE FROM advert_sync_logs WHERE started_at < NOW() - INTERVAL '30 days';"

# Общий расход по всем CPM кампаниям за последнюю неделю
psql -h 217.199.253.234 -U grg -d grg -c \
  "SELECT date, SUM(sum) as total_spend, SUM(orders) as total_orders
   FROM wb_advert_stats_cpm
   WHERE date >= CURRENT_DATE - 7
   GROUP BY date ORDER BY date;"
```

---
