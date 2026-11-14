import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export function SessionTable({ label, children }: { label: string; children: ReactNode }) {
  const viewport = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ left: false, right: false })
  const update = () => {
    const node = viewport.current
    if (!node) return
    const next = { left: node.scrollLeft > 1, right: node.scrollWidth - node.clientWidth - node.scrollLeft > 1 }
    setEdges(previous => previous.left === next.left && previous.right === next.right ? previous : next)
  }
  useEffect(() => {
    const node = viewport.current
    if (!node) return
    const frame = requestAnimationFrame(update)
    const observer = new ResizeObserver(update)
    observer.observe(node)
    if (node.firstElementChild) observer.observe(node.firstElementChild)
    return () => { cancelAnimationFrame(frame); observer.disconnect() }
  }, [])
  const scroll = (direction: number) => {
    const node = viewport.current
    if (node) node.scrollBy({ left: direction * Math.max(240, node.clientWidth * .75), behavior: 'instant' })
  }
  return <div className="session-table-frame">
    {(edges.left || edges.right) && <div className="table-scroll-controls"><span>More columns</span><button type="button" aria-label={`Scroll ${label} left`} disabled={!edges.left} onClick={() => scroll(-1)}><ChevronLeft size={16} /></button><button type="button" aria-label={`Scroll ${label} right`} disabled={!edges.right} onClick={() => scroll(1)}><ChevronRight size={16} /></button></div>}
    <div ref={viewport} className="session-table-scroll" tabIndex={0} role="region" aria-label={`${label}; scroll for more rows and columns`} onScroll={update}>{children}</div>
  </div>
}
