const crypto = require("crypto");

function sendText(res, status, text) {
  res.statusCode = status;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.end(text);
}

function buildSign(params, key) {
  const source = Object.keys(params)
    .filter((name) => name !== "sign" && name !== "sign_type" && params[name] !== "")
    .sort()
    .map((name) => `${name}=${params[name]}`)
    .join("&");

  return crypto.createHash("md5").update(`${source}${key}`, "utf8").digest("hex");
}

module.exports = async function handler(req, res) {
  const merchantKey = process.env.YUHUI_KEY || process.env.YUHUI_SECRET;

  if (!merchantKey) {
    return sendText(res, 500, "fail");
  }

  const params = req.method === "POST" ? req.body : req.query;
  const expected = buildSign(params || {}, merchantKey);
  const actual = String(params?.sign || "").toLowerCase();

  if (actual && expected === actual) {
    // TODO: 接入数据库或订单系统后，在这里把订单状态标记为已支付。
    return sendText(res, 200, "success");
  }

  return sendText(res, 400, "fail");
};
