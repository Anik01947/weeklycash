exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 200, body: 'OK' };
  }
  try {
    const update = JSON.parse(event.body || '{}');
    const token = process.env.BOT_TOKEN;
    if (!token) return { statusCode: 500, body: 'BOT_TOKEN missing' };

    const host = event.headers['x-forwarded-host'] || event.headers['host'];
    const proto = event.headers['x-forwarded-proto'] || 'https';
    const base = process.env.PUBLIC_BASE_URL || `${proto}://${host}`;

    const sendMessage = async (chat_id, text, markup) => {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id, text, reply_markup: markup }),
      });
    };

    const admins = (process.env.ADMIN_IDS || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    if (update.message) {
      const msg = update.message;
      const chat_id = msg.chat.id;
      const isAdmin = admins.includes(String(msg.from.id));

      const keyboard = {
        inline_keyboard: [
          [{ text: 'Open WeeklyCash', web_app: { url: `${base}/webapp/` } }],
          ...(isAdmin ? [[{ text: 'Admin Panel', web_app: { url: `${base}/admin/` } }]] : []),
        ],
      };

      const text = `Welcome to WeeklyCash!
- প্রতি অ্যাড দেখলে 15 পয়সা
- শুধু শুক্রবার Withdraw

নিচের বোতামে ক্লিক করুন ⬇️`;

      await sendMessage(chat_id, text, keyboard);
    }

    return { statusCode: 200, body: 'OK' };
  } catch (e) {
    console.error(e);
    return { statusCode: 200, body: 'OK' };
  }
};
