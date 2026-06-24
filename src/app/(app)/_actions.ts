"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionPermissions, requirePermission } from "@/lib/auth";
import type { AppUser } from "@/lib/database.types";
import { modules } from "@/lib/modules";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const numericFields = new Set([
  "width",
  "gsm",
  "selling_price",
  "opening_stock",
  "current_stock",
  "critical_level",
  "salary",
  "gross_weight",
  "core_weight",
  "initial_meters",
  "end_meters",
  "quantity",
  "quantity_meters",
  "rate",
]);

function sanitizeText(value: FormDataEntryValue) {
  return String(value).trim().replace(/\s+/g, " ");
}

function todayInIndia() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function readPayload(formData: FormData, fieldNames: string[]) {
  const payload: Record<string, unknown> = {};
  for (const name of fieldNames) {
    const value = formData.get(name);
    if (value === null || value === "") continue;
    payload[name] = numericFields.has(name) ? Number(Number(value).toFixed(2)) : sanitizeText(value);
  }
  return payload;
}

const statusSchema = z.enum(["active", "inactive"]);
const attendanceSchema = z.object({
  employee_id: z.string().uuid(),
});
const productionSchema = z.object({
  fabric_type_id: z.string().uuid(),
  loom_id: z.string().uuid(),
  gross_weight: z.coerce.number().positive(),
  core_weight: z.coerce.number().min(0),
  initial_meters: z.coerce.number().min(0).optional(),
  end_meters: z.coerce.number().min(0),
  remarks: z.string().optional(),
}).refine((value) => value.gross_weight >= value.core_weight, {
  message: "Gross weight must be greater than or equal to core weight.",
});
const saleSchema = z.object({
  customer_id: z.string().uuid(),
  fabric_type_id: z.string().uuid(),
  quantity_meters: z.coerce.number().positive(),
  rate: z.coerce.number().min(0),
  status: z.enum(["draft", "confirmed", "cancelled"]),
  selected_roll_ids: z.array(z.string().uuid()),
});
const rawPurchaseSchema = z.object({
  raw_material_id: z.string().uuid(),
  purchase_date: z.string().min(1),
  supplier_name: z.string().optional(),
  bill_number: z.string().optional(),
  quantity: z.coerce.number().positive(),
  rate: z.coerce.number().min(0),
  remarks: z.string().optional(),
});
const createUserSchema = z.object({
  full_name: z.string().trim().min(2, "Full name is required.").transform(val => val.toUpperCase()),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  phone: z.string().trim().optional(),
  role_id: z.string().uuid("Select a valid role."),
  status: statusSchema,
});
const roleSchema = z.object({
  name: z.string().trim().min(2, "Role name is required.").transform(val => val.toUpperCase()),
  description: z.string().trim().optional().transform(val => val ? val.toUpperCase() : val),
});
const employeeUserLinkSchema = z.object({
  user_id: z.string().uuid(),
  employee_id: z.string().uuid().optional(),
});

function modulePermissionKey(moduleKey: string) {
  return moduleKey.replaceAll("-", "_");
}

function assertValid<T>(schema: z.ZodType<T>, value: unknown) {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid form data.");
  return parsed.data;
}

async function assertAttendanceAccess(supabase: Awaited<ReturnType<typeof createClient>>, user: AppUser, employeeId: string) {
  const permissions = await getSessionPermissions(user);
  if (permissions.includes("employees.view") || permissions.includes("users.view")) return;

  const { data, error } = await (supabase
    .from("employees")
    .select("id, user_id")
    .eq("id", employeeId)
    .eq("status", "active")
    .is("deleted_at", null)
    .maybeSingle() as any);

  if (error) throw new Error("Unable to verify employee attendance access.");
  if (!data || data.user_id !== user.id) throw new Error("You can only manage your own attendance.");
}

function validateMasterPayload(moduleKey: string, payload: Record<string, unknown>) {
  const numericPositive = new Set(["width", "gsm"]);
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const field of modules[moduleKey].fields) {
    if (field.name === "status") {
      shape[field.name] = statusSchema;
    } else if (numericFields.has(field.name)) {
      const numeric = numericPositive.has(field.name) ? z.number().positive() : z.number().min(0);
      shape[field.name] = field.required ? numeric : numeric.optional();
    } else {
      const text = field.required ? z.string().trim().min(1) : z.string().trim().optional();
      shape[field.name] = text;
    }
  }
  return assertValid(z.object(shape), payload);
}

export async function saveMaster(moduleKey: string, formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const user = await requirePermission(`${modulePermissionKey(moduleKey)}.${id ? "edit" : "create"}`);

  const config = modules[moduleKey];
  const supabase = await createClient();
  const payload = validateMasterPayload(moduleKey, readPayload(formData, config.fields.map((field) => field.name))) as any;

  let oldAlias: string | null = null;
  let oldCustomerName: string | null = null;
  if (moduleKey === "customers" && id) {
    const { data } = await (supabase
      .from("customers") as any)
      .select("customer_name, alias, is_internal")
      .eq("id", id)
      .maybeSingle();
    if (data && data.is_internal === "client a/c") {
      oldAlias = data.alias;
      oldCustomerName = data.customer_name;
    }
  }

  if (moduleKey === "fabric-types" && !id) {
    payload.width = 1;
    payload.gsm = 1;
    payload.selling_price = 0;
  }
  if (moduleKey === "raw-materials" && !payload.unit) {
    payload.unit = "-";
  }
  payload.updated_by = user.id;
  const table = config.table as any;

  let finalPayload = { ...payload };
  if (moduleKey === "customers") {
    if (finalPayload.customer_name) {
      finalPayload.customer_name = String(finalPayload.customer_name).toUpperCase().trim();
    }
    if (finalPayload.alias) {
      finalPayload.alias = String(finalPayload.alias).toUpperCase().trim();
    }
  }

  const buildQuery = (p: Record<string, unknown>) =>
    id
      ? (supabase.from(table) as any).update(p).eq("id", id)
      : (supabase.from(table) as any).insert({ ...p, created_by: user.id, updated_by: user.id });

  let { error } = await buildQuery(finalPayload) as any;

  // If description column doesn't exist yet in DB (migration pending), retry without it
  if (error && /could not find the 'description' column/i.test(error.message)) {
    const { description: _dropped, ...payloadWithoutDesc } = finalPayload;
    finalPayload = payloadWithoutDesc;
    const retry = await buildQuery(finalPayload) as any;
    error = retry.error;
  }

  if (error) {
    console.error('saveMaster error for module', moduleKey, ':', error);
    throw new Error(`Failed to save ${moduleKey}: ${error.message}`);
  }

  // Handle client alias account auto-generation
  if (moduleKey === "customers") {
    const isInternal = String(finalPayload.is_internal ?? "");
    const customerName = String(finalPayload.customer_name ?? "").trim();
    const newAlias = String(finalPayload.alias ?? "").trim();

    if (isInternal === "client a/c" && !customerName.toLowerCase().endsWith(" a/c")) {
      const aliasAccountName = newAlias ? `${newAlias} A/c` : `${customerName} A/c`;
      let oldAliasAccountName: string | null = null;
      if (oldCustomerName) {
        oldAliasAccountName = oldAlias 
          ? `${oldAlias} A/c` 
          : (oldCustomerName.toLowerCase().endsWith(" a/c") ? oldCustomerName : `${oldCustomerName} A/c`);
      }

      if (oldAliasAccountName && oldAliasAccountName.toLowerCase() !== aliasAccountName.toLowerCase()) {
        // Alias/name was updated, so rename the old associated account if it exists
        const { data: existingOldAccount } = await (supabase
          .from("customers") as any)
          .select("id")
          .eq("customer_name", oldAliasAccountName)
          .is("deleted_at", null)
          .maybeSingle();

        if (existingOldAccount) {
          await (supabase
            .from("customers") as any)
            .update({ customer_name: aliasAccountName, updated_by: user.id })
            .eq("id", existingOldAccount.id);
        } else {
          // Check if the new one exists, otherwise create it
          const { data: existingNewAccount } = await (supabase
            .from("customers") as any)
            .select("id")
            .eq("customer_name", aliasAccountName)
            .is("deleted_at", null)
            .maybeSingle();

          if (!existingNewAccount) {
            await (supabase.from("customers") as any).insert({
              customer_name: aliasAccountName,
              is_internal: "client a/c",
              status: "active",
              created_by: user.id,
              updated_by: user.id,
            });
          }
        }
      } else {
        // Create the new alias account if it doesn't exist
        const { data: existingNewAccount } = await (supabase
          .from("customers") as any)
          .select("id")
          .eq("customer_name", aliasAccountName)
          .is("deleted_at", null)
          .maybeSingle();

        if (!existingNewAccount) {
          await (supabase.from("customers") as any).insert({
            customer_name: aliasAccountName,
            is_internal: "client a/c",
            status: "active",
            created_by: user.id,
            updated_by: user.id,
          });
        }
      }
    }
  }

  revalidatePath(config.path);
}

