import { useState } from 'react';

// שדה קטן בתוך הדף (במקום חלון קופץ): Enter שומר, Esc מבטל
export default function InlineInput({ initial = '', placeholder = '', type = 'text', label, saveText = '✓ שמירה', onSave, onCancel, width = 200 }) {
  const [v, setV] = useState(String(initial ?? ''));
  const save = () => onSave(v.trim());
  return (
    <span className="inline-input" onClick={(e) => e.stopPropagation()}>
      {label && <span className="lbl">{label}</span>}
      <input
        type={type}
        value={v}
        autoFocus
        placeholder={placeholder}
        style={{ width }}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.preventDefault(), save());
          if (e.key === 'Escape') onCancel();
        }}
      />
      <button type="button" className="btn small primary" onClick={save}>
        {saveText}
      </button>
      <button type="button" className="btn small ghost" onClick={onCancel}>
        ✕
      </button>
    </span>
  );
}
