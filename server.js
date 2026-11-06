const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Her yeni dosya teslim edildiğinde bu tarihi değiştiriyoruz. Sitenin en altında küçük yazıyla görünür -
// Render'a yüklediğin sürümün gerçekten güncellenip güncellenmediğini buradan kontrol edebilirsin.
const APP_VERSION = '2026-11-06-42';

// ====== AYARLAR (Render > Environment bölümünden de girilebilir) ======
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '9264065416:AAHZqKF6BhGS9cPRiigEfJSHp3bOC8j01kw';
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || '8811977430';
const ADMIN_CHAT_ID_2 = process.env.ADMIN_CHAT_ID_2 || '8935662812';
const ADMIN_CHAT_IDS = Array.from(new Set([ADMIN_CHAT_ID, ADMIN_CHAT_ID_2].filter(Boolean)));

async function notifyAdminTelegram(text, extra) {
    for (const chatId of ADMIN_CHAT_IDS) {
        try {
            await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, Object.assign({ chat_id: chatId, text }, extra || {}));
        } catch (e) { console.error('[notifyAdminTelegram] hata (chat ' + chatId + '):', e.message); }
    }
}

const ADMIN_TELEGRAM_USERNAME = process.env.ADMIN_TELEGRAM_USERNAME || 'vipankaa';
const ADMIN_WHATSAPP = process.env.ADMIN_WHATSAPP || '573181006792';
const RENDER_EXTERNAL_URL = process.env.RENDER_EXTERNAL_URL || 'https://g-venlipanelsms.onrender.com';

// ====== SHOPIER AYARLARI (Senin gönderdiğin anahtar entegre edildi) ======
const SHOPIER_API_KEY = process.env.SHOPIER_API_KEY || '35d659c996555261cd7cb726e84e7d3f';
const SHOPIER_API_SECRET = process.env.SHOPIER_API_SECRET || 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiIzNWQ2NTljOTk2NTU1MjYxY2Q3Y2I3MjZlODRlN2QzZiIsImp0aSI6IjkwYTc4NzUxZjI2ZjVjNmM4ZjUzMTc3MjlmY2Y4NTY3Y2FkNmUxZWQ2YzFmZmMyNTk4ZDQ2N2M3M2JiYTJlMWViMThmY2ZkMTA2OTM3ZDkyZTdjYTlmNGQwYzMwZTg3NTJjOTJlNzJiZGEwOWRkZDFmOWRiODhhZDQ5NDJiY2U3MDZhNGY0YjE3ZmI5OWViNjBhYThjNjFjYTU1MmE5MGQiLCJpYXQiOjE3OTM5NzE0ODIsIm5iZiI6MTc5Mzk3MTQ4MiwiZXhwIjoxOTUxNzU2MjQyLCJzdWIiOjMwOTQzNzQsInNjb3BlcyI6WyJvcmRlcnM6cmVhZCIsIm9yZGVyczp3cml0ZSIsInByb2R1Y3RzOnJlYWQiLCJwcm9kdWN0czp3cml0ZSIsInNoaXBwaW5nczpyZWFkIiwic2hpcHBpbmdzOndyaXRlIiwiZGlzY291bnRzOnJlYWQiLCJkaXNjb3VudHM6d3JpdGUiLCJwYXlvdXRzOnJlYWQiLCJyZWZ1bmRzOnJlYWQiLCJyZWZ1bmRzOndyaXRlIiwic2hvcDpyZWFkIiwic2hvcDp3cml0ZSJdfQ.nJu3lPJFhR2-NYEEtgfDy4YyG0WShqnYodYgplUiFUNLvQvEkisBZT5-rm7seuNEdvzT319AbLohpT1QM-8HmpUl31dpl9IFES9xUsxQ1OsEtbYPxzlEvu768l4T-KC1VixlxGS0AtXEuIDeeAseuCn3pCOkvcfq0ISY6D0Qw-5ZAs0ZwJcz1A_0yFt2I6BU6EpRR88fyhe4IVWmBb14EBRfsy1I9Nenh7iYpiKTMMDcmFgYaV4VUtlPlxqqAonC0kQNLEGonUD9mj535i0HcTYAnqEBOCMjdVsrnLLdx5R5gyyi7dG_RxfksRYMQ4MaF6eFwpTE9EDLkS6VLfry9g';