export async function deactivateMaster(moduleKey: string, formData: FormData) {
  const user = await requirePermission(`${modulePermissionKey(moduleKey)}.delete`);

  const config = modules[moduleKey];
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  const table = config.table as any;
  const { error } = await (supabase
    .from(table) as any)
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(config.path);
}

export async function checkInAttendance(formData: FormData) {
  const user = await requirePermission("attendance.create");

  const payload = assertValid(attendanceSchema, readPayload(formData, ["employee_id"]));
  const supabase = await createClient();
  await assertAttendanceAccess(supabase, user, payload.employee_id);
  const now = new Date();
  const today = todayInIndia();

  const { data: existing, error: readError } = await (supabase.from("attendance") as any)
    .select("id, check_in_at")
    .eq("employee_id", payload.employee_id)
    .eq("attendance_date", today)
    .is("deleted_at", null)
    .maybeSingle();

  if (readError) throw new Error("Unable to verify today's attendance.");
  if (existing?.check_in_at) throw new Error("This employee is already checked in today.");

  const write = existing?.id
    ? (supabase.from("attendance") as any).update({
      check_in_at: now.toISOString(),
      check_out_at: null,
      check_out: null,
      status: "present",
      updated_by: user.id,
    }).eq("id", existing.id)
    : (supabase.from("attendance") as any).insert({
    employee_id: payload.employee_id,
    attendance_date: today,
    check_in_at: now.toISOString(),
    status: "present",
    created_by: user.id,
    updated_by: user.id,
  });

  const { error } = await write;
  if (error) throw new Error(error.message);
  revalidatePath("/attendance");
  revalidatePath("/dashboard");
}

export async function checkOutAttendance(formData: FormData) {
  const user = await requirePermission("attendance.edit");

  const payload = assertValid(attendanceSchema, readPayload(formData, ["employee_id"]));
  const supabase = await createClient();
  await assertAttendanceAccess(supabase, user, payload.employee_id);
  const now = new Date();
  const today = todayInIndia();

  const { data: existing, error: readError } = await (supabase.from("attendance") as any)
    .select("id, check_in_at, check_out_at")
    .eq("employee_id", payload.employee_id)
    .eq("attendance_date", today)
    .is("deleted_at", null)
    .maybeSingle();

  if (readError) throw new Error(readError.message);
  if (!existing?.id) throw new Error("Check in before checking out.");
  if (existing.check_out_at) throw new Error("This employee is already checked out today.");
  if (!existing.check_in_at || now.getTime() <= new Date(existing.check_in_at).getTime()) throw new Error("Check out time must be after check in time.");

  const { error } = await (supabase.from("attendance") as any)
    .update({ check_out_at: now.toISOString(), updated_by: user.id })
    .eq("id", existing.id);

  if (error) throw new Error(error.message);
  revalidatePath("/attendance");
  revalidatePath("/dashboard");
}

export async function linkEmployeeUser(formData: FormData) {
  const user = await requirePermission("users.edit");
  const permissions = await getSessionPermissions(user);
  if (!permissions.includes("employees.edit")) throw new Error("You need employee edit permission to link users to employees.");

  const parsed = assertValid(employeeUserLinkSchema, {
    user_id: formData.get("user_id"),
    employee_id: formData.get("employee_id") || undefined,
  });

  const supabase = await createClient();
  const { error: clearError } = await (supabase.from("employees") as any)
    .update({ user_id: null, updated_by: user.id })
    .eq("user_id", parsed.user_id);
  if (clearError) throw new Error("Unable to update employee link.");

  if (parsed.employee_id) {
    const { error: linkError } = await (supabase.from("employees") as any)
      .update({ user_id: parsed.user_id, updated_by: user.id })
      .eq("id", parsed.employee_id);
    if (linkError) throw new Error("Unable to link employee to user.");
  }

  revalidatePath("/users");
  revalidatePath("/employees");
  revalidatePath("/attendance");
}

export async function saveProduction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const user = await requirePermission(`production.${id ? "edit" : "create"}`);
  const supabase = await createClient();
  const fields = ["fabric_type_id", "loom_id", "gross_weight", "core_weight", "end_meters", "remarks"];
  if (user.roles?.name === "admin") fields.push("initial_meters");
  const payload = {
    ...assertValid(productionSchema, readPayload(formData, fields)),
    updated_by: user.id,
  };

  const query = id
    ? (supabase.from("loom_production_entries") as any).update(payload as any).eq("id", id)
    : (supabase.from("loom_production_entries") as any).insert({ ...payload, created_by: user.id, updated_by: user.id } as any);

  const { error } = await query;
  if (error) throw new Error(error.message);
  revalidatePath("/fabric/production");
  revalidatePath("/rolls");
  revalidatePath("/dashboard");
  revalidatePath("/fabric/stock");
}

export async function softDeleteProduction(formData: FormData) {
  const user = await requirePermission("production.edit");
  const id = String(formData.get("id") ?? "");
  const adminSupabase = createAdminClient();
  const { error } = await (adminSupabase
    .from("loom_production_entries") as any)
    .delete()
    .eq("id", id);
  if (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[softDeleteProduction] failed", {
        id,
        userId: user.id,
        message: error.message,
      });
    }
    throw new Error(error.message);
  }
  revalidatePath("/fabric/production");
  revalidatePath("/rolls");
  revalidatePath("/dashboard");
  revalidatePath("/fabric/stock");
}

export async function saveSale(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const user = await requirePermission(`sales.${id ? "edit" : "create"}`);
  const supabase = await createClient();
  const selectedRollIds = formData.getAll("selected_roll_ids").map(String);
  const payload = {
    ...assertValid(saleSchema, {
      ...readPayload(formData, ["customer_id", "fabric_type_id", "quantity_meters", "rate", "status"]),
      selected_roll_ids: selectedRollIds,
    }),
    updated_by: user.id,
  };

  const query = id
    ? (supabase.from("sales_orders") as any).update(payload as any).eq("id", id)
    : (supabase.from("sales_orders") as any).insert({ ...payload, created_by: user.id, updated_by: user.id } as any);
  const { error } = await query;
  if (error) throw new Error(error.message);
  revalidatePath("/sales");
  revalidatePath("/rolls");
  revalidatePath("/dashboard");
}

export async function saveRawMaterialPurchase(formData: FormData) {
  const user = await requirePermission("raw_materials.edit");

  const purchase_date = String(formData.get("purchase_date") ?? "");
  const supplier_name = String(formData.get("supplier_name") ?? "");
  const bill_number = String(formData.get("bill_number") ?? "");
  const remarks = String(formData.get("remarks") ?? "").trim();

  const raw_material_ids = formData.getAll("raw_material_id").map(String);
  const quantities = formData.getAll("quantity").map(Number);
  const rates = formData.getAll("rate").map(Number);
  const totalBillValue = Number(formData.get("total_bill_value") ?? 0);

  if (!purchase_date || !supplier_name || !bill_number) {
    throw new Error("Purchase date, client, and bill number are required.");
  }
  if (!Number.isFinite(totalBillValue) || totalBillValue <= 0) {
    throw new Error("Total bill value must be a positive amount.");
  }
  if (raw_material_ids.length === 0) {
    throw new Error("At least one raw material item must be added.");
  }
  if (raw_material_ids.some((id) => !id) || quantities.some((qty) => qty <= 0) || rates.some((rate) => rate <= 0)) {
    throw new Error("Every purchase item must have a material, positive quantity, and positive rate.");
  }

  const finalRemarks = `[TOTAL_BILL_VALUE:${totalBillValue.toFixed(2)}] ${remarks}`.trim();
  const supabase = await createClient();

  const inserts = raw_material_ids.map((id, index) => {
    const qty = quantities[index] ?? 0;
    const rt = rates[index] ?? 0;
    return {
      purchase_date,
      supplier_name: supplier_name || null,
      bill_number: bill_number || null,
      raw_material_id: id,
      quantity: qty,
      rate: rt,
      remarks: finalRemarks,
      created_by: user.id,
      updated_by: user.id,
    };
  });

  const { error } = await supabase.from("raw_material_purchases").insert(inserts as any);
  if (error) throw new Error(error.message);

  // Auto-generate journal entries for purchase
  try {
    const [purchaseAcResult, supplierAcResult] = await Promise.all([
      supabase.from("customers").select("id, customer_name").ilike("customer_name", "Purchase A/c").is("deleted_at", null).maybeSingle(),
      supabase.from("customers").select("id, customer_name").ilike("customer_name", supplier_name).is("deleted_at", null).maybeSingle()
    ]);
    const purchaseAc = purchaseAcResult.data as any;
    const supplierAc = supplierAcResult.data as any;

    const journalNo = await generateNextJournalNo(supabase);
    const journalInserts = [
      {
        journal_no: journalNo,
        entry_date: purchase_date,
        account_id: purchaseAc?.id ?? null,
        account_name: purchaseAc?.customer_name ?? "Purchase A/c",
        entry_type: "debit",
        amount: totalBillValue,
        description: `${bill_number} (${supplierAc?.customer_name ?? supplier_name})`,
        created_by: user.id,
        updated_by: user.id,
      },
      {
        journal_no: journalNo,
        entry_date: purchase_date,
        account_id: supplierAc?.id ?? null,
        account_name: supplierAc?.customer_name ?? supplier_name,
        entry_type: "credit",
        amount: totalBillValue,
        description: bill_number,
        created_by: user.id,
        updated_by: user.id,
      },
    ];
    await (supabase.from("accounts_journal") as any).insert(journalInserts);
  } catch (_journalErr) {
    // Purchase saved successfully, journal auto-gen is best-effort
    console.error("Auto-journal for purchase failed:", _journalErr);
  }

  revalidatePath("/raw-materials");
  revalidatePath("/accounts/purchase");
  revalidatePath("/accounts/journal");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
}

