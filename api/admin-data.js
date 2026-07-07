const { requireAdmin } = require("./_auth");
const { ensureDefaultData, getConfig, getSiteData, patchRows, selectRows, upsertRows } = require("./_supabase");

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function cleanText(value, maxLength = 500) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizeProduct(item, index) {
  return {
    id: cleanText(item.id, 32),
    name: cleanText(item.name, 80),
    badge: cleanText(item.badge, 120),
    description: cleanText(item.description, 240),
    price_usd: Number(item.price_usd),
    price_cny: Number(item.price_cny),
    features: Array.isArray(item.features)
      ? item.features.map((feature) => cleanText(feature, 120)).filter(Boolean)
      : [],
    sort_order: Number.isInteger(Number(item.sort_order)) ? Number(item.sort_order) : index + 1,
    active: item.active !== false,
  };
}

function normalizeFaq(item, index) {
  const faq = {
    question: cleanText(item.question, 160),
    answer: cleanText(item.answer, 800),
    sort_order: Number.isInteger(Number(item.sort_order)) ? Number(item.sort_order) : index + 1,
    active: item.active !== false,
  };
  if (item.id) {
    faq.id = item.id;
  }
  return faq;
}

async function getAdminData() {
  if (!getConfig().configured) {
    throw new Error("supabase_not_configured");
  }

  await ensureDefaultData();
  const [siteData, orders, orderItems] = await Promise.all([
    getSiteData(),
    selectRows(
      "orders",
      "select=id,order_no,payment_method,payment_status,amount_cny,receiver_name,receiver_phone,wechat,province,city,address,note,created_at,paid_at&order=created_at.desc&limit=80",
    ),
    selectRows("order_items", "select=order_no,product_id,product_name,quantity,price_cny&order=created_at.asc&limit=240"),
  ]);

  const itemsByOrder = orderItems.reduce((map, item) => {
    map[item.order_no] ||= [];
    map[item.order_no].push(item);
    return map;
  }, {});

  const enrichedOrders = orders.map((order) => ({
    ...order,
    items: itemsByOrder[order.order_no] || [],
  }));

  return {
    ...siteData,
    orders: enrichedOrders,
    stats: {
      totalOrders: orders.length,
      paidOrders: orders.filter((order) => order.payment_status === "paid").length,
      pendingOrders: orders.filter((order) => order.payment_status !== "paid").length,
      revenueCny: orders
        .filter((order) => order.payment_status === "paid")
        .reduce((sum, order) => sum + Number(order.amount_cny || 0), 0),
    },
  };
}

module.exports = async function handler(req, res) {
  if (!requireAdmin(req, res)) {
    return;
  }

  try {
    if (req.method === "GET") {
      return sendJson(res, 200, await getAdminData());
    }

    if (req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      return sendJson(res, 405, { error: "method_not_allowed" });
    }

    const payload = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};

    if (payload.action === "save_products") {
      const products = (Array.isArray(payload.products) ? payload.products : []).map(normalizeProduct);
      if (products.some((item) => !item.id || !item.name || !item.price_cny || !item.price_usd)) {
        return sendJson(res, 400, { error: "invalid_products" });
      }
      await upsertRows("products", products, "id");
      return sendJson(res, 200, await getAdminData());
    }

    if (payload.action === "save_faqs") {
      const faqs = (Array.isArray(payload.faqs) ? payload.faqs : []).map(normalizeFaq);
      if (faqs.some((item) => !item.question || !item.answer)) {
        return sendJson(res, 400, { error: "invalid_faqs" });
      }
      const existing = faqs.filter((item) => item.id);
      const created = faqs.filter((item) => !item.id);
      if (existing.length) {
        await upsertRows("faqs", existing, "id");
      }
      if (created.length) {
        const { insertRows } = require("./_supabase");
        await insertRows("faqs", created);
      }
      return sendJson(res, 200, await getAdminData());
    }

    if (payload.action === "update_order_status") {
      const orderNo = cleanText(payload.orderNo, 64);
      const status = cleanText(payload.status, 32);
      if (!orderNo || !status) {
        return sendJson(res, 400, { error: "invalid_order_status" });
      }
      await patchRows("orders", `order_no=eq.${encodeURIComponent(orderNo)}`, { payment_status: status });
      return sendJson(res, 200, await getAdminData());
    }

    return sendJson(res, 400, { error: "unknown_action" });
  } catch (error) {
    return sendJson(res, 500, {
      error: "admin_data_failed",
      message: error.message,
    });
  }
};
