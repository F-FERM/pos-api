import { PaymentTermType } from 'src/utils/common.enum';

export const DEFAULT_PAYMENT_TERMS = [
  { name: 'Due on Receipt', type: PaymentTermType.FIXED, numberOfDays: 0 },
  { name: 'Net 15', type: PaymentTermType.FIXED, numberOfDays: 15 },
  { name: 'Net 30', type: PaymentTermType.FIXED, numberOfDays: 30 },
  { name: 'Net 45', type: PaymentTermType.FIXED, numberOfDays: 45 },
  { name: 'Net 60', type: PaymentTermType.FIXED, numberOfDays: 60 },
  { name: 'Due end of month', type: PaymentTermType.END_OF_MONTH },
  {
    name: 'Due end of next month',
    type: PaymentTermType.END_OF_NEXT_MONTH,
  },
  {
    name: 'Custom',
    type: PaymentTermType.CUSTOM,
  },
];