export async function createErpUser(_: unknown, formData: FormData) {
  await requirePermission("users.create");

  const parsed = createUserSchema.safeParse({
    full_name: formData.get("full_name"),
    email: formData.get("email"),
    password: formData.get("password"),
    phone: formData.get("phone") || undefined,
    role_id: formData.get("role_id"),
    status: formData.get("status") || "active",
  });

  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid user details." };

  const admin = createAdminClient();
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: {
      full_name: parsed.data.full_name,
      phone: parsed.data.phone ?? null,
    },
  });

  if (authError) return { error: "Unable to create Supabase Auth user. Verify the email is not already registered." };
  const authUserId = authData.user?.id;
  if (!authUserId) return { error: "Supabase did not return a user id." };

  const { error: profileError } = await admin.from("users").upsert({
    id: authUserId,
    role_id: parsed.data.role_id,
    full_name: parsed.data.full_name,
    email: parsed.data.email,
    phone: parsed.data.phone ?? null,
    status: parsed.data.status,
  } as any);

  if (profileError) {
    await admin.auth.admin.deleteUser(authUserId);
    return { error: "Unable to create ERP user profile." };
  }

  revalidatePath("/users");
  return { success: "Supabase Auth user created. Share the password securely with the user." };
}

export async function createRole(formData: FormData) {
  await requirePermission("roles.create");
  const payload = assertValid(roleSchema, {
    name: formData.get("name"),
    description: formData.get("description") || undefined,
  });
  const supabase = await createClient();
  const { error } = await (supabase.from("roles") as any).insert({
    name: payload.name,
    description: payload.description ?? null,
    is_active: true,
  } as any);
  if (error) throw new Error(error.message);
  revalidatePath("/roles");
}

export async function saveRoleDetails(formData: FormData) {
  await requirePermission("roles.edit");
  const roleId = String(formData.get("role_id") ?? "");
  assertValid(z.string().uuid("Select a valid role."), roleId);
  const payload = assertValid(roleSchema, {
    name: formData.get("name"),
    description: formData.get("description") || undefined,
  });
  const supabase = await createClient();
  const { error } = await (supabase
    .from("roles") as any)
    .update({
      name: payload.name,
      description: payload.description ?? null,
    } as any)
    .eq("id", roleId);
  if (error) throw new Error(error.message);
  revalidatePath("/roles");
  revalidatePath("/admin/permissions");
  revalidatePath(`/admin/permissions/${roleId}`);
}

export async function deactivateRole(formData: FormData) {
  await requirePermission("roles.delete");
  const roleId = String(formData.get("role_id") ?? "");
  assertValid(z.string().uuid("Select a valid role."), roleId);
  const supabase = await createClient();
  const { error } = await (supabase
    .from("roles") as any)
    .delete()
    .eq("id", roleId);
  if (error) throw new Error(error.message);
  revalidatePath("/roles");
}

export async function saveRolePermissions(formData: FormData) {
  const user = await requirePermission("roles.edit");
  const roleId = String(formData.get("role_id") ?? "");
  const permissionIds = formData.getAll("permission_ids").map(String);
  assertValid(z.string().uuid("Select a valid role."), roleId);
  const supabase = await createClient();
  const { error: deleteError } = await (supabase.from("role_permissions") as any).delete().eq("role_id", roleId);
  if (deleteError) throw new Error(deleteError.message);
  if (permissionIds.length > 0) {
    const rows = permissionIds.map((permissionId) => ({ role_id: roleId, permission_id: permissionId, created_by: user.id }));
    const { error: insertError } = await (supabase.from("role_permissions") as any).insert(rows as any);
    if (insertError) throw new Error(insertError.message);
  }
  revalidatePath("/roles");
  revalidatePath("/admin/permissions");
  revalidatePath(`/admin/permissions/${roleId}`);
}

export async function updateCriticalLevel(formData: FormData) {
  const user = await requirePermission("raw_materials.edit");
  const materialId = String(formData.get("material_id") ?? "");
  const criticalLevel = Number(formData.get("critical_level") ?? 0);

  const supabase = await createClient();
  const { error } = await (supabase
    .from("raw_materials") as any)
    .update({ critical_level: criticalLevel, updated_by: user.id })
    .eq("id", materialId);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/critical-levels");
  revalidatePath("/admin/raw-materials");
}

export async function saveRotoProduct(formData: FormData) {
  await requirePermission("roto_products.create");
  const id = String(formData.get("id") ?? "");
  const brand = String(formData.get("brand") ?? "").trim();
  const width = Number(formData.get("width") ?? 0);
  const height = Number(formData.get("height") ?? 0);
  const numCylinders = Number(formData.get("num_cylinders") ?? 0);
  const status = String(formData.get("status") ?? "active");
  const customerIdVal = String(formData.get("customer_id") ?? "").trim();
  const customer_id = (customerIdVal === "" || customerIdVal === "general") ? null : customerIdVal;
  const file = formData.get("image_file") as File | null;

  const supabase = await createClient();
  const adminSupabase = createAdminClient();

  let imageUrl = String(formData.get("image_url") ?? "");

  if (file && file.size > 0) {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `roto/${fileName}`;

    await adminSupabase.storage.createBucket("products", { public: true }).catch(() => {});

    const { error: uploadError } = await adminSupabase.storage
      .from("products")
      .upload(filePath, file, { cacheControl: "3600", upsert: true });

    if (uploadError) throw new Error(`Image upload failed: ${uploadError.message}`);

    const { data } = adminSupabase.storage
      .from("products")
      .getPublicUrl(filePath);

    imageUrl = data.publicUrl;
  }

  const payload = {
    brand,
    width,
    height,
    num_cylinders: numCylinders,
    image_url: imageUrl || null,
    status,
    customer_id,
  };

  const query = id 
    ? (supabase.from("roto_products") as any).update(payload).eq("id", id)
    : (supabase.from("roto_products") as any).insert(payload);

  const { error } = await query;
  if (error) throw new Error(error.message);

  revalidatePath("/admin/products");
}

export async function deactivateRotoProduct(formData: FormData) {
  await requirePermission("roto_products.delete");
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  const { error } = await (supabase
    .from("roto_products") as any)
    .update({ status: "inactive" })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/products");
}

export async function saveOffsetProduct(formData: FormData) {
  await requirePermission("offset_products.create");
  const id = String(formData.get("id") ?? "");
  const brand = String(formData.get("brand") ?? "").trim();
  const width = Number(formData.get("width") ?? 0);
  const height = Number(formData.get("height") ?? 0);
  const status = String(formData.get("status") ?? "active");
  const customerIdVal = String(formData.get("customer_id") ?? "").trim();
  const customer_id = (customerIdVal === "" || customerIdVal === "general") ? null : customerIdVal;
  const file = formData.get("image_file") as File | null;

  const supabase = await createClient();
  const adminSupabase = createAdminClient();

  let imageUrl = String(formData.get("image_url") ?? "");

  if (file && file.size > 0) {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `offset/${fileName}`;

    await adminSupabase.storage.createBucket("products", { public: true }).catch(() => {});

    const { error: uploadError } = await adminSupabase.storage
      .from("products")
      .upload(filePath, file, { cacheControl: "3600", upsert: true });

    if (uploadError) throw new Error(`Image upload failed: ${uploadError.message}`);

    const { data } = adminSupabase.storage
      .from("products")
      .getPublicUrl(filePath);

    imageUrl = data.publicUrl;
  }

  const payload = {
    brand,
    width,
    height,
    image_url: imageUrl || null,
    status,
    customer_id,
  };

  const query = id 
    ? (supabase.from("offset_products") as any).update(payload).eq("id", id)
    : (supabase.from("offset_products") as any).insert(payload);

  const { error } = await query;
  if (error) throw new Error(error.message);

  revalidatePath("/admin/products");
}

