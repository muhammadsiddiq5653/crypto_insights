// Notification service — Telegram broadcast + signal formatting
const https = require('https');
const { getSetting } = require('./appDb');

function getConfig() {
    const token   = getSetting('telegram_bot_token')  || process.env.TELEGRAM_BOT_TOKEN  || '';
    const rawIds  = getSetting('telegram_chat_ids')   || process.env.TELEGRAM_CHAT_IDS   || '';
    const chatIds = rawIds.split(',').map(s => s.trim()).filter(Boolean);
    return { botToken: token, chatIds };
}

async function _post(token, payload) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify(payload);
        const req  = https.request(
            `https://api.telegram.org/bot${token}/sendMessage`,
            { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } },
            (res) => {
                let data = '';
                res.on('data', c => data += c);
                res.on('end', () => {
                    try {
                        const j = JSON.parse(data);
                        if (j.ok) resolve(j);
                        else reject(new Error(j.description || 'Telegram error'));
                    } catch { reject(new Error('Invalid Telegram response')); }
                });
            }
        );
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

async function sendToChat(chatId, text) {
    const { botToken } = getConfig();
    if (!botToken) throw new Error('Telegram bot token not configured');
    return _post(botToken, { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true });
}

async function broadcast(text) {
    const { botToken, chatIds } = getConfig();
    if (!botToken)        throw new Error('Telegram bot token not configured');
    if (!chatIds.length)  throw new Error('No Telegram chat IDs configured');

    const results = await Promise.allSettled(chatIds.map(id => _post(botToken, { chat_id: id, text, parse_mode: 'HTML', disable_web_page_preview: true })));
    const ok  = results.filter(r => r.status === 'fulfilled').length;
    const bad = results.filter(r => r.status === 'rejected');
    if (ok === 0) throw new Error(bad[0]?.reason?.message || 'All messages failed');
    return { sent: ok, failed: bad.length, errors: bad.map(r => r.reason?.message) };
}

function formatSignal(signal) {
    const dir     = signal.direction === 'BUY' ? '🟢 <b>BUY</b>' : '🔴 <b>SELL</b>';
    const typeTag = signal.assetType ? ` · ${_esc(signal.assetType)}` : '';
    const conf    = signal.confidence || 'Medium';

    const lines = [
        `📊 <b>Trade Signal — ${_esc(signal.symbol)}</b>`,
        `${dir}${typeTag}`,
        ``,
        `📍 Entry:  <b>${_esc(String(signal.entry))}</b>`,
        signal.tp1  ? `🎯 TP1:    <b>${_esc(String(signal.tp1))}</b>`  : null,
        signal.tp2  ? `🎯 TP2:    <b>${_esc(String(signal.tp2))}</b>`  : null,
        signal.sl   ? `🛑 SL:     <b>${_esc(String(signal.sl))}</b>`   : null,
        ``,
        `📈 Confidence: ${_esc(conf)}`,
        signal.timeframe ? `⏱  Timeframe: ${_esc(signal.timeframe)}` : null,
        signal.notes ? `\n💬 ${_esc(signal.notes)}` : null,
        ``,
        `<i>— Trader Portal · ${new Date().toUTCString()}</i>`,
    ].filter(l => l !== null);

    return lines.join('\n');
}

function _esc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

module.exports = { getConfig, broadcast, sendToChat, formatSignal };
