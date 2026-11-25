import { useRef, useState } from 'react';
import { parseQuestionLines, readQuestionFile } from './questionList.js';

// הוספת הרבה שאלות בבת אחת: הדבקה מוורד / וואטסאפ, או העלאת קובץ וורד / טקסט
export default function ListPaste({ title, topicInput = false, onAdd, onCancel }) {
  const [text, setText] = useState('');
  const [topic, setTopic] = useState('');
  const [err, setErr] = useState('');
  const fileRef = useRef(null);
  const items = parseQuestionLines(text);

  const loadFile = async (f) => {
    if (!f) return;
    setErr('');
    try {
      const t = await readQuestionFile(f);
      setText((old) => (old.trim() ? old.trimEnd() + '\n' : '') + t);
    } catch (e) {
      setErr(e.message);
    }
    fileRef.current.value = '';
  };

  return (
    <div className="list-paste">
      <b>{title}</b>
      <p className="muted">
        מדביקים את הרשימה (למשל מוורד), או מעלים את הקובץ עצמו. שורה לכל שאלה – מספור ותבליטים יורדים לבד.
        <br />
        לשאלה עם תשובות קבועות: <code>שאלה | תשובה | תשובה</code>
      </p>
      <div className="row list-paste-tools">
        <button type="button" className="btn small" onClick={() => fileRef.current.click()}>
          📄 העלאת קובץ וורד / טקסט
        </button>
        <input ref={fileRef} type="file" accept=".docx,.txt,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden onChange={(e) => loadFile(e.target.files[0])} />
        {topicInput && <input type="text" className="list-paste-topic" placeholder="📂 נושא (לא חובה)" value={topic} onChange={(e) => setTopic(e.target.value)} />}
        {err && <span className="err">⚠️ {err}</span>}
      </div>
      <textarea
        autoFocus
        rows={7}
        value={text}
        placeholder={'1. מי הכי מצחיקה?\n2. מי תמיד מאחרת?\n3. קפה או תה? | קפה | תה'}
        onChange={(e) => setText(e.target.value)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          if (!e.dataTransfer.files?.length) return;
          e.preventDefault();
          loadFile(e.dataTransfer.files[0]);
        }}
      />
      {items.length > 0 && (
        <div className="list-paste-preview">
          <span className="muted">יתווספו {items.length} שאלות, למשל:</span>
          {items.slice(0, 4).map((q, i) => (
            <span key={i} className="pv">
              {q.text}
              {q.type === 'options' && <small> ({q.options.join(' / ')})</small>}
            </span>
          ))}
          {items.length > 4 && <span className="muted">ועוד {items.length - 4}…</span>}
        </div>
      )}
      <div className="row">
        <button type="button" className="btn primary" disabled={!items.length} onClick={() => onAdd(items, topic.trim())}>
          הוספת {items.length || ''} שאלות
        </button>
        <button type="button" className="btn ghost" onClick={onCancel}>
          ביטול
        </button>
      </div>
    </div>
  );
}
