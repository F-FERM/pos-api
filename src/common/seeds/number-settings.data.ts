import { numberSettingsDocumentType } from '../../utils/common.enum';

export interface DefaultNumberSettingConfig {
  docType: numberSettingsDocumentType;
  prefix: string;
  nextNumber: number;
}

export const DEFAULT_NUMBER_SETTINGS: DefaultNumberSettingConfig[] = [
  {
    docType: numberSettingsDocumentType.INVOICE,
    prefix: 'INV-',
    nextNumber: 1,
  },
  {
    docType: numberSettingsDocumentType.PURCHASE_ORDER,
    prefix: 'PO-',
    nextNumber: 1,
  },
  {
    docType: numberSettingsDocumentType.BILL,
    prefix: 'BILL-',
    nextNumber: 1,
  },
];

export const DEFAULT_PREFIX_MAP: Record<numberSettingsDocumentType, string> = {
  [numberSettingsDocumentType.INVOICE]: 'INV-',
  [numberSettingsDocumentType.PURCHASE_ORDER]: 'PO-',
  [numberSettingsDocumentType.BILL]: 'BILL-',
};
