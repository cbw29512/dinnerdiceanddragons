function assertWritesEnabled_() {
  try {
    const enabled = PropertiesService.getScriptProperties().getProperty("DDD_WRITES_ENABLED");
    if (String(enabled).toLowerCase() !== "true") {
      throw new Error("Shared pilot writes are disabled");
    }
  } catch (error) {
    console.error("[DDD] write gate rejected request", error);
    throw error;
  }
}

function enablePilotWrites() {
  try {
    PropertiesService.getScriptProperties().setProperty("DDD_WRITES_ENABLED", "true");
    return { ok:true, writes_enabled:true };
  } catch (error) {
    console.error("[DDD] enablePilotWrites failed", error);
    throw error;
  }
}

function disablePilotWrites() {
  try {
    PropertiesService.getScriptProperties().setProperty("DDD_WRITES_ENABLED", "false");
    return { ok:true, writes_enabled:false };
  } catch (error) {
    console.error("[DDD] disablePilotWrites failed", error);
    throw error;
  }
}
