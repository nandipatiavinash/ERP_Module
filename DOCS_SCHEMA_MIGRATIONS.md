# ERP Database Schema & Architectural Reference Guide

This document serves as a reference for developers and AI IDEs to understand the database schema, data relationships, and recent performance/architectural modifications implemented in the ERP system.

---

## 1. Database Table Registry (Schema Mapping)

The database runs on PostgreSQL (Supabase) under the `public` schema. Soft deletes are used across all tables via the `deleted_at` timestamp.

### A. Authentication & Permissions
* **`roles`**: Defines system roles (`admin`, `supervisor`, `labour`, `accounts`).
* **`users`**: System user profiles linked to Supabase auth IDs. Stores `id`, `email`, `full_name`, `role_id`, and `status`.
* **`role_permissions`**: Pivot table mapping `role_id` to system permission identifiers.

### B. Core Manufacturing & Inventory
* **`looms`**: Loom machinery details (`loom_number`, `status`, `notes`).
* **`fabric_types`**: Templates defining different fabric parameters (`fabric_name`, `width`, `gsm`, `avg_weight_per_meter`, `status`).
* **`fabric_rolls`**: Inventory tracking for individual fabric rolls (`roll_number`, `fabric_type_id`, `weight`, `meters`, `status` [available, allocated, dispatched], `production_date`).
* **`loom_production_entries`**: Logs of fabric rolls outputted from looms (`entry_date`, `loom_id`, `fabric_type_id`, `gross_weight`, `core_weight`, `net_weight`, `net_meters`, `average_meter_weight`).

### C. HR & Attendance
* **`employees`**: Employee records (`name`, `employee_code`, `department`, `designation`, `salary`, `shift_start`, `shift_end`, `user_id` [optional link to `users.id` for self-attendance]).
* **`attendance`**: Daily clock-in/out logs (`employee_id`, `attendance_date`, `check_in`, `check_out`, `check_in_at`, `check_out_at`, `working_hours`, `overtime_hours`, `status`).

### D. Clients, Sales & Purchases
* **`customers`**: Multi-purpose ledger representing external **Buyers**, **Suppliers**, and **Internal Accounting Entities** (e.g. system accounts "Purchase A/c" and "Sales A/c").
  - Columns: `id`, `customer_name`, `alias`, `gst_number`, `address`, `status`, `is_internal` (`client a/c`, `profit and loss a/c`).
* **`sales_orders`**: Sales orders and confirmed deliveries (`order_number`, `customer_id`, `order_date`, `status` [pending, confirmed], `bill_number`, `bill_value`).
* **`sales_order_items`**: Individual item rows within an order sheet (`sales_order_id`, `department`, `product_id`, `quantity`, `selected_roll_ids` [UUID array representing allocated rolls]).
* **`raw_materials`**: Catalog of raw materials (`material_name`, `unit`, `opening_stock`, `current_stock`, `critical_level`, `status`).
* **`raw_material_purchases`**: Inventory purchases ledger (`purchase_date`, `raw_material_id`, `supplier_name`, `bill_number`, `quantity`, `rate`, `total_amount`).

### E. Double-Entry Accounting
* **`accounts_journal`**: Balanced bookkeeping transaction lines (Debits/Credits).
  - Columns: `id`, `journal_no` (e.g., JE-000001), `entry_date`, `account_id` (references `customers.id`), `account_name` (legacy text fallback), `entry_type` (`debit`, `credit`), `amount`, `description`.

---

## 2. Dynamic Data & Accounting Flows

The ERP enforces double-entry accounting constraints. Transactions auto-generate balancing debit/credit journal entries in `accounts_journal`:

```
1. RAW MATERIAL PURCHASE ACTION:
   - Debit:  "Purchase A/c" (Linked to system P&L customer ID)
   - Credit: [Supplier Name] (Linked to supplier's customer ID)

2. SALES ORDER BILLING ACTION:
   - Debit:  [Customer Name] (Linked to customer's customer ID)
   - Credit: "Sales A/c"    (Linked to system P&L customer ID)
```

