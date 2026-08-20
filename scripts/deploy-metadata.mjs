function normalizedSha(value) {
  const sha = String(value || "").trim().toLowerCase();
  return /^[0-9a-f]{40}$/.test(sha) ? sha : "";
}

export function deploymentCommit(env = process.env) {
  try {
    const commit = normalizedSha(env.COMMIT_REF) || normalizedSha(env.GITHUB_SHA);
    if (commit) return commit;

    if (env.CONTEXT || env.GITHUB_ACTIONS) {
      throw new Error("A 40-character deployment commit SHA is required in CI/Netlify builds.");
    }

    return "local";
  } catch (error) {
    console.error("[Dinner Dice & Dragons] Unable to resolve deployment commit", {
      error_type: String(error?.name || error?.constructor?.name || "Error").slice(0, 100)
    });
    throw error;
  }
}

export function deploymentMetadata(env = process.env) {
  try {
    return Object.freeze({ commit: deploymentCommit(env) });
  } catch (error) {
    console.error("[Dinner Dice & Dragons] Unable to build deployment metadata", {
      error_type: String(error?.name || error?.constructor?.name || "Error").slice(0, 100)
    });
    throw error;
  }
}
