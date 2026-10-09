export const SYSTEM_SUBMODULES = [
  {
    moduleIdentity: 'sales',
    subModules: [
      { identity: 'customer', label: 'Customer' },
      { identity: 'register', label: 'Register Shift Session' },
      { identity: 'sale', label: 'POS Sale Invoicing' },
    ],
  },
  {
    moduleIdentity: 'inventory',
    subModules: [
      { identity: 'category', label: 'Category' },
      { identity: 'brand', label: 'Brand' },
      { identity: 'product', label: 'Product' },
    ],
  },
  {
    moduleIdentity: 'purchasing',
    subModules: [
      { identity: 'supplier', label: 'Supplier' },
      { identity: 'purchase', label: 'Stock Purchase Bill' },
    ],
  },
  {
    moduleIdentity: 'finance',
    subModules: [{ identity: 'expense', label: 'Expense Recording' }],
  },
];
