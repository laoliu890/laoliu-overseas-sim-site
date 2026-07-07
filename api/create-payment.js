const crypto = require("crypto");
const { getConfig, getSiteData, insertRows } = require("./_supabase");

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

function cleanText(value, maxLength = 120) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizeShippingInfo(value) {
  return {
    receiverName: cleanText(value?.receiverName, 32),
    receiverPhone: cleanText(value?.receiverPhone, 24).replace(/\s+/g, ""),
    wechat: cleanText(value?.wechat, 64),
    province: cleanText(value?.province, 32),
    city: cleanText(value?.city, 32),
    address: cleanText(value?.address, 180),
    note: cleanText(value?.note, 180),
  };
}

function validateShippingInfo(info) {
  if (!info.receiverName) {
    return "请填写收件人姓名。";
  }

  if (!/^1[3-9]\d{9}$/.test(info.receiverPhone)) {
    return "请填写正确的 11 位中国大陆手机号。";
  }

  if (!info.province || !info.city) {
    return "请填写完整的省份和城市。";
  }

  if (info.address.length < 8) {
    return "请填写详细收货地址。";
  }

  return "";
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
  const shipping = normalizeShippingInfo(payload?.shipping);
  const shippingError = validateShippingInfo(shipping);

  if (!channel) {
    return sendJson(res, 400, { error: "invalid_payment_method" });
  }

  if (shippingError) {
    return sendJson(res, 400, {
      error: "invalid_shipping_info",
      message: shippingError,
    });
  }

  let totalCny = 0;
  const orderItems = [];
  const siteData = await getSiteData();
  const products = siteData.products.reduce((map, product) => {
    map[product.id] = product;
    return map;
  }, {});

  for (const item of items) {
    const product = products[item.id];
    const quantity = Number(item.quantity);

    if (!product || !Number.isInteger(quantity) || quantity < 0 || quantity > 20) {
      return sendJson(res, 400, { error: "invalid_cart_item" });
    }

    if (quantity > 0) {
      const priceCny = Number(product.price_cny);
      totalCny += priceCny * quantity;
      orderItems.push({
        productId: product.id,
        productName: product.name,
        quantity,
        priceCny,
      });
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
    notify_url: `${siteUrl}/api/payment-notify/`,
    return_url: `${siteUrl}/cart/?paid=1&order=${encodeURIComponent(outTradeNo)}`,
    name: orderItems.map((item) => `${item.productName}x${item.quantity}`).join(" / "),
    money: totalCny.toFixed(2),
    sitename: "老六海外手机号",
  };

  if (getConfig().configured) {
    await insertRows("orders", [
      {
        order_no: outTradeNo,
        payment_method: method,
        payment_status: "pending",
        amount_cny: totalCny,
        receiver_name: shipping.receiverName,
        receiver_phone: shipping.receiverPhone,
        wechat: shipping.wechat,
        province: shipping.province,
        city: shipping.city,
        address: shipping.address,
        note: shipping.note,
      },
    ]);

    await insertRows(
      "order_items",
      orderItems.map((item) => ({
        order_no: outTradeNo,
        product_id: item.productId,
        product_name: item.productName,
        quantity: item.quantity,
        price_cny: item.priceCny,
      })),
    );
  }

  const sign = buildSign(params, merchantKey);
  const query = new URLSearchParams({
    ...params,
    sign,
    sign_type: "MD5",
  });

  return sendJson(res, 200, {
    orderNo: outTradeNo,
    amountCny: totalCny,
    shipping,
    paymentUrl: `${gateway}submit.php?${query.toString()}`,
  });
};
