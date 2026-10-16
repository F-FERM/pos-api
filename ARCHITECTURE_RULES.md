# NestJS POS API Architecture Rules & System Conventions

This document defines the exact architecture, coding patterns, directory structure, multi-tenancy rules, database abstractions, master environment switches, and API conventions for this codebase. Any future AI model or software developer modifying this repository MUST follow these conventions strictly.

---

## 1. Project Directory & Feature Module Architecture

All feature modules reside under `src/` organized into self-contained feature directories:

```
src/
├── <feature-name>/
│   ├── <feature-name>.controller.ts   # REST Controllers with Swagger & Guard annotations
│   ├── <feature-name>.service.ts      # Business logic extending GenericDatabase
│   ├── <feature-name>.module.ts       # NestJS Module declaration
│   └── dto/
│       ├── create-<feature-name>.dto.ts # Request DTO with class-validator
│       └── update-<feature-name>.dto.ts # PartialType DTO
├── models/                            # Mongoose Schemas & Type definitions
│   ├── common/
│   │   └── base.schema.ts            # BaseSchema class
│   └── <feature-name>.schema.ts
├── common/                            # Guards, Seeds, Constants
│   ├── guards/                        # JwtAuthGuard, RolesGuard, PermissionGuard, SubscriptionGuard
│   ├── seeds/                         # System seeds (accounts, privileges, submodules, superadmin)
│   └── constants/
├── config/                            # Environment config loader (config.ts)
├── helper/                            # GenericDatabase repository helper
└── utils/                             # Common Enums, Types, Constants
```

---

## 2. Mongoose Schema Standards (`src/models/`)

1. **`BaseSchema` Inheritance**:
   All Mongoose schema classes MUST extend `BaseSchema` (`src/models/common/base.schema.ts`):
   ```ts
   export class BaseSchema {
     @Prop({ default: false }) isDeleted: boolean;
     @Prop({ type: Types.ObjectId, ref: 'User', default: null }) createdBy?: Types.ObjectId;
     @Prop({ default: false }) isSynced?: boolean;
     @Prop({ type: Date, default: null }) syncedAt?: Date | null;
     @Prop({ default: false }) isSystemGenerated?: boolean;
   }
   ```

2. **Schema Export Standard**:
   Every schema file MUST export:
   ```ts
   export type <Model>Document = <Model> & Document;
   export const <Model>Schema = SchemaFactory.createForClass(<Model>);
   export const <Model>SchemaName = <Model>.name;
   export const <Model>ModelConstants: { [K in keyof <Model>]: K } = { ... };
   ```

3. **`ModelConstants` Pattern**:
   Use `ModelConstants` for type-safe key references in queries and populates:
   ```ts
   // Example usage:
   .populate(`${UserModelConstants.privilegeId}`)
   ```

---

## 3. Service Layer & Repository Pattern (`GenericDatabase`)

1. **Inheritance**:
   All service classes MUST extend `GenericDatabase<Model<<Model>Document>>`:
   ```ts
   @Injectable()
   export class MyService extends GenericDatabase<Model<MyDocument>> {
     constructor(@InjectModel(MySchemaName) private readonly myModel: Model<MyDocument>) {
       super(myModel);
     }
   }
   ```

2. **CRUD Helpers**:
   - `genericCreateOne(doc, options)`: Creates a new document.
   - `genericFindOne(filter, options)`: Finds a single document matching filter.
   - `genericFindOneOrNotFound(filter, options)`: Finds document or throws `NotFoundException`.
   - `genericUpdateOne(id, updateDto, options)`: Updates document. **Automatically resets `isSynced: false`** on local modifications to re-trigger background Cloud DB sync.
   - `genericDeleteOne(id, options)`: Soft-deletes document by setting `{ isDeleted: true, deletedAt: new Date() }`.
   - `runTransaction(work)`: Mongoose session transaction wrapper.

---

