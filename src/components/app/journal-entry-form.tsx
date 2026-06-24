"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { Plus, Trash2, CheckCircle2, XCircle, Search } from "lucide-react";
import { saveJournalEntry } from "@/app/(app)/_actions";
import { ConfirmSubmitButton } from "@/components/app/confirm-submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { todayInIndia } from "@/lib/utils";



type JournalRow = {
  id?: string;
  key: string;
  accountName: string;
  description: string;
  debit: string;
  credit: string;
  errors: {
    accountName?: string;
    description?: string;
    amount?: string;
  };
};

export function JournalEntryForm({
  initialRows = [],
  nextJournalNo = "JE-000001",
  editJournalNo = "",
  editJournalDate = "",
  accounts = [],
  row // Legacy single row fallback (e.g. prefill from Sales Page)
}: {
  initialRows?: any[];
  nextJournalNo?: string;
  editJournalNo?: string;
  editJournalDate?: string;
  accounts?: { name: string }[];
  row?: { account_name?: string; entry_type?: "debit" | "credit" };
}) {
  const isEditing = !!editJournalNo;
  const [journalNo] = useState(isEditing ? editJournalNo : nextJournalNo);
  const [entryDate, setEntryDate] = useState(
    isEditing ? editJournalDate : todayInIndia()
  );

  // Initialize rows: loaded edit rows, or prefill from 'row' prop, or two empty rows
  const [rows, setRows] = useState<JournalRow[]>(() => {
    if (initialRows.length > 0) {
      return initialRows.map((r) => ({
        id: r.id,
        key: `row-${r.id}-${Math.random()}`,
        accountName: r.account_name,
        description: r.description ?? "",
        debit: r.entry_type === "debit" ? String(r.amount) : "",
        credit: r.entry_type === "credit" ? String(r.amount) : "",
        errors: {}
      }));
    }

    if (row?.account_name) {
      return [
        {
          key: `row-init-1`,
          accountName: row.entry_type === "credit" ? "Accounts Receivable (Debtors)" : row.account_name,
          description: "Sales entry",
          debit: row.entry_type === "debit" ? "" : "",
          credit: "",
          errors: {}
        },
        {
          key: `row-init-2`,
          accountName: row.entry_type === "credit" ? row.account_name : "Accounts Receivable (Debtors)",
          description: "Sales entry",
          debit: "",
          credit: "",
          errors: {}
        }
      ];
    }

    return [
      { key: "row-1", accountName: "", description: "", debit: "", credit: "", errors: {} },
      { key: "row-2", accountName: "", description: "", debit: "", credit: "", errors: {} }
    ];
  });

  const [lastAddedKey, setLastAddedKey] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [successText, setSuccessText] = useState<string | null>(null);

  // Auto-focus on the newly added row's account dropdown search or input
  useEffect(() => {
    if (lastAddedKey) {
      const element = document.querySelector(`[data-row-key="${lastAddedKey}"] input`);
      if (element instanceof HTMLElement) {
        element.focus();
      }
      setLastAddedKey(null);
    }
  }, [lastAddedKey]);

  // Real-time totals
  const totalDebit = useMemo(() => {
    return rows.reduce((sum, r) => sum + (parseFloat(r.debit) || 0), 0);
  }, [rows]);

  const totalCredit = useMemo(() => {
    return rows.reduce((sum, r) => sum + (parseFloat(r.credit) || 0), 0);
  }, [rows]);

  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;

  // Validation function
  const validateRow = (rowObj: JournalRow): JournalRow["errors"] => {
    const errs: JournalRow["errors"] = {};
    if (!rowObj.accountName) {
      errs.accountName = "Select an account";
    }
    const debVal = parseFloat(rowObj.debit);
    const credVal = parseFloat(rowObj.credit);

    if (!rowObj.debit && !rowObj.credit) {
      errs.amount = "Enter Debit or Credit";
    } else if (rowObj.debit && rowObj.credit) {
      errs.amount = "Cannot enter both";
    } else {
      const val = rowObj.debit ? debVal : credVal;
      if (isNaN(val)) {
        errs.amount = "Invalid number";
      } else if (val <= 0) {
        errs.amount = "Must be positive";
      } else {
        // Decimal place check
        const parts = (rowObj.debit || rowObj.credit).split(".");
        if (parts[1] && parts[1].length > 2) {
          errs.amount = "Max 2 decimals";
        }
      }
    }
    return errs;
  };

  const handleRowChange = (index: number, fields: Partial<Omit<JournalRow, "key" | "errors">>) => {
    setRows((prev) => {
      const next = [...prev];
      const updatedRow = { ...next[index], ...fields };
      updatedRow.errors = validateRow(updatedRow);
      next[index] = updatedRow;
      return next;
    });
  };

  const handleAddRow = (index: number) => {
    const newKey = `row-${Date.now()}-${Math.random()}`;
    const newRow: JournalRow = {
      key: newKey,
      accountName: "",
      description: "",
      debit: "",
      credit: "",
      errors: { accountName: "Select an account", amount: "Enter Debit or Credit" }
    };
    setRows((prev) => {
      const next = [...prev];
      next.splice(index + 1, 0, newRow);
      return next;
    });
    setLastAddedKey(newKey);
  };

  const handleRemoveRow = (index: number) => {
    if (rows.length <= 1) return;
    setRows((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Form validity check
  const hasErrors = rows.some((r) => Object.keys(r.errors).length > 0);
  const allFieldsFilled = rows.every(
    (r) => r.accountName && (r.debit || r.credit)
  );
  const isValid = rows.length >= 2 && allFieldsFilled && !hasErrors && isBalanced;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving || !isValid) return;
    setIsSaving(true);
    setErrorText(null);
    setSuccessText(null);

    try {
      const formData = new FormData();
      formData.set("journal_no", journalNo);
      formData.set("entry_date", entryDate);
      if (isEditing) {
        formData.set("original_journal_no", editJournalNo);
      }

      const rowsData = rows.map((r) => ({
        account_name: r.accountName,
        description: r.description,
        debit: parseFloat(r.debit) || 0,
        credit: parseFloat(r.credit) || 0
      }));
      formData.set("rows_json", JSON.stringify(rowsData));

      await saveJournalEntry(formData);

      setSuccessText(
        isEditing ? "Journal Entry updated successfully!" : "Journal Entry logged successfully!"
      );

      if (!isEditing) {
        // Reset form
        setRows([
          { key: "row-1", accountName: "", description: "", debit: "", credit: "", errors: {} },
          { key: "row-2", accountName: "", description: "", debit: "", credit: "", errors: {} }
        ]);
        setEntryDate(new Date().toISOString().slice(0, 10));
      }
    } catch (err: any) {
      setErrorText(err.message || "Failed to save journal entry.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header Section with Title and Date Inline */}
      <div className="flex flex-row items-center justify-between gap-4 border-b border-emerald-100 pb-4 mb-2">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-bold text-emerald-950">
            {isEditing ? `Edit Journal Entry: ${journalNo}` : "New Journal Entry"}
          </h2>
          {isEditing && (
            <Link
              href="/accounts/journal"
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100 hover:bg-emerald-100 transition-colors"
            >
              Cancel Edit
            </Link>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Label className="text-emerald-900 font-semibold text-xs uppercase tracking-wider shrink-0">Date:</Label>
          <Input
            type="date"
            required
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
            disabled={isSaving}
            className="w-36 h-9 text-xs bg-white border-emerald-200 text-emerald-950 font-semibold px-2.5 py-1 rounded-lg"
          />
        </div>
      </div>


      {/* Header Row */}
      <div className="border border-emerald-100 rounded-xl overflow-hidden shadow-sm bg-white">
        <div className="grid grid-cols-[2fr_2fr_1fr_1fr_80px] bg-emerald-50 border-b border-emerald-100 px-4 py-3 text-xs font-semibold text-emerald-800 uppercase tracking-wider">
          <div>Account Name</div>
          <div>Description</div>
          <div className="text-right">Debit (₹)</div>
          <div className="text-right">Credit (₹)</div>
          <div className="text-center">Actions</div>
        </div>

        {/* Entry Rows */}
        {rows.map((rowObj, index) => (
          <div
            key={rowObj.key}
            className="grid grid-cols-[2fr_2fr_1fr_1fr_80px] gap-0 border-b border-gray-100 last:border-b-0 px-4 py-4 hover:bg-slate-50/40 transition-colors items-start"
          >
            {/* Account Name Dropdown */}
            <div className="pr-3">
              <SearchableAccountSelect
                value={rowObj.accountName}
                onChange={(val) => handleRowChange(index, { accountName: val })}
                disabled={isSaving}
                accounts={accounts}
              />
              {rowObj.errors.accountName && (
                <p className="text-xs text-destructive mt-1 font-medium">{rowObj.errors.accountName}</p>
              )}
            </div>

            {/* Description */}
            <div className="pr-3">
              <Input
                placeholder="Line item description..."
                value={rowObj.description}
                onChange={(e) => handleRowChange(index, { description: e.target.value })}
                disabled={isSaving}
                className="h-11 text-sm"
              />
              {rowObj.errors.description && (
                <p className="text-xs text-destructive mt-1 font-medium">{rowObj.errors.description}</p>
              )}
            </div>

            {/* Debit */}
            <div className="pr-3">
              <Input
                type="number" step="0.01" min="0.01" placeholder="0.00"
                value={rowObj.debit}
                onChange={(e) => handleRowChange(index, { debit: e.target.value, credit: e.target.value ? "" : rowObj.credit })}
                disabled={isSaving || !!rowObj.credit}
                className="text-right font-mono h-11 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              {rowObj.errors.amount && !rowObj.credit && (
                <p className="text-xs text-destructive mt-1 font-medium text-right">{rowObj.errors.amount}</p>
              )}
            </div>

            {/* Credit */}
            <div className="pr-3">
              <Input
                type="number" step="0.01" min="0.01" placeholder="0.00"
                value={rowObj.credit}
                onChange={(e) => handleRowChange(index, { credit: e.target.value, debit: e.target.value ? "" : rowObj.debit })}
                disabled={isSaving || !!rowObj.debit}
                className="text-right font-mono h-11 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              {rowObj.errors.amount && !rowObj.debit && (
                <p className="text-xs text-destructive mt-1 font-medium text-right">{rowObj.errors.amount}</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-center gap-1 pt-0.5">
              <Button type="button" variant="ghost" size="icon"
                onClick={() => handleAddRow(index)} disabled={isSaving}
                className="h-9 w-9 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-md" title="Add row below">
                <Plus className="h-4 w-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon"
                onClick={() => handleRemoveRow(index)} disabled={isSaving || rows.length <= 1}
                className="h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/5 rounded-md disabled:opacity-30" title="Delete row">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Messages */}
      {errorText && (
        <div className="p-3.5 text-sm bg-destructive/5 border border-destructive/20 text-destructive rounded-lg font-medium">
          {errorText}
        </div>
      )}
      {successText && (
        <div className="p-3.5 text-sm bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg font-semibold flex items-center gap-2">
          <CheckCircle2 className="h-4.5 w-4.5" /> {successText}
        </div>
      )}

      {/* Real-time Totals, Balanced Indicator, and Submission Inline */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 border rounded-xl bg-slate-50/80">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
          <div className="space-y-1">
            <div className="text-sm font-semibold text-slate-700 flex flex-wrap gap-x-4">
              <span>Total Debit: <span className="font-mono text-emerald-950 font-bold">₹{totalDebit.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></span>
              <span>Total Credit: <span className="font-mono text-emerald-950 font-bold">₹{totalCredit.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></span>
            </div>
            {totalDebit !== totalCredit && totalDebit > 0 && (
              <p className="text-xs text-destructive font-medium flex items-center gap-1 mt-1">
                Difference: ₹{Math.abs(totalDebit - totalCredit).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </p>
            )}
          </div>

          {/* Balanced Status Indicator */}
          <div className="shrink-0">
            {isBalanced ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-bold shadow-sm">
                <CheckCircle2 className="h-4 w-4" /> Balanced
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-destructive/10 border border-destructive/20 text-destructive text-xs font-bold shadow-sm">
                <XCircle className="h-4 w-4" /> Not Balanced
              </div>
            )}
          </div>
        </div>

        {/* Submission */}
        <div className="flex items-center gap-3">
          {totalDebit !== totalCredit && totalDebit > 0 && (
            <p className="text-xs text-destructive font-semibold">
              Must be balanced to submit.
            </p>
          )}
          <ConfirmSubmitButton
            confirmTitle={isEditing ? "Update journal entry?" : "Log journal entry?"}
            confirmDescription="Ensure all account lines, descriptions, and debits/credits are correct before submitting."
            disabled={!isValid || isSaving}
            className="w-auto px-5 h-10 text-sm shadow-sm"
          >
            {isSaving
              ? "Saving..."
              : isEditing
              ? "Update Entry"
              : "Submit Journal Entry"}
          </ConfirmSubmitButton>
        </div>
      </div>
    </form>
  );
}

// Account Dropdown — uses fixed positioning so it escapes overflow clipping
function SearchableAccountSelect({
  value,
  onChange,
  disabled,
  accounts = []
}: {
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
  accounts?: { name: string; alias?: string }[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Position dropdown using fixed coords from trigger element
  const openDropdown = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    
    // Predict dropdown height including search bar (approx max 300px)
    const dropdownHeight = 300;
    const openUpward = spaceBelow < dropdownHeight && spaceAbove > spaceBelow;
    const maxH = Math.max(150, openUpward ? spaceAbove - 20 : spaceBelow - 20);
    
    setDropdownStyle({
      position: 'fixed',
      left: rect.left,
      width: Math.max(rect.width, 360),
      zIndex: 9999,
      maxHeight: `${maxH}px`,
      ...(openUpward
        ? { bottom: window.innerHeight - rect.top + 4 }
        : { top: rect.bottom + 4 }),
    });
    setSearchQuery("");
    setIsOpen(true);
    
    // Auto-focus search input shortly after rendering
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);
  };

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        triggerRef.current && !triggerRef.current.contains(event.target as Node) &&
        dropdownRef.current && !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Close on scroll (only if scrolling outside the dropdown container itself)
  useEffect(() => {
    if (!isOpen) return;
    const handleScroll = (event: Event) => {
      if (dropdownRef.current && dropdownRef.current.contains(event.target as Node)) {
        return;
      }
      setIsOpen(false);
    };
    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [isOpen]);

  const handleSelect = (name: string) => {
    onChange(name);
    setIsOpen(false);
  };

  const filteredAccounts = useMemo(() => {
    if (!searchQuery.trim()) return accounts;
    const query = searchQuery.toLowerCase();
    return accounts.filter((acc) => {
      const nameMatch = acc.name.toLowerCase().includes(query);
      const aliasMatch = acc.alias?.toLowerCase().includes(query) ?? false;
      return nameMatch || aliasMatch;
    });
  }, [accounts, searchQuery]);

  const selectedAccountObj = accounts.find(a => a.name === value);
  const displayLabel = selectedAccountObj 
    ? (selectedAccountObj.name + (selectedAccountObj.alias ? ` (${selectedAccountObj.alias})` : ''))
    : (value || 'Select account...');

  return (
    <div className="w-full">
      {/* Trigger */}
      <div
        ref={triggerRef}
        onClick={() => {
          if (!disabled) {
            if (isOpen) setIsOpen(false);
            else openDropdown();
          }
        }}
        className={`h-11 w-full px-4 flex items-center justify-between rounded-lg border-2 bg-white text-sm cursor-pointer transition-all ${
          disabled
            ? 'opacity-50 cursor-not-allowed bg-gray-50 border-gray-200'
            : isOpen
            ? 'border-emerald-400 ring-2 ring-emerald-100'
            : 'border-gray-200 hover:border-emerald-300'
        } ${value ? 'text-slate-900 font-medium' : 'text-slate-400'}`}
      >
        <span className="truncate">{displayLabel}</span>
        <svg className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Fixed-position dropdown — not clipped by any overflow parent */}
      {isOpen && (
        <div
          ref={dropdownRef}
          style={dropdownStyle}
          className="bg-white border border-slate-200 rounded-xl shadow-2xl flex flex-col overflow-hidden"
        >
          {/* Search Input Sticky Header */}
          <div className="p-3 border-b border-slate-100 bg-slate-50 sticky top-0 shrink-0">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white shadow-sm focus-within:border-slate-400 transition-colors">
              <Search className="h-4 w-4 text-slate-400 shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Type to search account/alias..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent border-0 p-0 text-sm outline-none focus:ring-0 text-slate-800 placeholder-slate-400 font-medium"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="text-slate-400 hover:text-slate-600 text-lg font-bold px-1"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          {/* Account List Area */}
          <div className="overflow-y-auto flex-1 min-h-0 divide-y divide-slate-100">
            {filteredAccounts.length === 0 ? (
              <div className="p-5 text-center text-sm text-slate-400">No matching accounts found</div>
            ) : (
              <div className="py-1">
                {filteredAccounts.map((item) => {
                  const isSelected = value === item.name;
                  const itemLabel = item.name + (item.alias ? ` (${item.alias})` : '');
                  return (
                    <div
                      key={item.name}
                      onMouseDown={(e) => { e.preventDefault(); handleSelect(item.name); }}
                      className={`px-4 py-2.5 text-sm cursor-pointer transition-colors flex items-center gap-2 ${
                        isSelected
                          ? 'bg-slate-100 text-slate-900 font-semibold'
                          : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <div className="w-5 shrink-0 flex items-center justify-center">
                        {isSelected && (
                          <svg className="h-4 w-4 text-slate-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                      <span className="truncate">{itemLabel}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
