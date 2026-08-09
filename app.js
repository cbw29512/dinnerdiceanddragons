(() => {
  "use strict";

  try {
    if (!window.DDDDiscovery) {
      throw new Error("Discovery module failed to load.");
    }
    window.DDDDiscovery.renderGames();
  } catch (error) {
    console.error("[Dinner Dice & Dragons] Unable to initialize prototype", error);
    const grid = document.querySelector("#game-grid");
    if (grid) grid.textContent = "Game previews are temporarily unavailable.";
  }
})();
