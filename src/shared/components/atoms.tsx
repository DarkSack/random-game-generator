import type { ReactNode } from 'react'
import { STATUS_EMOJI, STATUS_LABEL, type GameStatus } from '@core/index'

/** Iniciales de un título, para las portadas sin imagen. */
function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('')
}

/** Hue estable derivado del nombre: cada juego mantiene su color de portada. */
function hueOf(name: string): number {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) % 360
  return hash
}

export function GameCover({
  name,
  url,
  className = '',
  wide = false,
}: {
  name: string
  url?: string | null
  className?: string
  wide?: boolean
}) {
  const hue = hueOf(name)
  return (
    <div
      className={`cover ${wide ? 'cover--wide' : ''} ${className}`}
      style={
        url
          ? undefined
          : {
              background: `linear-gradient(140deg, hsl(${hue} 55% 24%), hsl(${(hue + 45) % 360} 60% 14%))`,
            }
      }
    >
      {url ? (
        <img
          src={url}
          alt=""
          loading="lazy"
          onError={(event) => {
            // Portada rota (URL caducada, sin conexión): degradamos a iniciales.
            event.currentTarget.style.display = 'none'
          }}
        />
      ) : (
        <span className="cover__initials">{initialsOf(name) || '?'}</span>
      )}
    </div>
  )
}

export function StatusBadge({ status }: { status: GameStatus }) {
  return (
    <span className={`badge badge--${status}`}>
      {STATUS_EMOJI[status]} {STATUS_LABEL[status]}
    </span>
  )
}

export function Rating({ value }: { value: number | null }) {
  if (value == null) return <span className="faint">Sin nota</span>
  return (
    <span className="rating">
      ★ {value.toFixed(1)}
      <span className="faint" style={{ fontWeight: 500 }}>
        /10
      </span>
    </span>
  )
}

export function EmptyState({
  icon = '🎮',
  title,
  description,
  action,
}: {
  icon?: string
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="empty">
      <span className="empty__icon">{icon}</span>
      <h3 className="empty__title">{title}</h3>
      {description ? <p style={{ margin: 0, maxWidth: 380 }}>{description}</p> : null}
      {action}
    </div>
  )
}

export function Progress({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value))
  return (
    <div
      className="progress"
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="progress__bar" style={{ width: `${clamped}%` }} />
    </div>
  )
}

export function Stat({
  value,
  label,
  hint,
}: {
  value: ReactNode
  label: string
  hint?: ReactNode
}) {
  return (
    <div className="stat">
      <div className="stat__value gradient-text">{value}</div>
      <div className="stat__label">{label}</div>
      {hint ? <div className="stat__hint">{hint}</div> : null}
    </div>
  )
}
