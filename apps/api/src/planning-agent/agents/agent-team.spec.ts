import 'reflect-metadata';
import type { ConstraintSet } from '@camiones/shared';
import { describe, expect, it, vi } from 'vitest';
import type { LoadingPlannerResult } from '../../domain/loading-planner/loading-planner.types';
import type { CatalogContext, PlanProblems } from '../ports/agent.port';
import { AgentTeam } from './agent-team';

/**
 * multi-agent refactor — `AgentTeam` implements `AgentPort` by delegating
 * each method to the matching role-agent (`RuleExtractionAgent`/
 * `RulePatchAgent`/`PlanExplanationAgent`/`DiagnosisAgent`). Tested here with
 * fully mocked role-agents (no client involved) — pure delegation wiring.
 * `PlanningAgentService` depends only on `AgentPort`, so this is a drop-in
 * replacement for the old single-adapter binding.
 */

const catalogContext: CatalogContext = {
  productCodes: ['P-100'],
  families: ['COIL'],
  zones: ['CENTER'],
  destinations: ['dest-1'],
};

function buildMembers() {
  return {
    extraction: { extract: vi.fn().mockResolvedValue({ version: 1, hardRules: [] } as ConstraintSet) },
    patch: { revise: vi.fn().mockResolvedValue({ version: 1, hardRules: [] } as ConstraintSet) },
    explanation: { explain: vi.fn().mockResolvedValue('explanation text') },
    diagnosis: { diagnose: vi.fn().mockResolvedValue('diagnosis text') },
  };
}

describe('AgentTeam (multi-agent refactor)', () => {
  it('delegates planConstraints to the extraction agent, passing rulesText and catalogContext', async () => {
    const members = buildMembers();
    const team = new AgentTeam(members);

    const result = await team.planConstraints({ rulesText: 'Do not stack P-100.', catalogContext });

    expect(result).toEqual({ version: 1, hardRules: [] });
    expect(members.extraction.extract).toHaveBeenCalledWith('Do not stack P-100.', catalogContext);
    expect(members.patch.revise).not.toHaveBeenCalled();
  });

  it('delegates reviseConstraints to the patch agent, passing the full params object', async () => {
    const members = buildMembers();
    const team = new AgentTeam(members);
    const previousConstraints: ConstraintSet = { version: 1, hardRules: [] };
    const problems: PlanProblems = { unplaced: [], criticalAlerts: [] };

    const result = await team.reviseConstraints({ rulesText: 'r', previousConstraints, problems, catalogContext });

    expect(result).toEqual({ version: 1, hardRules: [] });
    expect(members.patch.revise).toHaveBeenCalledWith({ rulesText: 'r', previousConstraints, problems, catalogContext });
    expect(members.extraction.extract).not.toHaveBeenCalled();
  });

  it('delegates explainPlan to the explanation agent', async () => {
    const members = buildMembers();
    const team = new AgentTeam(members);
    const plan = {} as LoadingPlannerResult;
    const constraints: ConstraintSet = { version: 1, hardRules: [] };

    const result = await team.explainPlan({ plan, constraints });

    expect(result).toBe('explanation text');
    expect(members.explanation.explain).toHaveBeenCalledWith({ plan, constraints });
  });

  it('delegates diagnoseUnresolvedPlan to the diagnosis agent', async () => {
    const members = buildMembers();
    const team = new AgentTeam(members);
    const plan = {} as LoadingPlannerResult;
    const constraints: ConstraintSet = { version: 1, hardRules: [] };
    const problems: PlanProblems = { unplaced: [], criticalAlerts: [] };

    const result = await team.diagnoseUnresolvedPlan({ rulesText: 'r', constraints, plan, problems, catalogContext });

    expect(result).toBe('diagnosis text');
    expect(members.diagnosis.diagnose).toHaveBeenCalledWith({ rulesText: 'r', constraints, plan, problems, catalogContext });
  });
});