export async function deactivateOffsetProduct(formData: FormData) {
  await requirePermission("offset_products.delete");
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  const { error } = await (supabase
    .from("offset_products") as any)
    .update({ status: "inactive" })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/products");
}

export async function createSalesOrder(formData: FormData) {
  const user = await requirePermission("sales.create");
  const customerId = String(formData.get("customer_id") ?? "");
  const orderDate = String(formData.get("order_date") ?? "");

  const supabase = await createClient();

  const dateParts = orderDate.split("-");
  const mmDd = `${dateParts[1]}-${dateParts[2]}`;
  const { data: existing } = await (supabase
    .from("sales_orders") as any)
    .select("order_number")
    .eq("order_date", orderDate)
    .is("deleted_at", null);
  
  let maxSeq = 0;
  for (const order of (existing || []) as any[]) {
    const num = order.order_number;
    if (num.startsWith(`${mmDd}-`)) {
      const parts = num.split("-");
      const seq = Number(parts[2]);
      if (!isNaN(seq) && seq > maxSeq) {
        maxSeq = seq;
      }
    }
  }
  const orderNumber = `${mmDd}-${String(maxSeq + 1).padStart(2, "0")}`;

  const { data: orderHeader, error: headerError } = await (supabase
    .from("sales_orders") as any)
    .insert({
      customer_id: customerId,
      order_date: orderDate,
      order_number: orderNumber,
      status: "draft",
      created_by: user.id,
      updated_by: user.id
    })
    .select("id")
    .single();

  if (headerError) throw new Error(headerError.message);

  const departments = formData.getAll("department").map(String);
  const productIds = formData.getAll("product_id").map(String);
  const quantities = formData.getAll("quantity").map(Number);

  const itemsPayload = departments.map((dept, idx) => ({
    sales_order_id: (orderHeader as any).id,
    department: dept,
    product_id: productIds[idx],
    quantity: quantities[idx],
  }));

  if (itemsPayload.length > 0) {
    const { error: itemsError } = await (supabase
      .from("sales_order_items") as any)
      .insert(itemsPayload);
    
    if (itemsError) throw new Error(itemsError.message);
  }

  revalidatePath("/sales/delivery-entry");
}

export async function deleteSalesOrderItem(itemId: string) {
  const user = await requirePermission("sales.edit");
  const supabase = await createClient();

  const { data: item, error: itemError } = await (supabase
    .from("sales_order_items") as any)
    .select("sales_order_id, selected_roll_ids")
    .eq("id", itemId)
    .maybeSingle();

  if (itemError || !item) {
    throw new Error(itemError?.message || "Item not found.");
  }

  const orderId = item.sales_order_id;
  const rollIds = (item.selected_roll_ids as string[]) || [];

  if (rollIds.length > 0) {
    const { error: releaseError } = await (supabase
      .from("fabric_rolls") as any)
      .update({ status: "available", updated_by: user.id } as any)
      .in("id", rollIds);
    if (releaseError) throw new Error(releaseError.message);
  }

  const { error: deleteError } = await (supabase
    .from("sales_order_items") as any)
    .delete()
    .eq("id", itemId);
  if (deleteError) throw new Error(deleteError.message);

  const { data: remainingItems, error: countError } = await (supabase
    .from("sales_order_items") as any)
    .select("id")
    .eq("sales_order_id", orderId);

  if (countError) throw new Error(countError.message);

  if (!remainingItems || remainingItems.length === 0) {
    const { error: deleteOrderError } = await (supabase
      .from("sales_orders") as any)
      .delete()
      .eq("id", orderId);
    if (deleteOrderError) throw new Error(deleteOrderError.message);
  }

  revalidatePath("/sales/order-confirmation");
  revalidatePath("/rolls");
  revalidatePath("/fabric/stock");
  revalidatePath("/accounts/sales");
}

export async function confirmSalesDelivery(
  orderId: string,
  itemRolls: Record<string, string[]>,
  itemRemainingActions: Record<string, "backorder" | "close"> = {}
) {
  const user = await requirePermission("sales.edit");
  const supabase = await createClient();

  const { data: order, error: orderFetchError } = await (supabase
    .from("sales_orders") as any)
    .select("*, sales_order_items(*)")
    .eq("id", orderId)
    .single();

  if (orderFetchError || !order) {
    throw new Error(orderFetchError?.message || "Order not found.");
  }

  const items = (order.sales_order_items || []) as any[];

  const allNewRollIds = Object.values(itemRolls).flat();
  const rollsData: Record<string, number> = {};
  if (allNewRollIds.length > 0) {
    const { data: rollData, error: rollError } = await (supabase
      .from("fabric_rolls") as any)
      .select("id, weight")
      .in("id", allNewRollIds);
    if (rollError) throw new Error("Failed to retrieve roll details.");
    for (const r of rollData || []) {
      rollsData[r.id] = Number(r.weight || 0);
    }
  }

  const backorderItems: Array<{ department: string; product_id: string; quantity: number }> = [];
  const itemsToKeep: string[] = [];

  for (const item of items) {
    const newRollIds = itemRolls[item.id] || [];
    const oldRollIds = (item.selected_roll_ids as string[]) || [];
    const action = itemRemainingActions[item.id] || "close";

    if (item.department === "fabric") {
      const deliveredWeight = newRollIds.reduce((sum, rid) => sum + (rollsData[rid] || 0), 0);

      if (deliveredWeight < item.quantity) {
        if (action === "backorder") {
          const remainingQty = item.quantity - deliveredWeight;
          if (deliveredWeight > 0) {
            const { error: updateItemError } = await (supabase
              .from("sales_order_items") as any)
              .update({
                selected_roll_ids: newRollIds,
                quantity: deliveredWeight,
              } as any)
              .eq("id", item.id);
            if (updateItemError) throw new Error(updateItemError.message);
            itemsToKeep.push(item.id);

            backorderItems.push({
              department: item.department,
              product_id: item.product_id,
              quantity: remainingQty,
            });
          } else {
            const { error: deleteItemError } = await (supabase
              .from("sales_order_items") as any)
              .delete()
              .eq("id", item.id);
            if (deleteItemError) throw new Error(deleteItemError.message);

            backorderItems.push({
              department: item.department,
              product_id: item.product_id,
              quantity: item.quantity,
            });
          }
        } else {
          if (deliveredWeight > 0) {
            const { error: updateItemError } = await (supabase
              .from("sales_order_items") as any)
              .update({
                selected_roll_ids: newRollIds,
                quantity: deliveredWeight,
              } as any)
              .eq("id", item.id);
            if (updateItemError) throw new Error(updateItemError.message);
            itemsToKeep.push(item.id);
          } else {
            const { error: deleteItemError } = await (supabase
              .from("sales_order_items") as any)
              .delete()
              .eq("id", item.id);
            if (deleteItemError) throw new Error(deleteItemError.message);
          }
        }
      } else {
        const { error: updateItemError } = await (supabase
          .from("sales_order_items") as any)

          .update({
            selected_roll_ids: newRollIds,
            quantity: deliveredWeight,
          } as any)
          .eq("id", item.id);
        if (updateItemError) throw new Error(updateItemError.message);
        itemsToKeep.push(item.id);
      }

      const releasedRollIds = oldRollIds.filter((id) => !newRollIds.includes(id));
      if (releasedRollIds.length > 0) {
        const { error: releaseError } = await (supabase
          .from("fabric_rolls") as any)
          .update({ status: "available", updated_by: user.id } as any)
          .in("id", releasedRollIds);
        if (releaseError) throw new Error(releaseError.message);
      }

      if (newRollIds.length > 0) {
        const { error: allocateError } = await (supabase
          .from("fabric_rolls") as any)
          .update({ status: "sold", updated_by: user.id } as any)
          .in("id", newRollIds);
        if (allocateError) throw new Error(allocateError.message);
      }
    } else {
      itemsToKeep.push(item.id);
    }
  }

  if (backorderItems.length > 0) {
    const { data: newOrder, error: newOrderError } = await (supabase
      .from("sales_orders") as any)
      .insert({
        customer_id: order.customer_id,
        order_date: order.order_date,
        order_number: order.order_number,
        status: "draft",
        created_by: user.id,
        updated_by: user.id,
      } as any)
      .select("id")
      .single();

    if (newOrderError) throw new Error("Failed to create backorder sales order.");

    const backorderItemsPayload = backorderItems.map((bo) => ({
      sales_order_id: (newOrder as any).id,
      department: bo.department,
      product_id: bo.product_id,
      quantity: bo.quantity,
      selected_roll_ids: [],
    }));

    const { error: boInsertError } = await (supabase
      .from("sales_order_items") as any)
      .insert(backorderItemsPayload);
    if (boInsertError) throw new Error("Failed to create backordered items.");
  }

  if (itemsToKeep.length > 0) {
    const { error: orderError } = await (supabase
      .from("sales_orders") as any)
      .update({ status: "confirmed", updated_by: user.id } as any)
      .eq("id", orderId);

    if (orderError) throw new Error(orderError.message);
  } else {
    const { error: deleteOrderError } = await (supabase
      .from("sales_orders") as any)
      .delete()
      .eq("id", orderId);
    if (deleteOrderError) throw new Error(deleteOrderError.message);
  }

  revalidatePath("/sales/order-confirmation");
  revalidatePath("/rolls");
  revalidatePath("/fabric/stock");
  revalidatePath("/accounts/sales");
}

