const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const APP_VERSION = '2026-11-06-44';

// ====== AYARLAR ======
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

const RENDER_EXTERNAL_URL = process.env.RENDER_EXTERNAL_URL || 'https://g-venlipanelsms.onrender.com';

// ====== SHOPIER AYARLARI ======
const SHOPIER_API_KEY = process.env.SHOPIER_API_KEY || '35d659c996555261cd7cb726e84e7d3f';
const SHOPIER_API_SECRET = process.env.SHOPIER_API_SECRET || 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiIzNWQ2NTljOTk2NTU1MjYxY2Q3Y2I3MjZlODRlN2QzZiIsImp0aSI6IjkwYTc4NzUxZjI2ZjVjNmM4ZjUzMTc3MjlmY2Y4NTY3Y2FkNmUxZWQ2YzFmZmMyNTk4ZDQ2N2M3M2JiYTJlMWViMThmY2ZkMTA2OTM3ZDkyZTdjYTlmNGQwYzMwZTg3NTJjOTJlNzJiZGEwOWRkZDFmOWRiODhhZDQ5NDJiY2U3MDZhNGY0YjE3ZmI5OWViNjBhYThjNjFjYTU1MmE5MGQiLCJpYXQiOjE3OTM5NzE0ODIsIm5iZiI6MTc5Mzk3MTQ4MiwiZXhwIjoxOTUxNzU2MjQyLCJzdWIiOjMwOTQzNzQsInNjb3BlcyI6WyJvcmRlcnM6cmVhZCIsIm9yZGVyczp3cml0ZSIsInByb2R1Y3RzOnJlYWQiLCJwcm9kdWN0czp3cml0ZSIsInNoaXBwaW5nczpyZWFkIiwic2hpcHBpbmdzOndyaXRlIiwiZGlzY291bnRzOnJlYWQiLCJkaXNjb3VudHM6d3JpdGUiLCJwYXlvdXRzOnJlYWQiLCJyZWZ1bmRzOnJlYWQiLCJyZWZ1bmRzOndyaXRlIiwic2hvcDpyZWFkIiwic2hvcDp3cml0ZSJdfQ.nJu3lPJFhR2-NYEEtgfDy4YyG0WShqnYodYgplUiFUNLvQvEkisBZT5-rm7seuNEdvzT319AbLohpT1QM-8HmpUl31dpl9IFES9xUsxQ1OsEtbYPxzlEvu768l4T-KC1VixlxGS0AtXEuIDeeAseuCn3pCOkvcfq0ISY6D0Qw-5ZAs0ZwJcz1A_0yFt2I6BU6EpRR88fyhe4IVWmBb14EBRfsy1I9Nenh7iYpiKTMMDcmFgYaV4VUtlPlxqqAonC0kQNLEGonUD9mj535i0HcTYAnqEBOCMjdVsrnLLdx5R5gyyi7dG_RxfksRYMQ4MaF6eFwpTE9EDLkS6VLfry9g';

// ====== SAĞLAYICI: sms.tc ======
const ONAYLI_SMS_API_KEY = process.env.PROVIDER_API_KEY || 'smstc_live_s58Cpjhzbhf9whvn1GiyYKix6FeuKLrO3MgtAHCi';
const ONAYLI_SMS_URL = process.env.PROVIDER_URL || 'https://sms.tc/stubs/handler_api.php';

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'Aklomanti';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'AZC.anka.34';

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
    customCatalog: []
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
    { id: 'tg_tr', key: 'tr', name: 'Telegram Türkiye', serviceCode: 'tg', defCountry: '62', price: 250 },
    { id: 'wa_tr', key: 'tr', name: 'WhatsApp Türkiye', serviceCode: 'wa', defCountry: '62', price: 300 }
];

(db.customCatalog || []).forEach(p => { if (p && p.id && !CATALOG.some(c => c.id === p.id)) CATALOG.push(p); });

