export function CountingVehicleIcon({ type,className = 'h-[18px] w-[18px]' }: { type: 'bus' | 'van'; className?: string }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${className}`}>
    {type === 'bus' ? <><rect x="4" y="3" width="16" height="16" rx="3"/><path d="M4 11h16M12 3v8M7 19v2M17 19v2M7 15h1M16 15h1"/></> : <><path d="M3 6h12l6 6v6H3zM14 6v7h7M3 12h11"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></>}
  </svg>;
}
