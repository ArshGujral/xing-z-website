import Hero from '../components/Hero.jsx'
import TrustStrip from '../components/TrustStrip.jsx'
import RangeGrid from '../components/RangeGrid.jsx'
import ConfiguratorTeaser from '../components/ConfiguratorTeaser.jsx'
import WhyXingZ from '../components/WhyXingZ.jsx'
import InsideTheMotor from '../components/InsideTheMotor.jsx'
import Testimonials from '../components/Testimonials.jsx'
import FinalCta from '../components/FinalCta.jsx'
import Footer from '../components/Footer.jsx'
import WhatsAppFab from '../components/WhatsAppFab.jsx'

export default function Home() {
  return (
    <>
      <Hero />
      <main>
        <TrustStrip />
        <RangeGrid />
        <ConfiguratorTeaser />
        <WhyXingZ />
        <InsideTheMotor />
        <Testimonials />
        <FinalCta />
      </main>
      <Footer />
      <WhatsAppFab />
    </>
  )
}
