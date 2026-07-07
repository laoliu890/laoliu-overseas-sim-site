const state = {
  data: {
    products: [],
    faqs: [],
    orders: [],
    stats: {},
  },
};

const loginPanel = document.querySelector("[data-login-panel]");
const adminApp = document.querySelector("[data-admin-app]");
const notice = document.querySelector("[data-notice]");

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatCny(value) {
  return `¥${Number(value || 0).toLocaleString("zh-CN", { maximumFractionDigits: 2 })}`;
}

function showNotice(message, type = "info") {
  if (!notice) {
    return;
  }
  notice.hidden = !message;
  notice.textContent = message || "";
  notice.dataset.type = type;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || payload.error || "请求失败");
  }
  return payload;
}

function setAuthenticated(authenticated) {
  loginPanel.hidden = authenticated;
  adminApp.hidden = !authenticated;
}

function switchTab(name) {
  document.querySelectorAll("[data-tab-button]").forEach((button) => {
    button.classList.toggle("active", button.dataset.tabButton === name);
  });
  document.querySelectorAll("[data-tab-panel]").forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.tabPanel === name);
  });
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

function statusClass(status) {
  return `status-pill status-${escapeHtml(status || "pending")}`;
}

function renderStats(stats = {}) {
  document.querySelector('[data-stat="totalOrders"]').textContent = stats.totalOrders || 0;
  document.querySelector('[data-stat="paidOrders"]').textContent = stats.paidOrders || 0;
  document.querySelector('[data-stat="pendingOrders"]').textContent = stats.pendingOrders || 0;
  document.querySelector('[data-stat="revenueCny"]').textContent = formatCny(stats.revenueCny || 0);
}

function renderOrderItems(items = []) {
  if (!items.length) {
    return '<span class="muted-text">暂无商品明细</span>';
  }
  return `<div class="order-items">${items
    .map((item) => `${escapeHtml(item.product_name)} × ${escapeHtml(item.quantity)}`)
    .join("<br>")}</div>`;
}

