import { useLocation } from 'react-router-dom';
import type { LoadingPlan, OperationDestinationAssignment, OperationDetail, OperationProductAssignment, OperationSummary, OperationVehicleAssignment } from '../../../api/types';
import { SectionTitle } from '../../../components/ui';
import { formatAssignmentWeight, formatDate, formatNumber, formatProductDimensions } from '../../../lib/formatters';
import { navigate } from '../../../lib/navigation';

export function OperationHeader({ operation }: { operation: OperationDetail }) {
  const location = useLocation();
  const basePath = `/operations/${operation.id}`;
  const links = [
    ['operation', 'Resumen', basePath],
    ['truck', 'Camion', `${basePath}/truck`],
    ['destinations', 'Destinos', `${basePath}/destinations`],
    ['products', 'Productos', `${basePath}/products`],
    ['planner', 'Planner', `${basePath}/planner`],
    ['report', 'Reporte', `${basePath}/report`],
  ] as const;
  const currentRoute = links.find(([routeName, , href]) => (routeName === 'operation' ? location.pathname === href : location.pathname.startsWith(href)))?.[0] ?? 'operation';

  return (
    <section className="card operation-head">
      <div className="operation-head-top">
        <button className="back" type="button" onClick={() => navigate('/operations')}>← Operaciones</button>
        <nav className="operation-nav" aria-label="Navegacion de operacion">
          {links.map(([routeName, label, href]) => (
            <button className={currentRoute === routeName ? 'active' : ''} key={routeName} type="button" onClick={() => navigate(href)}>
              {label}
            </button>
          ))}
        </nav>
      </div>
      <div className="operation-title-block">
        <p className="eyebrow">{operation.status}</p>
        <h1>{operation.code}</h1>
        <p className="lede">{operation.name ?? 'Operacion sin nombre'}{operation.scheduledAt ? ` / ${formatDate(operation.scheduledAt)}` : ''}</p>
      </div>
    </section>
  );
}

export function OperationRow({ operation }: { operation: OperationSummary }) {
  return (
    <button className="row" type="button" onClick={() => navigate(`/operations/${operation.id}`)}>
      <span><strong>{operation.code}</strong><small>{operation.name ?? 'Sin nombre'} / {operation.status}</small></span>
      <span className="chips"><i>{operation.counts?.destinations ?? 0} destinos</i><i>{operation.counts?.products ?? 0} productos</i><i>{operation.counts?.plans ?? 0} planes</i></span>
    </button>
  );
}

export function DashboardLink({ href, label, value }: { href: string; label: string; value: string }) {
  return <button className="dash" type="button" onClick={() => navigate(href)}><span>{label}</span><strong>{value}</strong></button>;
}

export function VehicleAssignmentSummary({ item }: { item: OperationVehicleAssignment }) {
  return (
    <div className="assignment-summary">
      <strong>{item.truck?.plate ?? item.truckCatalogId}</strong>
      <span>{item.truck?.loadingMethod ?? '-'} / {item.truck?.lengthMm ?? '-'} x {item.truck?.widthMm ?? '-'} x {item.truck?.heightMm ?? '-'} mm</span>
      {item.trailer ? <span>Acoplado: {item.trailer.code}</span> : <span>Sin acoplado asignado</span>}
    </div>
  );
}

export function DestinationList({ items, onDelete, onMove, isReordering }: { items: OperationDestinationAssignment[]; onDelete: (id: string) => void; onMove: (ids: string[]) => void; isReordering: boolean }) {
  if (items.length === 0) return <p className="muted">Sin destinos cargados.</p>;
  const sortedItems = [...items].sort((left, right) => left.unloadingOrder - right.unloadingOrder);
  return <div className="list compact sequence-list">{sortedItems.map((item, index) => <div className="item sequence-item" key={item.id}><span className="sequence-badge">{index + 1}</span><span><strong>{item.catalog?.name ?? item.destinationCatalogId}</strong><small>{item.catalog?.code ?? 'Sin codigo'} {item.catalog?.address ? `/ ${item.catalog.address}` : ''}{item.notes ? ` / ${item.notes}` : ''}</small></span><span className="sequence-actions"><button className="ghost" disabled={isReordering || index === 0} onClick={() => onMove(moveDestination(sortedItems, index, -1))}>Subir</button><button className="ghost" disabled={isReordering || index === sortedItems.length - 1} onClick={() => onMove(moveDestination(sortedItems, index, 1))}>Bajar</button><button className="ghost" onClick={() => onDelete(item.id)}>Eliminar</button></span></div>)}</div>;
}

export function ProductAssignmentList({ items, onDelete }: { items: OperationProductAssignment[]; onDelete: (id: string) => void }) {
  if (items.length === 0) return <p className="muted">Sin productos cargados.</p>;
  return <div className="list compact">{items.map((item) => {
    const product = item.catalog;
    const destination = item.operationDestination?.catalog;
    return <div className="item" key={item.id}><span><strong>{product?.code ?? item.productCatalogId}</strong><small>{product?.family ?? '-'} / qty {item.quantity} / destino {destination?.name ?? 'sin destino'} / {formatAssignmentWeight(item, product)} / {formatProductDimensions(product)}</small></span><button className="ghost" onClick={() => onDelete(item.id)}>Eliminar</button></div>;
  })}</div>;
}

export function MetricGrid({ metrics }: { metrics: LoadingPlan['metrics'] }) {
  const values = [
    ['Peso total', formatNumber(metrics?.totalWeightKg, 'kg')],
    ['Peso ubicado', formatNumber(metrics?.placedWeightKg, 'kg')],
    ['Volumen usado', formatNumber(metrics?.usedVolumeM3, 'm3')],
    ['Utilizacion', formatNumber(metrics?.volumeUtilizationPct, '%')],
    ['Ubicados', String(metrics?.placedItemCount ?? 0)],
    ['No ubicados', String(metrics?.unplacedItemCount ?? 0)],
  ];
  return <div className="metrics">{values.map(([label, value]) => <div className="metric" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>;
}

export function DataTable({ title, headers, rows }: { title: string; headers: string[]; rows: string[][] }) {
  return <div className="card"><SectionTitle title={title} subtitle={`${rows.length} registros`} /><div className="table-wrap"><table><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={`${title}-${index}`}>{row.map((cell, cellIndex) => <td key={`${title}-${index}-${cellIndex}`}>{cell}</td>)}</tr>)}</tbody></table></div></div>;
}

export function nextDestinationOrder(items: OperationDestinationAssignment[]) {
  if (items.length === 0) return 1;
  return Math.max(...items.map((item) => item.unloadingOrder)) + 1;
}

function moveDestination(items: OperationDestinationAssignment[], index: number, direction: -1 | 1) {
  const nextItems = [...items];
  const targetIndex = index + direction;
  [nextItems[index], nextItems[targetIndex]] = [nextItems[targetIndex], nextItems[index]];
  return nextItems.map((item) => item.id);
}
