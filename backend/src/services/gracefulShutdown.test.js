"use strict";

const { createGracefulShutdown, SHUTDOWN_TIMEOUT_MS } = require("./gracefulShutdown");

function createLogger() {
  return { info: jest.fn(), error: jest.fn(), fatal: jest.fn() };
}

describe("graceful shutdown", () => {
  test("drains listeners, sockets, every queue, the indexer, Postgres, and Redis in order", async () => {
    const order = [];
    const logger = createLogger();
    const server = {
      listening: true,
      close: (callback) => {
        order.push("http");
        callback();
      },
    };
    const turretsServer = {
      listening: true,
      close: (callback) => {
        order.push("turrets");
        callback();
      },
    };
    const io = { close: (callback) => { order.push("socket.io"); callback(); } };
    const queues = Array.from({ length: 8 }, (_, index) => ({
      name: `queue_${index + 1}`,
      stop: async () => { order.push(`queue_${index + 1}`); },
    }));
    const shutdown = createGracefulShutdown({
      server,
      getTurretsServer: () => turretsServer,
      io,
      queues,
      extraStages: [
        { name: "indexer", run: async () => { order.push("indexer"); } },
        { name: "queue_metrics_refresh", run: async () => {} },
      ],
      pool: { end: async () => { order.push("postgres"); } },
      redis: { disconnect: async () => { order.push("redis"); } },
      logger,
    });

    await shutdown("SIGTERM");

    expect(order).toEqual([
      "http", "turrets", "socket.io", "queue_1", "queue_2", "queue_3", "queue_4",
      "queue_5", "queue_6", "queue_7", "queue_8", "indexer", "postgres", "redis",
    ]);
    expect(logger.info.mock.calls
      .filter(([context]) => context.event === "shutdown_stage_started")
      .map(([context]) => context.stage)).toEqual([
      "http_server", "socket_io", "http_drain", "queue_1", "queue_2", "queue_3",
      "queue_4", "queue_5", "queue_6", "queue_7", "queue_8", "indexer",
      "queue_metrics_refresh", "postgres_pool", "redis",
    ]);
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ event: "shutdown_completed", failed: false }),
      "Graceful shutdown completed",
    );
  });

  test("continues draining after a stage fails and marks the process unsuccessful", async () => {
    const order = [];
    const logger = createLogger();
    const processRef = {};
    const shutdown = createGracefulShutdown({
      server: { listening: true, close: (callback) => callback(new Error("close failed")) },
      io: { close: (callback) => { order.push("socket.io"); callback(); } },
      queues: [],
      pool: { end: async () => { order.push("postgres"); } },
      redis: { disconnect: async () => { order.push("redis"); } },
      logger,
      processRef,
    });

    await shutdown("SIGINT");

    expect(order).toEqual(["socket.io", "postgres", "redis"]);
    expect(processRef.exitCode).toBe(1);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ event: "shutdown_stage_failed", stage: "http_drain" }),
      "Failed to drain http_drain",
    );
  });

  test("returns one shared shutdown promise for repeated signals", async () => {
    let finishQueue;
    const queueFinished = new Promise((resolve) => { finishQueue = resolve; });
    const shutdown = createGracefulShutdown({
      server: { listening: false },
      io: { close: (callback) => callback() },
      queues: [{ name: "queue", stop: () => queueFinished }],
      pool: { end: jest.fn() },
      redis: { disconnect: jest.fn() },
      logger: createLogger(),
    });

    const first = shutdown("SIGTERM");
    const second = shutdown("SIGINT");
    await Promise.resolve();
    await Promise.resolve();
    finishQueue();

    expect(second).toBe(first);
    await first;
  });

  test("forces process exit after the immutable 15-second fallback", () => {
    jest.useFakeTimers();
    const processRef = { exit: jest.fn() };
    const shutdown = createGracefulShutdown({
      server: { listening: false },
      io: { close: () => {} },
      queues: [],
      pool: { end: jest.fn() },
      redis: { disconnect: jest.fn() },
      logger: createLogger(),
      processRef,
    });

    void shutdown("SIGTERM");
    jest.advanceTimersByTime(SHUTDOWN_TIMEOUT_MS);

    expect(SHUTDOWN_TIMEOUT_MS).toBe(15_000);
    expect(processRef.exit).toHaveBeenCalledWith(1);
    jest.clearAllTimers();
    jest.useRealTimers();
  });
});