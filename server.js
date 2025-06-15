const express = require('express');
const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');

// === Конфигурация ===
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const SELL_RATE = 42.30;
const ALLOWED_BANKS = ['Monobank', 'Izibank', 'А-Банк', 'ПУМБ'];
const MIN_LIMIT = 3000;
const MAX_LIMIT = 10000;

const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot is running'));
app.listen(PORT, () => {
    console.log(`✅ Express server listening on port ${PORT}`);
    mainLoop();
    setInterval(mainLoop, 60000);
});

const bot = new TelegramBot(BOT_TOKEN, { polling: false });

async function mainLoop() {
    try {
        console.log('🔄 Получение офферов с Binance P2P...');
        const payload = {
            page: 1,
            rows: 20,
            asset: 'USDT',
            fiat: 'UAH',
            tradeType: 'BUY',
            publisherType: null
        };

        const response = await axios.post(
            'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search',
            payload,
            { headers: { 'Content-Type': 'application/json' } }
        );

        const data = response.data;
        if (!data || !data.success) return;
        const offers = data.data;

        for (const offer of offers) {
            const adv = offer.adv;
            const advertiser = offer.advertiser;

            const price = parseFloat(adv.price);
            const minLimit = parseFloat(adv.minSingleTransAmount);
            const maxLimit = parseFloat(adv.maxSingleTransAmount);
            const payMethods = adv.tradeMethods.map(m => m.tradeMethodName);
            const sellerName = advertiser.nickName;

            if (minLimit > MAX_LIMIT || maxLimit < MIN_LIMIT) continue;

            const matchedBanks = payMethods.filter(bank =>
                ALLOWED_BANKS.some(allowed => bank.toLowerCase().includes(allowed.toLowerCase()))
            );
            if (matchedBanks.length === 0) continue;

            const roi = (SELL_RATE / price - 1) * 100;
            const profit = SELL_RATE - price;
            if (roi <= 1) continue;

            const roiEmoji = roi > 1.5 ? '🟢' : roi >= 0.5 ? '🟡' : '🔴';

            const msg = 
                `📌 <b>Могу купить</b>\n` +
                `💵 <b>Курс:</b> ${price.toFixed(2)} UAH\n` +
                `🏦 <b>Банк:</b> ${matchedBanks.join(', ')}\n` +
                `💳 <b>Лимит:</b> ${minLimit} – ${maxLimit} грн\n` +
                `👤 <b>Продавец:</b> ${sellerName}\n\n` +
                `🔁 <b>Связка:</b> ${price.toFixed(2)} ➜ ${SELL_RATE}\n` +
                `📈 <b>Профит:</b> ${roiEmoji} <b>+${roi.toFixed(1)}%</b> (~${(profit * 200).toFixed(0)} грн с $200)\n` +
                `🔗 <a href="https://p2p.binance.com/ru/trade/buy/USDT?fiat=UAH&merchant=${encodeURIComponent(sellerName)}">Открыть оффер</a>`;

            try {
                await bot.sendMessage(CHAT_ID, msg, {
                    parse_mode: 'HTML',
                    disable_web_page_preview: true
                });
                console.log(`✅ Отправлено: ${sellerName}, ROI ${roi.toFixed(1)}%`);
            } catch (err) {
                console.error('❌ Telegram error:', err.message);
            }
        }
    } catch (err) {
        console.error('❌ Ошибка mainLoop:', err.message);
    }
}
