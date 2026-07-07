const { setSessionCookie } = require("./_auth");

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "method_not_allowed" });
  }

  const expected = process.env.ADMIN_PASSWORD;
  const payload = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};

  if (!expected) {
    return sendJson(res, 500, {
      error: "admin_password_not_configured",
      message: "后台密码尚未配置。",
    });
  }

  if (String(payload.password || "") !== expected) {
    return sendJson(res, 401, {
      error: "invalid_password",
      message: "后台密码不正确。",
    });
  }

  setSessionCookie(res);
  return sendJson(res, 200, { ok: true });
};
