---
name: API security test runner
description: How to keep API policy tests independent from the production bundle output.
---

API policy tests should import their focused TypeScript helpers from `src` and run with Node's `--experimental-strip-types` support.

**Why:** The API production build bundles source into one entry point and replaces `dist`; incremental TypeScript may not recreate individual helper modules that a test imports from that directory.

**How to apply:** Keep small, database-free boundary tests in the API test directory and run them through the package `test` script. Do not make them depend on files produced by the API bundler.