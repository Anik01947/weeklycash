const { admin, verifyInitData, json } = require('./_lib/common');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return json(405, { error: 'method_not_allowed' });
  try {
    const tgUser = verifyInitData(event.queryStringParameters?.init);
    if (!tgUser) return json(401, { error: 'unauthorized' });

    const admins = (process.env.ADMIN_IDS || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    const uid = String(tgUser.id);
    if (!admins.includes(uid)) return json(403, { error: 'not_admin' });

    const token = await admin.auth().createCustomToken(`tg:${uid}`, {
      admin: true,
      tgId: uid
    });

    return json(200, { token });
  } catch (e) {
    console.error(e);
    return json(500, { error: 'server_error' });
  }
};
