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

function renderProduct(product) {
  const card = document.querySelector(`[data-home-product="${CSS.escape(product.id)}"]`);
  if (!card) {
    return;
  }

  const features = Array.isArray(product.features) ? product.features : [];
  card.querySelector("[data-product-badge]").textContent = product.badge || "";
  card.querySelector("[data-product-name]").textContent = product.name || "";
  card.querySelector("[data-product-description]").textContent = product.description || "";
  card.querySelector("[data-product-usd]").textContent = formatMoney(product.price_usd, "$");
  card.querySelector("[data-product-cny]").textContent = formatMoney(product.price_cny, "人民币 ¥");
  card.querySelector("[data-product-features]").innerHTML = features
    .map((feature) => `<li>${escapeHtml(feature)}</li>`)
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
    (data.products || []).forEach(renderProduct);
    renderFaqs(data.faqs || []);
  } catch (error) {
    // Keep the static fallback content if the API is unavailable.
  }
}

loadSiteData();