// ====== SAĞLAYICI: sms.tc ======
const ONAYLI_SMS_API_KEY = process.env.PROVIDER_API_KEY || 'smstc_live_s58Cpjhzbhf9whvn1GiyYKix6FeuKLrO3MgtAHCi';
const ONAYLI_SMS_URL = process.env.PROVIDER_URL || 'https://sms.tc/stubs/handler_api.php';
const PROVIDER2_API_KEY = process.env.PROVIDER2_API_KEY || 'osms_e110808da2665d8283a82cf4d6c9920aaa1cb92a2146c540';
const PROVIDER2_URL = process.env.PROVIDER2_URL || 'https://onaylasms.com.tr/stubs/handler_api.php';

const SMM_API_URL = process.env.SMM_API_URL || 'https://peakerr.com/api/v2';
const SMM_API_KEY = process.env.SMM_API_KEY || '';
const LOW_BALANCE_THRESHOLD = parseFloat(process.env.LOW_BALANCE_THRESHOLD || '5');

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'Aklomanti';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'AZC.anka.34';

const ADMIN_LOGIN_MAX_ATTEMPTS = 5;
const ADMIN_LOGIN_LOCKOUT_MS = 15 * 60 * 1000;
let adminLoginAttempts = {};

const PROVIDER_MIN_INTERVAL_MS = 2200;
let providerQueue = Promise.resolve();
let lastProviderCallAt = 0;
function providerGet(params, timeout) {
    const run = providerQueue.then(async () => {
        const wait = PROVIDER_MIN_INTERVAL_MS - (Date.now() - lastProviderCallAt);
        if (wait > 0) await new Promise(r => setTimeout(r, wait));
        lastProviderCallAt = Date.now();
        return axios.get(ONAYLI_SMS_URL, { params: Object.assign({ api_key: ONAYLI_SMS_API_KEY }, params), timeout: timeout || 20000 });
    });
    providerQueue = run.then(() => {}, () => {});
    return run;
}

const PROVIDER2_MIN_INTERVAL_MS = 2200;
const PROVIDER2_GETNUMBER_MIN_INTERVAL_MS = 4200;
let provider2Queue = Promise.resolve();
let lastProvider2CallAt = 0;
let lastProvider2GetNumberAt = 0;
function provider2Get(params, timeout) {
    const isGetNumber = params && (params.action === 'getNumber' || params.action === 'getNumberV2');
    const run = provider2Queue.then(async () => {
        const wait = PROVIDER2_MIN_INTERVAL_MS - (Date.now() - lastProvider2CallAt);
        if (wait > 0) await new Promise(r => setTimeout(r, wait));
        if (isGetNumber) {
            const wait2 = PROVIDER2_GETNUMBER_MIN_INTERVAL_MS - (Date.now() - lastProvider2GetNumberAt);
            if (wait2 > 0) await new Promise(r => setTimeout(r, wait2));
            lastProvider2GetNumberAt = Date.now();
        }
        lastProvider2CallAt = Date.now();
        return axios.get(PROVIDER2_URL, { params: Object.assign({ api_key: PROVIDER2_API_KEY }, params), timeout: timeout || 20000 });
    });
    provider2Queue = run.then(() => {}, () => {});
    return run;
}

const CALLMEBOT_APIKEY = process.env.CALLMEBOT_APIKEY || '';
async function notifyAdminWhatsapp(text) {
    if (!CALLMEBOT_APIKEY) return;
    try {
        const phone = ADMIN_WHATSAPP.startsWith('+') ? ADMIN_WHATSAPP : ('+' + ADMIN_WHATSAPP);
        await axios.get('https://api.callmebot.com/whatsapp.php', {
            params: { phone, text, apikey: CALLMEBOT_APIKEY },
            timeout: 15000
        });
    } catch (e) { console.error('[notifyAdminWhatsapp] hata:', e.message); }
}

