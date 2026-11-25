// טיימר לשאלה: "רגיל" = לפי הגדרות המשחק, או זמן משלה
const OPTIONS = [5, 10, 15, 20, 30, 45, 60, 90];

export default function TimerSelect({ value, def, onChange, label = 'טיימר לשאלה' }) {
  return (
    <select
      className={`q-timer ${value != null ? 'set' : ''}`}
      title={label}
      value={value == null ? '' : String(value)}
      onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
    >
      <option value="">⏱ {def == null ? 'לפי הגדרות המשחק' : `רגיל (${def ? def + ' שנ׳' : 'בלי'})`}</option>
      {OPTIONS.map((t) => (
        <option key={t} value={t}>
          ⏱ {t} שניות
        </option>
      ))}
      <option value="0">⏱ בלי טיימר</option>
    </select>
  );
}
