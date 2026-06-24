"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatNumber, formatDate } from "@/lib/utils";

interface SalesPrintViewProps {
  order: {
    order_number: string;
    order_date: string;
    bill_number?: string;
    bill_value?: number;
    customers?: {
      customer_name: string;
      address?: string;
      gst_number?: string;
      phone?: string;
    };
  };
  rollsByProduct: Record<
    string,
    Array<{
      roll_number: string;
      gross_weight: number;
      core_weight: number;
      net_weight: number;
      net_meters: number;
      average_meter_weight: number;
    }>
  >;
}

export function SalesPrintView({ order, rollsByProduct }: SalesPrintViewProps) {
  const customer = order.customers;
  const productKeys = Object.keys(rollsByProduct).sort();

  let grandTotalNetWeight = 0;
  let grandTotalMeters = 0;
  let grandTotalRolls = 0;

  for (const rolls of Object.values(rollsByProduct)) {
    for (const r of rolls) {
      grandTotalNetWeight += r.net_weight;
      grandTotalMeters += r.net_meters;
    }
    grandTotalRolls += rolls.length;
  }

  return (
    <>
      {/* ---------- Print-specific styles ---------- */}
      <style>{`
        @media print {
          /* Hide headers, sidebars, buttons, etc. */
          header,
          aside,
          nav,
          button,
          .no-print,
          [data-print-hide] {
            display: none !important;
          }

          /* Reset main page container layout paddings and background */
          html,
          body,
          main,
          div.lg\\:pl-64,
          div.min-h-screen {
            background: #fff !important;
            color: #000 !important;
            padding: 0 !important;
            margin: 0 !important;
            position: static !important;
            width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
          }

          /* Ensure the print container spans the page and doesn't get boxed */
          .sales-print-area {
            display: block !important;
            border: none !important;
            box-shadow: none !important;
            margin: 0 !important;
            padding: 12mm 10mm !important;
            width: 100% !important;
          }

          .sales-print-area table {
            width: 100%;
            border-collapse: collapse;
            page-break-inside: auto;
          }

          .sales-print-area thead {
            display: table-header-group;
          }

          .sales-print-area tr {
            page-break-inside: avoid;
          }

          .sales-print-area th,
          .sales-print-area td {
            border: 1px solid #d1d5db;
            padding: 4px 8px;
          }

          .sales-print-area th {
            background-color: #f3f4f6 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          @page {
            size: A4;
            margin: 8mm;
          }
        }

        @media screen {
          .sales-print-area {
            max-width: 900px;
            margin: 0 auto;
          }
        }
      `}</style>

      {/* ---------- Trigger button (hidden when printing) ---------- */}
      <div className="no-print mb-6 flex justify-end" data-print-hide>
        <Button type="button" onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" />
          Print Invoice
        </Button>
      </div>

      {/* ---------- Printable invoice content ---------- */}
      <div className="sales-print-area rounded-lg border border-gray-200 bg-white p-8 text-sm text-gray-900 shadow-sm">
        {/* ── Invoice header ── */}
        <div className="mb-6 border-b border-gray-300 pb-4">
          <div className="flex justify-between items-start text-sm">
            {/* Left column – customer name only */}
            <div>
              {customer && (
                <p className="text-lg font-bold">
                  {customer.customer_name}
                </p>
              )}
            </div>

            {/* Right column – date only */}
            <div className="text-right">
              <p className="text-sm font-medium">
                {formatDate(order.order_date)}
              </p>
            </div>
          </div>
        </div>

        {/* ── Product tables ── */}
        {productKeys.map((productKey) => {
          const rolls = rollsByProduct[productKey];
          const totalNetWeight = rolls.reduce((s, r) => s + r.net_weight, 0);
          const totalMeters = rolls.reduce((s, r) => s + r.net_meters, 0);

          return (
            <div key={productKey} className="mb-6">
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-700">
                Product ({productKey})
                <span className="ml-2 text-xs font-normal text-gray-400">
                  — {rolls.length} roll{rolls.length !== 1 && "s"}
                </span>
              </h2>

              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b-2 border-gray-300 bg-gray-50 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                    <th className="border border-gray-200 px-3 py-2 text-center">
                      Roll No
                    </th>
                    <th className="border border-gray-200 px-3 py-2 text-right">
                      Gross W8
                    </th>
                    <th className="border border-gray-200 px-3 py-2 text-right">
                      Core W8
                    </th>
                    <th className="border border-gray-200 px-3 py-2 text-right">
                      Net W8
                    </th>
                    <th className="border border-gray-200 px-3 py-2 text-right">
                      Mtrs
                    </th>
                    <th className="border border-gray-200 px-3 py-2 text-right">
                      Avg W8
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rolls.map((roll, idx) => (
                    <tr
                      key={roll.roll_number}
                      className={idx % 2 === 0 ? "bg-white" : "bg-gray-50/60"}
                    >
                      <td className="border border-gray-200 px-3 py-1.5 text-center text-gray-600">
                        {roll.roll_number}
                      </td>
                      <td className="border border-gray-200 px-3 py-1.5 text-right tabular-nums">
                        {formatNumber(roll.gross_weight)}
                      </td>
                      <td className="border border-gray-200 px-3 py-1.5 text-right tabular-nums">
                        {formatNumber(roll.core_weight)}
                      </td>
                      <td className="border border-gray-200 px-3 py-1.5 text-right tabular-nums">
                        {formatNumber(roll.net_weight)}
                      </td>
                      <td className="border border-gray-200 px-3 py-1.5 text-right tabular-nums">
                        {formatNumber(Math.floor(roll.net_meters), 0)}
                      </td>
                      <td className="border border-gray-200 px-3 py-1.5 text-right tabular-nums">
                        {formatNumber(Math.floor(roll.average_meter_weight), 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-400 bg-gray-100 font-semibold">
                    <td
                      className="border border-gray-200 px-3 py-2 text-right uppercase tracking-wide text-gray-600"
                      colSpan={3}
                    >
                      Total
                    </td>
                    <td className="border border-gray-200 px-3 py-2 text-right tabular-nums">
                      {formatNumber(totalNetWeight)}
                    </td>
                    <td className="border border-gray-200 px-3 py-2 text-right tabular-nums" />
                    <td className="border border-gray-200 px-3 py-2" />
                  </tr>
                </tfoot>
              </table>
            </div>
          );
        })}

        {/* ── Grand total ── */}
        {productKeys.length > 0 && (
          <div className="mt-4 border-t-2 border-gray-800 pt-4">
            <table className="ml-auto w-64 text-sm">
              <tbody>
                <tr>
                  <td className="py-1 font-medium text-gray-500">
                    Total Rolls
                  </td>
                  <td className="py-1 text-right tabular-nums font-semibold">
                    {grandTotalRolls}
                  </td>
                </tr>
                <tr>
                  <td className="py-1 font-medium text-gray-500">
                    Total Net Weight
                  </td>
                  <td className="py-1 text-right tabular-nums font-semibold">
                    {formatNumber(grandTotalNetWeight)} kg
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* ── Footer ── */}
        <div className="mt-10 border-t border-gray-200 pt-4 text-center text-[10px] text-gray-400">
          Generated on {formatDate(new Date().toISOString())} •{" "}
          {order.order_number}
        </div>
      </div>
    </>
  );
}
