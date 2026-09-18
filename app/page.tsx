import { Navigation } from "@/components/Navigation";
import { Hero } from "@/components/Hero";
import { HowItWorks } from "@/components/HowItWorks";
import { QueryInterface } from "@/components/QueryInterface";
import { Examples } from "@/components/Examples";
import { VisualizationSection, FinalCta, Footer } from "@/components/VisualizationSection";

export default function Home() {
  return (
    <>
      <Navigation />
      <main>
        <Hero />
        <HowItWorks />
        <QueryInterface />
        <Examples />
        <VisualizationSection />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
