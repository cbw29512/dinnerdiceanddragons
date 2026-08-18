# Security Policy

## Supported code

Security fixes target the current `main` production line. Older branches, prototype snapshots, and superseded pull requests are not supported deployment targets.

## Reporting a vulnerability

Please do **not** publish exploit details, credentials, private user data, or proof-of-concept payloads in a public issue.

Preferred reporting path:

1. Use GitHub's private vulnerability reporting / Security Advisory flow for this repository when the **Report a vulnerability** option is available.
2. Include the affected component or endpoint, impact, reproduction steps, and the minimum proof needed to validate the issue.
3. Remove or redact real credentials, access tokens, private messages, exact private locations, or unrelated personal data from the report.

If GitHub private vulnerability reporting is not available, open a public issue titled **Security contact request** with no exploit details. The maintainer will establish a private channel before technical information is exchanged.

Repository-level private vulnerability reporting, secret scanning, and push protection are administrative controls and must be verified separately; this file does not imply that those GitHub settings are enabled.

## Response expectations

- Acknowledge a credible report as quickly as practical, normally within 3 business days.
- Triage severity and affected production surface before requesting additional sensitive evidence.
- Prioritize critical/high vulnerabilities that expose authentication, authorization, private location, booking, message, moderation, or privileged data.
- Coordinate remediation and disclosure timing with the reporter when appropriate.
- Revoke/rotate exposed credentials immediately rather than waiting for a code release.

## Safe research

Good-faith research should minimize impact:

- do not access, alter, or retain data belonging to other users;
- do not perform denial-of-service, destructive, or high-volume testing against production;
- do not social-engineer users, venue staff, or maintainers;
- use test accounts/data where possible;
- stop once enough evidence exists to demonstrate the issue.

## Security-sensitive data

Never send these through public issues or logs:

- Supabase access or refresh tokens;
- Authorization headers;
- database/provider/admin credentials;
- private messages or moderation evidence;
- exact private home/location data;
- secrets recovered from historical commits.

## Disclosure

Please allow a reasonable remediation window before public disclosure. Once a fix is available, the project may publish a security advisory describing affected versions, impact, and upgrade/remediation guidance without exposing unrelated private data.
