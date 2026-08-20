# Repository Governance and Release Controls

## Purpose

This document separates controls that are enforced by repository files from controls that must be enabled in GitHub account/repository settings. A control is not considered active merely because it is documented here.

## Verified state — August 20, 2026

At the start of this hardening slice:

- `main` is the default branch.
- GitHub reports branch protection disabled for `main`.
- the repository did not contain a `CODEOWNERS` file;
- GitHub Dependency Review cannot run because the repository Dependency Graph is disabled;
- `SECURITY.md`, Dependabot configuration, CodeQL, supply-chain scanning, immutable Action pinning, SBOM generation, and production image vulnerability scanning already exist in repository code;
- no explicit repository `LICENSE` file exists.

The licensing choice is a product/legal decision and is intentionally **not** inferred or changed by this hardening slice.

## Repository-file controls

### Code ownership

`.github/CODEOWNERS` assigns `@cbw29512` as the default owner and explicitly covers production runtime/deployment, security/CI/dependency inputs, authentication, and schema-provenance paths.

CODEOWNERS by itself does not force review. Enforcement requires a GitHub branch protection rule or ruleset with Code Owner review enabled.

### Automated quality and security gates

The repository currently carries automated workflows for the Netlify production deployment contract, frontend/browser/accessibility/Lighthouse quality, CodeQL, and supply-chain security. Required-check policy should reference the current check names shown by GitHub rather than relying on stale names copied into documentation.

## GitHub settings still requiring administrative enforcement

The following are launch-gate settings and must be verified in GitHub after configuration:

1. **Protect `main` with a branch rule or ruleset.**
   - Require changes to reach `main` through pull requests.
   - Block force pushes and branch deletion.
   - Require conversation resolution before merge.
   - Require the current production, frontend, supply-chain, and CodeQL status checks.
   - Require Code Owner review when the available reviewer model permits it without making the single-maintainer repository impossible to operate.

2. **Enable Dependency Graph.**
   - This is a prerequisite for PR #64's Dependency Review workflow.
   - After enabling it, rerun PR #64 unchanged and require the Dependency Review job to pass before merge.
   - Do not remove or weaken that workflow merely to obtain a green status.

3. **Verify repository security features.**
   - Secret scanning.
   - Push protection.
   - Private vulnerability reporting, where supported.
   - Dependabot/security update settings consistent with the committed configuration.

4. **Review production environment controls.**
   - Protect any GitHub deployment environment that can affect production.
   - Keep production credentials outside repository files.
   - Record who can approve or alter production deployment settings.

## Merge discipline

Before merging a production-affecting pull request:

1. Confirm the PR is based on current `main` or deliberately update/retest it.
2. Review the complete diff for unrelated files, generated secrets, migrations, and deployment changes.
3. Require the exact PR head to pass every applicable automated gate.
4. Treat provider quota/cancellation messages separately from application test failures; do not weaken tests to hide provider problems.
5. Merge only after the intended release boundary is understood.
6. Verify post-merge production deployment separately from pre-merge CI when the change affects the production runtime.

## Stale work

A stale or superseded PR should be closed only after confirming that any still-valid requirement or unique implementation has been preserved in current work. The closing comment should point to the replacement PR or commit so future audits can reconstruct the decision.

## Licensing status

No license is selected by this document. Before public reuse rights are granted or a release process claims a particular license, make an explicit licensing decision and add the appropriate `LICENSE` file and user-facing notices. Until then, repository visibility must not be confused with an affirmative open-source license grant.
