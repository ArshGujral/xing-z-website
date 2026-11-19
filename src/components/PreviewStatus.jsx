export default function PreviewStatus({ unavailable = false }) {
  return (
    <p role="status" className="pointer-events-none absolute inset-0 grid place-items-center px-4 text-center text-sm text-white/60">
      {unavailable ? '3D preview unavailable' : 'Loading 3D preview…'}
    </p>
  )
}
