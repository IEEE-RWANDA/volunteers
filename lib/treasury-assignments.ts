import { createHash } from "node:crypto";
import { treasuryBalances } from "./treasury-balances";
import { roster } from "./volunteer-roster";
import { volunteerUnits } from "./volunteer-units";
import { listIntakeRecords, readIntakeJson, saveIntakeFile } from "./volunteer-store";

type Fund = { id: string; name: string; cents?: number; amount?: string; receivedAt?: string; treasuryRowId?: string };

export async function assignTreasuryFund(rowId: string, volunteerEmail: string, unitId: string, assignedBy: string) {
  const [balances, volunteers, units, paths, baseline] = await Promise.all([
    treasuryBalances(), roster(), volunteerUnits(), listIntakeRecords("listed-funds"),
    readIntakeJson<{ rows: { id: string }[] }>("treasury-history/fund-balances.json"),
  ]);
  const row = balances.rows.find(row => row.id === rowId);
  if (!row || row.incoming <= 0 || row.balance <= 0 || !Number.isSafeInteger(row.balance) ||
      !volunteers.some(person => person.email === volunteerEmail) || !units.some(unit => unit.id === unitId)) return false;
  const funds = await Promise.all(paths.map(path => readIntakeJson<Fund>(path)));
  const existing = funds.find(fund => fund && (fund.id === row.id || fund.treasuryRowId === row.id));
  const imported = baseline?.rows.some(item => item.id === row.id);
  if (!existing && !imported) return false;
  // One deterministic fund per imported row prevents duplicate assignment balances.
  const hash = createHash("sha256").update(`treasury-row:${row.id}`).digest("hex");
  const id = existing?.id ?? `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
  const fund = {
    ...(existing ?? { id, name: row.name, cents: row.balance, receivedAt: row.date, treasuryRowId: row.id }),
    volunteerEmail, unitId, unitName: units.find(unit => unit.id === unitId)!.label, assignedBy, assignedAt: new Date().toISOString(),
  };
  await saveIntakeFile(`listed-funds/${id}.json`, JSON.stringify(fund), Boolean(existing));
  return true;
}
