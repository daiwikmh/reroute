import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";

// Every config constant in dns/config.ts reads process.env at module-load
// time. ES module imports are hoisted and fully evaluated before any of a
// file's own top-level statements run — so calling loadEnv() at the top of
// server.ts, even textually before its other imports, would still run
// *after* dns/config.ts had already read process.env. A dynamic import()
// is a real function call, not hoisted, so it's the one thing that actually
// runs after this file's own code — this is the only reliable place to load
// the root .env before anything downstream reads from it.
loadEnv({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });

await import("./server.js");
