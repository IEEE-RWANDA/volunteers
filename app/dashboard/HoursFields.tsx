import { kigaliToday } from "@/lib/volunteer-hours";

export default function HoursFields() {
  const today = kigaliToday();
  return (
    <>
      <label className="block text-sm font-semibold">Activity
        <input className="login-input" name="activity" maxLength={150} required />
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block min-w-0 text-sm font-semibold">Date
          <input className="login-input min-w-0" name="date" type="date" defaultValue={today} max={today} required />
        </label>
        <label className="block min-w-0 text-sm font-semibold">Hours
          <input className="login-input" name="hours" type="number" min={0} max={24} step={1} defaultValue={0} required />
        </label>
        <label className="block min-w-0 text-sm font-semibold">Minutes
          <input className="login-input" name="minutes" type="number" min={0} max={59} step={1} defaultValue={0} required />
        </label>
      </div>
    </>
  );
}
