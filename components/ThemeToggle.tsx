"use client";

import { useSyncExternalStore, useCallback, useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";
import { motion } from "framer-motion";
import GlassIcon from "./GlassIcon";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getSnapshot(): "light" | "dark" {
  if (typeof window === "undefined") return "dark";
  const saved = localStorage.getItem("theme");
  return saved === "light" ? "light" : "dark";
}

function getServerSnapshot(): "light" | "dark" {
  return "dark";
}

export default function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true);
      document.documentElement.setAttribute("data-theme", getSnapshot());
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const toggleTheme = useCallback(() => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    try {
      localStorage.setItem("theme", nextTheme);
    } catch {}
    document.documentElement.setAttribute("data-theme", nextTheme);
    window.dispatchEvent(new Event("storage"));
  }, [theme]);

  if (!mounted) {
    return <div style={{ width: 32, height: 32 }} />;
  }

  return (
    <motion.button
      onClick={toggleTheme}
      whileHover={{ scale: 1.08, y: -1 }}
      whileTap={{ scale: 0.95 }}
      style={{
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      id="theme-toggle-btn"
    >
      <GlassIcon
        icon={theme === "dark" ? Sun : Moon}
        variant={theme === "dark" ? "yellow" : "default"}
        size="sm"
        strokeWidth={2}
        style={{ borderRadius: "50%" }}
      />
    </motion.button>
  );
}
