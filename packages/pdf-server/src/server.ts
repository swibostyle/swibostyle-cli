import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { renderPDF, type RenderOptions } from "./renderer";

export function createApp() {
  const app = new Hono();

  // Middleware
  app.use("*", logger());
  app.use("*", cors());

  // Health check
  app.get("/health", (c) => {
    return c.json({ status: "ok", version: "0.1.0" });
  });

  // API info
  app.get("/", (c) => {
    return c.json({
      name: "@swibostyle/pdf-server",
      version: "0.1.0",
      license: "AGPL-3.0",
      endpoints: {
        "GET /health": "Health check",
        "POST /render": "Render PDF from build directory (page size from CSS @page)",
      },
    });
  });

  // Render PDF
  app.post("/render", async (c) => {
    try {
      const body = await c.req.json();
      const { source, options } = body as {
        source: string; // Path to build directory containing item/standard.opf
        options?: RenderOptions;
      };

      if (!source) {
        return c.json({ error: "source is required" }, 400);
      }

      const pdf = await renderPDF(source, options);

      return new Response(pdf, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": 'attachment; filename="output.pdf"',
        },
      });
    } catch (error) {
      console.error("Render error:", error);
      return c.json(
        {
          error: "Failed to render PDF",
          message: error instanceof Error ? error.message : String(error),
        },
        500,
      );
    }
  });

  return app;
}
