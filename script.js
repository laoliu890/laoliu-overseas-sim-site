const itemsRoot = document.querySelector(".cart-list");
const toast = document.querySelector("[data-toast]");
let toastTimer;

function formatUsd(value) {
  const number = Number(value || 0);
  return `$${Number.isInteger(number) ? number : number.toFixed(2)}`;
}

function formatCny(value) {
  const number = Number(value || 0);
  return `人民币 ¥${Number.isInteger(number) ? number : number.toFixed(2)}`;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
}

function getCartItems() {
  return [...document.querySelectorAll("[data-cart-item]")].map((item) => ({
    id: item.dataset.productId,
    quantity: Number(item.querySelector("[data-qty]").textContent),
  }));
}

function getShippingInfo() {
  const form = document.querySelector(".checkout-form");
  if (!form) {
    return null;
  }

  const data = new FormData(form);
  return {
    receiverName: String(data.get("receiverName") || "").trim(),
    receiverPhone: String(data.get("receiverPhone") || "").trim(),
    wechat: String(data.get("wechat") || "").trim(),
    province: String(data.get("province") || "").trim(),
    city: String(data.get("city") || "").trim(),
    address: String(data.get("address") || "").trim(),
    note: String(data.get("note") || "").trim(),
  };
}

function validateShippingInfo(info) {
  const requiredFields = [
    ["receiverName", "请填写收件人姓名。"],
    ["receiverPhone", "请填写收货手机号。"],
    ["province", "请填写收货省份。"],
    ["city", "请填写收货城市。"],
    ["address", "请填写详细收货地址。"],
  ];

  for (const [field, message] of requiredFields) {
    if (!info?.[field]) {
      return message;
    }
  }

  if (!/^1[3-9]\d{9}$/.test(info.receiverPhone.replace(/\s+/g, ""))) {
    return "请填写正确的 11 位中国大陆手机号。";
  }

  if (info.address.length < 8) {
    return "详细地址太短，请补充区县、街道和门牌号。";
  }

  return "";
}

function openCheckout() {
  const items = getCartItems().filter((item) => item.quantity > 0);

  if (!items.length) {
    showToast("请先选择至少一件商品。");
    return;
  }

  const modal = document.querySelector("[data-checkout-modal]");
  modal?.classList.add("open");
  modal?.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  setTimeout(() => document.querySelector('.checkout-form input[name="receiverName"]')?.focus(), 80);
}

function closeCheckout() {
  const modal = document.querySelector("[data-checkout-modal]");
  modal?.classList.remove("open");
  modal?.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

async function createPayment() {
  const checkoutButton = document.querySelector("#confirm-checkout");
  const checkoutLabel = checkoutButton?.querySelector("[data-checkout-label]");
  const method = document.querySelector('input[name="payment_method"]:checked')?.value;
  const items = getCartItems().filter((item) => item.quantity > 0);
  const shipping = getShippingInfo();
  const shippingError = validateShippingInfo(shipping);

  if (!items.length) {
    showToast("请先选择至少一件商品。");
    return;
  }

  if (shippingError) {
    showToast(shippingError);
    document.querySelector(".checkout-form input:invalid, .checkout-form textarea:invalid")?.focus();
    return;
  }

  checkoutButton.disabled = true;
  checkoutButton.dataset.loading = "true";
  checkoutLabel.textContent = "正在创建订单";

  try {
    const response = await fetch("/api/create-payment/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ method, items, shipping }),
    });
    const result = await response.json();

    if (!response.ok || !result.paymentUrl) {
      throw new Error(result.message || "支付通道暂未配置完成。");
    }

    window.location.href = result.paymentUrl;
  } catch (error) {
    showToast(error.message || "创建支付订单失败，请稍后再试。");
  } finally {
    checkoutButton.disabled = false;
    checkoutButton.dataset.loading = "false";
    checkoutLabel.textContent = "确认并支付";
  }
}

