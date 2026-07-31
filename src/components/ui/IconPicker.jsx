import {
  ShoppingBag, Utensils, Plane, Home, Car, Heart, Briefcase,
  Coffee, Gift, BookOpen, Music, Phone, Wifi, Zap, Droplet,
  Wrench, Stethoscope, GraduationCap, Dumbbell, Baby,
} from 'lucide-react'
import clsx from 'clsx'

const ICON_OPTIONS = [
  { name: 'ShoppingBag', Icon: ShoppingBag },
  { name: 'Utensils',    Icon: Utensils },
  { name: 'Plane',       Icon: Plane },
  { name: 'Home',        Icon: Home },
  { name: 'Car',         Icon: Car },
  { name: 'Heart',       Icon: Heart },
  { name: 'Briefcase',   Icon: Briefcase },
  { name: 'Coffee',      Icon: Coffee },
  { name: 'Gift',        Icon: Gift },
  { name: 'BookOpen',    Icon: BookOpen },
  { name: 'Music',       Icon: Music },
  { name: 'Phone',       Icon: Phone },
  { name: 'Wifi',        Icon: Wifi },
  { name: 'Zap',         Icon: Zap },
  { name: 'Droplet',     Icon: Droplet },
  { name: 'Wrench',      Icon: Wrench },
  { name: 'Stethoscope', Icon: Stethoscope },
  { name: 'GraduationCap', Icon: GraduationCap },
  { name: 'Dumbbell',    Icon: Dumbbell },
  { name: 'Baby',        Icon: Baby },
]

/**
 * IconPicker — Lucide icon grid.
 *
 * Props:
 *  - value: string (icon name, e.g. 'Coffee')
 *  - onChange: (name) => void
 *  - label: string (optional)
 */
export function IconPicker({ value, onChange, label }) {
  return (
    <div className="flex flex-col gap-2">
      {label && <p className="text-body-m font-semibold text-text-primary">{label}</p>}
      <div role="radiogroup" aria-label={label ?? 'Icon'} className="grid grid-cols-5 gap-2 sm:grid-cols-10">
        {ICON_OPTIONS.map(({ name, Icon }) => (
          <button
            key={name}
            type="button"
            role="radio"
            aria-checked={value === name}
            aria-label={name}
            onClick={() => onChange?.(name)}
            className={clsx(
              'inline-flex h-11 w-11 items-center justify-center rounded-md border',
              value === name
                ? 'border-brand-500 bg-brand-50 text-brand-600'
                : 'border-border text-text-secondary hover:bg-bg-sunken hover:text-text-primary',
            )}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
          </button>
        ))}
      </div>
    </div>
  )
}