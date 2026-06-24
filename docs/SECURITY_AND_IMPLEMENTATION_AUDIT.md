# Security and Implementation Audit

## Verification Snapshot

- `npm run build`: passing on 2026-05-31 before this implementation pass.
- `npm run typecheck`: passing in the previous committed RBAC pass.
- Git working tree was clean before changes started.
- Existing production, fabric rolls, sales, inventory, and authentication modules are functional and must remain unchanged unless a targeted security or performance fix is required.

## Schema and Type Findings

- Dynamic RBAC tables and attendance fields exist in migrations, but secure employee self attendance still needs an approved additive link from employees to ERP users.
- `role_permissions` changes are not fully audited because the existing generic audit trigger assumes a single `id` column and does not cover composite-key deletes.
- Existing audit logging covers roles, users, master data, attendance, production, rolls, sales, raw material purchases, and settings via database triggers.
- Employee shift settings are present in TypeScript and UI, but the database migration must also include `employees.user_id` and an index for self attendance lookups.
- Existing `requireRole()` remains only as legacy compatibility code; active routes use `requirePermission()`.

## OWASP Top 10 Review

- Broken Access Control: page guards and server actions use `requirePermission()`, but attendance self-service needs both app-level ownership checks and RLS ownership checks.
- Authentication Failures: Supabase Auth is used and app profile/role status is checked after login. Password reset should constrain redirect origins.
- Injection Attacks: Supabase query builder is used; continue avoiding raw SQL in app code and validate all server action inputs with Zod.
- Insecure Design: permission hiding is not enough; every server action and RLS policy must enforce access independently.
- Security Misconfiguration: service-role access is isolated to the server admin client; deployment secrets must remain outside the repository.
- Vulnerable Components: Next.js is on a patched 15.5.x line; continue using `npm audit`/dependency updates before deployment.
- Identification and Authentication Failures: no user enumeration should be exposed in login/reset flows.
- Software and Data Integrity Failures: migrations should be additive, committed, and applied through Supabase migration tooling.
- Security Logging Failures: add explicit audit coverage for role permission grants/revokes and preserve previous/new JSON data.
- SSRF: no outbound user-controlled fetches were found in the app code.

## Performance Findings

- Dashboard queries select limited columns and use date/status filters, but indexes should be added for high-frequency dashboard/report filters.
- Reports fetch date-bounded data but should keep sensible defaults and pagination as data grows.
- Master pages currently fetch all rows and paginate client-side; acceptable for small factories, but should be moved to server-side range queries module by module.
- Audit logs are capped at 200 rows; add search/date filters later if audit volume grows.

## Implementation Plan For This Pass

1. Add an additive migration for `employees.user_id`, employee/date indexes, report indexes, attendance self-service RLS, and explicit role permission audit triggers.
2. Update database types for `employees.user_id`.
3. Add app-level attendance ownership checks so HR/admin can manage all employees and linked employees can manage only themselves.
4. Add user-to-employee linking UI and server action.
5. Harden reset password redirects and text/email normalization.
6. Keep existing production, fabric roll, sales, inventory, and auth behavior compatible.
7. Re-run build and typecheck after implementation.
