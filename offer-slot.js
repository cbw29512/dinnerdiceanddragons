(() => {
  "use strict";

  // Renders the optional homepage offer from offer-config.js. Hidden unless the config is complete.
  const BLOCKED_URL = /example\.|placeholder|todo|your-|xxx/i;

  function text(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function isRenderable(config) {
    try {
      if (!config || config.enabled !== true) return false;
      if (!text(config.title) || !text(config.cta) || !text(config.disclosure)) return false;
      const url = new URL(text(config.url));
      return url.protocol === "https:" && !BLOCKED_URL.test(url.href);
    } catch {
      return false;
    }
  }

  function element(tag, className, value) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value) node.textContent = value;
    return node;
  }

  function render(slot, config) {
    const copy = element("div", "ddd-offer-copy");
    copy.append(element("p", "eyebrow", text(config.label) || "Partner offer"));
    copy.append(element("h2", "", text(config.title)));
    if (text(config.body)) copy.append(element("p", "muted", text(config.body)));
    copy.append(element("p", "ddd-offer-disclosure", text(config.disclosure)));

    const link = element("a", "button primary", text(config.cta));
    link.href = new URL(text(config.url)).href;
    link.target = "_blank";
    link.rel = "sponsored noopener noreferrer";

    slot.replaceChildren(copy, link);
    slot.hidden = false;
  }

  function init() {
    const slot = document.querySelector("[data-ddd-offer-slot]");
    if (!slot) return;
    const config = window.DDD_OFFER_CONFIG;
    if (!isRenderable(config)) {
      slot.replaceChildren();
      slot.hidden = true;
      return;
    }
    try {
      render(slot, config);
    } catch (error) {
      console.error("[Dinner Dice & Dragons] Offer slot failed to render", error);
      slot.replaceChildren();
      slot.hidden = true;
    }
  }

  window.DDDOfferSlot = Object.freeze({ isRenderable });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
