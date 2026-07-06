const itemsRoot = document.querySelector(".cart-list");
const toast = document.querySelector("[data-toast]");
let toastTimer;

function formatUsd(value) {
  return `$${value}`;
}

function formatCny(value) {
  return `人民币 ¥${value}`;
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

async function createPayment() {
  const checkoutButton = document.querySelector("#checkout");
  const method = document.querySelector('input[name="payment_method"]:checked')?.value;
  const items = getCartItems().filter((item) => item.quantity > 0);

  if (!items.length) {
    showToast("请先选择至少一件商品。");
    return;
  }

  checkoutButton.disabled = true;
  checkoutButton.dataset.loading = "true";
  checkoutButton.lastChild.textContent = " 正在创建订单";

  try {
    const response = await fetch("/api/create-payment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ method, items }),
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
    checkoutButton.lastChild.textContent = " 去结算";
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

document.addEventListener("click", (event) => {
  const increase = event.target.closest("[data-increase]");
  const decrease = event.target.closest("[data-decrease]");
  const remove = event.target.closest("[data-remove]");
  const checkout = event.target.closest("#checkout");

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
    createPayment();
  }
});

updateCart();
