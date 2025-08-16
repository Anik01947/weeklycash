const { admin, db, verifyInitData, json } = require('./_lib/common');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'method_not_allowed' });
  try {
    const body = JSON.parse(event.body || '{}');
    const tgUser = verifyInitData(body.init);
    if (!tgUser) return json(401, { error: 'unauthorized' });

    const { sessionId } = body;
    if (!sessionId) return json(400, { error: 'missing_session' });

    const sessionRef = db.collection('adSessions').doc(sessionId);
    const sessionSnap = await sessionRef.get();
    if (!sessionSnap.exists) return json(404, { error: 'invalid_session' });

    const session = sessionSnap.data();
    const uid = String(tgUser.id);
    if (session.userId !== uid) return json(403, { error: 'wrong_user' });
    if (session.used) return json(409, { error: 'already_used' });

    const required = session.requiredSeconds || parseInt(process.env.AD_VIEW_SECONDS || '20', 10);
    const created = session.createdAt.toDate();
    const elapsed = (Date.now() - created.getTime()) / 1000;
    if (elapsed < required - 0.5) {
      return json(400, { error: 'too_fast' });
    }

    const reward = parseInt(process.env.REWARD_PER_AD_POISHA || '15', 10);

    await db.runTransaction(async (tx) => {
      const s = await tx.get(sessionRef);
      if (!s.exists) throw new Error('session_missing');
      if (s.data().used) throw new Error('double_spend');

      const userRef = db.collection('users').doc(uid);
      const u = await tx.get(userRef);
      if (!u.exists) throw new Error('user_missing');

      const newBal = (u.data().balancePoisha || 0) + reward;
      const ads = (u.data().adsWatched || 0) + 1;

      tx.update(sessionRef, { used: true });
      tx.update(userRef, {
        balancePoisha: newBal,
        adsWatched: ads,
        lastAdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    const userNew = (await db.collection('users').doc(uid).get()).data();

    return json(200, {
      ok: true,
      rewardPoisha: reward,
      balancePoisha: userNew.balancePoisha,
      balanceTaka: (userNew.balancePoisha / 100).toFixed(2),
      adsWatched: userNew.adsWatched,
    });
  } catch (e) {
    console.error(e);
    return json(500, { error: 'server_error' });
  }
};
