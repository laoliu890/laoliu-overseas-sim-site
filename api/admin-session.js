const { verifySession } = require("./_auth");

module.exports = async function handler(req, res) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify({ authenticated: verifySession(req) }));
};
