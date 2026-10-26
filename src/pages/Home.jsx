import Hero from '../components/Hero.jsx'
import RangeList from '../components/RangeList.jsx'
import Showcase from '../components/Showcase.jsx'
import Making from '../components/Making.jsx'
import InsideTheMotor from '../components/InsideTheMotor.jsx'
import WhyXingZ from '../components/WhyXingZ.jsx'
import Dealers from '../components/Dealers.jsx'
import EnquireBand from '../components/EnquireBand.jsx'
import Footer from '../components/Footer.jsx'
import WhatsAppFab from '../components/WhatsAppFab.jsx'
import { useReveal } from '../reveal.js'

// The page is a run of chapters, each one flat colour field: ground, copper, paper, steel and ink.
export default function Home() {
  useReveal()

  return (
    <>
      <Hero />
      <main>
        <RangeList />
        <Showcase />
        <Making />
        <InsideTheMotor />
        <WhyXingZ />
        <Dealers />
        <EnquireBand />
      </main>
      <Footer />
      <WhatsAppFab />
    </>
  )
}
