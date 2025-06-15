const express = require('express');
const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');

// Конфигурация – токен бота и чат-ID должны быть заданы в переменных окружения
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const SELL_RATE = 42.30;  // фиксированный курс продажи USDT за UAH

// Инициализация Express-заглушки для Render
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot is running'));
app.listen(PORT, () => {
    console.log(`Express server listening on port ${PORT}`);
});

// Инициализация Telegram Bot API
const bot = new TelegramBot(BOT_TOKEN, { polling: false });

// Функция основного цикла
async function mainLoop() {
    try {
        console.log('🔄 Получение офферов с Binance P2P...');
        // Запрос офферов (продающие USDT за UAH) через внутренний API Binance P2P
        const payload = {
            page: 1,
            rows: 20,                // запрашиваем топ-20 предложений
            asset: 'USDT',
            fiat: 'UAH',
            tradeType: 'BUY',
            publisherType: null      // получаем офферы от всех продавцов (не только мерчантов)
        };
        const response = await axios.post('https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search', payload, {
            headers: { 'Content-Type': 'application/json' }
        });
        const data = response.data;
        if (!data || !data.success) {
            console.error('❌ Ошибка API Binance P2P или пустой ответ');
            return;
        }
        const offers = data.data;  // массив офферов

        console.log(`✅ Офферов получено: ${offers.length}`);
        if (!offers.length) {
            return;  // нет данных для обработки
        }

        // Обработка каждого оффера
        for (const offer of offers) {
            const adv = offer.adv;
            const advertiser = offer.advertiser;
            // Извлекаем необходимые данные
            const price = parseFloat(adv.price);  // цена покупки USDT (UAH за 1 USDT)
            const minLimit = parseFloat(adv.minSingleTransAmount);
            const maxLimit = parseFloat(adv.maxSingleTransAmount);
            const payMethods = adv.tradeMethods.map(m => m.tradeMethodName);
            const sellerName = advertiser.nickName;

            // Расчет ROI (%) и профита (UAH)
            const roi = (SELL_RATE / price - 1) * 100;
            const profit = SELL_RATE - price;

            // Фильтрация: пропускаем офферы с ROI <= 1%
            if (roi <= 1) {
                continue;
            }

            // Определяем emoji для ROI по заданным порогам
            let roiEmoji;
            if (roi > 1.5) {
                roiEmoji = '🟢';
            } else if (roi >= 0.5 && roi <= 1.5) {
                roiEmoji = '🟡';
            } else {
                roiEmoji = '🔴';
            }

            // Форматируем значения для сообщения
            const priceStr = price.toFixed(2);        // курс покупки с двумя знаками после запятой
            const minStr = Number.isInteger(minLimit) ? minLimit.toFixed(0) : minLimit.toFixed(2);
            const maxStr = Number.isInteger(maxLimit) ? maxLimit.toFixed(0) : maxLimit.toFixed(2);
            const roiStr = roi.toFixed(1);            // ROI с одним десятичным знаком
            const profitStr = profit.toFixed(2);      // прибыль в грн с двумя знаками
            const methodsStr = payMethods.join(', '); // перечисление способов оплаты

            // Формируем текст сообщения с HTML-разметкой
            const message = 
                `Могу купить USDT за <b>${priceStr}₴</b> (${methodsStr})` +
                `, лимит <b>${minStr}-${maxStr}₴</b>` +
                `, продавец <b>${sellerName}</b>` +
                `, ${priceStr}→${SELL_RATE.toFixed(2)}` +
                `, ROI: ${roiEmoji} <b>${roiStr}%</b> +${profitStr}₴` +
                `, <a href="https://p2p.binance.com/ru/trade/buy/USDT?fiat=UAH&merchant=${encodeURIComponent(sellerName)}">Binance</a>`;

            try {
                await bot.sendMessage(CHAT_ID, message, { parse_mode: 'HTML', disable_web_page_preview: true });
                console.log(`➡️ Отправлено уведомление в Telegram: продавец ${sellerName}, ROI ~${roiStr}%`);
            } catch (err) {
                console.error('Ошибка при отправке сообщения в Telegram:', err.message);
            }
        }
    } catch (err) {
        console.error('❌ Ошибка в основном цикле:', err.message);
    }
}

// Запуск цикла обновления каждые 60 секунд
mainLoop();  // первый запуск немедленно
setInterval(mainLoop, 60000);
