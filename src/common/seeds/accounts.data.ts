import { AccountCategory, AccountType } from '../../models/account.schema';

export enum SystemAccountCode {
  CASH = '1010',
  BANK = '1020',
  ACCOUNTS_RECEIVABLE = '1100',
  INVENTORY_ASSET = '1200',
  ACCOUNTS_PAYABLE = '2100',
  OWNER_EQUITY = '3100',
  SALES_REVENUE = '4100',
  OTHER_INCOME = '4200',
  COGS_EXPENSE = '5100',
  SALES_DISCOUNT_EXPENSE = '5200',
  LOYALTY_EXPENSE = '5300',
  OPERATING_EXPENSE = '5400',
}

export interface DefaultSystemAccountConfig {
  code: SystemAccountCode;
  name: string;
  type: AccountType;
  category: AccountCategory;
  description: string;
  isSystemGenerated: boolean;
}

export const DEFAULT_SYSTEM_ACCOUNTS: DefaultSystemAccountConfig[] = [
  {
    code: SystemAccountCode.CASH,
    name: 'Cash in Hand',
    type: AccountType.ASSET,
    category: AccountCategory.CURRENT_ASSET,
    description: 'Main till and cash in hand account for daily store sales and expenses',
    isSystemGenerated: true,
  },
  {
    code: SystemAccountCode.BANK,
    name: 'Bank Account',
    type: AccountType.ASSET,
    category: AccountCategory.CURRENT_ASSET,
    description: 'Primary bank account for card and electronic payments',
    isSystemGenerated: true,
  },
  {
    code: SystemAccountCode.ACCOUNTS_RECEIVABLE,
    name: 'Accounts Receivable',
    type: AccountType.ASSET,
    category: AccountCategory.CURRENT_ASSET,
    description: 'Money owed to store by customers for credit sales',
    isSystemGenerated: true,
  },
  {
    code: SystemAccountCode.INVENTORY_ASSET,
    name: 'Inventory Asset',
    type: AccountType.ASSET,
    category: AccountCategory.CURRENT_ASSET,
    description: 'Valuation of store merchandise and stock inventory',
    isSystemGenerated: true,
  },
  {
    code: SystemAccountCode.ACCOUNTS_PAYABLE,
    name: 'Accounts Payable',
    type: AccountType.LIABILITY,
    category: AccountCategory.CURRENT_LIABILITY,
    description: 'Money owed by store to suppliers for credit purchases',
    isSystemGenerated: true,
  },
  {
    code: SystemAccountCode.OWNER_EQUITY,
    name: 'Owner Equity & Capital',
    type: AccountType.EQUITY,
    category: AccountCategory.EQUITY,
    description: 'Owner capital investment and retained store earnings',
    isSystemGenerated: true,
  },
  {
    code: SystemAccountCode.SALES_REVENUE,
    name: 'Sales Revenue',
    type: AccountType.INCOME,
    category: AccountCategory.OPERATING_INCOME,
    description: 'Gross revenue generated from store sales and retail transactions',
    isSystemGenerated: true,
  },
  {
    code: SystemAccountCode.OTHER_INCOME,
    name: 'Other Income',
    type: AccountType.INCOME,
    category: AccountCategory.NON_OPERATING_INCOME,
    description: 'Miscellaneous store receipts and non-operating revenue',
    isSystemGenerated: true,
  },
  {
    code: SystemAccountCode.COGS_EXPENSE,
    name: 'Cost of Goods Sold / Purchases',
    type: AccountType.EXPENSE,
    category: AccountCategory.COST_OF_GOODS_SOLD,
    description: 'Direct cost of merchandise sold and supplier stock inventory purchases',
    isSystemGenerated: true,
  },
  {
    code: SystemAccountCode.SALES_DISCOUNT_EXPENSE,
    name: 'Sales Discounts & Allowances',
    type: AccountType.EXPENSE,
    category: AccountCategory.OPERATING_EXPENSE,
    description: 'Promotional discounts, promotional coupons, and price concessions given to customers',
    isSystemGenerated: true,
  },
  {
    code: SystemAccountCode.LOYALTY_EXPENSE,
    name: 'Loyalty Program Expense',
    type: AccountType.EXPENSE,
    category: AccountCategory.OPERATING_EXPENSE,
    description: 'Monetary value of customer loyalty points redeemed during sales',
    isSystemGenerated: true,
  },
  {
    code: SystemAccountCode.OPERATING_EXPENSE,
    name: 'Operating & General Expenses',
    type: AccountType.EXPENSE,
    category: AccountCategory.OPERATING_EXPENSE,
    description: 'General store operating expenses, utilities, rent, and overheads',
    isSystemGenerated: true,
  },
];
