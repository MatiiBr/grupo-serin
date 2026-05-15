import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { destinationsApi } from '../../../api/destinations';
import { productsApi } from '../../../api/products';
import { queryKeys } from '../../../api/queryKeys';
import { MutationError, QueryState, SectionTitle } from '../../../components/ui';
import { formatProductDimensions } from '../../../lib/formatters';
import { handleProductAssignmentSubmit, OperationHeader, ProductAssignmentList } from '../components/operation-ui';
import { useDeleteMutation, useOperation } from '../hooks/operationHooks';

export function ProductsPage({ operationId }: { operationId: string }) {
  const queryClient = useQueryClient();
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

  return (
    <main className="stack">
      <QueryState query={operation}>{(item) => <OperationHeader operation={item} />}</QueryState>
      <section className="grid two">
        <div className="card">
          <SectionTitle title="Asignar producto" subtitle="Catalogo reusable + cantidad y destino de esta operacion" />
          <QueryState query={destinations}>
            {(destinationItems) => (
              <QueryState query={catalog}>
                {(catalogItems) => <form className="form matrix" onSubmit={(event) => handleProductAssignmentSubmit(event, createProduct.mutate)}>
                <label className="wide">Producto de catalogo<select name="productCatalogId" required><option value="">Seleccionar producto</option>{catalogItems.map((product) => <option key={product.id} value={product.id}>{product.code} / {product.family} / {formatProductDimensions(product)}</option>)}</select></label>
                <label>Destino<select name="operationDestinationId"><option value="">Sin destino</option>{destinationItems.map((destination) => <option key={destination.id} value={destination.id}>#{destination.unloadingOrder} {destination.catalog?.name ?? destination.destinationCatalogId}</option>)}</select></label>
                <label>Cantidad<input name="quantity" type="number" min="1" defaultValue="1" /></label>
                <label>Peso override kg<input name="weightKgOverride" type="number" step="0.01" /></label>
                <label>Largo override mm<input name="lengthMmOverride" type="number" /></label>
                <label>Ancho override mm<input name="widthMmOverride" type="number" /></label>
                <label>Alto override mm<input name="heightMmOverride" type="number" /></label>
                <label className="check"><input name="stackableOverride" type="checkbox" /> Forzar apilable</label>
                <label className="check"><input name="rotationAllowedOverride" type="checkbox" /> Forzar rotacion</label>
                <label className="wide">Notas operativas<textarea name="notes" rows={3} /></label>
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
