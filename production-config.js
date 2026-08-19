(() => {
  "use strict";

  // The production UI and API share one Netlify origin. Authentication is
  // provided by secure Netlify Identity cookies; no provider keys belong here.
  window.DDDProductionConfig = Object.freeze({
    apiBaseUrl: window.location.origin
  });
})();
