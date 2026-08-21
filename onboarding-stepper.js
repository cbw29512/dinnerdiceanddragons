(() => {
  "use strict";

  function element(tag, className = "", text = "") {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function fields(step) {
    return [...step.querySelectorAll("input, select, textarea")].filter((field) => !field.disabled && field.type !== "hidden");
  }

  function validate(step) {
    try {
      for (const field of fields(step)) {
        if (typeof field.checkValidity === "function" && !field.checkValidity()) {
          field.setAttribute("aria-invalid", "true");
          field.focus();
          field.reportValidity?.();
          return false;
        }
      }
      return true;
    } catch (error) {
      console.error("[DDD Onboarding] Unable to validate onboarding step", error);
      return false;
    }
  }

  function nodesForHeading(heading) {
    const nodes = [];
    let node = heading;
    while (node) {
      if (node !== heading && node.nodeType === Node.ELEMENT_NODE && node.matches(".form-section-title")) break;
      nodes.push(node);
      node = node.nextSibling;
    }
    return nodes;
  }

  function buildSteps(form) {
    const headings = [...form.querySelectorAll(":scope > .form-section-title")];
    if (headings.length < 2) return [];
    const groups = headings.map((heading) => ({ heading, nodes: nodesForHeading(heading) }));
    const steps = [];
    for (const group of groups) {
      const section = element("section", "ddd-onboarding-step");
      section.dataset.stepTitle = group.heading.textContent.replace(/^\d+\.\s*/, "").trim();
      form.insertBefore(section, group.heading);
      group.nodes.forEach((node) => section.append(node));
      steps.push(section);
    }
    return steps;
  }

  function enhance(form) {
    try {
      if (form.dataset.stepperEnhanced === "true") return;
      const steps = buildSteps(form);
      if (!steps.length) return;
      let index = 0;
      const progress = element("div", "ddd-step-progress");
      progress.setAttribute("aria-live", "polite");
      form.prepend(progress);
      const controls = element("div", "ddd-step-controls");
      const back = element("button", "button secondary", "Back");
      const next = element("button", "button primary", "Continue");
      back.type = next.type = "button";
      controls.append(back, next);
      form.append(controls);

      const render = () => {
        steps.forEach((step, current) => { step.hidden = current !== index; });
        progress.textContent = `Step ${index + 1} of ${steps.length} · ${steps[index].dataset.stepTitle}`;
        back.hidden = index === 0;
        next.hidden = index === steps.length - 1;
        steps[index].scrollIntoView({ block: "nearest" });
      };
      back.addEventListener("click", () => { if (index > 0) { index -= 1; render(); } });
      next.addEventListener("click", () => {
        if (!validate(steps[index])) return;
        if (index < steps.length - 1) { index += 1; render(); }
      });
      form.addEventListener("input", (event) => event.target?.removeAttribute?.("aria-invalid"));
      form.dataset.stepperEnhanced = "true";
      render();
    } catch (error) {
      console.error("[DDD Onboarding] Unable to enhance onboarding form", error);
    }
  }

  function init() {
    try {
      document.querySelectorAll("form.prototype-form").forEach(enhance);
    } catch (error) {
      console.error("[DDD Onboarding] Unable to initialize onboarding steppers", error);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
