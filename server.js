// 📦 Зависимости
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const TelegramBot = require('node-telegram-bot-api');

// 🔑 Конфигурация через переменные окружения
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const BINANCE_API_KEY = process.env.BINANCE_API_KEY;
const BINANCE_SECRET_KEY = process.env.BINANCE_SECRET_KEY;
const SELL_RATE = 42.30;

// 🧠 Telegram bot
const bot = new TelegramBot(BOT_TOKEN, { polling: false });

// 🌐 Express-заглушка
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (_, res) => res.send('Binance Private API Bot is running'));
app.listen(PORT, () => console.log(`✅ Express listening on ${PORT}`));

// 🔐 Создание подписи HMAC SHA256
function sign(query, secret) {
    return crypto.createHmac('sha256', secret).update(query).digest('hex');
}

// 📊 Получение баланса аккаунта
async function getBinanceBalance() {
    const timestamp = Date.now();
    const query = `timestamp=${timestamp}`;
    const signature = sign(query, BINANCE_SECRET_KEY);
    const url = `https://api.binance.com/api/v3/account?${query}&signature=${signature}`;

    try {
        const res = await axios.get(url, {
            headers: { 'X-MBX-APIKEY': BINANCE_API_KEY }
        });
        return res.data.balances;
    } catch (err) {
        console.error('❌ Ошибка при получении баланса:', err.response?.data || err.message);
        return [];
    }
}

// 📤 Отправка баланса в Telegram
async function sendBalanceToTelegram() {
    const balances = await getBinanceBalance();
    const usdt = balances.find(b => b.asset === 'USDT');
    const btc = balances.find(b => b.asset === 'BTC');
    const bnb = balances.find(b => b.asset === 'BNB');

    const msg = `💰 <b>Баланс Binance</b>\n` +
        `USDT: ${usdt?.free || 0}\n` +
        `BTC: ${btc?.free || 0}\n` +
        `BNB: ${bnb?.free || 0}`;

    await bot.sendMessage(CHAT_ID, msg, { parse_mode: 'HTML' });
}

// 🚀 Запуск каждую минуту
sendBalanceToTelegram();
setInterval(sendBalanceToTelegram, 60_000);
