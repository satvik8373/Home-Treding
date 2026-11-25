import type { ReactNode } from 'react'

type Field = {
  label: string
  value: ReactNode
  detail?: ReactNode
  tone?: 'positive' | 'negative'
}

export function DataGrid({ fields, label, className = '' }: {
  fields: readonly Field[]
  label?: string
  className?: string
}) {
  return <dl className={`data-grid ${className}`} aria-label={label}>
    {fields.map(field => <div key={field.label}>
      <dt>{field.label}</dt>
      <dd className="data-grid-value" data-tone={field.tone}>{field.value}</dd>
      {field.detail != null && <dd className="data-grid-detail">{field.detail}</dd>}
    </div>)}
  </dl>
}
