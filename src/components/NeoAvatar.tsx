export function NeoAvatar({ size = 46 }: { size?: number }) {
  return (
    <div
      className="neo-avatar-container"
      style={{
        width: size,
        height: size,
        minWidth: size,
        borderRadius: '50%',
        backgroundColor: '#ede9fe',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(167, 139, 250, 0.25)',
        border: '2px solid #ffffff',
      }}
      aria-label="User avatar"
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Soft circular pastel background */}
        <circle cx="24" cy="24" r="24" fill="#ede9fe" />

        {/* Neck and shirt */}
        <path d="M18 36c0-3 3-5 6-5s6 2 6 5v6H18v-6z" fill="#fbcfe8" />
        <path d="M12 44c0-5 5.5-8 12-8s12 3 12 8v4H12v-4z" fill="#6366f1" />

        {/* Head / Face */}
        <rect x="16" y="16" width="16" height="18" rx="8" fill="#fed7aa" />

        {/* Hair - modern textured dark hair */}
        <path
          d="M15 19c0-6 4-10 10-10 5 0 9 3 9 7 0 1-1 3-2 3-1 0-2-1-3-1-3 0-5 2-6 4-1 1-3 1-4 0-2-1-4-1-4-3z"
          fill="#1e1b4b"
        />
        <path d="M14 17c1-3 4-6 9-6 6 0 10 3 11 7-1 0-3-1-5-1s-4 2-6 2-5-2-9-2z" fill="#0f172a" />

        {/* Beard / stubble styling as in Wilson image */}
        <path
          d="M17 26c0 5 3 8 7 8s7-3 7-8c0-1 0-1-.5-.5-1.5 2-4 3-6.5 3s-5-1-6.5-3c-.5-.5-.5-.5-.5.5z"
          fill="#1e1b4b"
        />

        {/* Eyes */}
        <circle cx="20" cy="22" r="1.5" fill="#0f172a" />
        <circle cx="28" cy="22" r="1.5" fill="#0f172a" />
        <circle cx="20.5" cy="21.5" r="0.5" fill="#ffffff" />
        <circle cx="28.5" cy="21.5" r="0.5" fill="#ffffff" />

        {/* Eyebrows */}
        <path d="M18 19.5c1-.8 3-.8 4 0" stroke="#0f172a" strokeWidth="1" strokeLinecap="round" />
        <path d="M26 19.5c1-.8 3-.8 4 0" stroke="#0f172a" strokeWidth="1" strokeLinecap="round" />

        {/* Nose */}
        <path d="M24 23v2.5a1 1 0 0 1-1 1" stroke="#ea580c" strokeWidth="0.8" strokeLinecap="round" />

        {/* Smile */}
        <path d="M21.5 27.5c1 1 4 1 5 0" stroke="#0f172a" strokeWidth="1" strokeLinecap="round" />
      </svg>
    </div>
  )
}
