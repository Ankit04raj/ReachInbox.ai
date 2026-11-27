# Validation and submission checklist

## Checks performed in this environment
- Original ZIP extracted; backend/frontend source, schema, package manifests, queue/worker, OAuth, Docker and existing reports reviewed.
- TypeScript parser checked every corrected .ts/.tsx file for syntax. No syntax diagnostics reported. This is not a dependency-aware typecheck.
- Dependency installation attempted; DNS resolution for registry.npmjs.org failed. No complete npm install, Prisma generation, build, Docker deployment, Redis test, SMTP send, Google/Slack OAuth, or browser test was possible here.
- Added three real Redis Jest tests; not executed here. Old reports claiming test success removed to avoid misleading submission evidence.

## Execute locally before submission
1. Follow README setup. Run `npm ci`, `npm run build`, `npm test`. Fix any dependency/type errors before continuing. If lockfile needs regeneration, run `npm install` on a networked machine and commit the resulting lockfile.
2. Sign in via real Google consent. Confirm header name/email/avatar and logout; unauthenticated API requests should be 401. Open Bull Board as ADMIN_EMAIL; other users must get 403.
3. Configure two distinct Ethereal accounts. Upload a CSV such as `email,name\nlead1@example.com,One\nlead2@example.com,Two`. Verify detected count, select sender and schedule future emails. Use an ISO time in API tests. Confirm scheduled rows and queue delayed state, then actual Ethereal previews.
4. Connect real Slack workspace/channel. Set hourly limit to 2 in Compose and schedule three recipients on the same sender with at least 2 seconds delay. Confirm a real Slack message on the second admitted attempt, third job deferred to next UTC hour. Repeat on a fresh sender/account after disconnect; no notification. Reconnect and verify on a fresh hour/sender. Check actual delivery timestamps and inspect the queue.
5. Schedule emails 2 minutes ahead, stop API/worker, restart before due time. Keep volumes. Confirm sends appear at due time and each preview occurs once. Also stop Redis briefly and verify recovery. Do not simulate failure by deleting persistent volumes.
6. Submit same schedule request twice with same Idempotency-Key and identical payload; count rows and BullMQ jobs. Test multiple worker processes against same database and Redis. Verify no duplicate sends; verify independent sender capacity. Simulate a crash during SMTP and inspect ambiguous status manually rather than automatically resending.
7. Search subject/recipient/body in dashboard after indexing. Confirm no cross-user leakage. Confirm failed and deferred rows visible. Try an invalid CSV, unauthorized sender, bad date and empty leads.
8. Load-test with 1,001 fake addresses and a start time far in the future. Check response and queue/database counts without sending the batch; delete/cancel pending jobs in an isolated demo database afterward. Validate under multiple concurrent requests and monitor memory/latency. Do not claim load-test success until performed.

## Five-minute demo script
- 0:00–0:40 Google login, header, dashboard, Slack OAuth connection.
- 0:40–1:30 Compose, upload sample leads, select sender and schedule.
- 1:30–2:10 Scheduled tab and authenticated Bull Board delayed jobs.
- 2:10–3:10 Restart backend/worker before scheduled time, show retained records and queue.
- 3:10–4:20 Sent tab, Ethereal preview, Slack real message and deferred job.
- 4:20–5:00 Search, environment configuration and trade-offs.

## Outstanding items
- Figma comparison: missing link.
- Real service credentials and live test evidence: must be supplied locally; never commit them.
- Production hardening: encrypted credentials, migration history, large-scale pagination, strict FIFO/rolling quotas if required, stronger distributed recovery coordination, validated environment settings, and comprehensive automated restart/load integration tests.
- Private GitHub repository, collaborator invitations (Mitrajit and Yadav036), recording and submission form remain user actions. No remote repo changes were made by this revision.

## Final revision checks
- Added transactional campaign-level payload fingerprinting, cancellation tombstones, UNCERTAIN delivery status, durable Slack notification records with retry deadlines, dirty-index recovery, and GitHub Actions build/Redis test workflow.
- Existing database needs the new schema applied with `prisma db push` for local demo. Back up existing data first.
- Offline npm install also failed (ENOTCACHED for zod). CI workflow has not run; full typecheck and integration results remain unverified.
- Existing limitations: SMTP and Slack external calls cannot be made exactly-once with these providers; a crash can leave uncertain SMTP delivery or duplicate Slack notifications. SMTP secrets/webhooks are still stored as plaintext in the demo database, and configured Ethereal accounts are shared test accounts with per-user sender limits. Do not use real production credentials.
