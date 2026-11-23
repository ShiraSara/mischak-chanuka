// קו גלי מתחת לכותרת
export default function Wave({ className = '' }) {
  return (
    <svg className={`wave ${className}`} viewBox="0 0 300 16" preserveAspectRatio="none" aria-hidden="true">
      <path d="M3 10 C 40 2, 70 15, 110 8 S 180 3, 220 9 S 280 12, 297 5" />
    </svg>
  );
}
