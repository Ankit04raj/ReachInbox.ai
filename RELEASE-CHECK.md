# Submission candidate — verification status

This release adds AES-256-GCM credential encryption, compare-and-set migration, missing-index reconstruction, partial recipient search, pending-index search, Slack OAuth timeout, and a Railway schema setup command. Deferred jobs no longer wait on search indexing.

Required new environment variable: `CREDENTIAL_ENCRYPTION_KEY` (64 hexadecimal characters, generate using `openssl rand -hex 32`). Preserve it across deployments. Back up before upgrading.

Local checks: see CHECK-RESULTS.txt. Full dependency-aware build, Redis integration suite, Docker services, browser, live Google/Slack OAuth, SMTP, restart and load tests require a network-enabled machine and real configuration. No live deployment was inspected or remote repository modified. Figma URL missing. SMTP cannot guarantee exactly-once delivery: uncertain outcomes are not automatically resent. Fixed-hour admission is not strict FIFO; Slack delivery may repeat after ambiguous responses.

Run `npm ci`, `npm run build`, `docker compose up -d --wait`, `npm --workspace apps/backend exec -- prisma db push`, `npm test`, and `npm run dev` on your machine. Complete VALIDATION.md before submission.