function renderOrdersTable(selector, orders, compact = false) {
  const target = document.querySelector(selector);
  if (!target) {
    return;
  }
  const list = compact ? orders.slice(0, 6) : orders;

  if (!list.length) {
    target.innerHTML = `<tr><td colspan="${compact ? 6 : 6}" class="empty-state">暂无订单。</td></tr>`;
    return;
  }

  target.innerHTML = list
    .map((order) => {
      const status = order.payment_status || "pending";
      const createdAt = order.created_at ? new Date(order.created_at).toLocaleString("zh-CN") : "-";
      if (compact) {
        return `
          <tr>
            <td>${escapeHtml(order.order_no)}</td>
            <td>${renderOrderItems(order.items)}</td>
            <td>${formatCny(order.amount_cny)}</td>
            <td><span class="${statusClass(status)}">${orderStatusLabel(status)}</span></td>
            <td>${escapeHtml(order.receiver_name || "-")}</td>
            <td>${createdAt}</td>
          </tr>
        `;
      }

      return `
        <tr>
          <td>${escapeHtml(order.order_no)}</td>
          <td>${renderOrderItems(order.items)}</td>
          <td>${formatCny(order.amount_cny)}<br><span class="muted-text">${escapeHtml(order.payment_method || "-")}</span></td>
          <td><span class="${statusClass(status)}">${orderStatusLabel(status)}</span></td>
          <td>
            <div class="address-block">
              <strong>${escapeHtml(order.receiver_name || "-")}</strong> ${escapeHtml(order.receiver_phone || "")}<br>
              微信：${escapeHtml(order.wechat || "-")}<br>
              ${escapeHtml(order.province || "")}${escapeHtml(order.city || "")} ${escapeHtml(order.address || "")}<br>
              <span class="muted-text">备注：${escapeHtml(order.note || "-")}</span>
            </div>
          </td>
          <td>
            <div class="order-actions">
              <select data-order-status="${escapeHtml(order.order_no)}">
                ${["pending", "paid", "shipped", "completed", "cancelled"]
                  .map(
                    (item) =>
                      `<option value="${item}" ${item === status ? "selected" : ""}>${orderStatusLabel(item)}</option>`,
                  )
                  .join("")}
              </select>
              <button type="button" data-save-order-status="${escapeHtml(order.order_no)}">更新状态</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function renderProducts(products = []) {
  const editor = document.querySelector("[data-product-editor]");
  if (!editor) {
    return;
  }

  editor.innerHTML = products
    .map(
      (product, index) => `
        <article class="editor-card" data-product-row>
          <div class="editor-card-header">
            <h3>${escapeHtml(product.name || `商品 ${index + 1}`)}</h3>
            <label class="checkbox-label">
              <input type="checkbox" data-product-field="active" ${product.active !== false ? "checked" : ""}>
              <span>前台显示</span>
            </label>
          </div>
          <div class="form-grid">
            <label>
              <span>商品 ID</span>
              <input data-product-field="id" value="${escapeHtml(product.id)}" readonly>
            </label>
            <label>
              <span>排序</span>
              <input data-product-field="sort_order" type="number" value="${escapeHtml(product.sort_order || index + 1)}">
            </label>
            <label>
              <span>商品名称</span>
              <input data-product-field="name" value="${escapeHtml(product.name)}">
            </label>
            <label>
              <span>标签文案</span>
              <input data-product-field="badge" value="${escapeHtml(product.badge)}">
            </label>
            <label>
              <span>美元价格</span>
              <input data-product-field="price_usd" type="number" min="0" step="0.01" value="${escapeHtml(product.price_usd)}">
            </label>
            <label>
              <span>人民币价格</span>
              <input data-product-field="price_cny" type="number" min="0" step="0.01" value="${escapeHtml(product.price_cny)}">
            </label>
            <label class="full-field">
              <span>商品描述</span>
              <textarea data-product-field="description">${escapeHtml(product.description)}</textarea>
            </label>
            <label class="full-field">
              <span>卖点列表，每行一条</span>
              <textarea data-product-field="features">${escapeHtml((product.features || []).join("\n"))}</textarea>
            </label>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderFaqs(faqs = []) {
  const editor = document.querySelector("[data-faq-editor]");
  if (!editor) {
    return;
  }

  editor.innerHTML = faqs
    .map(
      (faq, index) => `
        <article class="editor-card" data-faq-row>
          <div class="editor-card-header">
            <h3>问题 ${index + 1}</h3>
            <label class="checkbox-label">
              <input type="checkbox" data-faq-field="active" ${faq.active !== false ? "checked" : ""}>
              <span>前台显示</span>
            </label>
          </div>
          <input type="hidden" data-faq-field="id" value="${escapeHtml(faq.id || "")}">
          <div class="form-grid">
            <label>
              <span>排序</span>
              <input data-faq-field="sort_order" type="number" value="${escapeHtml(faq.sort_order || index + 1)}">
            </label>
            <label>
              <span>问题</span>
              <input data-faq-field="question" value="${escapeHtml(faq.question)}">
            </label>
            <label class="full-field">
              <span>回答</span>
              <textarea data-faq-field="answer">${escapeHtml(faq.answer)}</textarea>
            </label>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderAll(data) {
  state.data = data;
  renderStats(data.stats || {});
  renderOrdersTable("[data-recent-orders]", data.orders || [], true);
  renderOrdersTable("[data-orders]", data.orders || [], false);
  renderProducts(data.products || []);
  renderFaqs(data.faqs || []);
}

async function loadAdminData() {
  showNotice("正在读取数据库...");
  const data = await api("/api/admin-data/");
  renderAll(data);
  showNotice("");
}

function collectProducts() {
  return [...document.querySelectorAll("[data-product-row]")].map((row, index) => ({
    id: row.querySelector('[data-product-field="id"]').value.trim(),
    sort_order: Number(row.querySelector('[data-product-field="sort_order"]').value || index + 1),
    name: row.querySelector('[data-product-field="name"]').value.trim(),
    badge: row.querySelector('[data-product-field="badge"]').value.trim(),
    description: row.querySelector('[data-product-field="description"]').value.trim(),
    price_usd: Number(row.querySelector('[data-product-field="price_usd"]').value || 0),
    price_cny: Number(row.querySelector('[data-product-field="price_cny"]').value || 0),
    features: row
      .querySelector('[data-product-field="features"]')
      .value.split("\n")
      .map((item) => item.trim())
      .filter(Boolean),
    active: row.querySelector('[data-product-field="active"]').checked,
  }));
}

function collectFaqs() {
  return [...document.querySelectorAll("[data-faq-row]")].map((row, index) => ({
    id: row.querySelector('[data-faq-field="id"]').value.trim() || undefined,
    sort_order: Number(row.querySelector('[data-faq-field="sort_order"]').value || index + 1),
    question: row.querySelector('[data-faq-field="question"]').value.trim(),
    answer: row.querySelector('[data-faq-field="answer"]').value.trim(),
    active: row.querySelector('[data-faq-field="active"]').checked,
  }));
}

async function saveProducts() {
  showNotice("正在保存商品...");
  const data = await api("/api/admin-data/", {
    method: "POST",
    body: JSON.stringify({ action: "save_products", products: collectProducts() }),
  });
  renderAll(data);
  showNotice("商品已保存，前台会读取最新价格和文案。");
}

async function saveFaqs() {
  showNotice("正在保存 FAQ...");
  const data = await api("/api/admin-data/", {
    method: "POST",
    body: JSON.stringify({ action: "save_faqs", faqs: collectFaqs() }),
  });
  renderAll(data);
  showNotice("FAQ 已保存。");
}

async function updateOrderStatus(orderNo) {
  const select = document.querySelector(`[data-order-status="${CSS.escape(orderNo)}"]`);
  if (!select) {
    return;
  }
  showNotice("正在更新订单状态...");
  const data = await api("/api/admin-data/", {
    method: "POST",
    body: JSON.stringify({ action: "update_order_status", orderNo, status: select.value }),
  });
  renderAll(data);
  showNotice("订单状态已更新。");
}

async function checkSession() {
  const session = await api("/api/admin-session/");
  setAuthenticated(Boolean(session.authenticated));
  if (session.authenticated) {
    await loadAdminData();
  }
}

document.addEventListener("click", async (event) => {
  const tabButton = event.target.closest("[data-tab-button]");
  const jumpTab = event.target.closest("[data-jump-tab]");
  const saveProductsButton = event.target.closest("[data-save-products]");
  const saveFaqsButton = event.target.closest("[data-save-faqs]");
  const addFaqButton = event.target.closest("[data-add-faq]");
  const refreshButton = event.target.closest("[data-refresh]");
  const logoutButton = event.target.closest("[data-logout]");
  const orderStatusButton = event.target.closest("[data-save-order-status]");

  try {
    if (tabButton) {
      switchTab(tabButton.dataset.tabButton);
    }

    if (jumpTab) {
      switchTab(jumpTab.dataset.jumpTab);
    }

    if (saveProductsButton) {
      await saveProducts();
    }

    if (saveFaqsButton) {
      await saveFaqs();
    }

    if (addFaqButton) {
      const faqs = collectFaqs();
      faqs.push({
        question: "新的常见问题",
        answer: "请在这里填写回答。",
        active: true,
        sort_order: faqs.length + 1,
      });
      renderFaqs(faqs);
    }

    if (refreshButton) {
      await loadAdminData();
    }

    if (logoutButton) {
      await api("/api/admin-logout/", { method: "POST" });
      setAuthenticated(false);
    }

    if (orderStatusButton) {
      await updateOrderStatus(orderStatusButton.dataset.saveOrderStatus);
    }
  } catch (error) {
    showNotice(error.message || "操作失败，请稍后再试。", "error");
  }
});

document.querySelector("[data-login-form]").addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = document.querySelector("[data-login-message]");
  const password = new FormData(event.currentTarget).get("password");
  message.textContent = "正在登录...";

  try {
    await api("/api/admin-login/", {
      method: "POST",
      body: JSON.stringify({ password }),
    });
    message.textContent = "";
    setAuthenticated(true);
    await loadAdminData();
  } catch (error) {
    message.textContent = error.message || "登录失败。";
  }
});

checkSession().catch((error) => {
  setAuthenticated(false);
  document.querySelector("[data-login-message]").textContent = error.message || "";
});
