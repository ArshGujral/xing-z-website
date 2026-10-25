// Everything editable on the site lives here.
// Anything in [brackets] or shown as XX is a placeholder: replace it with real details before launch.

// A file in /public, resolved against the site's base path so it also loads when the site is served
// from a subfolder (as on GitHub Pages).
export const asset = (path) => `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`

export const brand = {
  name: 'Xing-Z',
  logoSrc: asset('xingz-logo-white.png'), // 'xingz-logo-black.png' for light backgrounds
  tagline: ["We don't just manufacture.", 'We engineer.'], // shown on two lines under the hero logo
  claim: "One of India's largest manufacturers of cooler motors and cooler pumps.",
}

export const contact = {
  whatsapp: '910000000000', // country code + number, digits only
  phone: '+91 00000 00000',
  email: 'sales@example.com',
  address: ['[Factory address line 1]', '[Area, City, State – PIN]'],
  gstin: '[add GSTIN]',
}

export const whatsappLink = (message = "Hi Xing-Z, I'd like a quote.") =>
  `https://wa.me/${contact.whatsapp}?text=${encodeURIComponent(message)}`

export const external = { target: '_blank', rel: 'noopener noreferrer' }

// Future routes from the site map. Only the home page exists so far.
export const pages = {
  configurator: '/configurator',
  why: '/why-xing-z',
  inside: '/inside-the-motor',
  manufacturing: '/manufacturing-and-quality',
  dealers: '/dealers',
  downloads: '/downloads',
  support: '/support',
  about: '/about',
  contact: '/contact',
}

// Real figures only — these stay as XX until confirmed.
export const stats = [
  { value: 'XX+', label: 'Years manufacturing' },
  { value: 'XX lakh+', label: 'Motors made' },
  { value: 'XX+', label: 'Cities served' },
  { value: 'XX,000+', label: 'Test hours logged' },
]

// `image`: path to a real product photo in /public. Until then an illustration is drawn from `motor`.
export const categories = [
  {
    slug: 'cooler-pump-motors',
    name: 'Cooler pump motors',
    use: 'Water circulation pumps that keep cooler pads soaked.',
    image: null,
    motor: { attachment: 'pump', mount: 'none' },
  },
  {
    slug: 'high-speed-motors',
    name: 'High-speed motors',
    use: 'Higher RPM for stronger air throw in large coolers.',
    image: asset('products/high-speed-motors.webp'),
    motor: { attachment: 'blades', fast: true },
  },
  {
    slug: 'kit-motors',
    name: 'Kit motors',
    use: 'Ready-to-fit kits for cooler assemblers and repairers.',
    image: asset('products/kit-motors.webp'),
    motor: { attachment: 'blades', clamp: true },
  },
  {
    slug: '110-motors',
    name: '110 motors',
    use: 'The 110 size for standard room and desert coolers.',
    image: asset('products/110-motors.webp'),
    motor: { attachment: 'blades', plate: '110' },
  },
  {
    slug: 'h-frame-motors',
    name: 'H Frame motors',
    use: 'H-frame mounting for rigid, low-vibration installs.',
    image: asset('products/h-frame-motors.webp'),
    motor: { attachment: 'blades', mount: 'hframe' },
  },
  {
    slug: 'exhaust-motors',
    name: 'Exhaust motors',
    use: 'For exhaust fans in kitchens, bathrooms and workshops.',
    image: asset('products/exhaust-motors.webp'),
    motor: { attachment: 'blades', finish: 'Silver' },
  },
  {
    slug: 'blower-motors',
    name: 'Blower motors',
    use: 'Drives blower wheels in centrifugal-blower coolers.',
    image: null,
    motor: { attachment: 'blower' },
  },
  {
    slug: 'capcan-motors',
    name: 'Capcan motors',
    use: 'Capacitor-can motors for steady starting torque.',
    image: null,
    motor: { attachment: 'blades', cap: true },
  },
  {
    slug: 'submersible-pumps',
    name: 'Submersible pumps',
    use: 'Sit in the cooler tank and push water to the pads.',
    image: null,
    motor: { attachment: 'pump', mount: 'strainer' },
  },
]

