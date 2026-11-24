# Fox Space local MCP bridge

The stdio server gives a local MCP host read access to selected Fox Space data. It uses the native macOS workspace snapshot, which is updated while Fox Space runs.

## Connect a local host

1. Open the native Fox Space app and go to **Агенты и доступ**. Create and enable a profile, grant read permission for the relevant resources, and copy the profile ID.
2. Install Node.js 22 and run `npm install` in this folder.
3. In your local MCP host, configure the Node executable as the command and the absolute path to `index.mjs` as its argument. Set `FOXSPACE_AGENT_ID` to the profile ID.
4. Call `foxspace_status`, then a read tool for an allowed resource. Each call checks the current saved profile. To revoke access, disable the profile or clear its read permissions.

The bridge looks for `~/Library/Application Support/studio.liseya.foxspace/workspace.json` by default. Use `FOXSPACE_WORKSPACE_PATH` for a different snapshot. Configure the process and environment only in a local host you trust with the enabled resources.

## Tools

- `foxspace_status` reports whether the workspace snapshot is available.
- `foxspace_list` and `foxspace_get` read projects, goals, tasks, finance transactions, publications or trackers.
- `foxspace_tables`, `foxspace_table_records` and `foxspace_table_record` read table structure and rows.
- `foxspace_table_image` returns the attached image bytes when both Tables and Files read permissions are granted.

The stdio server exposes read tools only. The experimental offline write helpers in `core.mjs` are kept for fixture tests. Cloud and mobile access require a separate transport.

Run `npm test` for the bridge's tests.
