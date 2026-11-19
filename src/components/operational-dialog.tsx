'use client';

import { useEffect, useId, useRef, useState } from 'react';

export function closeDialogOnBackdrop(event: React.MouseEvent<HTMLDialogElement>, onClose: () => void) {
  if (event.target !== event.currentTarget) return;
  const rect = event.currentTarget.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
}

export function OperationalDialog({ title, children, onClose, sheet = false }: {
  title: string; children: React.ReactNode; onClose: () => void; sheet?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useId();
  useEffect(() => {
    const element = dialog.current;
    const trigger = document.activeElement;
    element?.showModal();
    return () => {
      element?.close();
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
    };
  }, []);
  return <dialog ref={dialog} aria-labelledby={heading} onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => closeDialogOnBackdrop(event, onClose)} className={sheet ? 'counting-sheet' : 'management-dialog'}>
    {sheet && <div className="counting-sheet-grab" aria-hidden="true" />}
    <h2 id={heading} className="mb-2 text-xl font-semibold">{title}</h2>
    {children}
  </dialog>;
}

export function PanelActionDialog({ title, children, label = title, disabled = false }: {
  title: string; label?: string; children: React.ReactNode; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" className="management-action" disabled={disabled} onClick={() => setOpen(true)}>{label}</button>
    {open && <OperationalDialog title={title} onClose={() => setOpen(false)}>
      {children}
      <button type="button" className="management-action mt-4" onClick={() => setOpen(false)}>Fechar</button>
    </OperationalDialog>}
  </>;
}
