# NestJS Point-of-Sale (POS) REST API — System Feature Documentation

This document provides a comprehensive, module-by-module breakdown of all built features and capabilities within this NestJS POS REST API repository.

---

## Executive Architecture Summary

- **Architecture Pattern**: NestJS Feature-Module Architecture (Controller, Service extending `GenericDatabase`, Module, DTOs, Mongoose Schema).
- **Multi-Tenant Store Scoping**: Company-level data isolation via `{ companyId: ObjectId, isDeleted: false }`.
- **Hybrid Cloud / Local DB**: Cloud Superadmin support (`CLOUD_MONGO_URI`) and offline/local store terminal support with automated bi-directional synchronization.
- **API Response Envelope**: All API endpoints return a standardized envelope:
  ```json
  {
    "success": true,
    "message": "Human readable message",
    "data": {},
    "statusCode": 200
  }
  ```
- **Access Control & Security**: JWT Authentication (`JwtAuthGuard`), Granular Role Guard (`RolesGuard`), Sub-Module Permissions Guard (`PermissionGuard`), and Subscription Guard (`SubscriptionGuard`).
- **Audit Logging**: Comprehensive activity and audit trail logged via `LogService`.

---

## Complete Module & Feature Matrix

### 1. Authentication & Security (`src/auth/`)
- **User Authentication**: Standard store user login via email/username & password.
- **Cloud Superadmin Authentication**: Direct Superadmin (`anees`) privilege verification against Cloud MongoDB (`CLOUD_MONGO_URI`).
- **JWT Token Management**: Access token issuance with user ID, company ID, and role payload.
- **Public & Protected Route Control**: Custom decorators `@Public()`, `@Roles()`, and `@CheckPermission()` for fine-grained authorization.

### 2. Multi-Tenant Company Store Management (`src/company/`)
- **Store Company Creation**: Initialize new store company entity.
- **Company Validation**: Service helper `validateCompany(companyId, userId)` ensuring store context security.
- **Store Details Management**: Name, contact details, store settings, and tax configuration.
- **Company Updates & Soft Deletion**: Full lifecycle management for store companies.

### 3. User Management (`src/user/`)
- **Store Staff User Creation**: Add store users with assigned roles (`Role.admin`, `Role.user`, `Role.superadmin`).
- **Privilege Linking**: Associate granular privileges to store users.
- **User Authentication Validation**: Service helper `validateAuthenticatedUser(userId)` to verify user status and credentials.
- **User Listing & Search**: Paginated user listing with search filters.
- **User Updates & Soft Deletion**: Update details, reset passwords, or soft-delete user accounts.

### 4. Privilege & Role Permissions (`src/privilege/`)
- **Custom Privilege Creation**: Define store-specific privileges with assigned sub-module permissions matrix.
- **Granular Sub-Module Permissions**: Configure action-level flags (`canCreate`, `canRead`, `canUpdate`, `canDelete`) per submodule.
- **System Privileges Seeding**: Auto-seeding of platform system privileges on startup.
- **Privilege Protection**: Deletion guards preventing soft-deletion if assigned to active users or if system-generated.

### 5. Platform Modules & Catalog (`src/module/`)
- **System Modules Seeding**: Auto-seeding of core platform modules (`sales`, `inventory`, `purchasing`, `finance`).
- **System Submodules Seeding**: Auto-seeding of submodules under corresponding modules.
- **Privilege Tree API (`GET /module/with-submodules`)**: Hierarchical structure listing all active modules with nested submodules specifically designed for the Create Privilege UI.
- **Module Lookup**: Query module and submodule ObjectIds by identity key.

### 6. Customer Management (`src/customer/`)
- **Customer Lifecycle**: Create, retrieve, update, and soft-delete customer profiles.
- **Customer Categorization Tags**: `tag` field backed by `CustomerTag` enum (`REGULAR`, `VIP`, `WHOLESALE`).
- **Credit & Financial Tracking**: `creditLimit` and `balanceDue` tracking per customer.
- **Loyalty Points Balance**: Accumulate and track customer loyalty points.
- **Single Customer Profile (`GET /customer/:id`)**:
  - Full Customer Details.
  - Complete Sales & Purchase History (`purchaseHistory`).
  - Total Purchases Count (`totalPurchases`).
  - Total Spent Aggregate (`totalSpent`).

### 7. Supplier Management (`src/supplier/`)
- **Supplier Lifecycle**: Create, retrieve, update, and soft-delete supplier records.
- **GSTIN / TRN Tax Number**: `gstinNumber` field for GSTIN/TRN tax registration numbers.
- **Required Payment Terms Linkage**: `paymentTermsId` field referencing `PaymentTerm` schema.
- **Payment Terms Service Validation**: Injected `PaymentTermsService.genericFindOne(...)` validation ensuring valid, non-deleted payment terms.
- **Populated Payment Term View**: Query responses automatically populate payment term details (`name`, `type`, `numberOfDays`).

