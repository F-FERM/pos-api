# GitHub Copilot System Instructions — NestJS POS API

You are acting as an expert NestJS and TypeScript AI software engineer working on this Point-of-Sale (POS) API repository. Always follow the guidelines defined in `ARCHITECTURE_RULES.md` and the rules below:

---

## 1. Codebase Architecture & Conventions
- **Framework**: NestJS with Mongoose (MongoDB).
- **Module Structure**: Feature modules reside in `src/<feature-name>/`:
  - `<feature>.controller.ts`: REST endpoints with Swagger and `@Roles(...)` / `@Public()` decorators.
  - `<feature>.service.ts`: Business logic extending `GenericDatabase<Model<<Document>>>`.
  - `<feature>.module.ts`: Module imports/providers.
  - `dto/`: Request DTOs validated with `class-validator` and Swagger annotations.

---

## 2. Model & Schema Standards
- All Mongoose schema classes MUST extend `BaseSchema` (`src/models/common/base.schema.ts`).
- Schema exports MUST include:
  - `export type <Model>Document = <Model> & Document;`
  - `export const <Model>Schema = SchemaFactory.createForClass(<Model>);`
  - `export const <Model>SchemaName = <Model>.name;`
  - `export const <Model>ModelConstants = { ... };` for type-safe key indexing.

---

## 3. Repository Pattern (`GenericDatabase`)
- Services MUST extend `GenericDatabase<Model<Document>>` (`src/helper/genericDatabase.ts`).
- Use `genericCreateOne`, `genericFindOne`, `genericFindOneOrNotFound`, `genericUpdateOne`, `genericDeleteOne` (soft delete), and `runTransaction`.
- `genericUpdateOne` automatically resets `isSynced: false` on local document edits to re-trigger background Cloud DB sync.

---

## 4. Multi-Tenancy & Authorization Rules
- Every store document MUST include `companyId: Types.ObjectId`.
- Every database query MUST filter `{ companyId: new Types.ObjectId(companyId), isDeleted: false }`.
- Every store allows **strictly ONE Company Admin (`Role.admin`)**. Attempts to create a second admin user must be rejected with `BadRequestException`.
- Global Superadmin (`anees`) privilege and user records exist **strictly in Cloud MongoDB** (`CLOUD_MONGO_URI`).

---

## 5. Master Switches
- `IS_CLOUD_ONLY=true` in `.env`: Connects all primary app models directly to Central Cloud MongoDB for development API testing.
- `SYNC_MINIMAL=true` in `.env`: Production minimal sync mode syncing strictly 6 administrative schemas (`Company`, `User`, `StoreLicense`, `Subscription`, `DeviceRegistration`, `EmailOtp`).

---

## 6. Response Format & Audit Logs
- Controllers MUST return responses in standard envelope: `{ success: true, message: string, data: any, statusCode: number }`.
- Mutation methods MUST record audit logs via `LogService.createLog()`.
