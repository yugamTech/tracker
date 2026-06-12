import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { paymentsApi } from './payments.api';

export const paymentKeys = {
  invoices: ['invoices'] as const,
  invoice: (id: string) => ['invoices', id] as const,
  mandate: ['mandate'] as const,
};

export const useMyInvoices = () =>
  useQuery({
    queryKey: paymentKeys.invoices,
    queryFn: paymentsApi.getMyInvoices,
  });

export const useInvoiceById = (id: string) =>
  useQuery({
    queryKey: paymentKeys.invoice(id),
    queryFn: () => paymentsApi.getInvoiceById(id),
    enabled: !!id,
  });

export const useMandate = () =>
  useQuery({
    queryKey: paymentKeys.mandate,
    queryFn: paymentsApi.getMandate,
  });

export const useInitiatePayment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: paymentsApi.initiatePayment,
    onSuccess: () => qc.invalidateQueries({ queryKey: paymentKeys.invoices }),
  });
};

export const useCreateMandate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: paymentsApi.createMandate,
    onSuccess: () => qc.invalidateQueries({ queryKey: paymentKeys.mandate }),
  });
};
