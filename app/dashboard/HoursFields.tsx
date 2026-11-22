export default function HoursFields() {
  return (
    <div className="grid grid-cols-2 gap-3">
      <label className="block min-w-0 text-sm font-semibold">Hours
        <input className="login-input" name="hours" type="number" min={0} max={24} step={1} defaultValue={0} required />
      </label>
      <label className="block min-w-0 text-sm font-semibold">Minutes
        <input className="login-input" name="minutes" type="number" min={0} max={59} step={1} defaultValue={0} required />
      </label>
    </div>
  );
}
