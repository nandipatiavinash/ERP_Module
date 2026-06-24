import fs from 'fs';
import path from 'path';

const placeholders = [
  { file: 'src/app/(app)/fabric/consumption/page.tsx', title: 'Fabric Consumption', desc: 'Manage fabric consumption logs.' },
  { file: 'src/app/(app)/roto-printing/production/page.tsx', title: 'Roto Printing Production', desc: 'Roto-gravure printing production entry.' },
  { file: 'src/app/(app)/roto-printing/consumption/page.tsx', title: 'Roto Printing Consumption', desc: 'Roto-gravure printing inks and film consumption.' },
  { file: 'src/app/(app)/roto-printing/stock/page.tsx', title: 'Roto Printing Stock', desc: 'View printing materials stock.' },
  { file: 'src/app/(app)/lamination/production/page.tsx', title: 'Lamination Production', desc: 'Film lamination production entry.' },
  { file: 'src/app/(app)/lamination/consumption/page.tsx', title: 'Lamination Consumption', desc: 'Adhesives and films lamination consumption.' },
  { file: 'src/app/(app)/lamination/stock/page.tsx', title: 'Lamination Stock', desc: 'Laminated film stock.' },
  { file: 'src/app/(app)/offset-printing/production/page.tsx', title: 'Offset Printing Production', desc: 'Offset printing production entries.' },
  { file: 'src/app/(app)/offset-printing/consumption/page.tsx', title: 'Offset Printing Consumption', desc: 'Offset inks and materials consumption.' },
  { file: 'src/app/(app)/offset-printing/stock/page.tsx', title: 'Offset Printing Stock', desc: 'Offset products stock.' },
  { file: 'src/app/(app)/finishing/production/page.tsx', title: 'Finishing Production', desc: 'Bag cutting and finishing production entries.' },
  { file: 'src/app/(app)/finishing/consumption/page.tsx', title: 'Finishing Consumption', desc: 'Packaging and threads consumption logs.' },
  { file: 'src/app/(app)/finishing/stock/page.tsx', title: 'Finishing Stock', desc: 'Finished products stock.' },
  { file: 'src/app/(app)/accounts/journal/page.tsx', title: 'Journal Entry', desc: 'Accounting double entry journals.' },
  { file: 'src/app/(app)/accounts/purchase/page.tsx', title: 'Purchase Entry', desc: 'Accounting purchase entry and ledger updates.' },
  { file: 'src/app/(app)/accounts/sales/page.tsx', title: 'Sales Entry', desc: 'Accounting sales ledger entries.' },
  { file: 'src/app/(app)/reports/sales-confirmation/page.tsx', title: 'Sales Confirmation Reports', desc: 'Sales order confirmation and status reporting.' },
  { file: 'src/app/(app)/reports/accounts/page.tsx', title: 'Account Reports', desc: 'Accounting reports and ledgers.' },
  { file: 'src/app/(app)/reports/opening-balance/page.tsx', title: 'Opening Balance', desc: 'Configured opening balances for ledger accounts.' },
  { file: 'src/app/(app)/reports/closing-stock/page.tsx', title: 'Closing Stock', desc: 'Closing stock reports.' },
  { file: 'src/app/(app)/reports/profit-loss/page.tsx', title: 'Profit & Loss', desc: 'Profit & Loss statements.' },
  { file: 'src/app/(app)/reports/balance-sheet/page.tsx', title: 'Balance Sheet', desc: 'Company balance sheet statements.' },
  { file: 'src/app/(app)/sales/order-confirmation/page.tsx', title: 'Order Confirmation', desc: 'Order confirmation print and SMS templates.' }
];

for (const p of placeholders) {
  const dir = path.dirname(p.file);
  fs.mkdirSync(dir, { recursive: true });
  const content = `import { PlaceholderPage } from "@/components/app/placeholder-page";

export default function Page() {
  return <PlaceholderPage title="${p.title}" description="${p.desc}" />;
}
`;
  fs.writeFileSync(p.file, content, 'utf8');
  console.log(`Created: ${p.file}`);
}
