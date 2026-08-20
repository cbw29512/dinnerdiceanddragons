(() => {
  "use strict";

  const list = document.querySelector("#shared-games-list");
  const mode = document.querySelector("#shared-games-mode");
  const status = document.querySelector("#shared-games-status");

  function make(tag, text, className = "") {
    const node = document.createElement(tag);
    if (text !== undefined && text !== null) node.textContent = String(text);
    if (className) node.className = className;
    return node;
  }

  function renderCleanState() {
    if (!list) return;
    list.replaceChildren();
    if (mode) mode.textContent = "FORMING GAMES";

    const card = make("article", null, "status-card");
    card.appendChild(make("p", "LIVE PRODUCTION DATA", "eyebrow"));
    card.appendChild(make("h3", "No public tables have been formed yet."));
    card.appendChild(make(
      "p",
      "This site no longer shows demo games or placeholder Players. Real Player demand, DM availability, and Venue openings will create the first live tables.",
      "muted"
    ));

    const actions = make("div", null, "cta-row");
    const player = make("a", "Add a Player", "button");
    player.href = "join.html#player";
    const gm = make("a", "Add a DM / Game", "button");
    gm.href = "join.html#gm";
    const venue = make("a", "Add a Venue", "button");
    venue.href = "venues.html#signup";
    actions.append(player, gm, venue);
    card.appendChild(actions);
    list.appendChild(card);

    if (status) status.textContent = "Production is using real Netlify Database records only.";
  }

  try {
    renderCleanState();
  } catch (error) {
    console.error("[Dinner Dice & Dragons] Unable to render clean production table state", error);
    if (list) list.textContent = "Live table discovery is temporarily unavailable.";
  }
})();
