"use client";

import { useRef, useState } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type SummaryRow = { label: string; value: string; words?: string };

type ConfirmSubmitButtonProps = ButtonProps & {
  confirmTitle?: string;
  confirmDescription?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  summary?: SummaryRow[];
};

const ones = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function underHundred(value: number) {
  if (value < 20) return ones[value];
  return `${tens[Math.floor(value / 10)]}${value % 10 ? ` ${ones[value % 10]}` : ""}`;
}

function underThousand(value: number) {
  const hundred = Math.floor(value / 100);
  const rest = value % 100;
  return `${hundred ? `${ones[hundred]} hundred` : ""}${hundred && rest ? " " : ""}${rest ? underHundred(rest) : ""}`;
}

function numberToIndianWords(input: string) {
  const number = Number(input.replaceAll(",", ""));
  if (!Number.isFinite(number) || Math.abs(number) >= 1000000000) return undefined;
  if (number === 0) return "zero";
  const whole = Math.floor(Math.abs(number));
  const parts = [
    { value: Math.floor(whole / 10000000), label: "crore" },
    { value: Math.floor((whole % 10000000) / 100000), label: "lakh" },
    { value: Math.floor((whole % 100000) / 1000), label: "thousand" },
    { value: whole % 1000, label: "" },
  ];
  const words = parts
    .filter((part) => part.value)
    .map((part) => `${underThousand(part.value)}${part.label ? ` ${part.label}` : ""}`)
    .join(" ");
  return `${number < 0 ? "minus " : ""}${words}`;
}

function humanizeName(name: string) {
  return name
    .replaceAll("_id", "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function labelFor(control: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) {
  if (control.id) {
    const label = control.form?.querySelector(`label[for="${CSS.escape(control.id)}"]`)?.textContent?.trim();
    if (label) return label;
  }
  const nearbyLabel = control.closest(".space-y-2")?.querySelector("label")?.textContent?.trim();
  return nearbyLabel || humanizeName(control.name);
}

function valueFor(control: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) {
  if (control instanceof HTMLSelectElement) return control.selectedOptions[0]?.textContent?.trim() ?? control.value;
  if (control instanceof HTMLInputElement && control.type === "checkbox") return control.checked ? control.labels?.[0]?.textContent?.trim() ?? control.value : "";
  return control.value.trim();
}

function collectFormSummary(form: HTMLFormElement | null) {
  if (!form) return [];
  const rows: SummaryRow[] = [];
  const controls = Array.from(form.elements).filter((element): element is HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement => {
    return element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement;
  });

  for (const control of controls) {
    if (!control.name || control.type === "hidden" || control.disabled) continue;
    const value = valueFor(control);
    if (!value) continue;
    const words = control instanceof HTMLInputElement && control.type === "number" ? numberToIndianWords(value) : undefined;
    rows.push({ label: labelFor(control), value, words });
  }

  return rows.slice(0, 12);
}

export function ConfirmSubmitButton({
  children,
  confirmTitle = "Confirm action",
  confirmDescription = "Please confirm before saving this change.",
  confirmLabel = "Confirm",
  cancelLabel = "Close",
  disabled,
  summary: propsSummary,
  ...props
}: ConfirmSubmitButtonProps) {
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const isDeleteAction =
    confirmTitle.toLowerCase().includes("delete") ||
    confirmTitle.toLowerCase().includes("deactivate") ||
    (typeof children === "string" && children.toLowerCase().includes("delete"));

  const finalConfirmLabel = isDeleteAction && confirmLabel === "Confirm" ? "Yes" : confirmLabel;
  const finalCancelLabel = isDeleteAction && cancelLabel === "Close" ? "No" : cancelLabel;
  const finalDescription = isDeleteAction &&
    (confirmDescription === "Please confirm before saving this change." ||
     confirmDescription.toLowerCase().includes("delete") ||
     confirmDescription.toLowerCase().includes("deactivate") ||
     confirmDescription.toLowerCase().includes("remove") ||
     confirmDescription.toLowerCase().includes("will be deleted"))
    ? "Do you want to delete this?"
    : confirmDescription;

  function submitForm() {
    const form = buttonRef.current?.closest("form");
    setOpen(false);
    window.setTimeout(() => form?.requestSubmit(), 0);
  }

  return (
    <>
      <Button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (propsSummary) {
            setSummary(propsSummary);
          } else {
            setSummary(collectFormSummary(buttonRef.current?.closest("form") ?? null));
          }
          setOpen(true);
        }}
        {...props}
      >
        {children}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{confirmTitle}</DialogTitle>
            <DialogDescription>{finalDescription}</DialogDescription>
          </DialogHeader>
          {summary.length > 0 ? (
            <div className="max-h-72 overflow-y-auto rounded-md border bg-muted/30 p-3">
              <div className="space-y-2 text-sm">
                {summary.map((row, index) => (
                  <div key={`${row.label}-${index}`} className="grid gap-1 sm:grid-cols-[9rem_1fr]">
                    <div className="text-muted-foreground">{row.label}</div>
                    <div className="font-medium">
                      {row.value}
                      {row.words ? <div className="text-xs font-normal capitalize text-muted-foreground">{row.words}</div> : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <DialogClose asChild>
              <Button type="button" variant="outline">{finalCancelLabel}</Button>
            </DialogClose>
            <Button type="button" onClick={submitForm}>{finalConfirmLabel}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
