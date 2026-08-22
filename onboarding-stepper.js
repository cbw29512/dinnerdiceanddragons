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

  function fieldLabel(field) {
    try {
      const label = field.closest("label");
      if (label) {
        const text = [...label.childNodes]
          .filter((node) => node !== field)
          .map((node) => node.textContent || "")
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
        if (text) return text;
      }
      return field.getAttribute("aria-label") || field.name || "this field";
    } catch {
      return field.name || "this field";
    }
  }

  function validate(step, status) {
    try {
      const invalid = fields(step).filter((field) => typeof field.checkValidity === "function" && !field.checkValidity());
      fields(step).forEach((field) => field.removeAttribute("aria-invalid"));
      invalid.forEach((field) => field.setAttribute("aria-invalid", "true"));
      if (!invalid.length) {
        status.textContent = "";
        return true;
      }
      const first = invalid[0];
      status.textContent = `Please review ${invalid.length} ${invalid.length === 1 ? "field" : "fields"}. Start with ${fieldLabel(first)}.`;
      first.focus();
      first.reportValidity?.();
      return false;
    } catch (error) {
      console.error("[DDD Onboarding] Unable to validate onboarding step", error);
      status.textContent = "This step could not be validated. Please review the fields and try again.";
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
      const status = element("p", "ddd-step-status");
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");
      form.prepend(status);
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
        status.textContent = "";
        back.hidden = index === 0;
        next.hidden = index === steps.length - 1;
        steps[index].scrollIntoView({ block: "nearest" });
      };
      back.addEventListener("click", () => { if (index > 0) { index -= 1; render(); } });
      next.addEventListener("click", () => {
        if (!validate(steps[index], status)) return;
        if (index < steps.length - 1) { index += 1; render(); }
      });
      form.addEventListener("input", (event) => {
        event.target?.removeAttribute?.("aria-invalid");
        if (!fields(steps[index]).some((field) => field.getAttribute("aria-invalid") === "true")) status.textContent = "";
      });
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
