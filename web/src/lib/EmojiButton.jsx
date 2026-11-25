import { useEffect, useRef, useState } from 'react';

const EMOJIS = [
  '😂', '🤣', '😍', '🥰', '😎', '🤔', '🙈', '😱', '🤫', '😴', '🥳', '🤩',
  '😇', '😈', '🤭', '🙄', '😬', '🥹', '💃', '👑', '💅', '👀', '💕', '🔥',
  '⭐', '✨', '🎉', '🎂', '🍕', '🍫', '☕', '🍦', '🛍️', '👗', '👠', '💄',
  '📱', '🚗', '✈️', '🏖️', '📚', '🎤', '🎵', '💍', '👶', '🐶', '🐱', '🏆',
];

// כפתור 😊 קטן שפותח לוח אימוג'ים; לחיצה מכניסה את האימוג'י במקום של הסמן בשדה
export default function EmojiButton({ inputRef, value, onChange }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => !box.current?.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const insert = (em) => {
    const el = inputRef.current;
    const at = el && el.selectionStart != null ? el.selectionStart : value.length;
    const end = el && el.selectionEnd != null ? el.selectionEnd : at;
    onChange(value.slice(0, at) + em + value.slice(end));
    setOpen(false);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      el.setSelectionRange(at + em.length, at + em.length);
    });
  };

  return (
    <span className="emoji-btn" ref={box}>
      <button type="button" title="הוספת אימוג'י" onClick={() => setOpen(!open)}>
        😊
      </button>
      {open && (
        <span className="emoji-pop">
          {EMOJIS.map((em) => (
            <button type="button" key={em} onClick={() => insert(em)}>
              {em}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}