---

## 3. Completed Performance & Schema Optimizations

Below are the details, rationales, and implementations of recent optimizations:

### A. Global Route Transition Progress Bar
* **What we did:** Added `<RouteTransitionBar />` in `src/components/app/app-shell.tsx`.
* **Why:** In Next.js App Router, changing search/query parameters (e.g. switching Products tabs: roto vs offset, or searching a ledger) triggers server-side re-rendering. Because the route path doesn't change, Next.js does not display the default `loading.tsx` spinner. The browser blocked visually until the server finished fetching.
* **Implementation:** The progress bar component attaches global document event listeners to capture all internal link clicks and form submissions. It immediately renders a sleek, premium animated progress bar on top of the browser viewport during the server's render period and auto-hides once `pathname` or `searchParams` update.

### B. Viewport Link Prefetching Spikes Resolved
* **What we did:** Added `prefetch={false}` to detail drill-down links in `/sales/order-confirmation`, `/fabric/stock`, and `/rolls` list tables.
* **Why:** Next.js default viewport prefetching downloads the server payload for all visible links. For lists with 25 rows where each detail page runs 6 heavy queries, loading the list page triggered up to 150 background database queries instantly, causing connection spikes and slow loading. Disabling prefetching keeps the load strictly on user-intent (click).

### C. Database Query Concurrency (Promise.all)
* **What we did:** Restructured sequential awaits into concurrent fetches using `Promise.all` in `accounts/sales/page.tsx`, `sales/order-confirmation/[id]/page.tsx`, and `admin/attendance/page.tsx`.
* **Why:** Running queries sequentially makes the page load time the *sum* of all query latencies. Concurrent fetches run queries in parallel, making page load time equal to the *slowest single query*.

### D. Missing Database Indexes
* **What we did:** Created migrations `023` and `024` adding indexes:
  - `idx_roto_products_brand` / `idx_offset_products_brand` (paginated product lists).
  - `idx_raw_materials_name` / `idx_employees_name` (non-composite indexes to optimize name-based sorts when `status` is not filtered).
  - `idx_sales_orders_billing_status_date` (Sales Entry page filter queries).
  - `idx_accounts_journal_account_id` (optimize ledger queries).
  - Foreign keys: `idx_raw_material_purchases_material`, `idx_loom_production_entries_fabric`, and `idx_sales_order_items_order` (optimize cascade checks and sub-table joins).

### E. Account-ID Integration (Safe Migration)
* **What we did:** Added `account_id` column referencing `customers.id` to `accounts_journal`.
* **Why:** Name-based references (`account_name TEXT`) are prone to integrity errors (e.g., renaming a customer breaks historical ledger audits) and make reports filtering by account ID impossible.
* **Backend Resolution (Frontend Untouched):** To fulfill the user requirement of leaving the frontend dropdown forms completely unchanged, the backend server actions (`saveRawMaterialPurchase`, `saveSalesOrderBilling`, and `saveJournalEntry` in `src/app/(app)/_actions.ts`) were updated to dynamically resolve text names/aliases to customer IDs on the server side using a memory lookup map during insertions.
* **Data Safety:** An update query was executed during migration `024` to automatically map and backpopulate existing journal rows based on their text name strings matching active customer records.

---

## 4. Development Guidelines for Future AI IDEs
1. **Frontend Integrity:** Do NOT modify the dropdown selection UI or form structure in `JournalEntryForm` or `MasterPage` unless explicitly requested. It must remain a text-based search/selection.
2. **Server-Side ID Resolution:** Always use the `nameToIdMap` resolver pattern on the server action (`_actions.ts`) to lookup and insert the foreign key `account_id` whenever recording transactions.
3. **Soft Delete Checks:** When creating new indexes or queries, always filter out soft-deleted records using `WHERE deleted_at IS NULL` to ensure active database consistency.
