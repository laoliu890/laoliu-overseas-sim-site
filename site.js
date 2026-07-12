function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatMoney(value, prefix) {
  const number = Number(value || 0);
  return `${prefix}${Number.isInteger(number) ? number : number.toFixed(2)}`;
}

function renderProducts(products) {
  const grid = document.querySelector(".product-grid");
  const activeProducts = Array.isArray(products) ? products.filter((product) => product.active !== false) : [];
  if (!grid || !activeProducts.length) {
    return;
  }

  grid.innerHTML = activeProducts
    .map((product, index) => {
      const features = Array.isArray(product.features) ? product.features : [];
      return `
        <article class="product-card ${index === 0 ? "featured" : ""}" data-home-product="${escapeHtml(product.id)}">
          <span class="product-badge">${escapeHtml(product.badge || "推荐产品")}</span>
          <h3>${escapeHtml(product.name || "未命名商品")}</h3>
          <p>${escapeHtml(product.description || "")}</p>
          <ul>
            ${features.map((feature) => `<li>${escapeHtml(feature)}</li>`).join("")}
          </ul>
          <div class="product-bottom">
            <div>
              <strong>${formatMoney(product.price_usd, "$")}</strong>
              <small>${formatMoney(product.price_cny, "人民币 ¥")}</small>
            </div>
            <a href="/cart/?product=${encodeURIComponent(product.id)}">加入购物车</a>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderFaqs(faqs) {
  const list = document.querySelector("[data-faq-list]");
  const activeFaqs = Array.isArray(faqs) ? faqs.filter((faq) => faq.question && faq.answer) : [];
  if (!list || !activeFaqs.length) {
    return;
  }

  list.innerHTML = activeFaqs
    .map(
      (faq, index) => `
        <details ${index === 0 ? "open" : ""}>
          <summary>${escapeHtml(faq.question)}</summary>
          <p>${escapeHtml(faq.answer)}</p>
        </details>
      `,
    )
    .join("");
}

async function loadSiteData() {
  try {
    const response = await fetch("/api/site-data/", { cache: "no-store" });
    if (!response.ok) {
      return;
    }
    const data = await response.json();
    renderProducts(data.products || []);
    renderFaqs(data.faqs || []);
  } catch (error) {
    // Keep the static fallback content if the API is unavailable.
  }
}

document.addEventListener("click", (event) => {
  const closeButton = event.target.closest("[data-floating-contact-close]");
  if (!closeButton) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  const floatingContact = closeButton.closest(".floating-contact");
  if (floatingContact) {
    floatingContact.removeAttribute("open");
  }
});

const floatingContact = document.querySelector(".floating-contact");
if (floatingContact) {
  let scrollFadeTimer;

  const updateFloatingContactScrollState = () => {
    if (!window.matchMedia("(max-width: 720px)").matches || floatingContact.open) {
      floatingContact.classList.remove("is-scrolling");
      return;
    }

    floatingContact.classList.add("is-scrolling");
    window.clearTimeout(scrollFadeTimer);
    scrollFadeTimer = window.setTimeout(() => {
      floatingContact.classList.remove("is-scrolling");
    }, 420);
  };

  window.addEventListener("scroll", updateFloatingContactScrollState, { passive: true });
  floatingContact.addEventListener("toggle", () => {
    if (floatingContact.open) {
      floatingContact.classList.remove("is-scrolling");
    }
  });
}

loadSiteData();