### 8. Product & Catalog Management (`src/product/`)
- **Product Lifecycle**: Create, list, update, and soft-delete products.
- **Catalog Associations**: Link products to Categories, Brands, and Units of Measure (UOM).
- **Pricing & Inventory Fields**: Cost Price, Selling Price, Tax Percentage, Stock Quantity, and Reorder Thresholds.
- **Barcode Generation (`GET /product/generate-barcode`)**: Auto-generate unique barcodes for products.
- **Barcode Scanning Endpoint (`GET /product/scan/:barcode`)**: Rapid product lookup by barcode string for fast checkout.

### 9. Category Management (`src/category/`)
- **Category Lifecycle**: Create, update, list, and soft-delete product categories.
- **Category Hierarchy**: Support parent-child category relationships.
- **Search & Pagination**: Paginated listing with name-based regex search.

### 10. Brand Management (`src/brand/`)
- **Brand Lifecycle**: Create, list, update, and soft-delete product brands.
- **Brand Search & Filtering**: Paginated query responses.

### 11. Unit of Measure Management (`src/unit/`)
- **Unit Lifecycle**: Create, list, update, and soft-delete units of measure (Pcs, Kg, Ltr, Box, etc.).
- **System Units**: Support default system-generated units.

### 12. POS Sales & Invoicing (`src/sale/`)
- **Checkout Invoicing**: Create sales with itemized products, quantities, unit prices, discounts, and taxes.
- **Multiple Payment Methods**: Support `CASH`, `CARD`, `UPI`, `CREDIT`.
- **Hold Sales (Draft Invoices)**: Save sales in `SAVE` status for later checkout resume.
- **Register Shift Linkage**: Associate sales with active register shift sessions (`registerSessionId`).
- **Loyalty Redemption**: Redeem customer loyalty points for sale discounts.
- **Automatic Stock Deduction**: Automatically update product inventory stock on completed sales.

### 13. Sale Returns & Refunds (`src/sale-return/`)
- **Sale Return Processing**: Process returns against existing sale invoice numbers.
- **Itemized Return Validation**: Verify return quantities do not exceed originally purchased quantities.
- **Refund Allocation**: Refund via `CASH`, `CARD`, `UPI`, or `STORE_CREDIT`.
- **Customer Credit & Balance Sync**: Update customer balance due or credit when returning via store credit.
- **Stock Inventory Restocking**: Automatically increment product inventory stock upon approved return.

### 14. Stock Purchase Bills (`src/purchase/`)
- **Purchase Order / Bill Recording**: Create stock purchase bills from suppliers.
- **Inventory Restocking**: Automatically increment product stock levels upon purchase creation.
- **Accounts Payable Updates**: Record supplier balance due.

### 15. Expense Management (`src/expense/`)
- **Store Expense Recording**: Track operational expenses with category, payment account, amount, and notes.
- **Financial Statement Integration**: Expense totals feed into store financial summaries.

### 16. Chart of Accounts & Finance (`src/account/`)
- **Chart of Accounts**: Create and manage Assets, Liabilities, Equity, Income, and Expense accounts.
- **Financial Summary Statement (`GET /account/financial-summary`)**: Aggregate financial snapshot of store Assets, Liabilities, Income, and Expenses.
- **Account Ledger History (`GET /account/:id/ledger`)**: Detailed transaction history per account.
- **Manual Account Transactions (`POST /account/transaction`)**: Record manual journal entries and ledger adjustments.

### 17. Register Shift Sessions (`src/register/`)
- **Open Shift Session (`POST /register/open`)**: Open register shift with starting cash float.
- **Current Active Shift (`GET /register/current`)**: Fetch active shift details and aggregated cash sales.
- **Close Shift Session (`PATCH /register/:id/close`)**: Close shift with expected vs actual cash reconciliation.

### 18. Payment Terms (`src/payment-terms/`)
- **Payment Terms Types**: `FIXED` (Net 15, Net 30), `END_OF_MONTH`, `END_OF_NEXT_MONTH`, `CUSTOM`.
- **Default System Terms Seeding**: Auto-seed standard payment terms on startup.
- **Custom Company Terms & Bulk Updates**: Create and bulk-update custom store payment terms.

