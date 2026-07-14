import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { PlanAlertsPanel, PlanCandidateDiagnosticsPanel, PlanEvaluationPanel, PlanStepInstructionPreview, buildPlacedItemAdjustmentPayload, buildUnplacedItemPlacementPayload, candidateNameLabel, formatDimension, formatPosition } from './planner-ui';

describe('planner item adjustment form mapping', () => {
  it('maps centimeter adjustment values to millimeters for the API', () => {
    expect(buildPlacedItemAdjustmentPayload({ xCm: '10', yCm: '20', zCm: '30', rotationDeg: '90', locked: false })).toEqual({
      xMm: 100,
      yMm: 200,
      zMm: 300,
      rotationDeg: 90,
      locked: false,
    });
  });

  it('maps the locked checkbox value to true', () => {
    expect(buildPlacedItemAdjustmentPayload({ xCm: '1', yCm: '2', zCm: '3', rotationDeg: '180', locked: true })).toEqual({
      xMm: 10,
      yMm: 20,
      zMm: 30,
      rotationDeg: 180,
      locked: true,
    });
  });

  it('preserves decimal centimeter precision when adjusting placed items', () => {
    expect(buildPlacedItemAdjustmentPayload({ xCm: '600', yCm: '105', zCm: '180', rotationDeg: '0', locked: false })).toEqual({
      xMm: 6000,
      yMm: 1050,
      zMm: 1800,
      rotationDeg: 0,
      locked: false,
    });
  });
});

describe('planner unplaced item manual placement form mapping', () => {
  it('maps centimeter placement inputs to millimeters for the API', () => {
    expect(buildUnplacedItemPlacementPayload({ xCm: '125', yCm: '40', zCm: '0', rotationDeg: '90', locked: true })).toEqual({
      xMm: 1250,
      yMm: 400,
      zMm: 0,
      rotationDeg: 90,
      locked: true,
    });
  });

  it('preserves decimal centimeter precision when converting to millimeters', () => {
    expect(buildUnplacedItemPlacementPayload({ xCm: '12.5', yCm: '0.5', zCm: '30.2', rotationDeg: '0', locked: false })).toEqual({
      xMm: 125,
      yMm: 5,
      zMm: 302,
      rotationDeg: 0,
      locked: false,
    });
  });
});

describe('planner units', () => {
  it('formats positions as meters and dimensions as centimeters or meters for user-facing labels', () => {
    expect(formatPosition(1250)).toBe('1.25 m');
    expect(formatPosition(0)).toBe('0.00 m');
    expect(formatDimension(850)).toBe('85 cm');
    expect(formatDimension(3200)).toBe('3.20 m');
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
      winnerExplanation: {
        summary: 'Ganó frente a 2 alternativas por tener menos violaciones críticas y mejor puntaje.',
        strengths: ['Menos violaciones críticas que Base automática.', 'Mejor puntaje general.'],
        tradeoffs: ['Todavía ocupa más largo del camión.'],
      },
      candidates: [
        candidate({ index: 1, name: 'light-first', score: 1050, hardViolationCount: 0 }),
        candidate({ index: 4, name: 'balance-lateral', score: 1075, hardViolationCount: 0 }),
      ],
      discardedCandidates: [
        { ...candidate({ index: 0, name: 'current', score: 775, hardViolationCount: 1 }), reason: 'Tiene 1 violacion(es) critica(s).' },
      ],
    }} />);

    expect(screen.getByRole('heading', { name: /alternativas válidas/i })).toBeInTheDocument();
    expect(screen.getByText(/elegida #1/i)).toBeInTheDocument();
    expect(screen.getAllByText('Livianos primero')).toHaveLength(2);
    expect(screen.getByText('Balance lateral')).toBeInTheDocument();
    expect(within(screen.getByLabelText(/alternativas válidas/i)).queryByText('Base automática')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /intentos descartados/i })).toBeInTheDocument();
    expect(within(screen.getByLabelText(/intentos descartados/i)).getByText('Base automática')).toBeInTheDocument();
    expect(screen.getByText(/puntaje 775/i)).toBeInTheDocument();
    expect(screen.getByText(/1 criticas/i)).toBeInTheDocument();
    expect(screen.getAllByText(/2 ubicados/i)).toHaveLength(3);
    expect(screen.getByText(/ganó frente a 2 alternativas/i)).toBeInTheDocument();
    expect(screen.getByText(/menos violaciones críticas que base automática/i)).toBeInTheDocument();
    expect(screen.getByText(/todavía ocupa más largo/i)).toBeInTheDocument();
    expect(screen.getByText(/mejor puntaje que las otras alternativas/i)).toBeInTheDocument();
  });

  it('selects an alternative for preview', async () => {
    const user = userEvent.setup();
    let selected: number | null = null;

    const { container } = render(<PlanCandidateDiagnosticsPanel diagnostics={{
      winnerIndex: 1,
      winnerName: 'light-first',
      winnerExplanation: {
        summary: 'Ganó frente a 1 alternativa por tener menos violaciones críticas.',
        strengths: ['Menos violaciones críticas que Base automática.'],
        tradeoffs: [],
      },
      candidates: [
        candidate({ index: 0, name: 'current', score: 775, hardViolationCount: 1 }),
        candidate({ index: 1, name: 'light-first', score: 1050, hardViolationCount: 0 }),
      ],
    }} selectedCandidateIndex={null} onSelectCandidate={(index) => { selected = index; }} />);

    await user.click(within(container).getByRole('button', { name: /base automática/i }));

    expect(selected).toBe(0);
  });

  it('renders nothing without diagnostics', () => {
    const { container } = render(<PlanCandidateDiagnosticsPanel diagnostics={undefined} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders all backend candidate strategy ids as Spanish labels', () => {
    expect(['current', 'base', 'light-first', 'large-footprint-first', 'volume-first', 'target-zone', 'balance-lateral', 'long-first', 'stack-friendly', 'best-fit-compact'].map(candidateNameLabel)).toEqual([
      'Base automática',
      'Base automática',
      'Livianos primero',
      'Mayor huella primero',
      'Mayor volumen primero',
      'Agrupado por zona',
      'Balance lateral',
      'Largos primero',
      'Apilado seguro',
      'Compactación eficiente',
    ]);
  });

  it('renders the best partial plan as manual completion guidance when valid alternatives are empty', () => {
    const { container } = render(<PlanCandidateDiagnosticsPanel diagnostics={{
      winnerIndex: 1,
      winnerName: 'light-first',
      winnerExplanation: {
        summary: 'Ganó frente a 7 intento(s) evaluado(s) por dejar menos bultos sin ubicar.',
        strengths: ['Deja menos bultos sin ubicar.'],
        tradeoffs: ['1 bulto(s) quedan sin ubicar.'],
      },
      candidates: [],
      bestPartialCandidate: { ...candidate({ index: 1, name: 'light-first', score: 1186, hardViolationCount: 1 }), placedItemCount: 28, unplacedItemCount: 1 },
      discardedCandidates: [
        { ...candidate({ index: 1, name: 'light-first', score: 1186, hardViolationCount: 1 }), unplacedItemCount: 1, reason: 'tiene 1 violacion(es) critica(s) y deja 1 bulto(s) sin ubicar.' },
      ],
    }} />);
    const panel = within(container);

    expect(panel.getByRole('heading', { name: /plan base parcial para completar manualmente/i })).toBeInTheDocument();
    expect(panel.getAllByText(/livianos primero/i).length).toBeGreaterThan(0);
    expect(panel.getByText(/28 ubicados/i)).toBeInTheDocument();
    expect(panel.getAllByText(/1 sin ubicar/i).length).toBeGreaterThan(0);
    expect(panel.getByText(/el plan guardado muestra este resultado parcial/i)).toBeInTheDocument();
    expect(panel.getByText(/no hay alternativas válidas completas/i)).toBeInTheDocument();
  });
});