## 4. Multi-Tenancy & Authorization Rules

1. **`companyId` Store Isolation**:
   - Every store-level document MUST have `companyId: Types.ObjectId`.
   - Every service operation MUST validate user (`userService.validateAuthenticatedUser(userId)`) and company (`companyService.validateCompany(companyId, userId)`).
   - Every database query MUST filter `{ companyId: new Types.ObjectId(companyId), isDeleted: false }`.

2. **Strict 1 Company Admin Limit**:
   - Store registration creates the owner as **Company Admin** (`Role.admin`).
   - `UserService.createUser()` enforces that **each store company can have strictly 1 Company Admin**. Attempts to create a second Admin user for a store must be rejected with `BadRequestException`.

3. **Global Cloud Superadmin**:
   - Superadmin privilege and user records (`anees` / `000000`) exist **strictly in Cloud MongoDB** (`CLOUD_MONGO_URI`). No Superadmin records are written to Local POS MongoDB.
   - `UserService.validateUser()` authenticates Superadmin credentials against Cloud MongoDB and returns `cloudUser` directly with signed JWT containing `roles: [Role.superadmin]`.

---

## 5. API Response Envelope & Audit Logging

1. **Standard API Response Payload**:
   All REST controllers MUST return responses wrapped in this standard structure:
   ```ts
   return {
     success: true,
     message: 'Descriptive success message',
     data: resultPayload,
     statusCode: HttpStatus.OK // or HttpStatus.CREATED
   };
   ```

2. **Audit Logging**:
   Every state-changing mutation (Create, Update, Delete) MUST log an audit entry via `LogService.createLog()`:
   ```ts
   await this.logService.createLog({
     companyId: new Types.ObjectId(companyId),
     createdBy: new Types.ObjectId(userId),
     action: LogActions.CREATE_PRODUCT,
     entityType: LogEntityType.PRODUCT,
     entityId: new Types.ObjectId(created._id),
     description: `Product ${created.name} created`,
     ipAddress,
     path: req.url,
     status: LogStatus.SUCCESS,
   });
   ```

---

## 6. Master Environment Switches (`.env` & `src/config/config.ts`)

1. **`IS_CLOUD_ONLY=true` (Development Master Switch)**:
   - When `IS_CLOUD_ONLY=true`, all primary Mongoose models connect and operate **directly against Central Cloud MongoDB** (`CLOUD_MONGO_URI`).
   - Bypasses Local POS MongoDB during development API testing.

2. **`SYNC_MINIMAL=true` (Production Master Switch)**:
   - When `SYNC_MINIMAL=true` (Production Default), the background sync engine pushes/pulls **strictly the 6 Administrative Schemas**:
     1. `companies` (`CompanySchema`)
     2. `users` (`UserSchema`)
     3. `storeLicenses` (`StoreLicenseSchema`)
     4. `subscriptions` (`SubscriptionSchema`)
     5. `deviceRegistrations` (`DeviceRegistrationSchema`)
     6. `emailOtps` (`EmailOtpSchema`)
   - Daily store transaction data (Sales, Purchases, Expenses, Inventory, Accounts, Shifts) remains local to the POS device.
   - When `SYNC_MINIMAL=false` (Development Mode), runs full sync across all 17 entity types.

---

## 7. Extending Cloud Auto-Sync for New Schemas

When adding a new schema that requires Cloud sync (e.g. `Unit`, `Category`, `Product`):
1. Ensure model extends `BaseSchema`.
2. Register schema in `src/sync/sync.module.ts` on both default connection AND `'cloudConnection'`.
3. Inject local and cloud models into `src/sync/sync.service.ts`.
4. Add model to `syncAllUnsyncedRecords()`, `pushLocalDataToCloud()`, and `pullCloudDataForCompany()` lists.
5. If schema is an Administrative schema required in production minimal mode, include it in `isSyncMinimal` checks.