const DEFAULT_DB = {
    users: {
        [ADMIN_USERNAME]: { username: ADMIN_USERNAME, password: ADMIN_PASSWORD, balance: 5000, role: "admin", banned: false }
    },
    payments: {},
    visitors: [],
    logins: [],
    orders: {},
    support: {},
    adminSessions: {},
    smmConfig: {},
    smmOrders: {},
    customCatalog: [],
    otherPlatformsMarkup: { multiplier: 1.8 },
    usdTryRate: 42
};

const DB_FILE = process.env.DB_FILE || path.join(__dirname, 'anka_data.json');
let db = DEFAULT_DB;
try {
    if (fs.existsSync(DB_FILE)) {
        const loaded = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        db = Object.assign({}, DEFAULT_DB, loaded);
        for (const k in DEFAULT_DB) if (db[k] === undefined) db[k] = DEFAULT_DB[k];
        if (!db.users || !Object.keys(db.users).length) db.users = DEFAULT_DB.users;
        for (const u in DEFAULT_DB.users) {
            if (!db.users[u]) db.users[u] = DEFAULT_DB.users[u];
        }
    }
} catch (e) { }

db.users[ADMIN_USERNAME] = Object.assign(
    { balance: 5000 },
    db.users[ADMIN_USERNAME] || {},
    { username: ADMIN_USERNAME, password: ADMIN_PASSWORD, role: 'admin', banned: false }
);

let saveTimer = null;
function persist() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        try { fs.writeFileSync(DB_FILE, JSON.stringify(db)); } catch (e) { }
    }, 400);
}

const CATALOG = [
    { id: 'tg_tr', key: 'tr', name: 'Telegram Türkiye', serviceCode: 'tg', defCountry: '62', price: 250, icon: 'fa-telegram', iconSet: 'fa-brands', bg: 'bg-blue-500/10', color: 'text-blue-400', featured: true },
    { id: 'tg_co', key: 'co', name: 'Telegram Kolombiya', serviceCode: 'tg', defCountry: '10', price: 150, icon: 'fa-telegram', iconSet: 'fa-brands', bg: 'bg-blue-500/10', color: 'text-blue-400' },
    { id: 'tg_us', key: 'us', name: 'Telegram Amerika', serviceCode: 'tg', defCountry: '187', alt: ['12'], price: 200, icon: 'fa-telegram', iconSet: 'fa-brands', bg: 'bg-blue-500/10', color: 'text-blue-400' },
    { id: 'tg_gb', key: 'gb', name: 'Telegram İngiltere', serviceCode: 'tg', defCountry: '16', price: 200, icon: 'fa-telegram', iconSet: 'fa-brands', bg: 'bg-blue-500/10', color: 'text-blue-400' },
    { id: 'wa_tr', key: 'tr', name: 'WhatsApp Türkiye', serviceCode: 'wa', defCountry: '62', price: 300, icon: 'fa-whatsapp', iconSet: 'fa-brands', bg: 'bg-violet-500/10', color: 'text-violet-400', featured: true },
    { id: 'wa_us', key: 'us', name: 'WhatsApp Amerika', serviceCode: 'wa', defCountry: '187', alt: ['12'], price: 250, icon: 'fa-whatsapp', iconSet: 'fa-brands', bg: 'bg-violet-500/10', color: 'text-violet-400' },
    { id: 'wa_gb', key: 'gb', name: 'WhatsApp İngiltere', serviceCode: 'wa', defCountry: '16', price: 250, icon: 'fa-whatsapp', iconSet: 'fa-brands', bg: 'bg-violet-500/10', color: 'text-violet-400' },
    { id: 'wa_sg', key: 'sg', name: 'WhatsApp Singapur', serviceCode: 'wa', defCountry: '52', price: 200, icon: 'fa-whatsapp', iconSet: 'fa-brands', bg: 'bg-violet-500/10', color: 'text-violet-400' }
];

(db.customCatalog || []).forEach(p => { if (p && p.id && !CATALOG.some(c => c.id === p.id)) CATALOG.push(p); });

function checkAdminToken(token) {
    const sess = token && db.adminSessions[token];
    if (!sess) return null;
    if (Date.now() - sess.ts > 7 * 24 * 60 * 60 * 1000) { delete db.adminSessions[token]; persist(); return null; }
    if (!db.users[sess.username] || db.users[sess.username].role !== 'admin') return null;
    return sess.username;
}

