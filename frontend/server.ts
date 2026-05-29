import { randomUUID } from "crypto";
import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { spawn, type ChildProcessWithoutNullStreams } from "child_process";
import readline from "readline";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const frontendDir = process.cwd();
const projectRoot = path.resolve(frontendDir, "..");
const bridgeScript = path.join(projectRoot, "backend_bridge.py");

app.use(express.json({ limit: "1mb" }));

interface ChatHistoryItem {
  role: "user" | "assistant";
  content: string;
}

interface ChatRequest {
  message?: string;
  history?: ChatHistoryItem[];
}

interface PendingRequest {
  reject: (error: Error) => void;
  resolve: (value: string) => void;
  timer: NodeJS.Timeout;
}

class PythonRAGBridge {
  private child: ChildProcessWithoutNullStreams | null = null;
  private readonly pending = new Map<string, PendingRequest>();
  private readyPromise: Promise<void> | null = null;
  private isReady = false;

  start() {
    if (this.readyPromise) {
      return this.readyPromise;
    }

    this.readyPromise = new Promise((resolve, reject) => {
      const child = spawn(
        "conda",
        ["run", "--no-capture-output", "-n", "cook-rag", "python", bridgeScript],
        {
          cwd: projectRoot,
          stdio: ["pipe", "pipe", "pipe"],
        }
      );

      this.child = child;

      const readyTimeout = setTimeout(() => {
        reject(new Error("Python RAG 服务启动超时"));
      }, 180_000);

      const stdoutLines = readline.createInterface({ input: child.stdout });
      stdoutLines.on("line", (line) => {
        this.handleStdoutLine(line, resolve, reject, readyTimeout);
      });

      const stderrLines = readline.createInterface({ input: child.stderr });
      stderrLines.on("line", (line) => {
        console.log(`[python-rag] ${line}`);
      });

      child.on("error", (error) => {
        clearTimeout(readyTimeout);
        reject(error);
        this.failAllPending(new Error(`Python RAG 进程启动失败: ${error.message}`));
      });

      child.on("exit", (code, signal) => {
        this.isReady = false;
        this.readyPromise = null;
        this.child = null;
        this.failAllPending(
          new Error(`Python RAG 进程已退出，code=${code ?? "null"} signal=${signal ?? "null"}`)
        );
      });
    });

    return this.readyPromise;
  }

  async sendMessage(message: string, history: ChatHistoryItem[]) {
    await this.start();

    if (!this.child || !this.isReady) {
      throw new Error("Python RAG 服务尚未就绪");
    }

    const requestId = randomUUID();
    const payload = JSON.stringify({
      id: requestId,
      message,
      history,
    });

    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error("Python RAG 响应超时"));
      }, 180_000);

      this.pending.set(requestId, { resolve, reject, timer });
      this.child!.stdin.write(`${payload}\n`);
    });
  }

  getStatus() {
    return {
      ready: this.isReady,
      running: Boolean(this.child),
      pendingRequests: this.pending.size,
    };
  }

  stop() {
    if (this.child) {
      this.child.kill("SIGTERM");
    }
  }

  private handleStdoutLine(
    rawLine: string,
    resolveReady: () => void,
    rejectReady: (error: Error) => void,
    readyTimeout: NodeJS.Timeout
  ) {
    const line = rawLine.trim();
    if (!line) {
      return;
    }

    try {
      const payload = JSON.parse(line) as {
        type?: string;
        id?: string;
        ok?: boolean;
        text?: string;
        error?: string;
      };

      if (payload.type === "ready") {
        clearTimeout(readyTimeout);
        this.isReady = true;
        resolveReady();
        return;
      }

      if (payload.type === "init_error") {
        clearTimeout(readyTimeout);
        rejectReady(new Error(payload.error || "Python RAG 初始化失败"));
        return;
      }

      if (!payload.id) {
        return;
      }

      const pendingRequest = this.pending.get(payload.id);
      if (!pendingRequest) {
        return;
      }

      clearTimeout(pendingRequest.timer);
      this.pending.delete(payload.id);

      if (payload.ok) {
        pendingRequest.resolve(payload.text || "");
      } else {
        pendingRequest.reject(new Error(payload.error || "Python RAG 返回未知错误"));
      }
    } catch (error) {
      console.error("Failed to parse bridge payload:", error, rawLine);
    }
  }

  private failAllPending(error: Error) {
    for (const [requestId, pendingRequest] of this.pending.entries()) {
      clearTimeout(pendingRequest.timer);
      pendingRequest.reject(error);
      this.pending.delete(requestId);
    }
  }
}

const bridge = new PythonRAGBridge();

app.get("/api/health", async (_req, res) => {
  const status = bridge.getStatus();
  res.json(status);
});

app.post("/api/chat", async (req, res) => {
  const { message, history = [] } = req.body as ChatRequest;

  if (!message?.trim()) {
    res.status(400).json({ error: "message is required" });
    return;
  }

  try {
    const replyText = await bridge.sendMessage(message.trim(), history);
    res.json({ text: replyText });
  } catch (error) {
    const messageText = error instanceof Error ? error.message : "后端服务调用失败";
    console.error("RAG API Error:", error);
    res.status(500).json({ error: messageText });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in development mode with Vite middleware...");
    const vite = await createViteServer({
      root: frontendDir,
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in production mode...");
    const distPath = path.join(frontendDir, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`DishMind Dev Server running at http://localhost:${PORT}`);
  });

  const shutdown = () => {
    bridge.stop();
    server.close(() => process.exit(0));
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  bridge.start().catch((error) => {
    console.error("Python RAG warmup failed:", error);
  });
}

startServer().catch((error) => {
  console.error("Failed to start DishMind server:", error);
  bridge.stop();
  process.exit(1);
});