// ====== ANA SAYFA (PANEL ARAYÜZÜ) ======
app.get('/', (req, res) => {
    res.send(`<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><title>Anka SMS Panel</title><script src="https://cdn.tailwindcss.com"></script><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"></head><body class="bg-slate-950 text-slate-100 min-h-screen"><div class="max-w-4xl mx-auto p-4 sm:p-6"><header class="flex justify-between items-center bg-slate-900 border border-slate-800 p-4 rounded-xl mb-6 shadow-lg"><div><h1 class="text-xl font-bold text-violet-400"><i class="fa-solid fa-shield-halved mr-2"></i>Anka SMS Panel</h1><p class="text-xs text-slate-400">Sürüm: ${APP_VERSION}</p></div><div class="flex items-center gap-4"><span class="text-sm">Bakiye: <b id="lblBakiye" class="text-emerald-400">5000</b> TL</span><button onclick="openPaymentModal()" class="bg-emerald-600 hover:bg-emerald-500 text-xs px-3 py-2 rounded-lg font-semibold transition"><i class="fa-solid fa-wallet mr-1"></i>Bakiye Yükle</button></div></header><div class="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-6 shadow-lg"><h2 class="text-lg font-semibold mb-4 text-violet-300"><i class="fa-solid fa-cart-shopping mr-2"></i>Numara Satın Al</h2><div id="catalogList" class="grid grid-cols-1 sm:grid-cols-2 gap-4"></div></div></div>

    <!-- BAKİYE YÜKLE (SHOPIER) MODALI -->
    <div id="paymentModal" class="hidden fixed inset-0 bg-black/70 flex items-center justify-center p-4"><div class="bg-slate-900 border border-slate-800 p-6 rounded-2xl w-full max-w-md shadow-2xl"><h3 class="text-lg font-bold mb-4 text-emerald-400"><i class="fa-solid fa-credit-card mr-2"></i>Shopier ile Bakiye Yükle</h3><input type="number" id="payAmount" placeholder="Yüklenecek Tutar (TL)" value="50" min="10" class="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl mb-4 text-sm text-white"><div class="flex justify-end gap-2"><button onclick="closePaymentModal()" class="bg-slate-800 px-4 py-2 rounded-xl text-xs">İptal</button><button onclick="startShopierPayment()" class="bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-xl text-xs font-bold">Ödemeye Geç</button></div></div></div>

    <div id="shopierFormContainer" class="hidden"></div>

    <script>
        async function loadCatalog() {
            const res = await fetch('/api/catalog');
            const data = await res.json();
            const box = document.getElementById('catalogList');
            box.innerHTML = '';
            data.catalog.forEach(item => {
                box.innerHTML += \`<div class="bg-slate-950 border border-slate-800 p-4 rounded-xl flex justify-between items-center"><div><h3 class="font-bold text-sm">\${item.name}</h3><p class="text-emerald-400 font-bold mt-1">\${item.price} TL</p></div><button onclick="buyNumber('\${item.id}')" class="bg-violet-600 hover:bg-violet-500 text-xs px-4 py-2 rounded-xl font-semibold transition">Satın Al</button></div>\`;
            });
        }
        function openPaymentModal() { document.getElementById('paymentModal').classList.remove('hidden'); }
        function closePaymentModal() { document.getElementById('paymentModal').classList.add('hidden'); }

        async function startShopierPayment() {
            const amount = document.getElementById('payAmount').value;
            if(!amount || amount < 10) return alert('Lütfen en az 10 TL giriniz.');
            const res = await fetch('/api/payment/shopier/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: 'Aklomanti', amount: parseFloat(amount) })
            });
            const data = await res.json();
            if(data.success && data.htmlForm) {
                document.getElementById('shopierFormContainer').innerHTML = data.htmlForm;
                document.getElementById('shopier_payment_form').submit();
            } else {
                alert('Ödeme başlatılamadı.');
            }
        }
        loadCatalog();
    </script></body></html>`);
});

app.get('/api/catalog', (req, res) => {
    res.json({ success: true, catalog: CATALOG });
});

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Anka SMS Panel ${PORT} portunda aktif.`);
});
