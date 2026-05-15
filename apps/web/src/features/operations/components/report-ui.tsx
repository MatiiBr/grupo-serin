import { PlanStatus } from '@camiones/shared';
import { loadingPlansApi } from '../../../api/loading-plans';
import { formatDate, formatNumber } from '../../../lib/formatters';
import { navigate } from '../../../lib/navigation';
import { buildAlertsByPlacedItemId, buildItemStatusByPlacedItemId, TruckCanvas } from './planner-ui';

export function OperationalReport({ report }: { report: Awaited<ReturnType<typeof loadingPlansApi.report>> }) {
  const { operation, truck, destinations, products, plan } = report;
  const nonCriticalAlerts = plan.alerts.filter((alert) => alert.severity !== 'CRITICAL');
  const approvalDate = plan.approvedAt ?? (plan.planStatus === PlanStatus.APPROVED ? plan.updatedAt : null);
  const productRows = products.map((product) => [product.code, product.destinationName ?? '-', product.family, String(product.quantity), formatNumber(product.weightKg, 'kg')]);
  const stepRows = plan.steps.map((step) => [String(step.sequence), step.title, step.instructions ?? '-']);
  const placedRows = plan.placedItems.map((item) => [item.productCode, item.destinationName ?? '-', `${item.xMm}/${item.yMm}/${item.zMm}`, `${item.lengthMm}/${item.widthMm}/${item.heightMm}`, item.zoneType ?? '-']);

  return (
    <article className="print-report">
      <div className="report-actions no-print">
        <button className="ghost" type="button" onClick={() => navigate(`/operations/${operation.id}/planner`)}>Volver al planner</button>
        <button type="button" onClick={() => window.print()}>Imprimir reporte</button>
      </div>
      <header className="report-header">
        <div>
          <p className="eyebrow">Reporte operativo de carga</p>
          <h1>{operation.code}</h1>
          <p>{operation.name ?? 'Operacion sin nombre'}{operation.scheduledAt ? ` / ${formatDate(operation.scheduledAt)}` : ''}</p>
        </div>
        <div className="report-stamp">
          <span>{plan.planStatus}</span>
          <strong>{approvalDate ? formatDate(approvalDate) : 'Pendiente de aprobacion'}</strong>
        </div>
      </header>
      <section className="report-grid">
        <ReportBlock title="Camion" rows={[
          ['Patente', truck?.plate ?? '-'],
          ['Metodo', truck?.loadingMethod ?? plan.loadingMethod],
          ['Payload', formatNumber(truck?.maxPayloadKg, 'kg')],
          ['Dimensiones', truck ? `${truck.lengthMm ?? '-'} x ${truck.widthMm ?? '-'} x ${truck.heightMm ?? '-'} mm` : '-'],
        ]} />
        <ReportBlock title="Metricas" rows={[
          ['Peso total', formatNumber(plan.metrics?.totalWeightKg, 'kg')],
          ['Peso ubicado', formatNumber(plan.metrics?.placedWeightKg, 'kg')],
          ['Volumen usado', formatNumber(plan.metrics?.usedVolumeM3, 'm3')],
          ['Utilizacion', formatNumber(plan.metrics?.volumeUtilizationPct, '%')],
          ['Centro gravedad', `${formatNumber(plan.metrics?.centerOfGravityX, 'mm')} / ${formatNumber(plan.metrics?.centerOfGravityY, 'mm')} / ${formatNumber(plan.metrics?.centerOfGravityZ, 'mm')}`],
        ]} />
      </section>
      <section className="report-section">
        <h2>Destinos y orden de descarga</h2>
        <ReportTable headers={['Orden', 'Destino', 'Codigo', 'Direccion']} rows={destinations.map((destination) => [String(destination.unloadingOrder), destination.name, destination.code ?? '-', destination.address ?? '-'])} />
      </section>
      <section className="report-section">
        <h2>Resumen de productos</h2>
        <ReportTable headers={['Producto', 'Destino', 'Familia', 'Cantidad', 'Peso unitario']} rows={productRows} />
      </section>
      <section className="report-section">
        <h2>Secuencia de carga</h2>
        <ReportTable headers={['Paso', 'Accion', 'Instruccion']} rows={stepRows} />
      </section>
      <section className="report-section">
        <h2>Plano superior simplificado</h2>
        <TruckCanvas items={plan.placedItems} truck={truck} itemStatusByPlacedItemId={buildItemStatusByPlacedItemId(buildAlertsByPlacedItemId(plan.alerts))} />
        <ReportTable headers={['Producto', 'Destino', 'X/Y/Z', 'L/A/H', 'Zona']} rows={placedRows} />
      </section>
      <section className="report-section">
        <h2>Alertas no criticas</h2>
        {nonCriticalAlerts.length === 0 ? <p>Sin alertas no criticas.</p> : <ReportTable headers={['Severidad', 'Tipo', 'Mensaje']} rows={nonCriticalAlerts.map((alert) => [alert.severity, alert.type, alert.message])} />}
      </section>
      {operation.notes ? <section className="report-section"><h2>Notas</h2><p>{operation.notes}</p></section> : null}
    </article>
  );
}

function ReportBlock({ title, rows }: { title: string; rows: string[][] }) {
  return <section className="report-block"><h2>{title}</h2>{rows.map(([label, value]) => <div className="report-row" key={label}><span>{label}</span><strong>{value}</strong></div>)}</section>;
}

function ReportTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return <div className="report-table-wrap"><table><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={`${index}-${cellIndex}`}>{cell}</td>)}</tr>)}</tbody></table></div>;
}
