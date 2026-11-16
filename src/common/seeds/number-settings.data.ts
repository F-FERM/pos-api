import { numberSettingsDocumentType } from '../../utils/common.enum';

export interface DefaultNumberSettingConfig {
  docType: numberSettingsDocumentType;
  prefix: string;
  nextNumber: number;
  mode?: 'Auto' | 'Manual';
}

export const DEFAULT_NUMBER_SETTINGS: DefaultNumberSettingConfig[] = [
  {
    docType: numberSettingsDocumentType.INVOICE,
    prefix: 'INV-',
    nextNumber: 1,
    mode: 'Auto',
  },
  {
    docType: numberSettingsDocumentType.PURCHASE_ORDER,
    prefix: 'PO-',
    nextNumber: 1,
    mode: 'Auto',
  },
  {
    docType: numberSettingsDocumentType.BILL,
    prefix: 'BILL-',
    nextNumber: 1,
    mode: 'Auto',
  },
  {
    docType: numberSettingsDocumentType.SALE_RETURN,
    prefix: 'SR-',
    nextNumber: 1,
    mode: 'Auto',
  },
  {
    docType: numberSettingsDocumentType.ACCOUNT_TRANSACTION,
    prefix: 'TXN-',
    nextNumber: 1,
    mode: 'Auto',
  },
];

export const DEFAULT_PREFIX_MAP: Record<numberSettingsDocumentType, string> = {
  [numberSettingsDocumentType.INVOICE]: 'INV-',
  [numberSettingsDocumentType.PURCHASE_ORDER]: 'PO-',
  [numberSettingsDocumentType.BILL]: 'BILL-',
  [numberSettingsDocumentType.SALE_RETURN]: 'SR-',
  [numberSettingsDocumentType.ACCOUNT_TRANSACTION]: 'TXN-',
};
