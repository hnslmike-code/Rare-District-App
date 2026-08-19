---
name: API Zod code generation
description: Compatibility constraint for regenerating the typed OpenAPI client and Zod schemas.
---

The OpenAPI generator emits Zod 4 helpers, while the workspace resolves Zod through the package’s versioned `zod/v4` compatibility entry point. Keep the post-generation import patch in the API-spec codegen script.

**Why:** Using the default `zod` import resolves APIs that do not include the generated Zod 4 helpers, causing widespread generated-schema type errors.

**How to apply:** Run the project’s API-spec codegen command after contract edits; do not hand-edit generated schemas or remove its compatibility patch.