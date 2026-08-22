const LOOKUP_DELAY_MS = 180;

function cleanZip(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 5);
}

async function lookupPostalCode(zip) {
  const response = await fetch(`/.netlify/functions/postal-lookup?zip=${encodeURIComponent(zip)}`, {
    method: "GET",
    credentials: "same-origin",
    headers: { Accept: "application/json" }
  });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = null; }
  if (!response.ok) throw new Error(body?.detail || "ZIP lookup is temporarily unavailable.");
  if (!body?.city || !/^[A-Z]{2}$/.test(String(body?.state || ""))) {
    throw new Error("ZIP lookup returned incomplete location information.");
  }
  return { city: String(body.city).trim(), state: String(body.state).trim().toUpperCase() };
}

export function installVenuePostalLookup(form, announce) {
  const zipField = form?.elements?.postal_code;
  const cityField = form?.elements?.city;
  const stateField = form?.elements?.state;
  if (!zipField || !cityField || !stateField || typeof announce !== "function") return;

  let timer = null;
  let sequence = 0;
  let lastResolvedZip = "";

  const run = async () => {
    const zip = cleanZip(zipField.value);
    zipField.value = zip;
    if (zip.length !== 5 || zip === lastResolvedZip) return;

    const requestSequence = ++sequence;
    announce("venue-details-status", "Finding City and State from ZIP…", true);
    try {
      const place = await lookupPostalCode(zip);
      if (requestSequence !== sequence || cleanZip(zipField.value) !== zip) return;
      cityField.value = place.city;
      stateField.value = place.state;
      cityField.removeAttribute("aria-invalid");
      stateField.removeAttribute("aria-invalid");
      lastResolvedZip = zip;
      announce("venue-details-status", `${place.city}, ${place.state} filled from ZIP. You can edit either field if needed.`, true);
    } catch (error) {
      if (requestSequence !== sequence) return;
      lastResolvedZip = "";
      announce("venue-details-status", "ZIP lookup is unavailable. Enter City and State manually, then continue.");
      console.warn("[DDD Venue Location] ZIP lookup failed", { message: String(error?.message || error) });
    }
  };

  const schedule = () => {
    const zip = cleanZip(zipField.value);
    zipField.value = zip;
    sequence += 1;
    if (timer) clearTimeout(timer);
    if (zip.length !== 5) {
      lastResolvedZip = "";
      return;
    }
    timer = setTimeout(() => void run(), LOOKUP_DELAY_MS);
  };

  zipField.addEventListener("input", schedule);
  zipField.addEventListener("change", () => void run());
  if (cleanZip(zipField.value).length === 5) timer = setTimeout(() => void run(), 0);
}