export async function saveRawMaterialConsumption(formData: FormData) {
  const user = await requirePermission("production.edit");
  const id = String(formData.get("id") ?? "");
  const rawMaterialId = String(formData.get("raw_material_id") ?? "");
  const department = String(formData.get("department") ?? "");
  const quantity = Number(formData.get("quantity") ?? 0);
  const consumptionDate = String(formData.get("consumption_date") ?? "");
  const remarks = String(formData.get("remarks") ?? "");

  if (!rawMaterialId || !department || quantity <= 0 || !consumptionDate) {
    throw new Error("Missing required consumption fields or invalid quantity.");
  }
  if (quantity % 25 !== 0) {
    throw new Error("Quantity must be a multiple of 25.");
  }

  const supabase = await createClient();
  const payload = {
    raw_material_id: rawMaterialId,
    department,
    quantity,
    consumption_date: consumptionDate,
    remarks: remarks || null,
    updated_by: user.id,
  };

  const query = id
    ? (supabase.from("raw_material_consumptions") as any).update(payload).eq("id", id)
    : (supabase.from("raw_material_consumptions") as any).insert({ ...payload, created_by: user.id });

  const { error } = await query;
  if (error) throw new Error(error.message);

  revalidatePath("/fabric/consumption");
  revalidatePath("/roto-printing/consumption");
  revalidatePath("/lamination/consumption");
  revalidatePath("/offset-printing/consumption");
  revalidatePath("/finishing/consumption");
  revalidatePath("/raw-materials");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
}

export async function softDeleteRawMaterialConsumption(formData: FormData) {
  const user = await requirePermission("production.edit");
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();

  // Fetch the entry first to verify its consumption date
  const { data: entry, error: fetchError } = await (supabase
    .from("raw_material_consumptions") as any)
    .select("consumption_date")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !entry) {
    throw new Error("Consumption log not found.");
  }

  if (entry.consumption_date !== todayInIndia()) {
    throw new Error("You can only delete consumption logs on the day they are created.");
  }

  const { error } = await (supabase
    .from("raw_material_consumptions") as any)
    .delete()
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/fabric/consumption");
  revalidatePath("/roto-printing/consumption");
  revalidatePath("/lamination/consumption");
  revalidatePath("/offset-printing/consumption");
  revalidatePath("/finishing/consumption");
  revalidatePath("/raw-materials");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
}

export async function saveStageProduction(formData: FormData) {
  const user = await requirePermission("production.edit");
  const id = String(formData.get("id") ?? "");
  const rollId = String(formData.get("roll_id") ?? "");
  const stage = String(formData.get("stage") ?? "");
  const productId = String(formData.get("product_id") ?? "");
  const entryDate = String(formData.get("entry_date") ?? "");
  const remarks = String(formData.get("remarks") ?? "");

  // Gather specific details depending on stage
  const details: Record<string, any> = {};
  if (stage === "roto_printing") {
    details.color_id = String(formData.get("color_id") ?? "");
    details.cylinders = Number(formData.get("cylinders") ?? 0);
  } else if (stage === "lamination") {
    details.adhesive = String(formData.get("adhesive") ?? "");
  } else if (stage === "finishing") {
    details.packaging = String(formData.get("packaging") ?? "");
  }

  if (!rollId || !stage || !entryDate) {
    throw new Error("Missing required production entry fields.");
  }

  const supabase = await createClient();
  const payload = {
    roll_id: rollId,
    stage,
    product_id: productId || null,
    details,
    entry_date: entryDate,
    remarks: remarks || null,
    updated_by: user.id,
  };

  const query = id
    ? (supabase.from("stage_production_entries") as any).update(payload).eq("id", id)
    : (supabase.from("stage_production_entries") as any).insert({ ...payload, created_by: user.id });

  const { error } = await query;
  if (error) throw new Error(error.message);

  revalidatePath("/roto-printing/production");
  revalidatePath("/roto-printing/stock");
  revalidatePath("/lamination/production");
  revalidatePath("/lamination/stock");
  revalidatePath("/offset-printing/production");
  revalidatePath("/offset-printing/stock");
  revalidatePath("/finishing/production");
  revalidatePath("/finishing/stock");
  revalidatePath("/rolls");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
}

export async function softDeleteStageProduction(formData: FormData) {
  const user = await requirePermission("production.edit");
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  const { error } = await (supabase
    .from("stage_production_entries") as any)
    .delete()
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/roto-printing/production");
  revalidatePath("/roto-printing/stock");
  revalidatePath("/lamination/production");
  revalidatePath("/lamination/stock");
  revalidatePath("/offset-printing/production");
  revalidatePath("/offset-printing/stock");
  revalidatePath("/finishing/production");
  revalidatePath("/finishing/stock");
  revalidatePath("/rolls");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
}

export async function saveJournalEntry(formData: FormData) {
  const user = await requirePermission("sales.edit");
  const journalNo = String(formData.get("journal_no") ?? "");
  const entryDate = String(formData.get("entry_date") ?? "");
  const rowsJson = String(formData.get("rows_json") ?? "");
  const originalJournalNo = String(formData.get("original_journal_no") ?? "");

  if (!journalNo || !entryDate || !rowsJson) {
    throw new Error("Missing required journal fields.");
  }

  type JournalFormRow = {
    account_name: string;
    description: string;
    debit: number;
    credit: number;
  };
  type JournalInsertRow = {
    journal_no: string;
    entry_date: string;
    account_name: string;
    entry_type: "debit" | "credit";
    amount: number;
    description: string;
    created_by: string;
    updated_by: string;
  };

  const rows = JSON.parse(rowsJson) as JournalFormRow[];

  if (rows.length < 2) {
    throw new Error("At least 2 rows are required for a journal entry.");
  }

  // Validate totals and rows
  let totalDebit = 0;
  let totalCredit = 0;
  for (const r of rows) {
    if (!r.account_name) throw new Error("Account name is required on all rows.");
    if (r.debit > 0 && r.credit > 0) throw new Error("A row cannot contain both Debit and Credit.");
    if (r.debit <= 0 && r.credit <= 0) throw new Error("Either Debit or Credit must be entered on all rows.");
    if (r.debit > 0) {
      if (r.debit <= 0) throw new Error("Amount must be positive.");
      totalDebit += r.debit;
    }
    if (r.credit > 0) {
      if (r.credit <= 0) throw new Error("Amount must be positive.");
      totalCredit += r.credit;
    }
  }

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error("Total Debit must be equal to Total Credit before submitting.");
  }

  const supabase = await createClient();

  // If editing (originalJournalNo exists), soft delete old rows first
  if (originalJournalNo) {
    const { error: deleteError } = await (supabase
      .from("accounts_journal") as any)
      .update({ deleted_at: new Date().toISOString(), updated_by: user.id })
      .eq("journal_no", originalJournalNo);
    if (deleteError) throw new Error(deleteError.message);
  }

  // Resolve account_ids from names/aliases dynamically on the server
  const { data: matchedCustomersData } = await supabase
    .from("customers")
    .select("id, customer_name, alias")
    .is("deleted_at", null);

  const matchedCustomers = (matchedCustomersData ?? []) as any[];
  const nameToIdMap = new Map<string, string>();
  for (const c of matchedCustomers) {
    nameToIdMap.set(c.customer_name.toLowerCase().trim(), c.id);
    if (c.alias) {
      nameToIdMap.set(c.alias.toLowerCase().trim(), c.id);
    }
  }

  // Insert new rows
  const inserts = rows.map((r) => {
    const cleanName = r.account_name.toLowerCase().trim();
    const accountId = nameToIdMap.get(cleanName) || null;
    return {
      journal_no: journalNo,
      entry_date: entryDate,
      account_id: accountId,
      account_name: r.account_name,
      entry_type: r.debit > 0 ? "debit" : "credit",
      amount: r.debit > 0 ? r.debit : r.credit,
      description: r.description,
      created_by: user.id,
      updated_by: user.id,
    };
  });

  const { error: insertError } = await (supabase.from("accounts_journal") as any).insert(inserts);
  if (insertError) throw new Error(insertError.message);

  revalidatePath("/accounts/journal");
  revalidatePath("/accounts/sales");
  revalidatePath("/reports");
}

