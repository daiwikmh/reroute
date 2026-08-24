import Intro from "@/components/Intro";
import HowItWorksSection from "@/components/HowItWorksSection";
import WhoItsForSection from "@/components/WhoItsForSection";
import WhyNowSection from "@/components/WhyNowSection";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <div className="relative">
      <Intro />
      <HowItWorksSection />
      <WhoItsForSection />
      <WhyNowSection />
      <Footer />
    </div>
  );
}
