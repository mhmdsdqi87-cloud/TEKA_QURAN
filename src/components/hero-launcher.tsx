"use client";

import HeroSection from "@/components/hero-section";

export default function HeroLauncher() {
  return (
    <HeroSection
      onStart={() => {
        document.getElementById("studio")?.scrollIntoView({ behavior: "smooth" });
      }}
    />
  );
}