export async function softDeleteJournalEntry(formData: FormData) {
  const user = await requirePermission("sales.edit");
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  const { error } = await (supabase
    .from("accounts_journal") as any)
    .delete()
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/accounts/journal");
  revalidatePath("/accounts/sales");
  revalidatePath("/reports");
}

export async function softDeleteJournalEntryGroup(formData: FormData) {
  const user = await requirePermission("sales.edit");
  const journalNo = String(formData.get("journal_no") ?? "");
  if (!journalNo) throw new Error("Missing journal number.");
  const supabase = await createClient();

  // Fetch journal lines to verify they are not auto-generated
  const { data: lines, error: fetchErr } = await (supabase
    .from("accounts_journal") as any)
    .select("description")
    .eq("journal_no", journalNo);

  if (fetchErr) throw new Error(fetchErr.message);

  const isAutoGenerated = (desc: string) => {
    if (!desc) return false;
    const d = desc.toLowerCase();
    return (
      d.startsWith("balance adjustment for bill") ||
      d.startsWith("billing for sales order") ||
      d.startsWith("raw material purchase") ||
      d.startsWith("purchase invoice")
    );
  };

  if ((lines || []).some((l: any) => isAutoGenerated(l.description))) {
    throw new Error("Cannot delete auto-generated journal entries.");
  }

  const { error } = await (supabase
    .from("accounts_journal") as any)
    .delete()
    .eq("journal_no", journalNo);

  if (error) throw new Error(error.message);

  revalidatePath("/accounts/journal");
  revalidatePath("/accounts/sales");
  revalidatePath("/reports");
}


// --- Helper: generate next journal number ---
async function generateNextJournalNo(supabase: any): Promise<string> {
  const { data: dbJournals } = await supabase
    .from("accounts_journal")
    .select("journal_no")
    .is("deleted_at", null);
  const journalNos = ((dbJournals ?? []) as Array<{ journal_no: string | null }>)
    .map((j) => j.journal_no)
    .filter((no): no is string => Boolean(no));
  let nextInt = 1;
  for (const no of journalNos) {
    const match = no.match(/JE-(\d+)/);
    if (match) {
      const val = parseInt(match[1], 10);
      if (val >= nextInt) nextInt = val + 1;
    }
  }
  return `JE-${String(nextInt).padStart(6, "0")}`;
}

export async function saveSalesOrderBilling(formData: FormData) {
  const user = await requirePermission("sales.edit");
  const orderId = String(formData.get("order_id") ?? "");
  const billNumber = String(formData.get("bill_number") ?? "").trim();
  const billValue = Number(formData.get("bill_value") ?? 0);
  const skipJournal = formData.get("skip_journal") === "1" && billNumber === "0";

  if (!orderId || !billNumber) {
    throw new Error("Order ID and Bill Number are required.");
  }
  if (!Number.isFinite(billValue) || billValue <= 0) {
    throw new Error("Bill Value must be a positive amount.");
  }

  const supabase = await createClient();

  // Fetch the order with items, customers, and their alias/short name
  const { data: order, error: orderError } = await (supabase
    .from("sales_orders") as any)
    .select(`
      id,
      customer_id,
      order_date,
      gst_rate,
      customers(customer_name, alias),
      sales_order_items(
        id,
        department,
        product_id,
        quantity,
        price,
        selected_roll_ids
      )
    `)
    .eq("id", orderId)
    .single();

  if (orderError || !order) throw new Error("Sales order not found.");

  const customerName = (order as any).customers?.customer_name ?? "Unknown";
  const entryDate = (order as any).order_date ?? todayInIndia();

  // Update sales order with billing info
  const { error: updateError } = await (supabase
    .from("sales_orders") as any)
    .update({
      bill_number: billNumber,
      bill_value: billValue,
      updated_by: user.id,
    } as any)
    .eq("id", orderId);

  if (updateError) throw new Error(updateError.message);

  // If bill number is "0" and skip_journal flag is set, skip journal entries
  if (skipJournal) {
    revalidatePath("/accounts/sales");
    revalidatePath("/accounts/journal");
    revalidatePath("/sales/order-confirmation");
    revalidatePath("/reports");
    return;
  }

  const [customerAcResult, salesAcResult] = await Promise.all([
    supabase.from("customers").select("id, customer_name").ilike("customer_name", customerName).is("deleted_at", null).maybeSingle(),
    supabase.from("customers").select("id, customer_name").ilike("customer_name", "Sales A/c").is("deleted_at", null).maybeSingle()
  ]);
  const customerAc = customerAcResult.data as any;
  const salesAc = salesAcResult.data as any;

  const journalNo = await generateNextJournalNo(supabase);
  const journalInserts = [
    {
      journal_no: journalNo,
      entry_date: entryDate,
      account_id: customerAc?.id ?? null,
      account_name: customerAc?.customer_name ?? customerName,
      entry_type: "debit",
      amount: billValue,
      description: billNumber,
      created_by: user.id,
      updated_by: user.id,
    },
    {
      journal_no: journalNo,
      entry_date: entryDate,
      account_id: salesAc?.id ?? null,
      account_name: salesAc?.customer_name ?? "Sales A/c",
      entry_type: "credit",
      amount: billValue,
      description: `${billNumber} (${customerAc?.customer_name ?? customerName})`,
      created_by: user.id,
      updated_by: user.id,
    },
  ];

  const { error: journalError } = await (supabase.from("accounts_journal") as any).insert(journalInserts);
  if (journalError) throw new Error(journalError.message);

  revalidatePath("/accounts/sales");
  revalidatePath("/accounts/journal");
  revalidatePath("/sales/order-confirmation");
  revalidatePath("/reports");
}

export async function deleteSalesOrderCompletely(orderId: string) {
  const user = await requirePermission("sales.edit");
  const supabase = await createClient();

  const { data: order, error: orderError } = await (supabase
    .from("sales_orders") as any)
    .select("id, bill_number, sales_order_items(id, selected_roll_ids)")
    .eq("id", orderId)
    .single();

  if (orderError || !order) {
    throw new Error("Sales order not found or already deleted.");
  }

  const orderData = order as any;
  const billNumber = orderData.bill_number;
  const items = orderData.sales_order_items || [];

  const rollIds: string[] = [];
  for (const item of items) {
    if (item.selected_roll_ids && Array.isArray(item.selected_roll_ids)) {
      rollIds.push(...item.selected_roll_ids);
    }
  }

  if (rollIds.length > 0) {
    const { error: rollUpdateErr } = await (supabase
      .from("fabric_rolls") as any)
      .update({ status: "available", updated_by: user.id })
      .in("id", rollIds);
    if (rollUpdateErr) {
      throw new Error("Failed to reset roll statuses: " + rollUpdateErr.message);
    }
  }

  if (billNumber) {
    const { data: journalRows } = await (supabase
      .from("accounts_journal") as any)
      .select("journal_no")
      .or(`description.eq."${billNumber}",description.like."${billNumber} (%)"`);
    
    const journalNos = (journalRows || []).map((r: any) => r.journal_no);
    if (journalNos.length > 0) {
      const { error: journalDelErr } = await (supabase
        .from("accounts_journal") as any)
        .delete()
        .in("journal_no", journalNos);
      if (journalDelErr) {
        throw new Error("Failed to delete related journal entries: " + journalDelErr.message);
      }
    }
  }

  const { error: itemsDelErr } = await (supabase
    .from("sales_order_items") as any)
    .delete()
    .eq("sales_order_id", orderId);
  if (itemsDelErr) {
    throw new Error("Failed to delete sales order items: " + itemsDelErr.message);
  }

  const { error: orderDelErr } = await (supabase
    .from("sales_orders") as any)
    .delete()
    .eq("id", orderId);
  if (orderDelErr) {
    throw new Error("Failed to delete sales order: " + orderDelErr.message);
  }

  revalidatePath("/sales/delivery-entry");
  revalidatePath("/sales/order-confirmation");
  revalidatePath("/accounts/sales");
  revalidatePath("/accounts/journal");
  revalidatePath("/rolls");
  revalidatePath("/fabric/stock");
  revalidatePath("/reports");
}

