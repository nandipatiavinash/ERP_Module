import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile(path) {
  const env = {};
  try {
    const content = readFileSync(path, "utf8");
    for (const line of content.split(/\r?\n/)) {
      if (!line || line.trim().startsWith("#")) continue;
      const index = line.indexOf("=");
      if (index === -1) continue;
      const key = line.slice(0, index).trim();
      const value = line.slice(index + 1).trim().replace(/^["']|["']$/g, "");
      env[key] = value;
    }
  } catch (e) {}
  return env;
}

const env = { ...loadEnvFile(resolve(".env.local")), ...process.env };
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error("Supabase URL or Service Role Key missing in .env.local!");
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey);

console.log("=== STARTING SYSTEM-WIDE BACKEND CRUD & CONSISTENCY TESTS ===");

let hasFailed = false;

async function runTest(name, fn) {
  console.log(`\nTesting Segment: ${name}...`);
  try {
    await fn();
    console.log(`✅ ${name} test passed successfully.`);
  } catch (err) {
    console.error(`❌ ${name} test FAILED:`, err.message || err);
    hasFailed = true;
  }
}

// 1. Employees & Attendance
await runTest("Employees & Attendance", async () => {
  const suffix = Date.now();
  
  // Create Employee
  const { data: employee, error: empErr } = await supabase
    .from("employees")
    .insert({
      employee_code: `TEST-EMP-${suffix}`,
      name: `Test Employee ${suffix}`,
      department: "fabric",
      designation: "Operator",
      salary: 20000,
      status: "active"
    })
    .select()
    .single();
  if (empErr) throw new Error("Failed to create Employee: " + empErr.message);
  
  const empId = employee.id;
  
  // Create Attendance
  const { data: attendance, error: attErr } = await supabase
    .from("attendance")
    .insert({
      employee_id: empId,
      attendance_date: new Date().toISOString().slice(0, 10),
      check_in: "09:00:00",
      check_out: "18:00:00",
      status: "present"
    })
    .select()
    .single();
  if (attErr) {
    // Cleanup employee before throwing
    await supabase.from("employees").delete().eq("id", empId);
    throw new Error("Failed to create Attendance: " + attErr.message);
  }
  
  // Update Attendance
  const { data: updatedAtt, error: uAttErr } = await supabase
    .from("attendance")
    .update({ status: "half_day" })
    .eq("id", attendance.id)
    .select()
    .single();
  if (uAttErr) {
    await supabase.from("attendance").delete().eq("id", attendance.id);
    await supabase.from("employees").delete().eq("id", empId);
    throw new Error("Failed to update Attendance: " + uAttErr.message);
  }
  
  // Clean up
  const { error: dAttErr } = await supabase.from("attendance").delete().eq("id", attendance.id);
  const { error: dEmpErr } = await supabase.from("employees").delete().eq("id", empId);
  
  if (dAttErr) throw new Error("Failed to delete Attendance: " + dAttErr.message);
  if (dEmpErr) throw new Error("Failed to delete Employee: " + dEmpErr.message);
});

// 2. Customers, Sales Orders & Items
await runTest("Customers, Sales Orders & Items", async () => {
  const suffix = Date.now();
  
  // Create Customer
  const { data: customer, error: custErr } = await supabase
    .from("customers")
    .insert({
      customer_name: `Test Customer ${suffix}`,
      alias: `TC${suffix}`,
      status: "active",
      is_internal: "client a/c"
    })
    .select()
    .single();
  if (custErr) throw new Error("Failed to create Customer: " + custErr.message);
  const custId = customer.id;
  
  // Create product reference
  const { data: product, error: prodErr } = await supabase
    .from("offset_products")
    .insert({
      brand: `Test Offset Product ${suffix}`,
      width: 10,
      height: 10,
      status: "active"
    })
    .select()
    .single();
  if (prodErr) {
    await supabase.from("customers").delete().eq("id", custId);
    throw new Error("Failed to create product for Sales Order: " + prodErr.message);
  }
  const prodId = product.id;
  
  // Create Sales Order
  const { data: order, error: orderErr } = await supabase
    .from("sales_orders")
    .insert({
      order_number: `SO-TEST-${suffix}`,
      order_date: new Date().toISOString().slice(0, 10),
      customer_id: custId,
      status: "draft"
    })
    .select()
    .single();
  if (orderErr) {
    await supabase.from("offset_products").delete().eq("id", prodId);
    await supabase.from("customers").delete().eq("id", custId);
    throw new Error("Failed to create Sales Order: " + orderErr.message);
  }
  const orderId = order.id;
  
  // Create Sales Order Item
  const { data: orderItem, error: itemErr } = await supabase
    .from("sales_order_items")
    .insert({
      sales_order_id: orderId,
      department: "offset_printing",
      product_id: prodId,
      quantity: 500
    })
    .select()
    .single();
  if (itemErr) {
    await supabase.from("sales_orders").delete().eq("id", orderId);
    await supabase.from("offset_products").delete().eq("id", prodId);
    await supabase.from("customers").delete().eq("id", custId);
    throw new Error("Failed to create Sales Order Item: " + itemErr.message);
  }
  
  // Update Sales Order Item
  const { data: updatedItem, error: uItemErr } = await supabase
    .from("sales_order_items")
    .update({ quantity: 600 })
    .eq("id", orderItem.id)
    .select()
    .single();
  if (uItemErr) {
    await supabase.from("sales_order_items").delete().eq("id", orderItem.id);
    await supabase.from("sales_orders").delete().eq("id", orderId);
    await supabase.from("offset_products").delete().eq("id", prodId);
    await supabase.from("customers").delete().eq("id", custId);
    throw new Error("Failed to update Sales Order Item: " + uItemErr.message);
  }
  
  // Clean up
  const { error: dItemErr } = await supabase.from("sales_order_items").delete().eq("id", orderItem.id);
  const { error: dOrderErr } = await supabase.from("sales_orders").delete().eq("id", orderId);
  const { error: dProdErr } = await supabase.from("offset_products").delete().eq("id", prodId);
  const { error: dCustErr } = await supabase.from("customers").delete().eq("id", custId);
  
  if (dItemErr) throw new Error("Failed to delete Sales Order Item: " + dItemErr.message);
  if (dOrderErr) throw new Error("Failed to delete Sales Order: " + dOrderErr.message);
  if (dProdErr) throw new Error("Failed to delete product: " + dProdErr.message);
  if (dCustErr) throw new Error("Failed to delete Customer: " + dCustErr.message);
});

// 3. Raw Materials, Purchases & Consumptions
await runTest("Raw Materials, Purchases & Consumptions", async () => {
  const suffix = Date.now();
  
  // Create Raw Material
  const { data: material, error: matErr } = await supabase
    .from("raw_materials")
    .insert({
      material_name: `Test Raw Material ${suffix}`,
      unit: "kg",
      opening_stock: 100,
      current_stock: 100,
      status: "active"
    })
    .select()
    .single();
  if (matErr) throw new Error("Failed to create Raw Material: " + matErr.message);
  const matId = material.id;
  
  // Create Raw Material Purchase
  const { data: purchase, error: purErr } = await supabase
    .from("raw_material_purchases")
    .insert({
      purchase_date: new Date().toISOString().slice(0, 10),
      raw_material_id: matId,
      supplier_name: "Test Supplier",
      bill_number: `BILL-${suffix}`,
      quantity: 50,
      rate: 100
    })
    .select()
    .single();
  if (purErr) {
    await supabase.from("raw_materials").delete().eq("id", matId);
    throw new Error("Failed to create Raw Material Purchase: " + purErr.message);
  }
  
  // Create Raw Material Consumption
  const { data: consumption, error: consErr } = await supabase
    .from("raw_material_consumptions")
    .insert({
      consumption_date: new Date().toISOString().slice(0, 10),
      raw_material_id: matId,
      department: "fabric",
      quantity: 10,
      remarks: "Test consumption"
    })
    .select()
    .single();
  if (consErr) {
    await supabase.from("raw_material_purchases").delete().eq("id", purchase.id);
    await supabase.from("raw_materials").delete().eq("id", matId);
    throw new Error("Failed to create Raw Material Consumption: " + consErr.message);
  }
  
  // Update Consumption
  const { data: updatedCons, error: uConsErr } = await supabase
    .from("raw_material_consumptions")
    .update({ quantity: 15 })
    .eq("id", consumption.id)
    .select()
    .single();
  if (uConsErr) {
    await supabase.from("raw_material_consumptions").delete().eq("id", consumption.id);
    await supabase.from("raw_material_purchases").delete().eq("id", purchase.id);
    await supabase.from("raw_materials").delete().eq("id", matId);
    throw new Error("Failed to update Consumption: " + uConsErr.message);
  }
  
  // Clean up
  const { error: dConsErr } = await supabase.from("raw_material_consumptions").delete().eq("id", consumption.id);
  const { error: dPurErr } = await supabase.from("raw_material_purchases").delete().eq("id", purchase.id);
  const { error: dMatErr } = await supabase.from("raw_materials").delete().eq("id", matId);
  
  if (dConsErr) throw new Error("Failed to delete Consumption: " + dConsErr.message);
  if (dPurErr) throw new Error("Failed to delete Purchase: " + dPurErr.message);
  if (dMatErr) throw new Error("Failed to delete Raw Material: " + dMatErr.message);
});

// 4. Looms, Fabric Types, Loom Production Entries & Stage Production Entries
await runTest("Looms, Fabric & Production Flows", async () => {
  const suffix = Date.now();
  
  // Create Loom
  const { data: loom, error: loomErr } = await supabase
    .from("looms")
    .insert({
      loom_number: `TEST-LOOM-${suffix}`,
      status: "active"
    })
    .select()
    .single();
  if (loomErr) throw new Error("Failed to create Loom: " + loomErr.message);
  const loomId = loom.id;
  
  // Create Fabric Type
  const { data: fabricType, error: ftErr } = await supabase
    .from("fabric_types")
    .insert({
      fabric_name: `Test Fabric Type ${suffix}`,
      width: 2.0,
      gsm: 150,
      description: "Test description",
      status: "active"
    })
    .select()
    .single();
  if (ftErr) {
    await supabase.from("looms").delete().eq("id", loomId);
    throw new Error("Failed to create Fabric Type: " + ftErr.message);
  }
  const ftId = fabricType.id;
  
  // Create Loom Production Entry (which triggers Fabric Roll auto-creation)
  const { data: lpe, error: lpeErr } = await supabase
    .from("loom_production_entries")
    .insert({
      entry_date: new Date().toISOString().slice(0, 10),
      serial_number: `TEST-ROLL-${suffix}`,
      fabric_type_id: ftId,
      loom_id: loomId,
      gross_weight: 45.5,
      core_weight: 1.5,
      initial_meters: 0.0,
      end_meters: 120.0
    })
    .select()
    .single();
  if (lpeErr) {
    await supabase.from("fabric_types").delete().eq("id", ftId);
    await supabase.from("looms").delete().eq("id", loomId);
    throw new Error("Failed to create Loom Production Entry: " + lpeErr.message);
  }
  const lpeId = lpe.id;
  
  // Fetch the auto-created fabric roll
  const { data: roll, error: rErr } = await supabase
    .from("fabric_rolls")
    .select()
    .eq("production_entry_id", lpeId)
    .single();
  if (rErr) {
    await supabase.from("loom_production_entries").delete().eq("id", lpeId);
    await supabase.from("fabric_types").delete().eq("id", ftId);
    await supabase.from("looms").delete().eq("id", loomId);
    throw new Error("Failed to find auto-created Fabric Roll: " + rErr.message);
  }
  const rollId = roll.id;
  
  // Create Stage Production Entry (e.g. finishing stage log)
  const { data: stageEntry, error: stageErr } = await supabase
    .from("stage_production_entries")
    .insert({
      entry_date: new Date().toISOString().slice(0, 10),
      roll_id: rollId,
      stage: "finishing",
      details: { operator: "Test Op", duration_mins: 45 },
      remarks: "Test stage log"
    })
    .select()
    .single();
  if (stageErr) {
    await supabase.from("fabric_rolls").delete().eq("id", rollId);
    await supabase.from("loom_production_entries").delete().eq("id", lpeId);
    await supabase.from("fabric_types").delete().eq("id", ftId);
    await supabase.from("looms").delete().eq("id", loomId);
    throw new Error("Failed to create Stage Production Entry: " + stageErr.message);
  }
  
  // Update Stage Production Entry
  const { data: updatedStage, error: uStageErr } = await supabase
    .from("stage_production_entries")
    .update({ remarks: "Test stage log updated" })
    .eq("id", stageEntry.id)
    .select()
    .single();
  if (uStageErr) {
    await supabase.from("stage_production_entries").delete().eq("id", stageEntry.id);
    await supabase.from("fabric_rolls").delete().eq("id", rollId);
    await supabase.from("loom_production_entries").delete().eq("id", lpeId);
    await supabase.from("fabric_types").delete().eq("id", ftId);
    await supabase.from("looms").delete().eq("id", loomId);
    throw new Error("Failed to update Stage Production Entry: " + uStageErr.message);
  }
  
  // Clean up (Must be in correct dependency order)
  const { error: dStageErr } = await supabase.from("stage_production_entries").delete().eq("id", stageEntry.id);
  const { error: dRollErr } = await supabase.from("fabric_rolls").delete().eq("id", rollId);
  const { error: dLpeErr } = await supabase.from("loom_production_entries").delete().eq("id", lpeId);
  const { error: dFtErr } = await supabase.from("fabric_types").delete().eq("id", ftId);
  const { error: dLoomErr } = await supabase.from("looms").delete().eq("id", loomId);
  
  if (dStageErr) throw new Error("Failed to delete Stage Production Entry: " + dStageErr.message);
  if (dRollErr) throw new Error("Failed to delete Fabric Roll: " + dRollErr.message);
  if (dLpeErr) throw new Error("Failed to delete Loom Production Entry: " + dLpeErr.message);
  if (dFtErr) throw new Error("Failed to delete Fabric Type: " + dFtErr.message);
  if (dLoomErr) throw new Error("Failed to delete Loom: " + dLoomErr.message);
});

// 5. Products (Roto, Offset & Colors)
await runTest("Roto & Offset Products & Colors", async () => {
  const suffix = Date.now();
  
  // Roto Product CRUD
  const { data: roto, error: rErr } = await supabase
    .from("roto_products")
    .insert({
      brand: `Test Roto Product ${suffix}`,
      width: 15,
      height: 25,
      num_cylinders: 6,
      status: "active"
    })
    .select()
    .single();
  if (rErr) throw new Error("Failed to create Roto Product: " + rErr.message);
  
  const { data: uRoto, error: urErr } = await supabase
    .from("roto_products")
    .update({ num_cylinders: 8 })
    .eq("id", roto.id)
    .select()
    .single();
  if (urErr) {
    await supabase.from("roto_products").delete().eq("id", roto.id);
    throw new Error("Failed to update Roto Product: " + urErr.message);
  }
  
  // Offset Product CRUD
  const { data: offset, error: oErr } = await supabase
    .from("offset_products")
    .insert({
      brand: `Test Offset Product ${suffix}`,
      width: 12,
      height: 18,
      status: "active"
    })
    .select()
    .single();
  if (oErr) {
    await supabase.from("roto_products").delete().eq("id", roto.id);
    throw new Error("Failed to create Offset Product: " + oErr.message);
  }
  
  const { data: uOffset, error: uoErr } = await supabase
    .from("offset_products")
    .update({ width: 14 })
    .eq("id", offset.id)
    .select()
    .single();
  if (uoErr) {
    await supabase.from("offset_products").delete().eq("id", offset.id);
    await supabase.from("roto_products").delete().eq("id", roto.id);
    throw new Error("Failed to update Offset Product: " + uoErr.message);
  }
  
  // Roto Color CRUD
  const { data: color, error: cErr } = await supabase
    .from("roto_colors")
    .insert({
      color_name: `Test Color ${suffix}`,
      description: "Test printing color",
      status: "active"
    })
    .select()
    .single();
  if (cErr) {
    await supabase.from("offset_products").delete().eq("id", offset.id);
    await supabase.from("roto_products").delete().eq("id", roto.id);
    throw new Error("Failed to create Roto Color: " + cErr.message);
  }
  
  const { data: uColor, error: ucErr } = await supabase
    .from("roto_colors")
    .update({ description: "Test printing color updated" })
    .eq("id", color.id)
    .select()
    .single();
  if (ucErr) {
    await supabase.from("roto_colors").delete().eq("id", color.id);
    await supabase.from("offset_products").delete().eq("id", offset.id);
    await supabase.from("roto_products").delete().eq("id", roto.id);
    throw new Error("Failed to update Roto Color: " + ucErr.message);
  }
  
  // Clean up
  const { error: drErr } = await supabase.from("roto_products").delete().eq("id", roto.id);
  const { error: doErr } = await supabase.from("offset_products").delete().eq("id", offset.id);
  const { error: dcErr } = await supabase.from("roto_colors").delete().eq("id", color.id);
  
  if (drErr) throw new Error("Failed to delete Roto Product: " + drErr.message);
  if (doErr) throw new Error("Failed to delete Offset Product: " + doErr.message);
  if (dcErr) throw new Error("Failed to delete Roto Color: " + dcErr.message);
});

// 6. Settings
await runTest("Settings Configuration", async () => {
  const suffix = Date.now();
  
  const { data: setting, error: sErr } = await supabase
    .from("settings")
    .insert({
      key: `TEST-KEY-${suffix}`,
      value: { test: true },
      description: "Test setting description"
    })
    .select()
    .single();
  if (sErr) throw new Error("Failed to create Setting: " + sErr.message);
  
  const { data: uSetting, error: usErr } = await supabase
    .from("settings")
    .update({ value: { test: false } })
    .eq("id", setting.id)
    .select()
    .single();
  if (usErr) {
    await supabase.from("settings").delete().eq("id", setting.id);
    throw new Error("Failed to update Setting: " + usErr.message);
  }
  
  const { error: dSetting } = await supabase
    .from("settings")
    .delete()
    .eq("id", setting.id);
  if (dSetting) throw new Error("Failed to delete Setting: " + dSetting.message);
});

// 7. Accounts Journal & Account-ID Linking
await runTest("Accounts Journal & Account-ID Linking", async () => {
  const suffix = Date.now();
  
  // Create a temporary customer account
  const { data: cust, error: custErr } = await supabase
    .from("customers")
    .insert({
      customer_name: `Temp Journal Test Account ${suffix}`,
      is_internal: "client a/c",
      status: "active"
    })
    .select()
    .single();
  if (custErr) throw new Error("Failed to create Customer: " + custErr.message);
  
  const accountId = cust.id;
  
  // Insert journal lines linked by account_id
  const { data: journal, error: jErr } = await supabase
    .from("accounts_journal")
    .insert({
      journal_no: `JE-TEST-${suffix}`,
      entry_date: new Date().toISOString().slice(0, 10),
      account_id: accountId,
      account_name: `Temp Journal Test Account ${suffix}`,
      entry_type: "debit",
      amount: 500,
      description: "Test double-entry integrity"
    })
    .select()
    .single();
  if (jErr) {
    await supabase.from("customers").delete().eq("id", accountId);
    throw new Error("Failed to create Journal Entry: " + jErr.message);
  }
  
  if (!journal || journal.account_id !== accountId) {
    await supabase.from("accounts_journal").delete().eq("id", journal.id);
    await supabase.from("customers").delete().eq("id", accountId);
    throw new Error("Journal account_id linking mismatch!");
  }
  
  // Update journal line
  const { data: jUpdated, error: juErr } = await supabase
    .from("accounts_journal")
    .update({ amount: 600 })
    .eq("id", journal.id)
    .select()
    .single();
  if (juErr) {
    await supabase.from("accounts_journal").delete().eq("id", journal.id);
    await supabase.from("customers").delete().eq("id", accountId);
    throw new Error("Failed to update Journal Entry: " + juErr.message);
  }
  if (!jUpdated || Number(jUpdated.amount) !== 600) {
    await supabase.from("accounts_journal").delete().eq("id", journal.id);
    await supabase.from("customers").delete().eq("id", accountId);
    throw new Error("Journal amount update failed!");
  }
  
  // Clean up
  const { error: jdErr } = await supabase.from("accounts_journal").delete().eq("id", journal.id);
  const { error: cdErr } = await supabase.from("customers").delete().eq("id", accountId);
  
  if (jdErr) throw new Error("Failed to delete Journal Entry: " + jdErr.message);
  if (cdErr) throw new Error("Failed to delete Customer: " + cdErr.message);
});

console.log("\n=== CRUD & SCHEMA CONSISTENCY TESTS SUMMARY ===");
if (hasFailed) {
  console.error("❌ Some segment tests FAILED. Please review the errors above.");
  process.exit(1);
} else {
  console.log("🎉 All CRUD operations and schema integrity tests passed successfully with zero errors across all segments!");
}
