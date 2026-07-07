const { clearSessionCookie } = require("./_auth");

module.exports = async function handler(req, res) {
  clearSessionCookie(res);
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify({ ok: true }));
};
