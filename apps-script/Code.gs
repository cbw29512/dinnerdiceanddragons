function doGet(e) {
  try {
    const action = String((e && e.parameter && e.parameter.action) || "health");
    if (action === "health") return json_({ ok:true, service:"Dinner Dice & Dragons Pilot API" });
    if (action === "games.list") return json_({ ok:true, games:listPublicGames_() });
    if (action === "demand.summary") return json_({ ok:true, demand:listDemandSummary_() });
    return json_({ ok:false, error:"Unknown action" });
  } catch (error) {
    console.error("[DDD] doGet failed", error);
    return json_({ ok:false, error:"Request failed" });
  }
}

function doPost(e) {
  let lock = null;
  try {
    const request = parseRequest_(e);
    const action = String(request.action || "");
    const payload = request.payload || {};
    validateHoneypot_(payload);

    if (action === "match.query") return json_(tableMatchQuery_(payload));

    assertWritesEnabled_();
    lock = LockService.getScriptLock();
    lock.waitLock(10000);

    if (action === "player.save") return json_(savePlayerProfile_(payload));
    if (action === "gm.save") return json_(saveGMProfile_(payload));
    if (action === "game.save") return json_(saveGame_(payload));
    if (action === "game.join") return json_(joinGame_(payload));

    return json_({ ok:false, error:"Unknown action" });
  } catch (error) {
    console.error("[DDD] doPost failed", error);
    return json_({ ok:false, error:String(error && error.message ? error.message : "Request failed") });
  } finally {
    try {
      if (lock && lock.hasLock()) lock.releaseLock();
    } catch (error) {
      console.error("[DDD] lock release failed", error);
    }
  }
}

function parseRequest_(e) {
  try {
    const raw = e && e.postData ? e.postData.contents : "{}";
    const parsed = JSON.parse(raw || "{}");
    if (!parsed || typeof parsed !== "object") throw new Error("Invalid request body");
    return parsed;
  } catch (error) {
    console.error("[DDD] parseRequest_ failed", error);
    throw new Error("Invalid JSON request");
  }
}

function validateHoneypot_(payload) {
  try {
    if (payload && payload.website) throw new Error("Request rejected");
  } catch (error) {
    console.error("[DDD] validateHoneypot_ failed", error);
    throw error;
  }
}

function json_(value) {
  try {
    return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    console.error("[DDD] json_ failed", error);
    throw error;
  }
}
