"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { motion } from "framer-motion";
import GlassIcon from "./GlassIcon";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.setAttribute("data-theme", savedTheme);
    } else {
      document.documentElement.setAttribute("data-theme", "dark");
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("theme", nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
  };

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