function updateCart() {
  const items = [...document.querySelectorAll("[data-cart-item]")];
  let subtotalUsd = 0;
  let subtotalCny = 0;
  let count = 0;

  items.forEach((item) => {
    const qty = Number(item.querySelector("[data-qty]").textContent);
    const priceUsd = Number(item.dataset.priceUsd);
    const priceCny = Number(item.dataset.priceCny);
    const lineUsd = qty * priceUsd;
    const lineCny = qty * priceCny;

    subtotalUsd += lineUsd;
    subtotalCny += lineCny;
    count += qty;

    item.querySelector("[data-line-usd]").textContent = formatUsd(lineUsd);
    item.querySelector("[data-line-cny]").textContent = formatCny(lineCny);
    item.querySelector("[data-decrease]").disabled = qty <= 0;
  });

  document.querySelector("[data-subtotal-usd]").textContent = formatUsd(subtotalUsd);
  document.querySelector("[data-total-usd]").textContent = formatUsd(subtotalUsd);
  document.querySelector("[data-total-cny]").textContent = formatCny(subtotalCny);
  document.querySelector("[data-modal-total-usd]").textContent = formatUsd(subtotalUsd);
  document.querySelector("[data-modal-total-cny]").textContent = formatCny(subtotalCny);
  document.querySelector("[data-cart-count]").textContent = count;

  if (!items.length) {
    itemsRoot.innerHTML = `
      <article class="cart-card">
        <div class="product-copy">
          <div class="product-icon">
            <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="9" cy="20" r="1.6"></circle>
              <circle cx="17" cy="20" r="1.6"></circle>
              <path d="M3 4h2l2.2 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 1.9-1.4L21 8H6"></path>
            </svg>
          </div>
          <div>
            <span class="eyebrow">Cart empty</span>
            <h2>购物车暂无商品</h2>
            <p>你可以继续选择套餐，或联系老六确认订单与付款方式。</p>
          </div>
        </div>
      </article>
    `;
  }
}

function applyProductData(products) {
  if (!Array.isArray(products)) {
    return;
  }

  products.forEach((product) => {
    const item = document.querySelector(`[data-cart-item][data-product-id="${CSS.escape(product.id)}"]`);
    if (!item) {
      return;
    }

    item.dataset.priceUsd = String(product.price_usd || 0);
    item.dataset.priceCny = String(product.price_cny || 0);
    item.querySelector(".eyebrow").textContent = product.badge || "";
    item.querySelector("h2").textContent = product.name || "";
    item.querySelector(".product-copy p").textContent = product.description || "";
    item.querySelector("[data-remove]").setAttribute("aria-label", `移除 ${product.name || "商品"}`);
  });
}

async function initCart() {
  try {
    const response = await fetch("/api/site-data/", { cache: "no-store" });
    if (response.ok) {
      const data = await response.json();
      applyProductData(data.products || []);
    }
  } catch (error) {
    // Use the static cart defaults if the site data API is unavailable.
  }

  updateCart();
}

document.addEventListener("click", (event) => {
  const increase = event.target.closest("[data-increase]");
  const decrease = event.target.closest("[data-decrease]");
  const remove = event.target.closest("[data-remove]");
  const checkout = event.target.closest("#checkout");
  const closeModal = event.target.closest("[data-close-checkout]");

  if (increase || decrease) {
    const item = event.target.closest("[data-cart-item]");
    const qtyNode = item.querySelector("[data-qty]");
    const current = Number(qtyNode.textContent);
    qtyNode.textContent = String(increase ? current + 1 : Math.max(0, current - 1));
    updateCart();
  }

  if (remove) {
    const item = remove.closest("[data-cart-item]");
    item.classList.add("removing");
    setTimeout(() => {
      item.remove();
      updateCart();
      showToast("已从购物车移除商品。");
    }, 190);
  }

  if (checkout) {
    openCheckout();
  }

  if (closeModal) {
    closeCheckout();
  }
});

document.addEventListener("submit", (event) => {
  if (event.target.matches(".checkout-form")) {
    event.preventDefault();
    createPayment();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeCheckout();
  }
});

initCart();
