# Motion Foundry working instructions

- Read `plans/README.md` and the linked plans when they are present locally. The selected concept is approved; implementation defaults remain documented proposals until tested or revised.
- Keep `plans/` and populated `.env` files out of Git. Never force-add them. Publish only curated submission documentation under `devpost/` when it is ready.
- Use the required Devpost Learn planning guidance, CLAD and Lens Studio MCP workflow for the actual Lens. Follow the generated Lens project's own `AGENTS.md` when it exists.
- Use native Lens Studio MCP tools for editor interaction; do not bypass them through direct HTTP calls to the editor.
- No physical glasses are available. Demonstrate the complete core workflow in Preview with standard SIK/UI Kit interactions.
- Validate kinematics and constraints independently of AI explanations. Report infeasible inputs and numerical tolerances honestly.
- Keep AI credentials on the backend. Treat all model output as untrusted structured input requiring validation.
- Keep the working experience, README, reproducibility instructions and demonstration claims consistent.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