export const nav = [
  {
    label: 'Range',
    href: '#range',
    items: [...categories.map((c) => ({ label: c.name, href: `#${c.slug}` })), { label: 'View all', href: '#range' }],
  },
  { label: 'Configurator', href: '#configurator' },
  { label: 'Why Xing-Z', href: '#why' },
  { label: 'Inside the Motor', href: '#inside' },
  { label: 'Dealers/OEM', href: '#dealers' },
  { label: 'Contact', href: '#contact' },
]

export const reasons = [
  {
    icon: 'winding',
    title: 'Copper winding',
    text: 'Stators are wound in copper, which runs cooler and holds up through long summer duty cycles.',
  },
  {
    icon: 'testing',
    title: 'Quality testing',
    text: 'Motors are checked on our test line before dispatch, so faults stay at the factory, not at your counter.',
  },
  {
    icon: 'supply',
    title: 'Consistent supply',
    text: 'Steady production through the season, so dealers and OEMs can plan orders without gaps.',
  },
  {
    icon: 'support',
    title: 'Dealer support',
    text: 'A direct WhatsApp line for orders, replacements and technical questions.',
  },
]

// Exploded-view parts of the H Frame motor. `brand`: the branded component used, or null.
// `thumb`: small photo shown in the parts list.
export const parts = [
  {
    name: 'Shaft & rotor',
    role: 'Turns the magnetic field into rotation and carries it to the fan.',
    brand: null,
    thumb: asset('parts/thumbs/shaft-rotor.webp'),
  },
  {
    name: 'Bearings',
    role: 'Two sealed ball bearings hold the shaft true for smooth, quiet running.',
    brand: null,
    thumb: asset('parts/thumbs/bearings.webp'),
  },
  {
    name: 'Aluminium end cover',
    role: 'Seats the bearing and keeps the rotor centred.',
    brand: null,
    thumb: asset('parts/thumbs/cover.webp'),
  },
  {
    name: 'Copper-wound stator',
    role: 'Stamped steel laminations wound in copper. This is where copper matters.',
    brand: null,
    thumb: asset('parts/thumbs/stator.webp'),
  },
  {
    name: 'Housing with H-frame brackets',
    role: 'Protects the winding and bolts rigidly into the cooler frame.',
    brand: null,
    thumb: asset('parts/thumbs/housing.webp'),
  },
  {
    name: 'Capacitor',
    role: 'Gives the motor its starting and running torque.',
    brand: 'Tibcon',
    thumb: asset('parts/thumbs/capacitor.webp'),
  },
  {
    name: 'Bottom cover',
    role: 'Closes the motor and holds the capacitor.',
    brand: null,
    thumb: asset('parts/thumbs/bottom-cover.webp'),
  },
]

// Replace with real, attributable quotes (with permission) before launch.
export const testimonials = [
  {
    quote: '[Quote from a dealer — e.g. what changed in returns or repeat orders after stocking Xing-Z.]',
    name: '[Name]',
    role: 'Dealer',
    place: '[City]',
  },
  {
    quote: '[Quote from an OEM — e.g. supply consistency through the season.]',
    name: '[Name]',
    role: 'Cooler manufacturer',
    place: '[City]',
  },
  {
    quote: '[Quote from a repairer — e.g. fit, finish and how long motors last.]',
    name: '[Name]',
    role: 'Repair shop',
    place: '[City]',
  },
]

// `src`: path to a dealer/OEM logo in /public (with their permission), or null for an empty slot.
export const partnerLogos = Array.from({ length: 6 }, () => ({ name: null, src: null }))

export const footerLinks = [
  {
    title: 'Range',
    links: categories.map((c) => ({ label: c.name, href: `#${c.slug}` })),
  },
  {
    title: 'Company',
    links: [
      { label: 'Why Xing-Z', href: '#why' },
      { label: 'Inside the Motor', href: '#inside' },
      { label: 'Manufacturing & Quality', href: pages.manufacturing },
      { label: 'Dealers & OEM', href: '#dealers' },
      { label: 'About Us', href: pages.about },
    ],
  },
  {
    title: 'Help',
    links: [
      { label: '3D Configurator', href: pages.configurator },
      { label: 'Downloads', href: pages.downloads },
      { label: 'Support & FAQ', href: pages.support },
      { label: 'Contact & Where to Buy', href: pages.contact },
    ],
  },
]
