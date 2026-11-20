import { serve } from "@hono/node-server";
import { createApp } from "./app.js";

const port = Number(process.env.PORT ?? 8787);
const corsOrigin = process.env.CORS_ORIGIN ?? "http://localhost:5173";

const app = createApp({ corsOrigin });

serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.log(`API server running at http://localhost:${info.port}`);
  },
);
