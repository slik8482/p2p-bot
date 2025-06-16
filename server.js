
const express = require('express');
const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
const PORT = process.env.PORT || 3000;

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const START_USDT = 200;

const ALLOWED_BANKS = ['monobank', 'izibank', 'a-bank', 'пумб'];
const MIN_LIMIT = 3000;
const MAX_LIMIT = 10000;

const SELL_RATES = {
    'monobank': 42.30,
    'izibank': 42.25,
    'a-bank': 42.20,
    'пумб': 42.15
};

const BINANCE_API_KEY = process.env.BINANCE_API_KEY;
const BINANCE_SECRET_KEY = process.env.BINANCE_SECRET_KEY;

const bot = new TelegramBot(BOT_TOKEN, { polling: false });

app.get('/', (_, res) => res.send('Bot is running'));
app.listen(PORT, () => {
    console.log(`✅ Server started on port ${PORT}`);
    setInterval(mainLoop, 60000);
    mainLoop();
});

async function mainLoop() {
    try {
        console.log('🔄 Получение офферов...');
        const payload = {
            page: 1,
            rows: 20,
            asset: 'USDT',
            fiat: 'UAH',
            tradeType: 'BUY',
            publisherType: null
        };

        const response = await axios.post('https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search', payload, {
            headers: { 'Content-Type': 'application/json' }
        });

        const offers = response.data.data || [];

        for (const offer of offers) {
            const adv = offer.adv;
            const advertiser = offer.advertiser;

            const price = parseFloat(adv.price);
            const min = parseFloat(adv.minSingleTransAmount);
            const max = parseFloat(adv.maxSingleTransAmount);
            const methods = adv.tradeMethods.map(m => m.tradeMethodName.toLowerCase());
            const seller = advertiser.nickName;

            if (min > MAX_LIMIT || max < MIN_LIMIT) continue;

            const buyerBank = methods.find(m =>
                ALLOWED_BANKS.some(b => m.includes(b))
            );
            if (!buyerBank) continue;

            const sellBank = getBestSellBank();
            const sellRate = SELL_RATES[sellBank];

            const profit = sellRate - price;
            const roi = (profit / price) * 100;
            if (roi <= 1) continue;

            const profitUah = profit * START_USDT;
            const roiEmoji = roi > 1.5 ? '🟢' : roi >= 0.5 ? '🟡' : '🔴';

            const msg = `
📌 <b>Могу купить</b>  
💵 <b>Курс покупки:</b> ${price.toFixed(2)}₴  
🏦 <b>Банк продавца:</b> ${buyerBank}  
💳 <b>Лимит:</b> ${min} – ${max}₴  
👤 <b>Продавец:</b> ${seller}

🔁 <b>Связка:</b> Купил через <b>${buyerBank}</b> ➜ Продал через <b>${sellBank}</b> по <b>${sellRate.toFixed(2)}₴</b>  
📈 <b>Профит:</b> ${roiEmoji} <b>+${roi.toFixed(2)}%</b> (~${profitUah.toFixed(0)}₴ с $${START_USDT})

🔗 <a href="https://p2p.binance.com/ru/trade/all-payments/USDT/UAH?tradeType=BUY&fiat=UAH&asset=USDT&merchant=${encodeURIComponent(seller)}">Открыть оффер в Binance App</a>`;

            await bot.sendMessage(CHAT_ID, msg, { parse_mode: 'HTML', disable_web_page_preview: true });
            console.log(`✅ Отправлен пуш: ${seller}, ROI ${roi.toFixed(2)}%`);
        }
    } catch (err) {
        console.error('❌ Ошибка:', err.message);
    }
}

function getBestSellBank() {
    let best = null;
    let max = 0;
    for (const [bank, rate] of Object.entries(SELL_RATES)) {
        if (rate > max) {
            max = rate;
            best = bank;
        }
    }
    return best;
}
