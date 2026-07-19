import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { AgentTeam } from './agents/agent-team';
import { AGENT_PORT } from './ports/agent.port';
import { PlanningAgentModule } from './planning-agent.module';
import { PlanningAgentService } from './planning-agent.service';

/**
 * multi-agent refactor — module wiring smoke test: `PlanningAgentModule`
 * still boots (Nest resolves the full DI graph) and `AGENT_PORT` now
 * resolves to an `AgentTeam` instance (built by `agents/agent-team.factory.ts`)
 * instead of a single `DeepSeekJsonAdapter`/`DeepSeekToolUseAdapter`.
 * `PrismaService` is stubbed — this test never calls `$connect()` (Nest's
 * `compile()` does not run lifecycle hooks), so no live DB is needed.
 */
describe('PlanningAgentModule (multi-agent refactor — module wiring)', () => {
  const originalEnv = process.env.DEEPSEEK_ADAPTER;

  beforeEach(() => {
    delete process.env.DEEPSEEK_ADAPTER;
  });

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.DEEPSEEK_ADAPTER;
    else process.env.DEEPSEEK_ADAPTER = originalEnv;
  });

  it('boots and resolves AGENT_PORT to an AgentTeam instance (default json adapter)', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [PrismaModule, PlanningAgentModule] })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();

    const agentPort = moduleRef.get(AGENT_PORT);
    expect(agentPort).toBeInstanceOf(AgentTeam);

    const service = moduleRef.get(PlanningAgentService);
    expect(service).toBeInstanceOf(PlanningAgentService);
  });

  it('boots and resolves AGENT_PORT to an AgentTeam instance when DEEPSEEK_ADAPTER=tooluse', async () => {
    process.env.DEEPSEEK_ADAPTER = 'tooluse';

    const moduleRef = await Test.createTestingModule({ imports: [PrismaModule, PlanningAgentModule] })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();

    const agentPort = moduleRef.get(AGENT_PORT);
    expect(agentPort).toBeInstanceOf(AgentTeam);
  });
});
