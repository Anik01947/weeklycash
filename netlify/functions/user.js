const { verifyInitData, getOrCreateUser, json } = require('./_lib/common');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return json(405, { error: 'method_not_allowed' });
  try {
    const init = event.queryStringParameters?.init;
    const tgUser = verifyInitData(init);
    if (!tgUser) return json(401, { error: 'unauthorized' });

    const data = await getOrCreateUser(tgUser);

    return json(200, {
      id: String(tgUser.id),
      name: data.name,
      username: data.username,
      balancePoisha: data.balancePoisha || 0,
      balanceTaka: ((data.balancePoisha || 0) / 100).toFixed(2),
      adsWatched: data.adsWatched || 0,
      rewardPoisha: parseInt(process.env.REWARD_PER_AD_POISHA || '15', 10),
      adSeconds: parseInt(process.env.AD_VIEW_SECONDS || '20', 10),
      minWithdrawTaka: parseFloat(process.env.MIN_WITHDRAW_TAKA || '50'),
    });
  } catch (e) {
    console.error(e);
    return json(500, { error: 'server_error' });
  }
};