export async function saveSalesConfirmationRates(
  orderId: string,
  itemPrices: Record<string, number>,
  gstRate: number
) {
  const user = await requirePermission("sales.edit");
  const supabase = await createClient();

  // 1. Fetch sales order with customer details
  const { data: order, error: orderFetchError } = await (supabase
    .from("sales_orders") as any)
    .select("*, customers(*), sales_order_items(*)")
    .eq("id", orderId)
    .single();

  if (orderFetchError || !order) {
    throw new Error(orderFetchError?.message || "Order not found.");
  }

  // Update sales order GST rate
  const { error: orderError } = await (supabase
    .from("sales_orders") as any)
    .update({ gst_rate: gstRate, updated_by: user.id } as any)
    .eq("id", orderId);

  if (orderError) {
    throw new Error(orderError.message);
  }

  // Update prices for sales order items
  const itemUpdates = Object.entries(itemPrices).map(([itemId, price]) =>
    (supabase
      .from("sales_order_items") as any)
      .update({ price } as any)
      .eq("id", itemId)
  );

  const results = await Promise.all(itemUpdates);
  for (const res of results) {
    if (res.error) {
      throw new Error(res.error.message);
    }
  }

  // 2. Fetch fabric rolls for weight calculations
  const items = (order.sales_order_items || []) as any[];
  const allRollIds: string[] = [];
  items.forEach((item: any) => {
    if (item.department === "fabric" && item.selected_roll_ids) {
      allRollIds.push(...item.selected_roll_ids);
    }
  });

  const rollsData: Record<string, number> = {};
  if (allRollIds.length > 0) {
    const { data: rollData } = await supabase
      .from("fabric_rolls")
      .select("id, weight")
      .in("id", allRollIds)
      .is("deleted_at", null);
    
    (rollData || []).forEach((r: any) => {
      rollsData[r.id] = Number(r.weight || 0);
    });
  }

  // 3. Calculate actual calculatedTotal
  let baseTotal = 0;
  for (const item of items) {
    let qty = 0;
    if (item.department === "fabric") {
      const selectedIds = item.selected_roll_ids || [];
      selectedIds.forEach((rid: string) => {
        qty += rollsData[rid] || 0;
      });
    } else {
      qty = Number(item.quantity || 0);
    }
    const price = Number(itemPrices[item.id] ?? 0);
    baseTotal += qty * price;
  }

  const calculatedTotal = baseTotal + (baseTotal * gstRate / 100);
  const billValue = Number(order.bill_value ?? 0);
  const balance = calculatedTotal - billValue;

  const billNumber = order.bill_number;
  if (billNumber) {
    // Delete any existing balance adjustments for this bill to prevent duplication
    await (supabase
      .from("accounts_journal") as any)
      .delete()
      .or(`description.eq."Balance adjustment for Bill ${billNumber}",description.like."Balance adjustment for Bill ${billNumber} (%)"`);
  }

  // 4. Auto-generate journal entry if balance is > +/- 100
  if (Math.abs(balance) > 100 && billNumber) {
    const customerName = order.customers?.customer_name ?? "Unknown";
    const clientAlias = order.customers?.alias;

    // Resolve or create Client Alias A/c
    let aliasAcId: string | null = null;
    const aliasBase = (clientAlias && clientAlias.trim()) || customerName.trim();
    const aliasAcName = aliasBase.toLowerCase().endsWith(" a/c") ? aliasBase : `${aliasBase} A/c`;

    const { data: existingAliasAc } = await (supabase
      .from("customers") as any)
      .select("id, customer_name")
      .ilike("customer_name", aliasAcName)
      .is("deleted_at", null)
      .maybeSingle();

    if (existingAliasAc) {
      aliasAcId = existingAliasAc.id;
    } else {
      const { data: newAliasAc, error: createAliasErr } = await (supabase
        .from("customers") as any)
        .insert({
          customer_name: aliasAcName,
          is_internal: "client a/c",
          status: "active",
          created_by: user.id,
          updated_by: user.id,
        })
        .select("id")
        .single();
      if (!createAliasErr && newAliasAc) {
        aliasAcId = newAliasAc.id;
      }
    }

    const { data: salesAcData } = await (supabase
      .from("customers") as any)
      .select("id, customer_name")
      .ilike("customer_name", "Sales A/c")
      .is("deleted_at", null)
      .maybeSingle();
    const salesAc = salesAcData as any;

    const journalNo = await generateNextJournalNo(supabase);
    const journalInserts = [];
    const absBalance = Math.abs(balance);

    if (balance > 100) {
      // Positive balance (underpaid): CLIENT Alias A/c Dr. & SALES A/c Cr.
      journalInserts.push({
        journal_no: journalNo,
        entry_date: order.order_date ?? todayInIndia(),
        account_id: aliasAcId,
        account_name: aliasAcName,
        entry_type: "debit",
        amount: absBalance,
        description: `Balance adjustment for Bill ${billNumber}`,
        created_by: user.id,
        updated_by: user.id,
      });
      journalInserts.push({
        journal_no: journalNo,
        entry_date: order.order_date ?? todayInIndia(),
        account_id: salesAc?.id ?? null,
        account_name: salesAc?.customer_name ?? "Sales A/c",
        entry_type: "credit",
        amount: absBalance,
        description: `Balance adjustment for Bill ${billNumber} (${customerName})`,
        created_by: user.id,
        updated_by: user.id,
      });
    } else {
      // Negative balance (overpaid): SALES A/c Dr. & CLIENT Alias A/c Cr.
      journalInserts.push({
        journal_no: journalNo,
        entry_date: order.order_date ?? todayInIndia(),
        account_id: salesAc?.id ?? null,
        account_name: salesAc?.customer_name ?? "Sales A/c",
        entry_type: "debit",
        amount: absBalance,
        description: `Balance adjustment for Bill ${billNumber} (${customerName})`,
        created_by: user.id,
        updated_by: user.id,
      });
      journalInserts.push({
        journal_no: journalNo,
        entry_date: order.order_date ?? todayInIndia(),
        account_id: aliasAcId,
        account_name: aliasAcName,
        entry_type: "credit",
        amount: absBalance,
        description: `Balance adjustment for Bill ${billNumber}`,
        created_by: user.id,
        updated_by: user.id,
      });
    }

    const { error: journalError } = await (supabase.from("accounts_journal") as any).insert(journalInserts);
    if (journalError) throw new Error(journalError.message);
  }

  revalidatePath("/reports/sales-confirmation");
  revalidatePath("/accounts/journal");
  revalidatePath("/reports/accounts");
}

export async function saveAccountOpeningBalance(formData: FormData) {
  const user = await requirePermission("customers.edit");
  const id = String(formData.get("id") ?? "");
  const openingDebit = Number(formData.get("opening_debit") ?? 0);
  const openingCredit = Number(formData.get("opening_credit") ?? 0);

  if (!id) {
    throw new Error("Account ID is required.");
  }
  if (openingDebit < 0 || openingCredit < 0) {
    throw new Error("Opening values cannot be negative.");
  }

  const supabase = await createClient();
  const { error } = await (supabase
    .from("customers") as any)
    .update({
      opening_debit: openingDebit,
      opening_credit: openingCredit,
      updated_by: user.id,
    } as any)
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/reports/opening-balance");
  revalidatePath("/reports/accounts");
}

