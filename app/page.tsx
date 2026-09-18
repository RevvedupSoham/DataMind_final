import { Navigation } from "@/components/Navigation";
import { Hero } from "@/components/Hero";
import { QueryInterface } from "@/components/QueryInterface";
import { HowItWorks } from "@/components/HowItWorks";
import { Examples } from "@/components/Examples";
import { VisualizationSection, FinalCta, Footer } from "@/components/VisualizationSection";

export default function Home() {
  return (
    <>
      <Navigation />
      <main>
        <Hero />
        <QueryInterface />
        <HowItWorks />
        <Examples />
        <VisualizationSection />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
