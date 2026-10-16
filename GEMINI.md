# Gemini Copilot / Code Assist System Context — NestJS POS API

This repository is a NestJS Point-of-Sale (POS) REST API powered by Mongoose (MongoDB). Follow the strict architectural conventions defined below and in `ARCHITECTURE_RULES.md` when assisting with code generation or refactoring.

---

## Key System Principles

1. **Feature Module Structure (`src/<feature-name>/`)**:
   - Controller (`<feature>.controller.ts`)
   - Service (`<feature>.service.ts`) extending `GenericDatabase`
   - Module (`<feature>.module.ts`)
   - DTOs (`dto/create-<feature>.dto.ts`, `dto/update-<feature>.dto.ts`)

2. **Mongoose Schema Conventions (`src/models/`)**:
   - Extend `BaseSchema` (`isDeleted`, `createdBy`, `isSynced`, `syncedAt`, `isSystemGenerated`).
   - Export `Document` type, `Schema`, `SchemaName`, and `ModelConstants` object.

3. **Multi-Tenant Store Scoping**:
   - Query filters MUST include `{ companyId: new Types.ObjectId(companyId), isDeleted: false }`.
   - Validate authenticated user (`userService.validateAuthenticatedUser(userId)`) and company (`companyService.validateCompany(companyId, userId)`).
   - Strictly 1 Company Admin (`Role.admin`) per store company.

4. **Global Cloud Superadmin**:
   - Global Superadmin (`anees`) privilege and user exist **strictly in Cloud MongoDB** (`CLOUD_MONGO_URI`).
   - `UserService.validateUser()` authenticates Superadmin against Cloud MongoDB directly.

5. **Environment Master Switches**:
   - `IS_CLOUD_ONLY=true` in `.env`: Direct Cloud DB development testing mode.
   - `SYNC_MINIMAL=true` in `.env`: Production minimal sync mode (syncs 6 administrative schemas: `Company`, `User`, `StoreLicense`, `Subscription`, `DeviceRegistration`, `EmailOtp`).

6. **Repository Helper & Edit Re-Syncing**:
   - Services extend `GenericDatabase` (`src/helper/genericDatabase.ts`).
   - Local document updates via `genericUpdateOne` automatically reset `isSynced: false` to re-trigger Cloud DB synchronization.

7. **API Response Envelope**:
   - Return `{ success: true, message: '...', data: resultPayload, statusCode: HttpStatus.OK }`.
