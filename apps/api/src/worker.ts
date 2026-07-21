import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

/**
 * Dedicated `plan-agent` worker process — the standalone counterpart to
 * `main.ts` (the HTTP server).
 *
 * It boots a Nest *application context* (no HTTP listener, no Swagger) so the
 * only thing this process does is run the module's lifecycle providers —
 * crucially `PlanAgentWorker`, whose `onModuleInit` starts the BullMQ `Worker`
 * that claims and executes `plan-agent` jobs. Run one or more of these
 * alongside API instances that set `PLAN_AGENT_INLINE_WORKER=false`, so HTTP
 * servers and job executors scale independently.
 *
 * A dedicated worker process must ALWAYS run its Worker, so we force
 * `inlineWorker=true` here regardless of the ambient `PLAN_AGENT_INLINE_WORKER`
 * (which is typically set to `false` for the API instances sharing the same
 * env/secrets). `enableShutdownHooks` wires SIGTERM/SIGINT to
 * `onModuleDestroy`, so the Worker drains and its Redis connection closes
 * cleanly on shutdown.
 */
async function bootstrapWorker(): Promise<void> {
  process.env.PLAN_AGENT_INLINE_WORKER = 'true';

  const app = await NestFactory.createApplicationContext(AppModule, {
    // The HTTP process already logs bootstrap; keep the worker's logs focused.
    logger: ['error', 'warn', 'log'],
  });
  app.enableShutdownHooks();

  Logger.log('plan-agent worker process started (no HTTP server) — waiting for jobs', 'Worker');
}

void bootstrapWorker();
