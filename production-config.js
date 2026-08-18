(() => {
  "use strict";

  // Public browser configuration only. Do not place secrets in this file.
  // Authentication credentials/tokens remain runtime state; provider/admin secrets stay server-side.
  window.DDDProductionConfig = Object.freeze({
    apiBaseUrl: "https://dinnerdiceanddragons.vercel.app",
    supabaseUrl: "https://acpjfycmwbnxzlkvoouv.supabase.co",
    supabasePublishableKey: "sb_publishable_9V6jr7CdScW56IygolKgJQ_ul5v3pBb"
  });
})();
