const crypto = require("crypto");

const products = {
  self: {
    name: "giffgaff 自助卡",
    priceCny: 88,
  },
  assist: {
    name: "giffgaff 省心卡",
    priceCny: 269,
  },
};

const channelMap = {
  alipay: "alipay",
  wechat: "wxpay",
  usdt: "usdt",
};

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function buildSign(params, key) {
  const source = Object.keys(params)
    .filter((name) => name !== "sign" && name !== "sign_type" && params[name] !== "")
    .sort()
    .map((name) => `${name}=${params[name]}`)
    .join("&");

  return crypto.createHash("md5").update(`${source}${key}`, "utf8").digest("hex");
}

function normalizeGateway(value) {
  const gateway = value || "https://pay.yuhuizhifu.com/";
  return gateway.endsWith("/") ? gateway : `${gateway}/`;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "method_not_allowed" });
  }

  const merchantId = process.env.YUHUI_PID || process.env.YUHUI_MERCHANT_ID;
  const merchantKey = process.env.YUHUI_KEY || process.env.YUHUI_SECRET;
  const gateway = normalizeGateway(process.env.YUHUI_GATEWAY);
  const siteUrl = (process.env.SITE_URL || "https://globalsimhelp.com").replace(/\/$/, "");

  if (!merchantId || !merchantKey) {
    return sendJson(res, 500, {
      error: "payment_not_configured",
      message: "支付通道尚未配置商户号和密钥。",
    });
  }

  let payload;
  try {
    payload = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch (error) {
    return sendJson(res, 400, { error: "invalid_json" });
  }

  const method = payload?.method;
  const channel = channelMap[method];
  const items = Array.isArray(payload?.items) ? payload.items : [];

  if (!channel) {
    return sendJson(res, 400, { error: "invalid_payment_method" });
  }

  let totalCny = 0;
  const orderItems = [];

  for (const item of items) {
    const product = products[item.id];
    const quantity = Number(item.quantity);

    if (!product || !Number.isInteger(quantity) || quantity < 0 || quantity > 20) {
      return sendJson(res, 400, { error: "invalid_cart_item" });
    }

    if (quantity > 0) {
      totalCny += product.priceCny * quantity;
      orderItems.push(`${product.name}x${quantity}`);
    }
  }

  if (!orderItems.length || totalCny <= 0) {
    return sendJson(res, 400, { error: "empty_cart" });
  }

  const outTradeNo = `LL${Date.now()}${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
  const params = {
    pid: merchantId,
    type: channel,
    out_trade_no: outTradeNo,
    notify_url: `${siteUrl}/api/payment-notify`,
    return_url: `${siteUrl}/cart/?paid=1&order=${encodeURIComponent(outTradeNo)}`,
    name: orderItems.join(" / "),
    money: totalCny.toFixed(2),
    sitename: "老六海外手机号",
  };

  const sign = buildSign(params, merchantKey);
  const query = new URLSearchParams({
    ...params,
    sign,
    sign_type: "MD5",
  });

  return sendJson(res, 200, {
    orderNo: outTradeNo,
    amountCny: totalCny,
    paymentUrl: `${gateway}submit.php?${query.toString()}`,
  });
};
