import { startLocalServer } from "./server";
import { createSimplexProvider } from "./simplex-provider";
import { createHanlpSegmenter } from "./hanlp-provider";
// The npm launcher loads only the server's root .env.local, with shell env precedence.
const token = process.env.SIMPLEX_API_TOKEN;
const port =
  process.env.HORIZON_API_PORT === undefined
    ? 8787
    : Number(process.env.HORIZON_API_PORT);
const origins = process.env.HORIZON_UI_ORIGINS?.split(",").map((s) => s.trim());
startLocalServer({
  port,
  origins,
  allowHttpsOrigins: process.env.HORIZON_ALLOW_HTTPS_ORIGINS === "1",
  configured: !!token,
  provider: createSimplexProvider({ token }),
  userTokenProvider: process.env.HORIZON_ALLOW_HTTPS_ORIGINS === "1"
    ? undefined : (userToken) => createSimplexProvider({ token: userToken }),
  segmenter: process.env.HORIZON_SEGMENT_URL ? createHanlpSegmenter({url: process.env.HORIZON_SEGMENT_URL}) : undefined,
})
  .then((server) => {
    console.log(`Horizon local API: http://127.0.0.1:${server.port}`);
    for (const signal of ["SIGINT", "SIGTERM"] as const)
      process.once(signal, () => {
        void server.close().then(() => process.exit(0));
      });
  })
  .catch(() => {
    console.error(
      "Local API could not start. Check loopback configuration and whether the port is occupied.",
    );
    process.exitCode = 1;
  });
