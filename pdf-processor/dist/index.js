import { createServer } from "http";
import { processPdf } from "./agent.js";
import { logger } from "./lib/logger.js";
const PORT = parseInt(process.env.PORT ?? "8080", 10);
async function readBody(req) {
    const chunks = [];
    for await (const chunk of req) {
        chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    }
    return Buffer.concat(chunks).toString("utf-8");
}
function sendJson(res, status, body) {
    const json = JSON.stringify(body);
    res.writeHead(status, {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(json),
    });
    res.end(json);
}
async function handleProcess(req, res) {
    if (req.method !== "POST") {
        sendJson(res, 405, { error: "Method not allowed" });
        return;
    }
    let payload;
    try {
        const body = await readBody(req);
        payload = JSON.parse(body);
    }
    catch (err) {
        logger.error("Failed to parse request body", {
            error: err instanceof Error ? err.message : String(err),
        });
        sendJson(res, 400, { error: "Invalid JSON body" });
        return;
    }
    const pdfKey = payload.object?.key;
    if (!pdfKey) {
        logger.warn("Missing object.key in webhook payload", { payload });
        sendJson(res, 400, { error: "Missing object.key in payload" });
        return;
    }
    // Validate that the file is a PDF
    if (!pdfKey.toLowerCase().endsWith(".pdf")) {
        logger.info("Ignoring non-PDF object", { key: pdfKey });
        sendJson(res, 200, { status: "skipped", reason: "Not a PDF file" });
        return;
    }
    logger.info("Processing PDF", {
        key: pdfKey,
        bucket: payload.bucket,
        action: payload.action,
    });
    const result = await processPdf(pdfKey);
    logger.info("PDF processing complete", {
        key: pdfKey,
        jobId: result.jobId,
        success: result.success,
        steps: result.steps,
        durationMs: result.durationMs,
    });
    if (result.success) {
        sendJson(res, 200, {
            status: "success",
            pdfKey,
            jobId: result.jobId,
            csvKey: result.csvKey,
            steps: result.steps,
            durationMs: result.durationMs,
        });
    }
    else {
        sendJson(res, 500, {
            status: "error",
            pdfKey,
            jobId: result.jobId,
            error: result.error,
            steps: result.steps,
            durationMs: result.durationMs,
        });
    }
}
function handleHealth(_req, res) {
    sendJson(res, 200, {
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
}
const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const pathname = url.pathname;
    try {
        switch (pathname) {
            case "/process":
                await handleProcess(req, res);
                break;
            case "/health":
            case "/":
                handleHealth(req, res);
                break;
            default:
                sendJson(res, 404, { error: "Not found" });
        }
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error("Unhandled server error", {
            path: pathname,
            error: message,
        });
        if (!res.headersSent) {
            sendJson(res, 500, { error: "Internal server error" });
        }
    }
});
server.listen(PORT, () => {
    logger.info(`PDF processor server listening on port ${PORT}`, { port: PORT });
});
// Graceful shutdown
function shutdown(signal) {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    server.close(() => {
        logger.info("Server closed");
        process.exit(0);
    });
    // Force exit after 10 seconds
    setTimeout(() => {
        logger.warn("Graceful shutdown timed out, forcing exit");
        process.exit(1);
    }, 10_000);
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
//# sourceMappingURL=index.js.map