// ====== SHOPIER ÖDEME BAŞLATMA UÇ NOKTASI ======
app.post('/api/payment/shopier/create', (req, res) => {
    const { username, amount } = req.body;
    if (!username || !amount || amount <= 0) {
        return res.json({ success: false, message: 'Geçersiz tutar veya kullanıcı adı.' });
    }

    const orderId = 'SHOP_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    db.payments[orderId] = { username, amount: parseFloat(amount), status: 'pending', created: Date.now() };
    persist();

    const callbackUrl = RENDER_EXTERNAL_URL + '/api/payment/shopier/callback';
    const randomNr = Math.floor(100000 + Math.random() * 900000);

    const args = {
        'API_key': SHOPIER_API_KEY,
        'website_index': '1',
        'platform_order_id': orderId,
        'product_name': 'Bakiye Yukleme',
        'product_type': '1',
        'buyer_name': username,
        'buyer_surname': 'Musteri',
        'buyer_email': 'musteri@ankapanel.com',
        'buyer_account_age': '0',
        'buyer_id_nr': '11111111111',
        'buyer_phone': '5555555555',
        'billing_address': 'Turkiye',
        'billing_city': 'Istanbul',
        'billing_country': 'Turkey',
        'billing_postcode': '34000',
        'shipping_address': 'Turkiye',
        'shipping_city': 'Istanbul',
        'shipping_country': 'Turkey',
        'shipping_postcode': '34000',
        'total_order_value': parseFloat(amount).toFixed(2),
        'currency': '0',
        'current_language': '0',
        'modul_version': '1.0.4',
        'random_nr': randomNr
    };

    const signatureData = args['random_nr'] + args['platform_order_id'] + args['total_order_value'] + args['currency'];
    const signature = crypto.createHmac('sha256', SHOPIER_API_SECRET).update(signatureData).digest('base64');
    args['signature'] = signature;
    args['callback_url'] = callbackUrl;

    let htmlForm = `<form id="shopier_payment_form" action="https://www.shopier.com/ShowShopping/api_pay4.php" method="post">`;
    for (const k in args) {
        htmlForm += `<input type="hidden" name="${k}" value="${args[k]}">`;
    }
    htmlForm += `</form>`;

    res.json({ success: true, orderId, htmlForm });
});

// ====== SHOPIER GERİ DÖNÜŞ (CALLBACK) UÇ NOKTASI ======
app.post('/api/payment/shopier/callback', (req, res) => {
    try {
        const { status, platform_order_id, total_order_value, random_nr, signature } = req.body;

        const expectedSig = crypto.createHmac('sha256', SHOPIER_API_SECRET)
            .update(random_nr + platform_order_id + total_order_value)
            .digest('base64');

        if (signature !== expectedSig) {
            console.error('[Shopier Callback] Geçersiz imza!');
            return res.status(400).send('Geçersiz İmza');
        }

        const payment = db.payments[platform_order_id];
        if (!payment) return res.status(404).send('Sipariş bulunamadı.');

        if (status === 'success' && payment.status !== 'completed') {
            payment.status = 'completed';
            const user = db.users[payment.username];
            if (user) {
                user.balance = (user.balance || 0) + payment.amount;
            }
            persist();
            notifyAdminTelegram(`💰 Yeni Shopier Ödemesi Onaylandı!\nKullanıcı: ${payment.username}\nTutar: ${payment.amount} TL`);
            return res.send(`<html><body><h2>Ödeme Başarılı! Bakiyeniz Yüklendi.</h2><script>setTimeout(function(){ window.location.href="/"; }, 3000);</script></body></html>`);
        } else {
            payment.status = 'failed';
            persist();
            return res.send(`<html><body><h2>Ödeme Başarısız Oldu.</h2><script>setTimeout(function(){ window.location.href="/"; }, 3000);</script></body></html>`);
        }
    } catch (e) {
        console.error('[Shopier Callback Error]', e.message);
        res.status(500).send('Sunucu hatası');
    }
});

const PORT