export async function saveMaterialSalesEntry(formData: FormData) {
  const user = await requirePermission("sales.create");

  const sale_date = String(formData.get("sale_date") ?? todayInIndia());
  const bill_number = String(formData.get("bill_number") ?? "").trim();
  const customer_id = String(formData.get("customer_id") ?? "");
  const type = String(formData.get("type") ?? "");
  const quantity = Number(formData.get("quantity") ?? 0);
  const price = Number(formData.get("price") ?? 0);
  const inc_gst = formData.get("inc_gst") === "true";

  let department: string | null = null;
  let raw_material_id: string | null = null;

  if (type === "raw_material") {
    department = String(formData.get("department") ?? "");
    raw_material_id = String(formData.get("raw_material_id") ?? "");
    if (!department || !raw_material_id) {
      throw new Error("Department and Raw Material ID are required for raw material sales.");
    }
  }

  if (!bill_number || !customer_id || !type) {
    throw new Error("Bill number, client customer, and sale type are required.");
  }

  if (quantity <= 0 || price <= 0) {
    throw new Error("Quantity and price must be greater than zero.");
  }

  // Calculate amount
  const baseAmount = quantity * price;
  const amount = inc_gst ? baseAmount : baseAmount * 1.18;

  const supabase = await createClient();

  if (type === "raw_material" && raw_material_id) {
    const { data: rmData, error: rmErr } = await (supabase
      .from("raw_materials") as any)
      .select("current_stock, material_name")
      .eq("id", raw_material_id)
      .single();
    if (rmErr || !rmData) {
      throw new Error("Raw material not found.");
    }
    const currentStock = Number(rmData.current_stock ?? 0);
    if (quantity > currentStock) {
      throw new Error(`Cannot sell ${quantity}. Only ${currentStock} is available in stock.`);
    }
  }

  // Retrieve customer info
  const { data: customerResult, error: customerErr } = await (supabase
    .from("customers") as any)
    .select("customer_name")
    .eq("id", customer_id)
    .single();

  if (customerErr || !customerResult) {
    throw new Error("Customer not found.");
  }

  const customer = customerResult as any;
  const customerName = customer.customer_name;

  // Retrieve Sales A/c info (case-insensitive)
  const { data: salesAcResult, error: salesAcErr } = await (supabase
    .from("customers") as any)
    .select("id, customer_name")
    .ilike("customer_name", "sales a/c")
    .is("deleted_at", null)
    .maybeSingle();

  const salesAc = salesAcResult as any;
  const salesAcName = salesAc?.customer_name ?? "Sales A/c";

  // Generate journal number
  const journalNo = await generateNextJournalNo(supabase);

  // Insert double entries into accounts_journal
  const journalInserts = [
    {
      journal_no: journalNo,
      entry_date: sale_date,
      account_id: customer_id,
      account_name: customerName,
      entry_type: "debit",
      amount: amount,
      description: `Bill ${bill_number} (${type === "raw_material" ? "Raw Material" : "Waste"})`,
      created_by: user.id,
      updated_by: user.id,
    },
    {
      journal_no: journalNo,
      entry_date: sale_date,
      account_id: salesAc?.id ?? null,
      account_name: salesAcName,
      entry_type: "credit",
      amount: amount,
      description: `Bill ${bill_number} (${customerName})`,
      created_by: user.id,
      updated_by: user.id,
    },
  ];

  const { error: journalErr } = await (supabase.from("accounts_journal") as any).insert(journalInserts);
  if (journalErr) {
    throw new Error(`Failed to create journal entries: ${journalErr.message}`);
  }

  // Insert material sale entry
  const { error: saleErr } = await (supabase.from("material_sales") as any).insert({
    sale_date,
    bill_number,
    customer_id,
    type,
    department: department || null,
    raw_material_id: raw_material_id || null,
    quantity,
    price,
    inc_gst,
    amount,
    journal_no: journalNo,
    created_by: user.id,
    updated_by: user.id,
  });

  if (saleErr) {
    // Attempt rollback of journal entries
    await (supabase.from("accounts_journal") as any).delete().eq("journal_no", journalNo);
    throw new Error(`Failed to save material sale: ${saleErr.message}`);
  }

  revalidatePath("/accounts/material");
  revalidatePath("/accounts/journal");
  revalidatePath("/reports");
  revalidatePath("/reports/stock");
  revalidatePath("/reports/closing-stock");
}

export async function deleteMaterialSalesEntry(formData: FormData) {
  const user = await requirePermission("sales.edit");
  const id = String(formData.get("id") ?? "");
  const journalNo = String(formData.get("journal_no") ?? "");

  if (!id) throw new Error("Material sale ID is required.");

  const supabase = await createClient();

  // Delete material sale
  const { error: saleErr } = await (supabase
    .from("material_sales") as any)
    .delete()
    .eq("id", id);

  if (saleErr) throw new Error(`Failed to delete material sale: ${saleErr.message}`);

  // Delete journal entries if journalNo was generated
  if (journalNo) {
    const { error: journalErr } = await (supabase
      .from("accounts_journal") as any)
      .delete()
      .eq("journal_no", journalNo);
    if (journalErr) {
      console.error(`Failed to delete journal entries for material sale: ${journalErr.message}`);
    }
  }

  revalidatePath("/accounts/material");
  revalidatePath("/accounts/journal");
  revalidatePath("/reports");
  revalidatePath("/reports/stock");
  revalidatePath("/reports/closing-stock");
}

export async function clearSystemTransactions() {
  const user = await requirePermission("users.view");

  const supabase = await createClient();

  // 1. Delete transactions in order of dependency constraints
  const tablesToDelete = [
    "material_sales",
    "raw_material_purchases",
    "raw_material_consumptions",
    "accounts_journal",
    "sales_order_items",
    "sales_orders",
    "stage_production_entries",
  ];

  for (const table of tablesToDelete) {
    const { error } = await (supabase.from(table) as any).delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) {
      console.error(`Failed to clear table ${table}:`, error);
      throw new Error(`Failed to clear table ${table}: ${error.message}`);
    }
  }

  // 2. Reset fabric_rolls status to 'available'
  const { error: rollResetErr } = await (supabase
    .from("fabric_rolls") as any)
    .update({ status: "available", current_stage: "loom", updated_by: user.id } as any)
    .neq("id", "00000000-0000-0000-0000-000000000000");

  if (rollResetErr) {
    console.error("Failed to reset fabric rolls status:", rollResetErr);
    throw new Error(`Failed to reset fabric rolls: ${rollResetErr.message}`);
  }

  // 3. Reset raw materials stock level back to opening_stock
  const { data: rawMaterials, error: fetchRmErr } = await (supabase
    .from("raw_materials") as any)
    .select("id, opening_stock")
    .is("deleted_at", null);

  if (fetchRmErr) {
    throw new Error(`Failed to fetch raw materials: ${fetchRmErr.message}`);
  }

  for (const rm of (rawMaterials ?? [])) {
    const { error: rmResetErr } = await (supabase
      .from("raw_materials") as any)
      .update({ current_stock: rm.opening_stock, updated_by: user.id })
      .eq("id", rm.id);

    if (rmResetErr) {
      throw new Error(`Failed to reset raw material stock for ${rm.id}: ${rmResetErr.message}`);
    }
  }

  // 4. Create alias accounts for existing clients who have aliases but no "[Alias] A/c" yet
  const { data: activeClients } = await (supabase.from("customers") as any)
    .select("id, customer_name, alias")
    .eq("is_internal", "client a/c")
    .is("deleted_at", null);

  for (const client of activeClients ?? []) {
    const alias = String(client.alias ?? "").trim();
    if (alias && !client.customer_name.endsWith(" A/c")) {
      const aliasName = `${alias} A/c`;
      const { data: existing } = await (supabase.from("customers") as any)
        .select("id")
        .eq("customer_name", aliasName)
        .is("deleted_at", null)
        .maybeSingle();

      if (!existing) {
        await (supabase.from("customers") as any).insert({
          customer_name: aliasName,
          is_internal: "client a/c",
          status: "active",
          created_by: user.id,
          updated_by: user.id,
        });
      }
    }
  }

  // Revalidate paths to clear caches
  revalidatePath("/admin/raw-materials");
  revalidatePath("/fabric/stock");
  revalidatePath("/accounts/sales");
  revalidatePath("/accounts/purchase");
  revalidatePath("/accounts/consumption");
  revalidatePath("/accounts/journal");
  revalidatePath("/reports/stock");
  revalidatePath("/reports/closing-stock");
  revalidatePath("/reports/accounts");
  revalidatePath("/dashboard");
}

export async function saveClosingStock(
  date: string,
  customPrices: Record<string, number>,
  baseTotal: number,
  wipAmount: number,
  gstAmount: number,
  grandTotal: number
) {
  const user = await requirePermission("reports.view");
  const supabase = await createClient();

  const key = `closing_stock_${date}`;
  const value = {
    customPrices,
    baseTotal,
    wipAmount,
    gstAmount,
    grandTotal,
    submittedAt: new Date().toISOString(),
    submittedBy: user.id
  };

  const { data: existing } = await (supabase.from("settings") as any)
    .select("id")
    .eq("key", key)
    .maybeSingle();

  if (existing) {
    const { error } = await (supabase.from("settings") as any)
      .update({ value, updated_by: user.id } as any)
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await (supabase.from("settings") as any)
      .insert({
        key,
        value,
        created_by: user.id,
        updated_by: user.id
      } as any);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/reports/closing-stock");
  revalidatePath("/reports/profit-loss");
  revalidatePath("/reports/balance-sheet");
}

export async function saveProfitLoss(
  date: string,
  manualExpenses: number,
  netProfit: number,
  netLoss: number
) {
  const user = await requirePermission("reports.view");
  const supabase = await createClient();

  const key = `profit_loss_${date}`;
  const value = {
    manualExpenses,
    netProfit,
    netLoss,
    submittedAt: new Date().toISOString(),
    submittedBy: user.id
  };

  const { data: existing } = await (supabase.from("settings") as any)
    .select("id")
    .eq("key", key)
    .maybeSingle();

  if (existing) {
    const { error } = await (supabase.from("settings") as any)
      .update({ value, updated_by: user.id } as any)
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await (supabase.from("settings") as any)
      .insert({
        key,
        value,
        created_by: user.id,
        updated_by: user.id
      } as any);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/reports/profit-loss");
  revalidatePath("/reports/balance-sheet");
}


