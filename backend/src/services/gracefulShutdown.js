"use strict";

const SHUTDOWN_TIMEOUT_MS = 15_000;

function closeHttpServer(server) {
  if (!server || !server.listening) return Promise.resolve();
  return new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

function closeSocketServer(io) {
  if (!io) return Promise.resolve();
  return new Promise((resolve, reject) => {
    try {
      io.close((err) => {
        if (err && err.code !== "ERR_SERVER_NOT_RUNNING") reject(err);
        else resolve();
      });
    } catch (err) {
      reject(err);
    }
  });
}

function createGracefulShutdown({ server, getTurretsServer, io, queues, extraStages = [], pool, redis, logger, processRef = process }) {
  let shutdownPromise = null;

  return function shutdown(signal) {
    if (shutdownPromise) {
      logger.info({ event: "shutdown_already_in_progress", signal }, "Shutdown already in progress");
      return shutdownPromise;
    }

    shutdownPromise = (async () => {
      let failed = false;
      const timeout = setTimeout(() => {
        logger.fatal(
          { event: "shutdown_timeout", timeoutMs: SHUTDOWN_TIMEOUT_MS },
          "Shutdown timed out; forcing process exit",
        );
        processRef.exit(1);
      }, SHUTDOWN_TIMEOUT_MS);

      logger.info({ event: "shutdown_started", signal }, "Graceful shutdown started");

      let httpClosePromise = Promise.resolve();
      let turretsClosePromise = Promise.resolve();
      const stages = [
        {
          name: "http_server",
          run: () => {
            httpClosePromise = closeHttpServer(server);
            turretsClosePromise = closeHttpServer(getTurretsServer?.());
            httpClosePromise.catch(() => {});
            turretsClosePromise.catch(() => {});
          },
        },
        {
          name: "socket_io",
          run: () => closeSocketServer(io),
        },
        {
          name: "http_drain",
          run: () => Promise.all([httpClosePromise, turretsClosePromise]),
        },
        ...queues.map(({ name, stop }) => ({ name, run: stop })),
        ...extraStages,
        { name: "postgres_pool", run: () => pool.end() },
        { name: "redis", run: () => redis.disconnect() },
      ];

      try {
        for (const stage of stages) {
          logger.info({ event: "shutdown_stage_started", stage: stage.name }, `Draining ${stage.name}`);
          try {
            await stage.run();
            logger.info({ event: "shutdown_stage_completed", stage: stage.name }, `Drained ${stage.name}`);
          } catch (err) {
            failed = true;
            logger.error(
              { event: "shutdown_stage_failed", stage: stage.name, err },
              `Failed to drain ${stage.name}`,
            );
          }
        }

        if (failed) processRef.exitCode = 1;
        logger.info(
          { event: "shutdown_completed", failed },
          failed ? "Graceful shutdown completed with errors" : "Graceful shutdown completed",
        );
      } finally {
        clearTimeout(timeout);
      }
    })();

    return shutdownPromise;
  };
}

module.exports = { createGracefulShutdown, SHUTDOWN_TIMEOUT_MS };