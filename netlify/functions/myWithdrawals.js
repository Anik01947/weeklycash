const { db, verifyInitData, json } = require('./_lib/common');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return json(405, { error: 'method_not_allowed' });
  try {
    const init = event.queryStringParameters?.init;
    const tgUser = verifyInitData(init);
    if (!tgUser) return json(401, { error: 'unauthorized' });

    const uid = String(tgUser.id);

    // ইউজারের withdraw গুলো আনুন (সর্বশেষ আগে)
    const snap = await db
      .collection('withdrawals')
      .where('userId', '==', uid)
      .orderBy('timestamp', 'desc')
      .limit(50)
      .get();

    const items = [];
    snap.forEach(doc => {
      const w = doc.data() || {};
      items.push({
        id: doc.id,
        amountPoisha: w.amountPoisha || 0,
        amountTaka: ((w.amountPoisha || 0) / 100).toFixed(2),
        method: w.method || '-',
        number: w.number || '-',
        status: w.status || 'pending',
        timestamp: w.timestamp ? w.timestamp.toDate().toISOString() : null,
      });
    });

    return json(200, { items });
  } catch (e) {
    console.error(e);
    return json(500, { error: 'server_error' });
  }
};
