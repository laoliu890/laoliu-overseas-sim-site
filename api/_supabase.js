const { defaultFaqs, defaultProducts } = require("./_defaults");

function getConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return { configured: Boolean(url && key), key, url: url ? url.replace(/\/$/, "") : "" };
}

function headers(extra = {}) {
  const { key } = getConfig();
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function request(path, options = {}) {
  const config = getConfig();
  if (!config.configured) {
    throw new Error("supabase_not_configured");
  }

  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    ...options,
    headers: headers(options.headers || {}),
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = body?.message || body?.hint || response.statusText;
    throw new Error(message);
  }

  return body;
}

async function selectRows(table, query = "select=*") {
  return request(`${table}?${query}`, { method: "GET" });
}

async function upsertRows(table, rows, conflictKey) {
  return request(`${table}?on_conflict=${encodeURIComponent(conflictKey)}`, {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify(rows),
  });
}

async function insertRows(table, rows) {
  return request(table, {
    method: "POST",
    headers: {
      Prefer: "return=representation",
    },
    body: JSON.stringify(rows),
  });
}

async function patchRows(table, filter, values) {
  return request(`${table}?${filter}`, {
    method: "PATCH",
    headers: {
      Prefer: "return=representation",
    },
    body: JSON.stringify(values),
  });
}

async function ensureDefaultData() {
  const products = await selectRows(
    "products",
    "select=id,name,badge,description,price_usd,price_cny,features,sort_order,active&order=sort_order.asc",
  );
  if (!products.length) {
    await upsertRows("products", defaultProducts, "id");
  }

  const faqs = await selectRows("faqs", "select=id,question,answer,sort_order,active&order=sort_order.asc");
  if (!faqs.length) {
    await insertRows("faqs", defaultFaqs);
  }
}

async function getSiteData() {
  const config = getConfig();
  if (!config.configured) {
    return {
      configured: false,
      products: defaultProducts,
      faqs: defaultFaqs,
    };
  }

  await ensureDefaultData();
  const [products, faqs] = await Promise.all([
    selectRows(
      "products",
      "select=id,name,badge,description,price_usd,price_cny,features,sort_order,active&active=eq.true&order=sort_order.asc",
    ),
    selectRows("faqs", "select=id,question,answer,sort_order,active&active=eq.true&order=sort_order.asc"),
  ]);

  return {
    configured: true,
    products,
    faqs,
  };
}

module.exports = {
  defaultFaqs,
  defaultProducts,
  ensureDefaultData,
  getConfig,
  getSiteData,
  insertRows,
  patchRows,
  request,
  selectRows,
  upsertRows,
};
