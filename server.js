const express = require('express');
const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const SELL_RATE = 42.30;

const MIN_LIMIT = 3000;
const MAX_LIMIT = 10000;
const ALLOWED_BANKS = ['monobank', 'izibank', 'a-bank', 'пумб', 'pumb', 'mono'];

const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot is running'));
app.listen(PORT, () => {
    console.log(`Express server listening on port ${PORT}`);
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
        const response = await axios.post('https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search', payload, {
            headers: { 'Content-Type': 'application/json' }
        });

        const data = response.data;
        if (!data || !data.data) return;

        const offers = data.data;

        for (const offer of offers) {
            const adv = offer.adv;
            const advertiser = offer.advertiser;

            const price = parseFloat(adv.price);
            const minLimit = parseFloat(adv.minSingleTransAmount);
            const maxLimit = parseFloat(adv.maxSingleTransAmount);
            const payMethods = adv.tradeMethods.map(m => m.tradeMethodName.toLowerCase());
            const sellerName = advertiser.nickName;
            const userNo = advertiser.userNo;

            if (minLimit > MAX_LIMIT || maxLimit < MIN_LIMIT) continue;

            const matchedBanks = payMethods.filter(bank =>
                ALLOWED_BANKS.some(allowed => bank.includes(allowed))
            );
            if (matchedBanks.length === 0) continue;

            const roi = (SELL_RATE / price - 1) * 100;
            const profit = SELL_RATE - price;
            if (roi <= 1) continue;

            const roiEmoji = roi > 1.5 ? '🟢' : roi >= 0.5 ? '🟡' : '🔴';
            const link = `binance://p2p?type=buy&fiat=UAH&asset=USDT&merchant=${userNo}`;

            const msg = 
                `Могу купить USDT за <b>${price.toFixed(2)}₴</b> (${matchedBanks.join(', ')})` +
                `, лимит <b>${minLimit}-${maxLimit}₴</b>` +
                `, продавец <b>${sellerName}</b>` +
                `, ROI: ${roiEmoji} <b>${roi.toFixed(1)}%</b> +${profit.toFixed(2)}₴` +
                `, <a href="${link}">Открыть в Binance App</a>`;

            try {
                await bot.sendMessage(CHAT_ID, msg, { parse_mode: 'HTML', disable_web_page_preview: true });
                console.log(`✅ Отправлено: ${sellerName}, ROI ${roi.toFixed(1)}%`);
            } catch (err) {
                console.error('❌ Telegram error:', err.message);
            }
        }
    } catch (err) {
        console.error('❌ Ошибка в mainLoop:', err.message);
    }
}

mainLoop();
setInterval(mainLoop, 60000);
