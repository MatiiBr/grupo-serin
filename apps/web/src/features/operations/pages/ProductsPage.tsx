import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { destinationsApi } from '../../../api/destinations';
import { productsApi } from '../../../api/products';
import { queryKeys } from '../../../api/queryKeys';
import { MutationError, QueryState, SectionTitle } from '../../../components/ui';
import { formatProductDimensions } from '../../../lib/formatters';
import { OperationHeader, ProductAssignmentList } from '../components/operation-ui';
import { useDeleteMutation, useOperation } from '../hooks/operationHooks';

interface ProductFormValues {
  productCatalogId: string;
  operationDestinationId?: string;
  quantity?: number;
  weightKgOverride?: number;
  lengthMmOverride?: number;
  widthMmOverride?: number;
  heightMmOverride?: number;
  stackableOverride?: boolean;
  rotationAllowedOverride?: boolean;
  notes?: string;
}

export function ProductsPage({ operationId }: { operationId: string }) {
  const queryClient = useQueryClient();
  const { handleSubmit, register, reset } = useForm<ProductFormValues>({ defaultValues: { quantity: 1 } });
  const operation = useOperation(operationId);
  const destinations = useQuery({ queryKey: queryKeys.destinationAssignments.list(operationId), queryFn: () => destinationsApi.listAssignments(operationId) });
  const catalog = useQuery({ queryKey: queryKeys.productCatalog.search(), queryFn: () => productsApi.searchCatalog() });
  const products = useQuery({ queryKey: queryKeys.productAssignments.list(operationId), queryFn: () => productsApi.listAssignments(operationId) });
  const createProduct = useMutation({
    mutationFn: productsApi.createAssignment.bind(null, operationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.productAssignments.list(operationId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.operations.detail(operationId) });
    },
  });
  const deleteProduct = useDeleteMutation((id: string) => productsApi.removeAssignment(id), queryKeys.productAssignments.list(operationId), queryKeys.operations.detail(operationId));
  const onSubmit = handleSubmit((values) => {
    createProduct.mutate({
      productCatalogId: values.productCatalogId,
      operationDestinationId: optionalValue(values.operationDestinationId) ?? null,
      quantity: optionalNumberValue(values.quantity),
      weightKgOverride: optionalNumberValue(values.weightKgOverride),
      lengthMmOverride: optionalNumberValue(values.lengthMmOverride),
      widthMmOverride: optionalNumberValue(values.widthMmOverride),
      heightMmOverride: optionalNumberValue(values.heightMmOverride),
      stackableOverride: values.stackableOverride ? true : undefined,
      rotationAllowedOverride: values.rotationAllowedOverride ? true : undefined,
      notes: optionalValue(values.notes),
    });
    reset({ quantity: 1 });
  });

  return (
    <main className="stack">
      <QueryState query={operation}>{(item) => <OperationHeader operation={item} />}</QueryState>
      <section className="grid two">
        <div className="card">
          <SectionTitle title="Asignar producto" subtitle="Catalogo reusable + cantidad y destino de esta operacion" />
          <QueryState query={destinations}>
            {(destinationItems) => (
              <QueryState query={catalog}>
                {(catalogItems) => <form className="form matrix" onSubmit={onSubmit}>
                <label className="wide">Producto de catalogo<select required {...register('productCatalogId')}><option value="">Seleccionar producto</option>{catalogItems.map((product) => <option key={product.id} value={product.id}>{product.code} / {product.family} / {formatProductDimensions(product)}</option>)}</select></label>
                <label>Destino<select {...register('operationDestinationId')}><option value="">Sin destino</option>{destinationItems.map((destination) => <option key={destination.id} value={destination.id}>#{destination.unloadingOrder} {destination.catalog?.name ?? destination.destinationCatalogId}</option>)}</select></label>
                <label>Cantidad<input type="number" min="1" {...register('quantity', { valueAsNumber: true })} /></label>
                <label>Peso override kg<input type="number" step="0.01" {...register('weightKgOverride', { valueAsNumber: true })} /></label>
                <label>Largo override mm<input type="number" {...register('lengthMmOverride', { valueAsNumber: true })} /></label>
                <label>Ancho override mm<input type="number" {...register('widthMmOverride', { valueAsNumber: true })} /></label>
                <label>Alto override mm<input type="number" {...register('heightMmOverride', { valueAsNumber: true })} /></label>
                <label className="check"><input type="checkbox" {...register('stackableOverride')} /> Forzar apilable</label>
                <label className="check"><input type="checkbox" {...register('rotationAllowedOverride')} /> Forzar rotacion</label>
                <label className="wide">Notas operativas<textarea rows={3} {...register('notes')} /></label>
                <button disabled={createProduct.isPending || catalogItems.length === 0}>Asignar producto</button>
                <MutationError error={createProduct.error} />
              </form>}
              </QueryState>
            )}
          </QueryState>
        </div>
        <div className="card">
          <SectionTitle title="Productos" subtitle="Asignaciones de la operacion" />
          <QueryState query={products}>
            {(items) => <ProductAssignmentList items={items} onDelete={(id) => deleteProduct.mutate(id)} />}
          </QueryState>
          <MutationError error={deleteProduct.error} />
        </div>
      </section>
    </main>
  );
}

function optionalValue(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function optionalNumberValue(value?: number) {
  return typeof value === 'number' && !Number.isNaN(value) ? value : undefined;
}
