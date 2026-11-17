/**
 * Rostinho do Bilbo (óculos redondos + bigode) desenhado em SVG.
 * O emoji 🥸 não existe no Windows 10, então o desenho é próprio:
 * aparece igual em qualquer computador ou celular.
 */
export default function BilboFace({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-label="Bilbo" role="img">
      <defs>
        <radialGradient id="bilbo-pele" cx="42%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#FFE7B8" />
          <stop offset="70%" stopColor="#F2C46D" />
          <stop offset="100%" stopColor="#D9A441" />
        </radialGradient>
      </defs>
      {/* rosto */}
      <circle cx="32" cy="32" r="29" fill="url(#bilbo-pele)" stroke="#B8862B" strokeWidth="1.5" />
      {/* sobrancelhas */}
      <path d="M13 19 Q20 14 27 18" fill="none" stroke="#4A3220" strokeWidth="3" strokeLinecap="round" />
      <path d="M37 18 Q44 14 51 19" fill="none" stroke="#4A3220" strokeWidth="3" strokeLinecap="round" />
      {/* óculos */}
      <circle cx="21" cy="28" r="8.5" fill="#FFFFFF" fillOpacity="0.55" stroke="#1F1A14" strokeWidth="3" />
      <circle cx="43" cy="28" r="8.5" fill="#FFFFFF" fillOpacity="0.55" stroke="#1F1A14" strokeWidth="3" />
      <path d="M29.5 27 Q32 25 34.5 27" fill="none" stroke="#1F1A14" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M12.6 26.5 L4.5 24.5 M51.4 26.5 L59.5 24.5" stroke="#1F1A14" strokeWidth="2.4" strokeLinecap="round" />
      {/* olhos */}
      <circle cx="21.5" cy="28.5" r="2.6" fill="#1F1A14" />
      <circle cx="43.5" cy="28.5" r="2.6" fill="#1F1A14" />
      {/* nariz */}
      <ellipse cx="32" cy="38" rx="5.2" ry="4.6" fill="#E9A85B" stroke="#B87A35" strokeWidth="1.2" />
      {/* bigode */}
      <path
        d="M32 43 C27 40 20 40 15.5 44.5 C14.5 45.5 15.8 47 17 46.4 C21.5 44.3 26 45.3 32 47 C38 45.3 42.5 44.3 47 46.4 C48.2 47 49.5 45.5 48.5 44.5 C44 40 37 40 32 43 Z"
        fill="#4A3220"
      />
      {/* boca */}
      <path d="M27 52 Q32 55 37 52" fill="none" stroke="#8A4B2A" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
