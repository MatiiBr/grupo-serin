import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PlanEvaluationPanel, buildPlacedItemAdjustmentPayload } from './planner-ui';

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
    expect(screen.getByText(/1 hard/i)).toBeInTheDocument();
    expect(screen.getByText(/weight-imbalance/i)).toBeInTheDocument();
    expect(screen.getByText(/-50 pts/i)).toBeInTheDocument();
  });

  it('renders nothing without evaluation data', () => {
    const { container } = render(<PlanEvaluationPanel evaluation={undefined} />);

    expect(container).toBeEmptyDOMElement();
  });
});
