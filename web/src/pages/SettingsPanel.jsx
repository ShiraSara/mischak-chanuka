export const DEFAULT_SETTINGS = { timerSec: 30, shuffle: false, allowSelfVote: true, autoReveal: false, showVoters: true };

export default function SettingsPanel({ settings, setSettings }) {
  const set = (k, v) => setSettings({ ...settings, [k]: v });
  const check = (k, label) => (
    <label>
      <input type="checkbox" checked={settings[k]} onChange={(e) => set(k, e.target.checked)} /> {label}
    </label>
  );
  return (
    <div className="card">
      <h2>
        <span className="step">3</span>הגדרות
      </h2>
      <div className="settings-grid">
        <label>
          טיימר לכל שאלה (שניות, 0 = בלי)
          <input
            type="number"
            min="0"
            max="600"
            style={{ width: 90 }}
            value={settings.timerSec}
            onChange={(e) => set('timerSec', e.target.value)}
          />
        </label>
        {check('shuffle', 'ערבוב סדר השאלות')}
        {check('allowSelfVote', 'מותר להצביע לעצמך')}
        {check('autoReveal', 'הצגת תוצאות אוטומטית כשכולן הצביעו / הזמן נגמר')}
        {check('showVoters', 'להראות על המסך מי כבר הצביעה (בלי מה היא בחרה)')}
      </div>
    </div>
  );
}
