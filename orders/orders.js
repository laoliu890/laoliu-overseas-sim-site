function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMoney(value) {
  return `¥${Number(value || 0).toLocaleString("zh-CN", { maximumFractionDigits: 2 })}`;
}

function renderOrder(order) {
  const items = Array.isArray(order.items) ? order.items : [];
  const logisticsReady = order.logisticsStatus || order.logisticsImageData;
  const logisticsImage = order.logisticsImageData
    ? `
      <figure class="logistics-image">
        <img src="${escapeHtml(order.logisticsImageData)}" alt="物流凭证图片" loading="lazy" decoding="async">
        <figcaption>物流凭证图片${order.logisticsImageUpdatedAt ? ` · ${formatDate(order.logisticsImageUpdatedAt)}` : ""}</figcaption>
      </figure>
    `
    : "";

  return `
    <article class="order-result-card">
      <div class="order-result-head">
        <div>
          <span>订单号</span>
          <strong>${escapeHtml(order.orderNo || "-")}</strong>
        </div>
        <em>${escapeHtml(order.logisticsStatusLabel || "待更新")}</em>
      </div>

      <div class="order-result-grid">
        <div><span>订单状态</span><strong>${escapeHtml(order.paymentStatusLabel || "-")}</strong></div>
        <div><span>订单金额</span><strong>${formatMoney(order.amountCny)}</strong></div>
        <div><span>下单时间</span><strong>${formatDate(order.createdAt)}</strong></div>
        <div><span>收件城市</span><strong>${escapeHtml(order.destination || "-")}</strong></div>
      </div>

      <div class="order-items-list">
        <span>商品明细</span>
        ${
          items.length
            ? items.map((item) => `<p>${escapeHtml(item.productName)} × ${escapeHtml(item.quantity)}</p>`).join("")
            : "<p>暂无商品明细</p>"
        }
      </div>

      <div class="logistics-box ${logisticsReady ? "" : "is-empty"}">
        <h3>物流信息</h3>
        <dl>
          <div><dt>物流状态</dt><dd>${escapeHtml(order.logisticsStatusLabel || "待更新")}</dd></div>
          <div><dt>更新时间</dt><dd>${formatDate(order.logisticsUpdatedAt || order.logisticsImageUpdatedAt || order.shippedAt)}</dd></div>
        </dl>
        <p>${order.logisticsImageData ? "物流图片如下，请以图片中的快递信息为准。" : "客服上传物流图片后，你可以在这里查看发货凭证。"}</p>
        ${logisticsImage}
      </div>
    </article>
  `;
}

function renderEmpty(message) {
  return `
    <div class="order-empty-state">
      <h2>没有查询到订单</h2>
      <p>${escapeHtml(message || "请确认手机号是否为下单时填写的号码，或稍后再试。")}</p>
    </div>
  `;
}

const form = document.querySelector("[data-order-lookup-form]");
const message = document.querySelector("[data-order-lookup-message]");
const results = document.querySelector("[data-order-results]");

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = form.querySelector("button");
  const phone = new FormData(form).get("phone");

  button.disabled = true;
  button.textContent = "正在查询";
  message.textContent = "正在查询订单，请稍等...";

  try {
    const response = await fetch("/api/order-lookup/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload.message || "查询失败，请稍后重试。");
    }

    if (!payload.orders?.length) {
      results.innerHTML = renderEmpty("没有找到该手机号对应的订单。若你刚刚付款，请等待几分钟后再查。");
      message.textContent = "未查询到订单。";
      return;
    }

    results.innerHTML = payload.orders.map(renderOrder).join("");
    message.textContent = `已查询到 ${payload.orders.length} 个订单。`;
  } catch (error) {
    results.innerHTML = renderEmpty(error.message);
    message.textContent = error.message || "查询失败，请稍后重试。";
  } finally {
    button.disabled = false;
    button.textContent = "查询订单";
  }
});
