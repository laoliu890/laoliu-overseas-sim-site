const state = {
  data: {
    products: [],
    faqs: [],
    orders: [],
    stats: {},
  },
  productDrafts: [],
  selectedProductId: "",
  productSearch: "",
  productStatus: "all",
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

function logisticsStatusLabel(status) {
  const labels = {
    pending: "待处理",
    preparing: "备货中",
    shipped: "已发货",
    delivered: "已签收",
    exception: "物流异常",
  };
  return labels[status] || status || "待更新";
}

function readImageDimensions(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("图片读取失败，请重新选择。"));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("图片格式无法识别，请上传 JPG、PNG 或 WebP。"));
      image.onload = () => resolve(image);
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function compressLogisticsImage(file) {
  if (!file) {
    return "";
  }

  if (!file.type.startsWith("image/")) {
    throw new Error("请上传物流图片文件。");
  }

  if (file.size > 8 * 1024 * 1024) {
    throw new Error("图片不能超过 8MB，请先裁剪或压缩后再上传。");
  }

  const image = await readImageDimensions(file);
  const maxSize = 1200;
  const ratio = Math.min(1, maxSize / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * ratio));
  canvas.height = Math.max(1, Math.round(image.height * ratio));

  const context = canvas.getContext("2d");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const qualities = [0.78, 0.68, 0.58, 0.48];
  let dataUrl = "";
  for (const quality of qualities) {
    dataUrl = canvas.toDataURL("image/jpeg", quality);
    if (dataUrl.length <= 1_150_000) {
      return dataUrl;
    }
  }

  throw new Error("图片压缩后仍然过大，请换一张更小的物流截图。");
}

function statusClass(status) {
  return `status-pill status-${escapeHtml(status || "pending")}`;
}

function setTrackingImagePreview(orderNo, file) {
  const block = document.querySelector(`[data-tracking-dropzone="${CSS.escape(orderNo)}"]`);
  if (!block || !file) {
    return;
  }

  const url = URL.createObjectURL(file);
  block.innerHTML = `<img src="${url}" alt="待上传物流图片">`;
  const image = block.querySelector("img");
  image.addEventListener(
    "load",
    () => {
      URL.revokeObjectURL(url);
    },
    { once: true },
  );
}

function cloneProducts(products = []) {
  return products.map((product) => ({
    ...product,
    features: Array.isArray(product.features) ? [...product.features] : [],
  }));
}

function slugifyProductName(value) {
  const base = String(value || "product")
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 28);
  return base || `product-${Date.now()}`;
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
              <div class="tracking-editor">
                <label>
                  <span>快递公司</span>
                  <input data-tracking-company="${escapeHtml(order.order_no)}" type="text" maxlength="80" value="${escapeHtml(order.logistics_company || "")}" placeholder="例如：申通快递">
                </label>
                <label>
                  <span>快递单号</span>
                  <input data-tracking-no="${escapeHtml(order.order_no)}" type="text" maxlength="80" value="${escapeHtml(order.logistics_no || "")}" placeholder="请输入快递单号">
                </label>
                <label>
                  <span>物流状态</span>
                  <select data-tracking-status="${escapeHtml(order.order_no)}">
                    ${["pending", "preparing", "shipped", "delivered", "exception"]
                      .map(
                        (item) =>
                          `<option value="${item}" ${item === (order.logistics_status || "pending") ? "selected" : ""}>${logisticsStatusLabel(item)}</option>`,
                      )
                      .join("")}
                  </select>
                </label>
                <div class="tracking-image-block" data-tracking-dropzone="${escapeHtml(order.order_no)}" tabindex="0" role="button" aria-label="拖拽物流图片到这里上传">
                  ${
                    order.logistics_image_data
                      ? `<img src="${escapeHtml(order.logistics_image_data)}" alt="当前物流图片">`
                      : '<span class="muted-text">暂无物流图片<br><small>可直接拖拽图片到这里</small></span>'
                  }
                </div>
                <label>
                  <span>物流图片</span>
                  <input data-tracking-image="${escapeHtml(order.order_no)}" type="file" accept="image/png,image/jpeg,image/webp,image/*">
                </label>
                ${
                  order.logistics_image_data
                    ? `
                      <label class="tracking-clear-image">
                        <input data-tracking-image-clear="${escapeHtml(order.order_no)}" type="checkbox">
                        <span>清除当前物流图片</span>
                      </label>
                    `
                    : ""
                }
                <button type="button" data-save-order-tracking="${escapeHtml(order.order_no)}">保存物流</button>
                <p class="tracking-message" data-tracking-message="${escapeHtml(order.order_no)}" aria-live="polite"></p>
              </div>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function productMatchesFilter(product) {
  const keyword = state.productSearch.trim().toLowerCase();
  const statusOk =
    state.productStatus === "all" ||
    (state.productStatus === "active" && product.active !== false) ||
    (state.productStatus === "inactive" && product.active === false);
  const haystack = [product.id, product.name, product.badge, product.description, ...(product.features || [])]
    .join(" ")
    .toLowerCase();
  return statusOk && (!keyword || haystack.includes(keyword));
}