function candidate(overrides: { index: number; name: string; score: number; hardViolationCount: number }) {
  return {
    ...overrides,
    placedItemCount: 2,
    unplacedItemCount: 0,
    explanation: {
      summary: overrides.index === 1 ? 'Ganó por mejor puntaje que las otras alternativas.' : 'Perdió frente a la elegida por menor puntaje.',
      strengths: overrides.index === 1 ? ['Mejor puntaje que las otras alternativas.'] : ['Ubicó todos los bultos.'],
      tradeoffs: overrides.hardViolationCount > 0 ? ['Tiene violaciones críticas pendientes.'] : [],
    },
    placedItems: [],
    unplacedItems: [],
    steps: [],
    alerts: [],
    metrics: { placedItemCount: 2, unplacedItemCount: 0, criticalAlertCount: overrides.hardViolationCount, warningAlertCount: 0 },
    evaluation: { score: overrides.score, hardViolationCount: overrides.hardViolationCount, softPenaltyTotal: 0, penalties: [] },
  };
}

describe('planner alerts', () => {
  it('renders alert severity and known backend messages in Spanish', () => {
    render(<PlanAlertsPanel alertCounts={{ critical: 1, warning: 2 }} alerts={[
      { id: 'alert-1', severity: 'WARNING', type: 'WEIGHT_IMBALANCE', message: 'Lateral load differs by more than 20%: left 600.000kg, right 0.000kg.', createdAt: '2026-05-18T00:00:00.000Z' },
      { id: 'alert-2', severity: 'WARNING', type: 'WEIGHT_IMBALANCE', message: 'Zone load is concentrated in one third of the truck.', createdAt: '2026-05-18T00:00:00.000Z' },
      { id: 'alert-3', severity: 'CRITICAL', type: 'MAX_WEIGHT_EXCEEDED', message: 'Truck zone DOOR_SIDE load 500.000kg exceeds zone max 400.000kg.', createdAt: '2026-05-18T00:00:00.000Z' },
    ]} />);

    expect(screen.getAllByText(/advertencia/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/izquierda 600.0 kg, derecha 0.0 kg/i)).toBeInTheDocument();
    expect(screen.getByText(/concentrada en un tercio del camion/i)).toBeInTheDocument();
    expect(screen.getByText(/zona puerta carga 500.0 kg/i)).toBeInTheDocument();
    expect(screen.queryByText(/Truck zone/i)).not.toBeInTheDocument();
  });

  it('uses product code and name instead of UUID when an alert belongs to a product', () => {
    render(<PlanAlertsPanel alertCounts={{ critical: 1, warning: 0 }} alerts={[
      { id: 'alert-1', severity: 'CRITICAL', type: 'UNPLACED_ITEM', productId: '3b69d807-b2c8-4a31-8344-8d8bb53a49be', productCode: 'CH-100', productName: 'Chapa galvanizada', message: 'No floor space available for product 3b69d807-b2c8-4a31-8344-8d8bb53a49be.', createdAt: '2026-05-18T00:00:00.000Z' },
    ]} />);

    expect(screen.getByText(/CH-100 · Chapa galvanizada/i)).toBeInTheDocument();
    expect(screen.getByText(/No hay espacio disponible en piso para este bulto/i)).toBeInTheDocument();
    expect(screen.queryByText(/3b69d807/i)).not.toBeInTheDocument();
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
