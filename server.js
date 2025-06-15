
const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const BINANCE_API_KEY = process.env.BINANCE_API_KEY;
const BINANCE_SECRET_KEY = process.env.BINANCE_SECRET_KEY;

const bot = new TelegramBot(TELEGRAM_TOKEN);

async function fetchBinanceOffers() {
    const url = 'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search';
    const body = {
        page: 1,
        rows: 5,
        payTypes: [],
        countries: [],
        publisherType: null,
        asset: 'USDT',
        fiat: 'UAH',
        tradeType: 'BUY'
    };

    const headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0'
    };

    try {
        const response = await axios.post(url, body, { headers });
        return response.data.data || [];
    } catch (err) {
        console.error("Ошибка при получении офферов:", err.message);
        return [];
    }
}

async function sendTelegramPush(text) {
    try {
        await bot.sendMessage(TELEGRAM_CHAT_ID, text, { parse_mode: 'HTML' });
    } catch (err) {
        console.error("Ошибка отправки в Telegram:", err.message);
    }
}

async function mainLoop() {
    const offers = await fetchBinanceOffers();
    for (let offer of offers) {
        const adv = offer.adv;
        const advertiser = offer.advertiser;
        const msg = `<b>💸 Оффер найден</b>
Курс: <b>${adv.price} UAH</b>
Банк: ${adv.tradeMethods.map(m => m.identifier).join(', ')}
Лимит: ${adv.minSingleTransAmount} – ${adv.maxSingleTransAmount} грн
Продавец: ${advertiser.nickName}`;
        await sendTelegramPush(msg);
    }
}

app.get('/', (_, res) => res.send('P2P bot is running!'));
app.listen(PORT, () => {
    console.log(`Fake server running on port ${PORT}`);
    setInterval(mainLoop, 60 * 1000);
    mainLoop();
});