function renderProductCatalog() {
  const table = document.querySelector("[data-product-table]");
  const summary = document.querySelector("[data-product-summary]");
  if (!table) {
    return;
  }

  const filtered = state.productDrafts.filter(productMatchesFilter).sort((a, b) => {
    return Number(a.sort_order || 0) - Number(b.sort_order || 0);
  });

  if (summary) {
    const activeCount = state.productDrafts.filter((product) => product.active !== false).length;
    summary.textContent = `${filtered.length} 个结果 · ${activeCount} 个上架 · ${state.productDrafts.length} 个总商品`;
  }

  if (!filtered.length) {
    table.innerHTML = '<div class="empty-state">没有匹配的商品，可以调整搜索条件或新增商品。</div>';
    return;
  }

  table.innerHTML = filtered
    .map(
      (product) => `
        <button class="product-row ${product.id === state.selectedProductId ? "active" : ""}" type="button" data-select-product="${escapeHtml(product.id)}">
          <div class="product-row-main">
            <div class="product-row-title">
              <strong>${escapeHtml(product.name || "未命名商品")}</strong>
              <span>${escapeHtml(product.id)}</span>
            </div>
            <span class="${product.active === false ? "status-inactive" : "status-active"}">${product.active === false ? "下架" : "上架"}</span>
          </div>
          <div class="product-row-meta">
            <span>${formatCny(product.price_cny)}</span>
            <span>$${escapeHtml(product.price_usd || 0)}</span>
            <span>排序 ${escapeHtml(product.sort_order || "-")}</span>
          </div>
        </button>
      `,
    )
    .join("");
}

function syncSelectedProductFromEditor() {
  const form = document.querySelector("[data-product-edit-form]");
  if (!form || !state.selectedProductId) {
    return;
  }

  const product = state.productDrafts.find((item) => item.id === state.selectedProductId);
  if (!product) {
    return;
  }

  product.id = form.querySelector('[data-product-field="id"]').value.trim();
  product.sort_order = Number(form.querySelector('[data-product-field="sort_order"]').value || 0);
  product.name = form.querySelector('[data-product-field="name"]').value.trim();
  product.badge = form.querySelector('[data-product-field="badge"]').value.trim();
  product.description = form.querySelector('[data-product-field="description"]').value.trim();
  product.price_usd = Number(form.querySelector('[data-product-field="price_usd"]').value || 0);
  product.price_cny = Number(form.querySelector('[data-product-field="price_cny"]').value || 0);
  product.features = form
    .querySelector('[data-product-field="features"]')
    .value.split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
  product.active = form.querySelector('[data-product-field="active"]').checked;

  if (product.id !== state.selectedProductId) {
    state.selectedProductId = product.id;
  }
}

function renderProductEditor() {
  const editor = document.querySelector("[data-product-editor]");
  if (!editor) {
    return;
  }

  const product = state.productDrafts.find((item) => item.id === state.selectedProductId);
  if (!product) {
    editor.innerHTML = '<div class="empty-state">请选择一个商品进行编辑。</div>';
    return;
  }

  editor.innerHTML = `
        <article class="editor-card" data-product-edit-form>
          <div class="editor-card-header">
            <div>
              <p class="eyebrow">Product Detail</p>
              <h3>${escapeHtml(product.name || "未命名商品")}</h3>
            </div>
            <label class="checkbox-label">
              <input type="checkbox" data-product-field="active" ${product.active !== false ? "checked" : ""}>
              <span>${product.active === false ? "下架" : "前台显示"}</span>
            </label>
          </div>
          <div class="form-grid">
            <label>
              <span>商品 ID</span>
              <input data-product-field="id" value="${escapeHtml(product.id)}" readonly>
            </label>
            <label>
              <span>排序</span>
              <input data-product-field="sort_order" type="number" value="${escapeHtml(product.sort_order || 1)}">
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
          <div class="product-actions">
            <button class="ghost-button" type="button" data-duplicate-product>复制当前商品</button>
            <button class="danger-button" type="button" data-toggle-product-active>${product.active === false ? "重新上架" : "下架商品"}</button>
          </div>
        </article>
      `;
}

