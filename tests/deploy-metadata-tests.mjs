import assert from "node:assert/strict";
import { deploymentCommit, deploymentMetadata } from "../scripts/deploy-metadata.mjs";

function test(name, callback) {
  try {
    callback();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

const netlifySha = "1111111111111111111111111111111111111111";
const githubSha = "2222222222222222222222222222222222222222";

test("Netlify COMMIT_REF is the canonical deployed commit", () => {
  assert.equal(deploymentCommit({ COMMIT_REF: netlifySha, GITHUB_SHA: githubSha }), netlifySha);
});

test("GitHub SHA is the CI fallback", () => {
  assert.equal(deploymentCommit({ GITHUB_SHA: githubSha, GITHUB_ACTIONS: "true" }), githubSha);
});

test("deployment metadata exposes only the commit contract", () => {
  assert.deepEqual(deploymentMetadata({ COMMIT_REF: netlifySha }), { commit: netlifySha });
});

test("malformed CI deployment state fails closed", () => {
  assert.throws(
    () => deploymentCommit({ COMMIT_REF: "not-a-sha", GITHUB_ACTIONS: "true" }),
    /40-character deployment commit SHA/
  );
});

test("local builds without CI metadata remain usable", () => {
  assert.equal(deploymentCommit({}), "local");
});

console.log("All deployment metadata tests passed.");
