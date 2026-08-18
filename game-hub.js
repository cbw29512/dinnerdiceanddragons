(() => {
  "use strict";

  try {
    window.DDDGameHubActions.initialize();
  } catch (error) {
    window.DDDGameHubRuntime?.handleApiError(error, "Game Hub could not initialize.");
  }
})();
