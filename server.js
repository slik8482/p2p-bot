
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

    const marketSellPrice = 42.30; // 💡 Заменить на актуальную цену продажи (в будущем автоматизируем)
    const uahBudget = 200 * parseFloat(offers[0]?.adv?.price || 41.5);

    for (let offer of offers) {
        const adv = offer.adv;
        const advertiser = offer.advertiser;

        const price = parseFloat(adv.price);
        const profit = marketSellPrice - price;
        const roi = (profit / price) * 100;
        const profitUah = profit * 200;

        let roiText = `<span class="green">+${roi.toFixed(2)}%</span>`;
        if (roi < 1.5 && roi >= 0.5) roiText = `<span class="orange">~${roi.toFixed(2)}%</span>`;
        if (roi < 0.5) roiText = `<span class="red">${roi.toFixed(2)}%</span>`;

        if (roi < 1) continue; // Фильтруем по ROI

        const msg = `
📌 <b>Могу купить</b>
💵 <b>Курс:</b> ${price} UAH
🏦 <b>Банк продавца:</b> ${adv.tradeMethods.map(m => m.identifier).join(', ')}
💳 <b>Лимит:</b> ${adv.minSingleTransAmount} – ${adv.maxSingleTransAmount} грн
👤 <b>Продавец:</b> ${advertiser.nickName}

🔁 <b>Связка:</b> Купил за ${price} через ${adv.tradeMethods[0]?.identifier} ➜ Продал за ${marketSellPrice} через Wise  
📈 <b>Профит:</b> <b>${roiText}</b> (~${profitUah.toFixed(0)} грн с $200)

🔗 <a href="https://p2p.binance.com/ru/advertiserDetail?advertiserNo=${advertiser.userNo}">Открыть оффер в Binance</a>
`;

        await sendTelegramPush(msg);
    }
}


app.get('/', (_, res) => res.send('P2P bot is running!'));
app.listen(PORT, () => {
    console.log(`Fake server running on port ${PORT}`);
    setInterval(mainLoop, 60 * 1000);
    mainLoop();
});
