import type { ViteDevServer } from "vite";

// Test-owned resources only: never discover or stop an existing listener.
export async function withBrowserServer<B extends { close(): Promise<void> }>(
  server: ViteDevServer,
  launch: () => Promise<B>,
  run: (browser: B) => Promise<void>,
): Promise<void> {
  let browser: B | undefined;
  try {
    await server.listen();
    browser = await launch();
    await run(browser);
  } finally {
    try {
      await browser?.close();
    } finally {
      await server.close();
    }
  }
}
