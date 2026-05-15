import { SellerPriority } from '@camiones/shared';
import type { FormEvent } from 'react';
import { customersApi } from '../../../api/customers';
import { ordersApi } from '../../../api/orders';
import type { ProductCatalog } from '../../../api/types';
import { optionalDate, optionalInteger, optionalText, requiredText } from '../../../lib/forms';

export function handleCustomerSubmit(event: FormEvent<HTMLFormElement>, submit: (payload: Parameters<typeof customersApi.create>[0]) => void) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  submit({
    code: requiredText(form, 'code'),
    name: requiredText(form, 'name'),
    taxId: optionalText(form, 'taxId'),
    notes: optionalText(form, 'notes'),
  });
  event.currentTarget.reset();
}

export function handleOrderSubmit(event: FormEvent<HTMLFormElement>, submit: (payload: Parameters<typeof ordersApi.create>[0]) => void, products: ProductCatalog[]) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const productCatalogId = requiredText(form, 'productCatalogId');
  const selectedProduct = products.find((product) => product.id === productCatalogId);
  submit({
    customerId: requiredText(form, 'customerId'),
    sellerPriority: requiredText(form, 'sellerPriority') as SellerPriority,
    destinationName: optionalText(form, 'destinationName'),
    requestedDeliveryAt: optionalDate(form, 'requestedDeliveryAt'),
    notes: optionalText(form, 'notes'),
    items: [{
      productCatalogId,
      productCode: optionalText(form, 'productCode') ?? selectedProduct?.code ?? productCatalogId,
      description: selectedProduct?.description ?? undefined,
      quantity: optionalInteger(form, 'quantity'),
    }],
  });
  event.currentTarget.reset();
}
