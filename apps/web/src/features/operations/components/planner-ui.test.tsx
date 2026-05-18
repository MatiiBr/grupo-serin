import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PlanCandidateDiagnosticsPanel, PlanEvaluationPanel, buildPlacedItemAdjustmentPayload } from './planner-ui';

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
    expect(screen.getAllByText(/1 hard/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/weight-imbalance/i)).toBeInTheDocument();
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

    expect(screen.getByRole('heading', { name: /candidatos evaluados/i })).toBeInTheDocument();
    expect(screen.getByText(/ganador #1/i)).toBeInTheDocument();
    expect(screen.getAllByText('light-first')).toHaveLength(2);
    expect(screen.getByText('current')).toBeInTheDocument();
    expect(screen.getByText(/score 775/i)).toBeInTheDocument();
    expect(screen.getAllByText(/1 hard/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/2 ubicados/i)).toHaveLength(2);
  });

  it('renders nothing without diagnostics', () => {
    const { container } = render(<PlanCandidateDiagnosticsPanel diagnostics={undefined} />);

    expect(container).toBeEmptyDOMElement();
  });
});
