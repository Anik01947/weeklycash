const admin = require('firebase-admin');
const crypto = require('crypto');
const { DateTime } = require('luxon');

if (!admin.apps.length) {
  const pk = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: pk,
    }),
  });
}
const db = admin.firestore();

// Telegram WebApp initData যাচাই
function verifyInitData(init) {
  if (!init || !process.env.BOT_TOKEN) return null;
  const params = new URLSearchParams(init);
  const hash = params.get('hash');
  if (!hash) return null;

  params.delete('hash');
  const dataCheckString = Array.from(params.entries())
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('\n');

  // secret = sha256(bot_token)
  const secret = crypto.createHash('sha256').update(process.env.BOT_TOKEN).digest();
  const hmac = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');
  if (hmac !== hash) return null;

  const userStr = params.get('user');
  if (!userStr) return null;
  try { return JSON.parse(userStr); } catch { return null; }
}

// ইউজার না থাকলে বানায়, থাকলে আপডেট করে
async function getOrCreateUser(tgUser) {
  const uid = String(tgUser.id);
  const ref = db.collection('users').doc(uid);
  const snap = await ref.get();
  const now = admin.firestore.FieldValue.serverTimestamp();

  if (!snap.exists) {
    await ref.set({
      name: `${tgUser.first_name || ''} ${tgUser.last_name || ''}`.trim() || 'User',
      username: tgUser.username || null,
      balancePoisha: 0,
      adsWatched: 0,
      banned: false,
      createdAt: now,
      lastSeenAt: now,
    });
  } else {
    await ref.update({ lastSeenAt: now });
  }
  return (await ref.get()).data();
}

// Dhaka time
function nowDhaka() {
  const tz = process.env.TIMEZONE || 'Asia/Dhaka';
  return DateTime.now().setZone(tz);
}

// JSON response helper
function json(status, data) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  };
}

module.exports = { admin, db, verifyInitData, getOrCreateUser, nowDhaka, json };
