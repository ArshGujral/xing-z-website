import SectionHeading, { container } from './SectionHeading.jsx'
import { asset, rawMaterialBrands } from '../content/site.js'

export default function RawMaterialBrands() {
  const hasBrands = rawMaterialBrands.length > 0

  return (
    <section id="raw-material-brands" className="border-t border-white/5 py-20 md:py-28">
      <div className={container}>
        <SectionHeading
          eyebrow="Sourcing"
          title="Raw material brands"
          intro={hasBrands ? undefined : 'Brand and material details coming soon.'}
        />
        {hasBrands && (
          <ul className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
            {rawMaterialBrands.map(({ name, material, logo }) => (
              <li key={name} className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.02] p-3 sm:p-4">
                <div className="grid h-24 place-items-center rounded-xl bg-[#f3fbfa] p-3 sm:h-28 sm:p-5">
                  <img src={asset(logo)} alt="" loading="lazy" decoding="async" className="max-h-full max-w-full object-contain" />
                </div>
                <h3 className="mt-3 break-words text-sm font-medium text-white sm:text-base">{name}</h3>
                <p className="mt-1 break-words text-xs text-white/60 sm:text-sm">{material}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
