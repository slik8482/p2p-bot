// server.js
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const SELL_RATE = 42.30;

const ALLOWED_BANKS = ['Monobank', 'Izibank', 'ABank', 'PUMB'];
const MIN_LIMIT = 3000;
const MAX_LIMIT = 10000;

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
let mode = 'off';

app.get('/', (req, res) => res.send('Bot is running'));
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// /start кнопки
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
    bot.sendMessage(chatId, '⛔ Мониторинг остановлен');
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

      const minLimit = parseFloat(adv.minSingleTransAmount);
      const maxLimit = parseFloat(adv.maxSingleTransAmount);
      const payMethods = adv.tradeMethods.map(m => m.tradeMethodName);

      // фильтр по лимиту и банкам
      if (minLimit > MAX_LIMIT || maxLimit < MIN_LIMIT) continue;
      const matchedBanks = payMethods.filter(bank =>
        ALLOWED_BANKS.some(allowed => bank.toLowerCase().includes(allowed.toLowerCase()))
      );
      if (matchedBanks.length === 0) continue;
      if (roi < 1) continue;

      const profit = SELL_RATE - price;
      let roiEmoji = roi > 1.5 ? '🟢' : roi >= 0.5 ? '🟡' : '🔴';

      const msg = `<b>Могу ${mode === 'buy' ? 'купить' : 'продать'} USDT</b>
💵 Курс: <b>${price.toFixed(2)}₴</b>
🏦 Банк: ${matchedBanks.join(', ')}
💳 Лимит: ${minLimit}–${maxLimit} грн
👤 Продавец: <b>${advertiser.nickName}</b>

🔁 Связка: ${mode === 'buy' ? `Купил за ${price.toFixed(2)} через ${matchedBanks[0]} ➜ Продал за ${SELL_RATE} через ${ALLOWED_BANKS[0]}` : `Купил за ${SELL_RATE} через ${ALLOWED_BANKS[0]} ➜ Продал за ${price.toFixed(2)} через ${matchedBanks[0]}`}
📈 ROI: ${roiEmoji} <b>${roi.toFixed(2)}%</b> (~${profit.toFixed(2)}₴)
🔗 <a href="https://p2p.binance.com/ru/advertiserDetail?advertiserNo=${advertiser.userNo}">Открыть продавца в Binance</a>`;

      await bot.sendMessage(CHAT_ID, msg, { parse_mode: 'HTML', disable_web_page_preview: true });
    }
  } catch (err) {
    console.error('❌ Ошибка в mainLoop:', err.message);
  }
}

setInterval(mainLoop, 60000);
mainLoop();
