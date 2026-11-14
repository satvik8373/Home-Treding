import { useId, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Dialog } from './Dialog'

export function RecordDetails({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const titleId = useId()
  return <>
    <button type="button" className="record-details-button" aria-label={`Open ${title.toLowerCase()}`} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>Details</button>
    {open && createPortal(<Dialog titleId={titleId} onClose={() => setOpen(false)}><div className="record-dialog-heading"><h2 id={titleId}>{title}</h2></div><div className="record-dialog-content">{children}</div></Dialog>, document.body)}
  </>
}
