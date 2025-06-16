// server.js
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const SELL_RATE = 42.30;

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
let mode = 'off'; // off, buy, sell

app.get('/', (req, res) => res.send('Bot is running'));
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Команда /start
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const opts = {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'Купить', callback_data: 'buy' }],
                [{ text: 'Продать', callback_data: 'sell' }],
                [{ text: 'Остановить', callback_data: 'stop' }]
            ]
        }
    };
    bot.sendMessage(chatId, 'Выберите действие:', opts);
});

// Обработка кнопок
bot.on('callback_query', (query) => {
    const chatId = query.message.chat.id;
    if (query.data === 'buy') {
        mode = 'buy';
        bot.sendMessage(chatId, '✅ Мониторинг покупок включен');
    } else if (query.data === 'sell') {
        mode = 'sell';
        bot.sendMessage(chatId, '✅ Мониторинг продаж включен');
    } else if (query.data === 'stop') {
        mode = 'off';
        bot.sendMessage(chatId, '⛔ Пуши остановлены');
    }
});

// Основной цикл
async function mainLoop() {
    if (mode === 'off') return;
    try {
        const response = await axios.post('https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search', {
            page: 1,
            rows: 10,
            asset: 'USDT',
            fiat: 'UAH',
            tradeType: mode === 'buy' ? 'BUY' : 'SELL'
        }, { headers: { 'Content-Type': 'application/json' } });

        const offers = response.data.data;
        for (let offer of offers) {
            const adv = offer.adv;
            const advertiser = offer.advertiser;
            const price = parseFloat(adv.price);
            const roi = (SELL_RATE / price - 1) * 100;
            if (roi < 1) continue;

            const msg = `<b>Могу ${mode === 'buy' ? 'купить' : 'продать'} USDT</b>
💵 Курс: <b>${price.toFixed(2)}₴</b>
🏦 Банк: ${adv.tradeMethods.map(m => m.tradeMethodName).join(', ')}
💳 Лимит: ${adv.minSingleTransAmount}–${adv.maxSingleTransAmount} грн
👤 Продавец: <b>${advertiser.nickName}</b>
📈 ROI: <b>${roi.toFixed(2)}%</b>
🔗 <a href="https://p2p.binance.com/ru/trade/buy/USDT?fiat=UAH&merchant=${encodeURIComponent(advertiser.nickName)}">Открыть в Binance</a>`;
            await bot.sendMessage(CHAT_ID, msg, { parse_mode: 'HTML', disable_web_page_preview: true });
        }
    } catch (err) {
        console.error('❌ Ошибка:', err.message);
    }
}

setInterval(mainLoop, 60000);
mainLoop();
