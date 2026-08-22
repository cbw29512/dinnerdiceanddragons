(() => {
  "use strict";

  // The production UI and API share one Netlify origin. Authentication is
  // provided by secure Netlify Identity cookies; no provider keys belong here.
  window.DDDProductionConfig = Object.freeze({
    apiBaseUrl: window.location.origin
  });

  try {
    if (!document.querySelector('script[data-ddd-notifications-bootstrap]')) {
      const script = document.createElement("script");
      script.src = "global-notifications-ui.js";
      script.dataset.dddNotificationsBootstrap = "true";
      document.head.append(script);
    }
  } catch (error) {
    console.error("[DDD Config] Unable to bootstrap notification UI", error);
  }
})();
