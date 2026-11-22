# Fox Space local ChatGPT / MCP bridge — development preview

This is a **local stdio MCP server** for the existing native Fox Space workspace. It does not connect cloud/mobile ChatGPT to your Mac. No public HTTP listener, no remote credentials, and no model provider are included.

## First run
- Install Node.js 22.
- From `integrations/foxspace-mcp`: `npm install`, then `npm start`.
- Configure your MCP-capable **local desktop host** to launch `node <absolute-path>/integrations/foxspace-mcp/index.mjs` using stdio (working directory is this folder).
- Set `FOXSPACE_WORKSPACE_PATH` only if the Tauri application-data directory differs. By default it is `~/Library/Application Support/studio.liseya.foxspace/workspace.json`.
- Read-only operations work when a native workspace snapshot exists.
- All writes are **disabled by default**. To test writes on an isolated copy, set `FOXSPACE_ALLOW_WRITES=1`.

## Tools
- `foxspace_status`, `foxspace_list`, `foxspace_get`.
- Experimental: `foxspace_create_task`, `foxspace_set_task_status`.

**Safety and consistency:** Current write tools edit the native snapshot file, not the running application's in-memory React state. **Do not enable writes against your live Fox Space workspace while the app is open**: the app can overwrite external changes. This bridge is intentionally not described as a ready-to-use cloud/mobile ChatGPT plugin. Next stage: authenticated HTTPS relay + live client synchronization + per-resource policy enforcement + approval queue.

For development, run `npm test` with Node's built-in test runner.
