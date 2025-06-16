
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const SELL_RATE = 42.30;

const ALLOWED_BANKS = ['monobank', 'abank', 'pumb', 'izibank'];
const MIN_LIMIT = 3000;
const MAX_LIMIT = 10000;

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
let mode = 'off';

app.get('/', (req, res) => res.send('Bot is running'));
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// /start с кнопками
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Выберите действие:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔼 Купить', callback_data: 'buy' }],
        [{ text: '🔽 Продать', callback_data: 'sell' }],
        [{ text: '⛔️ Остановить', callback_data: 'stop' }]
      ]
    }
  });
});

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

// цикл
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
      const min = parseFloat(adv.minSingleTransAmount);
      const max = parseFloat(adv.maxSingleTransAmount);
      const methods = adv.tradeMethods.map(m => m.tradeMethodName);
      const seller = advertiser.nickName;
      const userNo = advertiser.userNo;

      if (min > MAX_LIMIT || max < MIN_LIMIT) continue;
      const matched = methods.filter(m => ALLOWED_BANKS.some(b => m.toLowerCase().includes(b)));
      if (!matched.length) continue;

      const roi = ((SELL_RATE / price) - 1) * 100;
      const profit = SELL_RATE - price;
      if (roi <= 1) continue;

      const message = `
📌 <b>Могу ${mode === 'buy' ? 'купить' : 'продать'} USDT</b>
💵 <b>Курс:</b> ${price.toFixed(2)}₴
🏦 <b>Банк продавца:</b> ${matched.join(', ')}
💳 <b>Лимит:</b> ${min}–${max} грн
👤 <b>Продавец:</b> ${seller}
🔁 <b>Связка:</b> Купил через <u>${matched[0]}</u> ➜ Продал через <u>Monobank</u>
📈 <b>ROI:</b> 🟢 ${roi.toFixed(2)}% (~${profit.toFixed(2)}₴)
      `.trim();

      await bot.sendMessage(CHAT_ID, message, {
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔗 Открыть оффер в Binance', url: `https://p2p.binance.com/ru/advertiserDetail?advertiserNo=${userNo}` }]
          ]
        }
      });
    }
  } catch (err) {
    console.error('❌ Ошибка:', err.message);
  }
}

setInterval(mainLoop, 60000);
mainLoop();