function renderProducts(products = []) {
  state.productDrafts = cloneProducts(products);
  if (!state.productDrafts.some((product) => product.id === state.selectedProductId)) {
    state.selectedProductId = state.productDrafts[0]?.id || "";
  }
  renderProductCatalog();
  renderProductEditor();
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
  try {
    const data = await api("/api/admin-data/");
    renderAll(data);
    showNotice("");
  } catch (error) {
    showNotice(error.message || "数据库读取失败，请检查本地 Supabase 环境变量。", "error");
    throw error;
  }
}

function collectProducts() {
  syncSelectedProductFromEditor();
  return state.productDrafts
    .filter((product) => product.id && product.name)
    .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
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

function addProduct() {
  syncSelectedProductFromEditor();
  const nextIndex = state.productDrafts.length + 1;
  const id = `product-${Date.now()}`;
  state.productDrafts.push({
    id,
    name: `新商品 ${nextIndex}`,
    badge: "新品",
    description: "请填写商品描述。",
    price_usd: 0,
    price_cny: 0,
    features: ["请填写卖点"],
    sort_order: nextIndex,
    active: false,
  });
  state.selectedProductId = id;
  renderProductCatalog();
  renderProductEditor();
}

function duplicateSelectedProduct() {
  syncSelectedProductFromEditor();
  const product = state.productDrafts.find((item) => item.id === state.selectedProductId);
  if (!product) {
    return;
  }
  const id = `${slugifyProductName(product.name)}-${Date.now().toString().slice(-5)}`;
  state.productDrafts.push({
    ...product,
    id,
    name: `${product.name} 副本`,
    sort_order: state.productDrafts.length + 1,
    active: false,
    features: [...(product.features || [])],
  });
  state.selectedProductId = id;
  renderProductCatalog();
  renderProductEditor();
}

function toggleSelectedProductActive() {
  syncSelectedProductFromEditor();
  const product = state.productDrafts.find((item) => item.id === state.selectedProductId);
  if (!product) {
    return;
  }
  product.active = product.active === false;
  renderProductCatalog();
  renderProductEditor();
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

async function updateOrderTracking(orderNo) {
  const saveButton = document.querySelector(`[data-save-order-tracking="${CSS.escape(orderNo)}"]`);
  const localMessage = document.querySelector(`[data-tracking-message="${CSS.escape(orderNo)}"]`);
  const company = document.querySelector(`[data-tracking-company="${CSS.escape(orderNo)}"]`);
  const trackingNo = document.querySelector(`[data-tracking-no="${CSS.escape(orderNo)}"]`);
  const status = document.querySelector(`[data-tracking-status="${CSS.escape(orderNo)}"]`);
  const imageInput = document.querySelector(`[data-tracking-image="${CSS.escape(orderNo)}"]`);
  const clearImage = document.querySelector(`[data-tracking-image-clear="${CSS.escape(orderNo)}"]`);
  if (!status) {
    return;
  }

  const originalButtonText = saveButton?.textContent || "保存物流";

  try {
    if (saveButton) {
      saveButton.disabled = true;
      saveButton.textContent = "正在保存...";
    }
    if (localMessage) {
      localMessage.dataset.type = "info";
      localMessage.textContent = "正在保存物流信息...";
    }

    const payload = {
      action: "update_order_tracking",
      orderNo,
      logisticsCompany: company?.value || "",
      logisticsNo: trackingNo?.value || "",
      logisticsStatus: status.value,
    };

    if (clearImage?.checked) {
      payload.clearLogisticsImage = true;
    }

    if (imageInput?.files?.[0]) {
      showNotice("正在压缩物流图片...");
      if (localMessage) {
        localMessage.dataset.type = "info";
        localMessage.textContent = "正在压缩物流图片...";
      }
      payload.logisticsImageData = await compressLogisticsImage(imageInput.files[0]);
      payload.clearLogisticsImage = false;
    }

    showNotice("正在保存物流信息...");
    const data = await api("/api/admin-data/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    renderAll(data);
    showNotice("物流信息已保存，用户可在前台按手机号查询。");
    const refreshedMessage = document.querySelector(`[data-tracking-message="${CSS.escape(orderNo)}"]`);
    if (refreshedMessage) {
      refreshedMessage.dataset.type = "success";
      refreshedMessage.textContent = "保存成功，用户现在可以在订单查询页看到最新物流状态。";
    }
  } catch (error) {
    const message = error.message?.includes("logistics_status")
      ? "数据库还没有物流字段。请先在 Supabase SQL Editor 执行 supabase/order_tracking_fields.sql。"
      : error.message || "物流保存失败。";
    showNotice(message, "error");
    if (localMessage) {
      localMessage.dataset.type = "error";
      localMessage.textContent = message;
    }
    window.alert(message);
  } finally {
    if (saveButton) {
      saveButton.disabled = false;
      saveButton.textContent = originalButtonText;
    }
  }
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
  const addProductButton = event.target.closest("[data-add-product]");
  const selectProductButton = event.target.closest("[data-select-product]");
  const duplicateProductButton = event.target.closest("[data-duplicate-product]");
  const toggleProductButton = event.target.closest("[data-toggle-product-active]");
  const saveFaqsButton = event.target.closest("[data-save-faqs]");
  const addFaqButton = event.target.closest("[data-add-faq]");
  const refreshButton = event.target.closest("[data-refresh]");
  const logoutButton = event.target.closest("[data-logout]");
  const orderStatusButton = event.target.closest("[data-save-order-status]");
  const orderTrackingButton = event.target.closest("[data-save-order-tracking]");
  const trackingDropzone = event.target.closest("[data-tracking-dropzone]");

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

    if (addProductButton) {
      addProduct();
    }

    if (selectProductButton) {
      syncSelectedProductFromEditor();
      state.selectedProductId = selectProductButton.dataset.selectProduct;
      renderProductCatalog();
      renderProductEditor();
    }

    if (duplicateProductButton) {
      duplicateSelectedProduct();
    }

    if (toggleProductButton) {
      toggleSelectedProductActive();
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

    if (orderTrackingButton) {
      await updateOrderTracking(orderTrackingButton.dataset.saveOrderTracking);
    }

    if (trackingDropzone) {
      const imageInput = document.querySelector(`[data-tracking-image="${CSS.escape(trackingDropzone.dataset.trackingDropzone)}"]`);
      imageInput?.click();
    }
  } catch (error) {
    showNotice(error.message || "操作失败，请稍后再试。", "error");
  }
});

document.addEventListener("input", (event) => {
  if (event.target.matches("[data-product-search]")) {
    state.productSearch = event.target.value;
    renderProductCatalog();
  }

  if (event.target.closest("[data-product-edit-form]")) {
    syncSelectedProductFromEditor();
    renderProductCatalog();
  }
});

document.addEventListener("change", (event) => {
  if (event.target.matches("[data-product-status-filter]")) {
    state.productStatus = event.target.value;
    renderProductCatalog();
  }

  if (event.target.matches("[data-tracking-image]")) {
    const file = event.target.files?.[0];
    if (file) {
      setTrackingImagePreview(event.target.dataset.trackingImage, file);
    }
  }

  if (event.target.closest("[data-product-edit-form]")) {
    syncSelectedProductFromEditor();
    renderProductCatalog();
  }
});

document.addEventListener("dragover", (event) => {
  const dropzone = event.target.closest("[data-tracking-dropzone]");
  if (!dropzone) {
    return;
  }

  event.preventDefault();
  dropzone.classList.add("dragging");
});

document.addEventListener("dragleave", (event) => {
  const dropzone = event.target.closest("[data-tracking-dropzone]");
  if (!dropzone || dropzone.contains(event.relatedTarget)) {
    return;
  }

  dropzone.classList.remove("dragging");
});

document.addEventListener("drop", (event) => {
  const dropzone = event.target.closest("[data-tracking-dropzone]");
  if (!dropzone) {
    return;
  }

  event.preventDefault();
  dropzone.classList.remove("dragging");

  const file = [...(event.dataTransfer?.files || [])].find((item) => item.type.startsWith("image/"));
  if (!file) {
    showNotice("请拖入图片文件。", "error");
    return;
  }

  const orderNo = dropzone.dataset.trackingDropzone;
  const imageInput = document.querySelector(`[data-tracking-image="${CSS.escape(orderNo)}"]`);
  if (!imageInput) {
    return;
  }

  const transfer = new DataTransfer();
  transfer.items.add(file);
  imageInput.files = transfer.files;
  setTrackingImagePreview(orderNo, file);
  showNotice("物流图片已导入，点击“保存物流”后生效。");
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
    if (adminApp && !adminApp.hidden) {
      showNotice(error.message || "数据库读取失败，请检查本地 Supabase 环境变量。", "error");
    }
  }
});

checkSession().catch((error) => {
  setAuthenticated(false);
  document.querySelector("[data-login-message]").textContent = error.message || "";
});
