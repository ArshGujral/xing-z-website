// Everything editable on the site lives here.
// Anything in [brackets] or shown as XX is a placeholder: replace it with real details before launch.

// A file in /public, resolved against the site's base path so it also loads when the site is served
// from a subfolder (as on GitHub Pages).
export const asset = (path) => `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`

export const brand = {
  name: 'Xing-Z',
  logoSrc: asset('xingz-logo-white.png'),
  logoOnLight: asset('xingz-logo-copper.png'), // on the light ground (light mode)
  logoBlack: asset('xingz-logo-black.png'), // on the copper and paper chapters
  tagline: ["We don't just manufacture.", 'We engineer.'], // shown on two lines under the hero logo
  headline: "One of India's largest cooler motor and pump makers.", // the hero's h1; two lines at every width
  claim: ["One of India's largest manufacturers", 'of cooler motors and cooler pumps.'], // hero headline; the second part is muted
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

// The range. `short` is the name set large in the range list; `image`, when there is a real
// photograph, puts the line in the product picker too.
export const categories = [
  {
    slug: 'cooler-pump-motors',
    name: 'Cooler pump motors',
    short: 'Cooler pump',
    use: 'Keeps the cooler pads soaked',
    image: null,
  },
  {
    slug: 'high-speed-motors',
    name: 'High-speed motors',
    short: 'High-speed',
    use: 'Stronger air throw for large coolers',
    image: asset('products/high-speed-motors.webp'),
  },
  {
    slug: 'kit-motors',
    name: 'Kit motors',
    short: 'Kit',
    use: 'Ready to fit, for assemblers and repairers',
    image: asset('products/kit-motors.webp'),
  },
  {
    slug: '110-motors',
    name: '110 motors',
    short: '110',
    use: 'The standard size for room and desert coolers',
    image: asset('products/110-motors.webp'),
  },
  {
    slug: 'h-frame-motors',
    name: 'H Frame motors',
    short: 'H Frame',
    use: 'Bolts rigidly into the frame, runs quiet',
    image: asset('products/h-frame-motors.webp'),
  },
  {
    slug: 'exhaust-motors',
    name: 'Exhaust motors',
    short: 'Exhaust',
    use: 'For kitchens, bathrooms and workshops',
    image: asset('products/exhaust-motors.webp'),
  },
  {
    slug: 'blower-motors',
    name: 'Blower motors',
    short: 'Blower',
    use: 'Drives the wheel in blower coolers',
    image: null,
  },
  {
    slug: 'capcan-motors',
    name: 'Capcan motors',
    short: 'Capcan',
    use: 'Capacitor-can start for steady torque',
    image: null,
  },
  {
    slug: 'submersible-pumps',
    name: 'Submersible pumps',
    short: 'Submersible',
    use: 'Sits in the tank, lifts water to the pads',
    image: null,
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

// Why Xing-Z: each reason is a short statement set large on its own colour field.
export const reasons = [
  {
    phrase: 'Wound in copper.',
    text: 'Stators are wound in copper, which runs cooler and holds up through long summer duty cycles.',
    field: 'copper',
  },
  {
    phrase: 'Tested before dispatch.',
    text: 'Motors are checked on our test line before they leave, so faults stay at the factory, not at your counter.',
    field: 'paper',
  },
  {
    phrase: 'Stock all summer.',
    text: 'Steady production through the season, so dealers and OEMs can plan orders without gaps.',
    field: 'steel',
  },
  {
    phrase: 'One line on WhatsApp.',
    text: 'Orders, replacements and technical questions go to one number, answered by people who know the motors.',
    field: 'ink',
  },
]

// How a motor is made, in the order it happens. Photographs from the workshop and the finished motor.
export const makingSteps = [
  {
    stage: 'Stamped',
    text: 'Steel laminations are stamped and stacked into the core.',
    image: asset('process/stamped.webp'),
    alt: 'A stamped steel lamination beside a rotor in the workshop',
  },
  {
    stage: 'Wound',
    text: 'The core is wound in copper and tied off by hand.',
    image: asset('process/wound.webp'),
    alt: 'Two stators wound in copper wire on the workbench',
  },
  {
    stage: 'Assembled',
    text: 'Housing, bearings and capacitor go on, then the test line.',
    image: asset('products/h-frame-motors.webp'),
    alt: 'A finished Xing-Z H Frame motor',
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

// Dealers & OEM section. Check these points match your actual terms before launch.
export const partnerOffers = [
  {
    icon: 'store',
    title: 'For dealers & distributors',
    points: [
      'Dealer pricing across the full range',
      'Pump, fan and blower motors from one supplier',
      'Stock planned ahead of the summer rush',
      'Orders and replacements handled on WhatsApp',
    ],
    cta: { label: 'Become a dealer', message: "Hi Xing-Z, I'd like to become a dealer." },
  },
  {
    icon: 'factory',
    title: 'For OEMs & cooler makers',
    points: [
      'Volume supply scheduled with your production',
      'Mount, speed and finish matched to your cooler',
      'The same copper-wound build, batch after batch',
      'A direct line to our technical team',
    ],
    cta: { label: 'Discuss OEM supply', message: "Hi Xing-Z, I'd like to discuss OEM supply." },
  },
]

export const partnerSteps = [
  { title: 'Message us', text: 'Tell us your city, the motors you need and rough monthly volumes.' },
  { title: 'Get your price list', text: 'We send dealer or OEM pricing for the range you stock.' },
  { title: 'Place your order', text: 'Motors are tested on our line and dispatched to you.' },
]

// Not shown on the page until there are real, attributable quotes (with permission).
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

// Not shown yet. `src`: path to a dealer/OEM logo in /public (with their permission).
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
