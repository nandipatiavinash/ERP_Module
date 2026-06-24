"use client";

import { useEffect } from "react";

export function SplashRemover() {
  useEffect(() => {
    const hideSplash = async () => {
      try {
        const { SplashScreen } = await import("@capacitor/splash-screen");
        await SplashScreen.hide();
      } catch (e) {
        // Ignored when running in standard browser environments
      }
    };
    hideSplash();
  }, []);

  return null;
}
