const { admin, db, verifyInitData, nowDhaka, json } = require('./_lib/common');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'method_not_allowed' });
  try {
    const body = JSON.parse(event.body || '{}');
    const tgUser = verifyInitData(body.init);
    if (!tgUser) return json(401, { error: 'unauthorized' });

    const { method, number, amountTaka } = body;
    if (!method || !number || !amountTaka) {
      return json(400, { error: 'missing_fields' });
    }

    // Friday only (Asia/Dhaka)
    const dhaka = nowDhaka();
    // Luxon: Monday=1 ... Friday=5 ... Sunday=7
    if (dhaka.weekday !== 5) {
      return json(403, { error: 'withdraw_only_friday' });
    }

    const amountPoisha = Math.round(parseFloat(amountTaka) * 100);
    const minPoisha = Math.round(parseFloat(process.env.MIN_WITHDRAW_TAKA || '50') * 100);

    if (!isFinite(amountPoisha) || amountPoisha <= 0) {
      return json(400, { error: 'invalid_amount' });
    }
    if (amountPoisha < minPoisha) {
      return json(400, { error: 'min_withdraw', minTaka: minPoisha / 100 });
    }

    const uid = String(tgUser.id);
    const userRef = db.collection('users').doc(uid);
    const wdRef = db.collection('withdrawals').doc();

    await db.runTransaction(async (tx) => {
      const u = await tx.get(userRef);
      if (!u.exists) throw new Error('user_missing');

      const bal = u.data().balancePoisha || 0;
      if (bal < amountPoisha) throw new Error('insufficient');

      // Deduct balance first to prevent double spend
      tx.update(userRef, { balancePoisha: bal - amountPoisha });

      tx.set(wdRef, {
        id: wdRef.id,
        userId: uid,
        name: u.data().name || tgUser.first_name || 'User',
        username: u.data().username || tgUser.username || null,
        amountPoisha,
        method,
        number,
        status: 'pending',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    return json(200, { ok: true });
  } catch (e) {
    console.error(e);
    if (e.message === 'insufficient') return json(400, { error: 'insufficient_balance' });
    return json(500, { error: 'server_error' });
  }
};
