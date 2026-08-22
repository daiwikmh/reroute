import SiteNav from "@/components/SiteNav";
import Intro from "@/components/Intro";
import HowItWorksSection from "@/components/HowItWorksSection";

export default function Home() {
  return (
    <div className="relative">
      <SiteNav />
      <Intro />
      <HowItWorksSection />
    </div>
  );
}
