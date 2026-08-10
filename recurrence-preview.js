(() => {
  "use strict";

  function logError(message, error) {
    console.error(`[Dinner Dice & Dragons] ${message}`, error);
  }

  function readRule(entry) {
    try {
      return {
        day: entry.querySelector('[name="availability_day[]"]')?.value,
        start: entry.querySelector('[name="availability_start[]"]')?.value,
        end: entry.querySelector('[name="availability_end[]"]')?.value,
        pattern: entry.querySelector('[name="availability_pattern[]"]')?.value,
        weekInterval: entry.querySelector('[name="availability_week_interval[]"]')?.value,
        anchorDate: entry.querySelector('[name="availability_anchor_date[]"]')?.value,
        monthlyOrdinal: entry.querySelector('[name="availability_monthly_ordinal[]"]')?.value,
        monthInterval: entry.querySelector('[name="availability_month_interval[]"]')?.value
      };
    } catch (error) {
      logError("Unable to read recurrence rule", error);
      return {};
    }
  }

  function dateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function formatDate(date) {
    try {
      return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(date);
    } catch (error) {
      logError("Unable to format recurrence date", error);
      return dateKey(date);
    }
  }

  function loadExceptions(entry) {
    try {
      return JSON.parse(entry.dataset.exceptions || "{}");
    } catch (error) {
      logError("Unable to load recurrence exceptions", error);
      return {};
    }
  }

  function saveExceptions(entry, exceptions) {
    try {
      entry.dataset.exceptions = JSON.stringify(exceptions);
      let hidden = entry.querySelector('[name="availability_exceptions[]"]');
      if (!hidden) {
        hidden = document.createElement("input");
        hidden.type = "hidden";
        hidden.name = "availability_exceptions[]";
        entry.appendChild(hidden);
      }
      hidden.value = JSON.stringify(exceptions);
    } catch (error) {
      logError("Unable to save recurrence exceptions", error);
    }
  }

  function ensurePreview(entry) {
    let preview = entry.querySelector(".recurrence-preview");
    if (preview) return preview;
    preview = document.createElement("section");
    preview.className = "recurrence-preview";
    preview.innerHTML = `<div class="recurrence-preview-head"><strong>Next 6 dates</strong><span class="microcopy">Skip or move one date without changing the recurring rule.</span></div><div class="recurrence-date-list" aria-live="polite"></div>`;
    entry.querySelector(".remove-availability")?.before(preview);
    return preview;
  }

  function applyMove(entry, sourceKey, row) {
    try {
      const picker = row.querySelector(".move-date-input");
      if (!picker?.value) return;
      const exceptions = loadExceptions(entry);
      exceptions[sourceKey] = { action: "move", to: picker.value };
      saveExceptions(entry, exceptions);
      render(entry);
    } catch (error) {
      logError("Unable to move recurrence date", error);
    }
  }

  function render(entry) {
    try {
      const preview = ensurePreview(entry);
      const list = preview.querySelector(".recurrence-date-list");
      const engine = window.DDDRecurrence;
      if (!list || !engine) return;
      const rule = readRule(entry);
      const dates = engine.nextDates(rule, 6);
      const exceptions = loadExceptions(entry);
      list.replaceChildren();

      if (!dates.length) {
        const note = document.createElement("p");
        note.className = "microcopy";
        note.textContent = rule.pattern === "weekly" && Number(rule.weekInterval) > 1 && !rule.anchorDate
          ? "Choose an anchor date to preview this multi-week schedule."
          : "No preview dates are available yet.";
        list.appendChild(note);
        return;
      }

      dates.forEach((date) => {
        const key = dateKey(date);
        const exception = exceptions[key];
        const row = document.createElement("div");
        row.className = "recurrence-date-row";
        const label = document.createElement("div");
        label.innerHTML = `<strong>${formatDate(date)}</strong><span>${rule.start || ""}–${rule.end || ""}</span>`;
        const actions = document.createElement("div");
        actions.className = "recurrence-date-actions";

        if (exception?.action === "skip") {
          label.insertAdjacentHTML("beforeend", `<span class="recurrence-exception">Skipped</span>`);
          actions.innerHTML = `<button class="button secondary restore-date" type="button">Restore</button>`;
        } else if (exception?.action === "move") {
          label.insertAdjacentHTML("beforeend", `<span class="recurrence-exception">Moved to ${exception.to}</span>`);
          actions.innerHTML = `<button class="button secondary restore-date" type="button">Undo Move</button>`;
        } else {
          actions.innerHTML = `<button class="button secondary skip-date" type="button">Skip</button><button class="button secondary show-move" type="button">Move</button><span class="move-date-wrap" hidden><input class="move-date-input" type="date" aria-label="Move this occurrence to"><button class="button primary confirm-move" type="button">Save Move</button></span>`;
        }

        actions.querySelector(".skip-date")?.addEventListener("click", () => {
          const next = loadExceptions(entry);
          next[key] = { action: "skip" };
          saveExceptions(entry, next);
          render(entry);
        });
        actions.querySelector(".show-move")?.addEventListener("click", () => {
          const wrap = actions.querySelector(".move-date-wrap");
          if (wrap) wrap.hidden = false;
        });
        actions.querySelector(".confirm-move")?.addEventListener("click", () => applyMove(entry, key, row));
        actions.querySelector(".restore-date")?.addEventListener("click", () => {
          const next = loadExceptions(entry);
          delete next[key];
          saveExceptions(entry, next);
          render(entry);
        });

        row.append(label, actions);
        list.appendChild(row);
      });
    } catch (error) {
      logError("Unable to render recurrence preview", error);
    }
  }

  function bindEntry(entry) {
    if (entry.dataset.previewBound === "true") return;
    entry.dataset.previewBound = "true";
    entry.addEventListener("change", () => render(entry));
    render(entry);
  }

  function scan() {
    try {
      document.querySelectorAll(".availability-entry").forEach(bindEntry);
    } catch (error) {
      logError("Unable to scan recurrence entries", error);
    }
  }

  try {
    scan();
    new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
  } catch (error) {
    logError("Unable to initialize recurrence preview", error);
  }
})();
