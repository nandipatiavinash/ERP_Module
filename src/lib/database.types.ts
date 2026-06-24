export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type RoleName = string;
export type Status = "active" | "inactive";
export type RollStatus = "available" | "reserved" | "sold" | "voided";
export type RollStage = "loom" | "roto_printing" | "lamination" | "finishing" | "offset_printing";
export type SalesStatus = "draft" | "confirmed" | "cancelled";
export type AttendanceStatus = "present" | "absent" | "half_day" | "leave";

export type AppUser = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  status: Status;
  role_id: string;
  roles?: { name: RoleName; is_active?: boolean; deleted_at?: string | null } | null;
};

export type Table<Row, Insert = Row, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
};

export type Database = {
  public: {
    Tables: {
      roles: Table<{
        id: string;
        name: string;
        description: string | null;
        is_active: boolean;
        created_at: string;
        updated_at: string;
        deleted_at: string | null;
      }>;
      users: Table<{
        id: string;
        role_id: string;
        full_name: string;
        email: string;
        phone: string | null;
        status: Status;
        created_at: string;
        updated_at: string;
        deleted_at: string | null;
      }>;
      looms: Table<{
        id: string;
        loom_number: string;
        description: string | null;
        status: Status;
        created_by: string | null;
        updated_by: string | null;
        created_at: string;
        updated_at: string;
        deleted_at: string | null;
      }>;
      fabric_types: Table<{
        id: string;
        fabric_name: string;
        description: string | null;
        width: string;
        gsm: string;
        selling_price: string;
        status: Status;
        created_by: string | null;
        updated_by: string | null;
        created_at: string;
        updated_at: string;
        deleted_at: string | null;
      }>;
      raw_materials: Table<{
        id: string;
        material_name: string;
        unit: string;
        description: string | null;
        opening_stock: string;
        current_stock: string;
        department: string | null;
        critical_level: number;
        status: Status;
        created_by: string | null;
        updated_by: string | null;
        created_at: string;
        updated_at: string;
        deleted_at: string | null;
      }>;
      raw_material_purchases: Table<{
        id: string;
        purchase_date: string;
        raw_material_id: string;
        supplier_name: string | null;
        bill_number: string | null;
        quantity: string;
        rate: string;
        total_amount: string;
        remarks: string | null;
        created_by: string | null;
        updated_by: string | null;
        created_at: string;
        updated_at: string;
        deleted_at: string | null;
      }>;
      accounts_journal: Table<{
        id: string;
        journal_no: string | null;
        entry_date: string;
        account_name: string;
        entry_type: "debit" | "credit";
        amount: string;
        description: string | null;
        created_by: string | null;
        updated_by: string | null;
        created_at: string;
        updated_at: string;
        deleted_at: string | null;
      }, {
        id?: string;
        journal_no?: string | null;
        entry_date?: string;
        account_name: string;
        entry_type: "debit" | "credit";
        amount: number | string;
        description?: string | null;
        created_by?: string | null;
        updated_by?: string | null;
        created_at?: string;
        updated_at?: string;
        deleted_at?: string | null;
      }, {
        journal_no?: string | null;
        entry_date?: string;
        account_name?: string;
        entry_type?: "debit" | "credit";
        amount?: number | string;
        description?: string | null;
        updated_by?: string | null;
        deleted_at?: string | null;
      }>;
      settings: Table<{
        id: string;
        key: string;
        value: Json;
        description: string | null;
        created_by: string | null;
        updated_by: string | null;
        created_at: string;
        updated_at: string;
        deleted_at: string | null;
      }>;
      employees: Table<{
        id: string;
        user_id: string | null;
        employee_code: string;
        name: string;
        department: string;
        designation: string;
        salary: string;
        joining_date: string | null;
        shift_start: string;
        shift_end: string;
        status: Status;
        created_by: string | null;
        updated_by: string | null;
        created_at: string;
        updated_at: string;
        deleted_at: string | null;
      }>;
      attendance: Table<{
        id: string;
        employee_id: string;
        attendance_date: string;
        check_in: string | null;
        check_out: string | null;
        check_in_at: string | null;
        check_out_at: string | null;
        working_hours: string;
        overtime_hours: string;
        status: AttendanceStatus;
        created_by: string | null;
        updated_by: string | null;
        created_at: string;
        updated_at: string;
        deleted_at: string | null;
      }>;
      customers: Table<{
        id: string;
        customer_name: string;
        alias: string | null;
        phone: string | null;
        gst_number: string | null;
        address: string | null;
        is_internal: string;
        opening_debit: number;
        opening_credit: number;
        status: Status;
        created_by: string | null;
        updated_by: string | null;
        created_at: string;
        updated_at: string;
        deleted_at: string | null;
      }>;
      loom_production_entries: Table<{
        id: string;
        entry_date: string;
        serial_number: string;
        fabric_type_id: string;
        loom_id: string;
        gross_weight: string;
        core_weight: string;
        net_weight: string;
        initial_meters: string;
        end_meters: string;
        net_meters: string;
        average_meter_weight: string | null;
        initial_meter_overridden: boolean;
        remarks: string | null;
        created_by: string | null;
        updated_by: string | null;
        created_at: string;
        updated_at: string;
        deleted_at: string | null;
      }>;
      fabric_rolls: Table<{
        id: string;
        roll_number: string;
        production_entry_id: string;
        fabric_type_id: string;
        loom_id: string;
        weight: string;
        meters: string;
        production_date: string;
        status: RollStatus;
        current_stage: RollStage;
        created_by: string | null;
        updated_by: string | null;
        created_at: string;
        updated_at: string;
        deleted_at: string | null;
      }>;
      sales_orders: Table<{
        id: string;
        order_number: string;
        order_date: string;
        customer_id: string;
        fabric_type_id: string;
        quantity_meters: string;
        rate: string;
        total_amount: string;
        selected_roll_ids: string[];
        status: SalesStatus;
        created_by: string | null;
        updated_by: string | null;
        created_at: string;
        updated_at: string;
        deleted_at: string | null;
      }>;
      roto_products: Table<{
        id: string;
        brand: string;
        width: number;
        height: number;
        num_cylinders: number;
        image_url: string | null;
        status: string;
        customer_id: string | null;
      }>;
      offset_products: Table<{
        id: string;
        brand: string;
        width: number;
        height: number;
        image_url: string | null;
        status: string;
        customer_id: string | null;
      }>;
      roto_colors: Table<{
        id: string;
        color_name: string;
        description: string | null;
        status: string;
      }>;
      sales_order_items: Table<{
        id: string;
        sales_order_id: string;
        department: string;
        product_id: string;
        quantity: number;
        selected_roll_ids: string[];
      }>;
      permissions: Table<{
        id: string;
        module: string;
        action: string;
        description: string | null;
        created_at: string;
        updated_at: string;
        deleted_at: string | null;
      }>;
      role_permissions: Table<{
        role_id: string;
        permission_id: string;
        created_by: string | null;
        created_at: string;
      }>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
