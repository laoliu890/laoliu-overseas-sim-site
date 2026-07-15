const { getConfig, selectRows } = require("./_supabase");

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function cleanPhone(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 11);
}

function orderStatusLabel(status) {
  const labels = {
    pending: "待支付",
    paid: "已支付",
    shipped: "已发货",
    completed: "已完成",
    cancelled: "已取消",
  };
  return labels[status] || status || "待处理";
}

function logisticsStatusLabel(status, paymentStatus) {
  const labels = {
    pending: "待处理",
    preparing: "备货中",
    shipped: "已发货",
    delivered: "已签收",
    exception: "物流异常",
  };

  if (!status && paymentStatus === "shipped") {
    return "已发货";
  }

  return labels[status] || "待更新";
}

function safeText(value, maxLength = 500) {
  return String(value || "").trim().slice(0, maxLength);
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "method_not_allowed" });
  }

  if (!getConfig().configured) {
    return sendJson(res, 500, {
      error: "database_not_configured",
      message: "订单查询暂未配置完成，请联系客服查询。",
    });
  }

  let payload;
  try {
    payload = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  } catch (error) {
    return sendJson(res, 400, { error: "invalid_json" });
  }

  const phone = cleanPhone(payload.phone);
  if (!/^1[3-9]\d{9}$/.test(phone)) {
    return sendJson(res, 400, {
      error: "invalid_phone",
      message: "请输入下单时填写的 11 位中国大陆手机号。",
    });
  }

  try {
    const [orders, orderItems] = await Promise.all([
      selectRows(
        "orders",
        `select=*&receiver_phone=eq.${encodeURIComponent(phone)}&order=created_at.desc&limit=10`,
      ),
      selectRows("order_items", "select=order_no,product_name,quantity,price_cny&order=created_at.asc&limit=300"),
    ]);

    const itemsByOrder = orderItems.reduce((map, item) => {
      map[item.order_no] ||= [];
      map[item.order_no].push({
        productName: safeText(item.product_name, 120),
        quantity: Number(item.quantity || 0),
        priceCny: Number(item.price_cny || 0),
      });
      return map;
    }, {});

    const result = orders.map((order) => ({
      orderNo: safeText(order.order_no, 80),
      paymentStatus: order.payment_status || "pending",
      paymentStatusLabel: orderStatusLabel(order.payment_status),
      amountCny: Number(order.amount_cny || 0),
      createdAt: order.created_at || "",
      paidAt: order.paid_at || "",
      shippedAt: order.shipped_at || "",
      logisticsCompany: safeText(order.logistics_company, 80),
      logisticsNo: safeText(order.logistics_no, 100),
      logisticsStatus: order.logistics_status || "",
      logisticsStatusLabel: logisticsStatusLabel(order.logistics_status, order.payment_status),
      logisticsNote: safeText(order.logistics_note, 500),
      logisticsUpdatedAt: order.logistics_updated_at || "",
      logisticsImageData: String(order.logistics_image_data || ""),
      logisticsImageUpdatedAt: order.logistics_image_updated_at || "",
      receiverName: order.receiver_name ? `${String(order.receiver_name).slice(0, 1)}**` : "",
      destination: [order.province, order.city].filter(Boolean).join(" "),
      items: itemsByOrder[order.order_no] || [],
    }));

    return sendJson(res, 200, { orders: result });
  } catch (error) {
    return sendJson(res, 500, {
      error: "lookup_failed",
      message: "订单查询失败，请稍后重试或联系客服。",
    });
  }
};
