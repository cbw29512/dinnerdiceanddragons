const FIELD_NAMES = Object.freeze([
  "availability_day", "availability_start", "availability_end", "availability_pattern",
  "availability_week_interval", "availability_anchor_date",
  "availability_monthly_ordinal", "availability_month_interval"
]);

export function collectLegacyFields(container) {
  try {
    const values = {};
    for (const name of FIELD_NAMES) {
      values[name] = [...container.querySelectorAll(`[name="${name}[]"]`)].map((input) => input.value);
    }
    return values;
  } catch (error) {
    console.error("[DDD Calendar] Unable to read legacy availability fields", error);
    throw error;
  }
}

export function syncLegacyInputs(container, fields) {
  try {
    if (!(container instanceof Element)) throw new TypeError("A DOM container is required.");
    container.replaceChildren();
    for (const name of FIELD_NAMES) {
      const values = Array.isArray(fields?.[name]) ? fields[name] : [];
      for (const value of values) {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = `${name}[]`;
        input.value = String(value ?? "");
        container.append(input);
      }
    }
  } catch (error) {
    console.error("[DDD Calendar] Unable to synchronize legacy form inputs", error);
    throw error;
  }
}
