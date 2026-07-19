import { TruckZoneType as SharedTruckZoneType } from '@camiones/shared';
import { describe, expect, it, vi } from 'vitest';
import type { LoadingPlannerResult } from '../../domain/loading-planner/loading-planner.types';
import type { CatalogContext } from '../ports/agent.port';
import { DeepSeekToolUseAdapter, DeepSeekToolUseUnsupportedError } from './deepseek-tool-use.adapter';

/**
 * loading-agent-llm Phase 6.4 — `DeepSeekToolUseAdapter` is an EXPERIMENTAL
 * scaffold, NOT the default `AgentPort` (see design.md: gated on verifying
 * Huawei Cloud's DeepSeek tool/function-calling, which has not happened).
 * Both methods reject with a typed `DeepSeekToolUseUnsupportedError`
 * WITHOUT ever calling the client — tested against a mocked client only.
 */

const catalogContext: CatalogContext = {
  productCodes: ['P-100'],
  families: ['COIL'],
  zones: ['CABIN_SIDE', 'CENTER', 'DOOR_SIDE'],
  destinations: ['dest-1'],
};

function mockClient() {
  return { chatCompletion: vi.fn().mockResolvedValue('{}') };
}

describe('DeepSeekToolUseAdapter — experimental, unsupported until verified', () => {
  it('planConstraints rejects with DeepSeekToolUseUnsupportedError and never calls the client', async () => {
    const client = mockClient();
    const adapter = new DeepSeekToolUseAdapter(client);

    await expect(adapter.planConstraints({ rulesText: 'Do not stack P-100.', catalogContext })).rejects.toBeInstanceOf(
      DeepSeekToolUseUnsupportedError,
    );
    expect(client.chatCompletion).not.toHaveBeenCalled();
  });

  it('explainPlan rejects with DeepSeekToolUseUnsupportedError and never calls the client', async () => {
    const client = mockClient();
    const adapter = new DeepSeekToolUseAdapter(client);
    const plan: LoadingPlannerResult = {
      placedItems: [],
      unplacedItems: [],
      steps: [],
      alerts: [],
      metrics: {
        totalWeightKg: 0,
        placedWeightKg: 0,
        unplacedWeightKg: 0,
        usedVolumeM3: 0,
        volumeUtilizationPct: 0,
        placedItemCount: 0,
        unplacedItemCount: 0,
        leftWeightKg: 0,
        rightWeightKg: 0,
        cabinSideWeightKg: 0,
        centerWeightKg: 0,
        doorSideWeightKg: 0,
        criticalAlertCount: 0,
        warningAlertCount: 0,
        loadLengthMm: 0,
        maxHeightMm: 0,
      },
    };
    const constraints = { version: 1 as const, hardRules: [{ type: 'ZONE_RESTRICTION' as const, productCode: 'P-100', zone: SharedTruckZoneType.CENTER }] };

    await expect(adapter.explainPlan({ plan, constraints })).rejects.toBeInstanceOf(DeepSeekToolUseUnsupportedError);
    expect(client.chatCompletion).not.toHaveBeenCalled();
  });

  it('reviseConstraints rejects with DeepSeekToolUseUnsupportedError and never calls the client (self-correcting-replan-loop)', async () => {
    const client = mockClient();
    const adapter = new DeepSeekToolUseAdapter(client);
    const previousConstraints = { version: 1 as const, hardRules: [] };
    const problems = { unplaced: [], criticalAlerts: [] };

    await expect(
      adapter.reviseConstraints({ rulesText: 'Do not stack P-100.', previousConstraints, problems, catalogContext }),
    ).rejects.toBeInstanceOf(DeepSeekToolUseUnsupportedError);
    expect(client.chatCompletion).not.toHaveBeenCalled();
  });
});
