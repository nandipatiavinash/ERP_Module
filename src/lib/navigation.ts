import type { RoleName } from "@/lib/database.types";

export type NavSubItem = { href: string; label: string; roles: RoleName[]; permission: string };

export type NavGroup = {
  key: string;
  label: string;
  roles: RoleName[];
  items: NavSubItem[];
};

export const navGroups: NavGroup[] = [
  {
    key: "admin",
    label: "Admin",
    roles: ["admin"],
    items: [
      { href: "/admin/credentials", label: "Login Credentials", roles: ["admin"], permission: "admin.credentials" },
      { href: "/admin/permissions", label: "Login Permissions", roles: ["admin"], permission: "admin.permissions" },
      { href: "/admin/raw-materials", label: "Raw Material IDs", roles: ["admin"], permission: "admin.raw_materials" },
      { href: "/admin/products", label: "Product IDs", roles: ["admin"], permission: "admin.products" },
      { href: "/admin/clients", label: "Account/Client IDs", roles: ["admin"], permission: "admin.clients" },
      { href: "/admin/looms", label: "Loom IDs", roles: ["admin"], permission: "admin.looms" },
      { href: "/admin/colors", label: "Printing Colour IDs", roles: ["admin"], permission: "admin.colors" },
      { href: "/admin/critical-levels", label: "Raw Material Critical Levels", roles: ["admin"], permission: "admin.critical_levels" },
      { href: "/admin/employees", label: "Employees", roles: ["admin"], permission: "admin.employees" },
      { href: "/admin/attendance", label: "Attendance", roles: ["admin"], permission: "admin.attendance" },
      { href: "/admin/reset", label: "System Reset", roles: ["admin"], permission: "admin.reset" },
    ],
  },
  {
    key: "fabric",
    label: "Fabric",
    roles: ["admin", "operator"],
    items: [
      { href: "/fabric/production", label: "Production", roles: ["admin", "operator"], permission: "fabric.production" },
      { href: "/fabric/consumption", label: "Consumption", roles: ["admin", "operator"], permission: "fabric.consumption" },
      { href: "/fabric/stock", label: "Stock", roles: ["admin", "operator"], permission: "fabric.stock" },
    ],
  },
  {
    key: "roto-printing",
    label: "Roto Printing",
    roles: ["admin", "operator"],
    items: [
      { href: "/roto-printing/production", label: "Production", roles: ["admin", "operator"], permission: "roto_printing.production" },
      { href: "/roto-printing/consumption", label: "Consumption", roles: ["admin", "operator"], permission: "roto_printing.consumption" },
      { href: "/roto-printing/stock", label: "Stock", roles: ["admin", "operator"], permission: "roto_printing.stock" },
    ],
  },
  {
    key: "lamination",
    label: "Lamination",
    roles: ["admin", "operator"],
    items: [
      { href: "/lamination/production", label: "Production", roles: ["admin", "operator"], permission: "lamination.production" },
      { href: "/lamination/consumption", label: "Consumption", roles: ["admin", "operator"], permission: "lamination.consumption" },
      { href: "/lamination/stock", label: "Stock", roles: ["admin", "operator"], permission: "lamination.stock" },
    ],
  },
  {
    key: "offset-printing",
    label: "Offset Printing",
    roles: ["admin", "operator"],
    items: [
      { href: "/offset-printing/production", label: "Production", roles: ["admin", "operator"], permission: "offset_printing.production" },
      { href: "/offset-printing/consumption", label: "Consumption", roles: ["admin", "operator"], permission: "offset_printing.consumption" },
      { href: "/offset-printing/stock", label: "Stock", roles: ["admin", "operator"], permission: "offset_printing.stock" },
    ],
  },
  {
    key: "finishing",
    label: "Finishing",
    roles: ["admin", "operator"],
    items: [
      { href: "/finishing/production", label: "Production", roles: ["admin", "operator"], permission: "finishing.production" },
      { href: "/finishing/consumption", label: "Consumption", roles: ["admin", "operator"], permission: "finishing.consumption" },
      { href: "/finishing/stock", label: "Stock", roles: ["admin", "operator"], permission: "finishing.stock" },
    ],
  },
  {
    key: "sales",
    label: "Sales",
    roles: ["admin"],
    items: [
      { href: "/sales/delivery-entry", label: "Order Confirmation", roles: ["admin"], permission: "sales.order_confirmation" },
      { href: "/sales/order-confirmation", label: "Delivery Entry", roles: ["admin"], permission: "sales.delivery_entry" },
    ],
  },
  {
    key: "accounts",
    label: "Accounts",
    roles: ["admin"],
    items: [
      { href: "/accounts/journal", label: "Journal Entry", roles: ["admin"], permission: "accounts.journal" },
      { href: "/accounts/purchase", label: "Purchase Entry", roles: ["admin"], permission: "accounts.purchase" },
      { href: "/accounts/sales", label: "Sales Entry", roles: ["admin"], permission: "accounts.sales" },
      { href: "/accounts/material", label: "Material Sales", roles: ["admin"], permission: "accounts.material" },
    ],
  },
  {
    key: "reports",
    label: "Reports",
    roles: ["admin", "operator"],
    items: [
      { href: "/reports/sales-confirmation", label: "Sales Confirmation", roles: ["admin"], permission: "reports.sales_confirmation" },
      { href: "/reports/accounts", label: "Account Reports", roles: ["admin"], permission: "reports.accounts" },
      { href: "/reports/opening-balance", label: "Opening Balance", roles: ["admin"], permission: "reports.opening_balance" },
      { href: "/reports/stock", label: "Stock Report", roles: ["admin", "operator"], permission: "reports.stock" },
      { href: "/reports/closing-stock", label: "Closing Stock", roles: ["admin", "operator"], permission: "reports.closing_stock" },
      { href: "/reports/profit-loss", label: "Profit & Loss", roles: ["admin"], permission: "reports.profit_loss" },
      { href: "/reports/balance-sheet", label: "Balance Sheet", roles: ["admin"], permission: "reports.balance_sheet" },
    ],
  },
];
