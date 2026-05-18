import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PlanAlertsPanel, PlanCandidateDiagnosticsPanel, PlanEvaluationPanel, PlanStepInstructionPreview, buildPlacedItemAdjustmentPayload } from './planner-ui';

describe('planner item adjustment form mapping', () => {
  it('maps numeric adjustment values to integers', () => {
    expect(buildPlacedItemAdjustmentPayload({ xMm: '10', yMm: '20', zMm: '30', rotationDeg: '90', locked: false })).toEqual({
      xMm: 10,
      yMm: 20,
      zMm: 30,
      rotationDeg: 90,
      locked: false,
    });
  });

  it('maps the locked checkbox value to true', () => {
    expect(buildPlacedItemAdjustmentPayload({ xMm: '1', yMm: '2', zMm: '3', rotationDeg: '180', locked: true })).toEqual({
      xMm: 1,
      yMm: 2,
      zMm: 3,
      rotationDeg: 180,
      locked: true,
    });
  });
});

describe('PlanEvaluationPanel', () => {
  it('renders score, hard violations, and penalties', () => {
    render(<PlanEvaluationPanel evaluation={{
      score: 823,
      hardViolationCount: 1,
      softPenaltyTotal: 77,
      penalties: [
        { code: 'weight-imbalance', points: 50, message: 'Weight imbalance warning present.' },
        { code: 'load-length', points: 27, message: 'Load uses 27000mm of truck length.' },
      ],
    }} />);

    expect(screen.getByRole('heading', { name: /score de plan/i })).toBeInTheDocument();
    expect(screen.getByText('823')).toBeInTheDocument();
    expect(screen.getByText(/1 violacion/i)).toBeInTheDocument();
    expect(screen.getByText(/desbalance de peso/i)).toBeInTheDocument();
    expect(screen.getByText(/-50 pts/i)).toBeInTheDocument();
  });

  it('renders nothing without evaluation data', () => {
    const { container } = render(<PlanEvaluationPanel evaluation={undefined} />);

    expect(container).toBeEmptyDOMElement();
  });
});

describe('PlanCandidateDiagnosticsPanel', () => {
  it('renders winning candidate and comparison rows', () => {
    render(<PlanCandidateDiagnosticsPanel diagnostics={{
      winnerIndex: 1,
      winnerName: 'light-first',
      candidates: [
        { index: 0, name: 'current', score: 775, hardViolationCount: 1, placedItemCount: 2, unplacedItemCount: 0 },
        { index: 1, name: 'light-first', score: 1050, hardViolationCount: 0, placedItemCount: 2, unplacedItemCount: 0 },
      ],
    }} />);

    expect(screen.getByRole('heading', { name: /alternativas evaluadas/i })).toBeInTheDocument();
    expect(screen.getByText(/elegida #1/i)).toBeInTheDocument();
    expect(screen.getAllByText('Livianos primero')).toHaveLength(2);
    expect(screen.getByText('Orden actual')).toBeInTheDocument();
    expect(screen.getByText(/puntaje 775/i)).toBeInTheDocument();
    expect(screen.getByText(/1 criticas/i)).toBeInTheDocument();
    expect(screen.getAllByText(/2 ubicados/i)).toHaveLength(2);
  });

  it('renders nothing without diagnostics', () => {
    const { container } = render(<PlanCandidateDiagnosticsPanel diagnostics={undefined} />);

    expect(container).toBeEmptyDOMElement();
  });
});

describe('planner alerts', () => {
  it('renders alert severity and known backend messages in Spanish', () => {
    render(<PlanAlertsPanel alertCounts={{ critical: 0, warning: 2 }} alerts={[
      { id: 'alert-1', severity: 'WARNING', type: 'WEIGHT_IMBALANCE', message: 'Lateral load differs by more than 20%: left 600.000kg, right 0.000kg.', createdAt: '2026-05-18T00:00:00.000Z' },
      { id: 'alert-2', severity: 'WARNING', type: 'WEIGHT_IMBALANCE', message: 'Zone load is concentrated in one third of the truck.', createdAt: '2026-05-18T00:00:00.000Z' },
    ]} />);

    expect(screen.getAllByText(/advertencia/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/izquierda 600.0 kg, derecha 0.0 kg/i)).toBeInTheDocument();
    expect(screen.getByText(/concentrada en un tercio del camion/i)).toBeInTheDocument();
  });
});

describe('planner step instructions', () => {
  it('renders legacy backend step instructions in Spanish without product ids', () => {
    render(<PlanStepInstructionPreview step={{
      id: 'step-1',
      planId: 'plan-1',
      placedItemId: 'placed-1',
      sequence: 1,
      title: 'Load unit 1',
      instructions: 'Place product 3b69d807-b2c8-4a31-8344-8d8bb53a49be in DOOR_SIDE at x=2000mm, y=0mm.',
      createdAt: '2026-05-18T00:00:00.000Z',
      updatedAt: '2026-05-18T00:00:00.000Z',
    }} />);

    expect(screen.getByText('Cargar unidad 1')).toBeInTheDocument();
    expect(screen.getByText(/Ubicar el bulto en zona puerta/i)).toBeInTheDocument();
    expect(screen.queryByText(/3b69d807/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/DOOR_SIDE/i)).not.toBeInTheDocument();
  });
});
