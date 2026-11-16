export function RexAvatar({ size = "small", talking = false }: { size?: "tiny" | "small" | "large"; talking?: boolean }) {
  return (
    <span className={`ec-rex-avatar ec-rex-avatar-${size} ${talking ? "ec-rex-talking" : ""} relative inline-grid shrink-0 place-items-center`} role="img" aria-label="Rex animated robot avatar">
      <svg viewBox="0 0 112 112" className="ec-rex-head relative z-10 h-full w-full" aria-hidden="true">
        <defs>
          <linearGradient id="rex-shell" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffffff"/><stop offset=".58" stopColor="#eef3ff"/><stop offset="1" stopColor="#cbd6f1"/></linearGradient>
          <linearGradient id="rex-face" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#1437bd"/><stop offset=".55" stopColor="#2465f4"/><stop offset="1" stopColor="#1032a7"/></linearGradient>
          <linearGradient id="rex-band" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#6d7cff"/><stop offset="1" stopColor="#253ed0"/></linearGradient>
        </defs>
        <path d="M12 55a44 44 0 0 1 88 0" fill="none" stroke="url(#rex-band)" strokeWidth="5" strokeLinecap="round"/>
        <rect x="4" y="43" width="13" height="30" rx="7" fill="#1738bd"/><rect x="95" y="43" width="13" height="30" rx="7" fill="#1738bd"/>
        <rect x="12" y="14" width="88" height="88" rx="36" fill="url(#rex-shell)"/>
        <rect x="23" y="37" width="66" height="47" rx="18" fill="url(#rex-face)"/>
        <g fill="none" stroke="#75f3ff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><g><animateTransform attributeName="transform" type="translate" values="-3 0;3 0;-3 0" dur="4.8s" repeatCount="indefinite"/><g className="ec-rex-eyes"><path d="M36 59l6-5 6 5"/><path d="M64 59l6-5 6 5"/></g></g></g>
        <path d="M49 70q7 5 14 0" fill="none" stroke="#75f3ff" strokeWidth="2.8" strokeLinecap="round">{talking && <animate attributeName="d" values="M49 70q7 5 14 0;M46 69q10 10 20 0;M49 70q7 5 14 0" dur="0.42s" repeatCount="indefinite" />}</path>
        <rect x="12" y="79" width="12" height="8" rx="4" fill="#102eaa"/>
        <circle cx="27" cy="83" r="4" fill="#102eaa"/>
      </svg>
      <span className="ec-rex-avatar-shadow" />
      <style>{`
        .ec-rex-avatar-large { width:86px;height:86px; }
        .ec-rex-avatar-small { width:46px;height:46px; }
        .ec-rex-avatar-tiny { width:32px;height:32px; }
        .ec-rex-avatar-large,.ec-rex-avatar-small,.ec-rex-avatar-tiny { animation:ec-rex-float 3.4s ease-in-out infinite; }
        .ec-rex-head { transform-origin:50% 60%; animation:ec-rex-look 5.8s ease-in-out infinite; }
        .ec-rex-avatar-shadow { position:absolute;width:48%;height:7px;border-radius:50%;bottom:-5px;background:rgba(74,211,171,.24);filter:blur(2px);animation:ec-rex-shadow 3.4s ease-in-out infinite; }
        .ec-rex-eyes { transform-origin:center;animation:ec-rex-blink 5.2s infinite; }
        @keyframes ec-rex-float { 0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)} }
        @keyframes ec-rex-shadow { 0%,100%{transform:scaleX(1);opacity:.8}50%{transform:scaleX(.78);opacity:.45} }
        @keyframes ec-rex-blink { 0%,42%,46%,100%{transform:scaleY(1)}44%{transform:scaleY(.12)} }
        @keyframes ec-rex-look { 0%,100%{rotate:0deg}25%{rotate:-3deg}72%{rotate:3deg} }
        @media (prefers-reduced-motion:reduce) { .ec-rex-avatar-large,.ec-rex-avatar-small,.ec-rex-avatar-tiny,.ec-rex-avatar-shadow,.ec-rex-eyes,.ec-rex-head { animation:none!important; } }
      `}</style>
    </span>
  );
}