### 19. Loyalty Program Settings (`src/loyalty-setting/`)
- **Loyalty Configuration**: Enable/disable store loyalty program.
- **Points Earning Rate**: Define spend-to-points ratio (e.g. 1 point per $10 spent).
- **Points Redemption Rate**: Define points-to-currency discount conversion (e.g. 10 points = $1 discount).

### 20. Document Sequence Numbering (`src/number-settings/`)
- **Custom Prefix & Numbering**: Configure document prefixes and starting numbers for `INVOICE`, `PURCHASE_ORDER`, `BILL`, `SALE_RETURN`, `ACCOUNT_TRANSACTION`.
- **Auto-Incrementing Numbers**: Generate padded sequential invoice numbers.

### 21. POS Receipt Printer (`src/printer/`)
- **Thermal Printer Configuration**: Setup receipt printers.
- **Paper Width Options**: Support `58mm` and `80mm` thermal paper.
- **Receipt Header & Footer Layouts**: Configure custom store header, address, phone, tax ID, and footer text on receipts.

### 22. POS Checkout Counters (`src/counter/`)
- **Counter Station Management**: Register checkout counter stations in the store.
- **Active Counter Status**: Enable or disable specific checkout stations.

### 23. Label & Price Tag Designer (`src/label-designer/`)
- **Label Layout Configuration**: Design product barcode price tags with customizable dimensions, product name, price, and barcode.
- **Test HTML Print Preview (`GET /label-designer/test-print/html`)**: Render thermal label HTML for test print previews.

### 24. Weighing Scale Integration (`src/weigh-scale/`)
- **Scale Configuration**: Configure scale settings (enable/disable, 2-digit prefix, weight multipliers, serial protocols).
- **Sticker Barcode Parsing (`POST /weigh-scale/parse-barcode`)**: Parse scale sticker barcodes (`WEIGHT_EMBEDDED` and `PRICE_EMBEDDED`) to extract PLU and calculate net weight/price at POS checkout.
- **Direct Serial/USB Scale Parsing (`POST /weigh-scale/parse-direct-weight`)**: Parse raw ASCII serial stream from direct scales (CAS, NCI, Toledo, Dibal) via Web Serial API.
- **Tare Weight Calculation (`POST /weigh-scale/calculate-weight`)**: Compute net weight and price after deducting container tare weight.

### 25. Staff & Employees (`src/staff/`)
- **Staff Lifecycle**: Create, list, update, and soft-delete store staff members.
- **Role & Privilege Linkage**: Assign privileges to staff members.

### 26. Device Registration & Hardware Licensing (`src/device-registration/`)
- **Hardware UUID Registration**: Register POS terminal PCs using Store License Keys.
- **Public Startup Verification (`POST /device/verify`)**: Public endpoint for Windows desktop app startup verification.
- **In-house LAN Auto-Bypass Mode**: Toggle auto-bypass mode for local terminal PCs.
- **License Revocation**: Revoke device terminal registrations.

### 27. Store License Management (`src/store-license/`)
- **Superadmin License Issuance**: Issue store license keys with set expiry dates, max counter limits, and max user limits.
- **License Status Verification**: Enforce active licensing on store terminals.

### 28. Subscriptions & Billing (`src/subscription/`)
- **Subscription Plans**: Manage store subscription plans (Trial, Monthly, Annual).
- **Subscription Guard (`SubscriptionGuard`)**: Enforce active subscription status across API routes (with `@SkipSubscription()` bypass for administrative utilities).

### 29. Email & OTP Services (`src/email/`)
- **Email OTP Generation**: Generate 6-digit email OTPs for authentication and verification.
- **SMTP Transport Integration**: Send formatted emails using Nodemailer.

### 30. Cloud-Local Database Synchronization (`src/sync/`)
- **Bi-Directional Sync Engine**:
  - Push local offline data to Cloud (`POST /sync/push`).
  - Pull cloud delta updates to Local (`POST /sync/pull`).
  - Atomic Bi-Directional Sync (`POST /sync/bi-directional`).
- **Automatic Re-syncing Trigger**: `genericUpdateOne` automatically resets `isSynced: false` on local document updates to queue cloud re-syncing.
- **Production Minimal Sync Mode (`SYNC_MINIMAL=true`)**: Minimal sync mode for core administrative schemas (`Company`, `User`, `StoreLicense`, `Subscription`, `DeviceRegistration`, `EmailOtp`).

### 31. System Action Audit Logging (`src/log/`)
- **Action Audit Trail (`LogService`)**: Record structured logs for all CRUD, authentication, and system events.
- **Captured Log Metadata**: `companyId`, `createdBy`, `action`, `entityType`, `entityId`, `description`, `ipAddress`, `path`, `status` (`SUCCESS`/`FAILED`), and `additionalData` (including old vs new state diffs).
