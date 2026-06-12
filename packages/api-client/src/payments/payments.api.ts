import { apiClient } from '../axios';
import type { Invoice, Mandate } from '@saarthi/types';

export const paymentsApi = {
  getMyInvoices: async () => {
    const { data } = await apiClient.get('/payments/invoices');
    return data.data as Invoice[];
  },

  getInvoiceById: async (invoiceId: string) => {
    const { data } = await apiClient.get(`/payments/invoices/${invoiceId}`);
    return data.data as Invoice;
  },

  initiatePayment: async (invoiceId: string) => {
    const { data } = await apiClient.post(`/payments/pay/${invoiceId}`);
    return data.data as { orderId: string; amount: number; gateway: string };
  },

  getMandate: async () => {
    const { data } = await apiClient.get('/payments/mandate');
    return data.data as Mandate | null;
  },

  createMandate: async (type: 'UPI_AUTOPAY' | 'ENACH') => {
    const { data } = await apiClient.post('/payments/mandate', { type });
    return data.data as Mandate;
  },
};
