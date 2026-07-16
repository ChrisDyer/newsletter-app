export default function SenderAvatar({ name, email, size = 'md' }) {
  const label = name || email || '?'
  const char = label[0].toUpperCase()
  const colors = ['bg-blue-600', 'bg-purple-600', 'bg-green-600', 'bg-rose-600', 'bg-amber-600', 'bg-teal-600']
  const idx = (label.charCodeAt(0) || 0) % colors.length
  const sizes = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-11 h-11 text-base',
  }

  return (
    <div className={`${sizes[size] || sizes.md} rounded-full flex items-center justify-center font-semibold text-white shrink-0 ${colors[idx]}`}>
      {char}
    </div>
  )
}