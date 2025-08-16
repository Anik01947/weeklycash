const { admin, db, verifyInitData, getOrCreateUser, json } = require('./_lib/common');
const { v4: uuid } = require('uuid');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'method_not_allowed' });
  try {
    const body = JSON.parse(event.body || '{}');
    const tgUser = verifyInitData(body.init);
    if (!tgUser) return json(401, { error: 'unauthorized' });

    const uid = String(tgUser.id);
    const userRef = db.collection('users').doc(uid);
    await getOrCreateUser(tgUser);

    const userSnap = await userRef.get();
    const user = userSnap.data();
    if (user.banned) return json(403, { error: 'banned' });

    // অল্প cooldown (anti-spam)
    const lastAd = user.lastAdAt?.toDate?.() || null;
    if (lastAd && Date.now() - lastAd.getTime() < 3000) {
      return json(429, { error: 'cooldown' });
    }

    const seconds = parseInt(process.env.AD_VIEW_SECONDS || '20', 10);
    const sessionId = uuid();

    await db.collection('adSessions').doc(sessionId).set({
      userId: uid,
      createdAt: admin.firestore.Timestamp.now(),
      expiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + (seconds + 60) * 1000)),
      used: false,
      requiredSeconds: seconds,
    });

    await userRef.update({ lastAdAt: admin.firestore.FieldValue.serverTimestamp() });

    return json(200, { sessionId, seconds });
  } catch (e) {
    console.error(e);
    return json(500, { error: 'server_error' });
  }
};
