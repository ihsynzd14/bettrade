import Nav from '@/components/nav'
import Hero from '@/components/hero'
import Marquee from '@/components/marquee'
import Features from '@/components/features'
import HowItWorks from '@/components/how-it-works'
import Stats from '@/components/stats'
import Cta from '@/components/cta'

export default function Home() {
  return (
    <>
      <Nav />
      <main className="pt-14">
        <Hero />
        <Marquee />
        <Features />
        <HowItWorks />
        <Stats />
        <Cta />
      </main>
    </>
  )
}
