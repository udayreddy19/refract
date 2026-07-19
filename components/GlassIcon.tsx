"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

export type GlassIconVariant = "default" | "green" | "red" | "yellow" | "blue" | "dim" | "dark";
export type GlassIconSize   = "xs" | "sm" | "md" | "lg" | "xl";

interface GlassIconProps {
  icon: LucideIcon;
  variant?: GlassIconVariant;
  size?: GlassIconSize;
  className?: string;
  style?: React.CSSProperties;
  /** Animate on mount */
  animate?: boolean;
  /** Index for stagger delay */
  delay?: number;
  strokeWidth?: number;
}

/* ── Per-variant palette ────────────────────────────────────────────────── */
const VARIANTS: Record<GlassIconVariant, {
  bg: string;
  borderTop: string;
  border: string;
  shadow: string;
  iconColor: string;
  glow: string;
}> = {
  default: {
    bg:        "var(--g-icon-bg-default)",
    borderTop: "var(--g-icon-border-top-default)",
    border:    "var(--g-icon-border-default)",
    shadow:    "var(--g-icon-shadow-default)",
    iconColor: "var(--g-icon-color-default)",
    glow:      "var(--g-icon-glow-default)",
  },
  green: {
    bg:        "var(--g-icon-bg-green)",
    borderTop: "var(--g-icon-border-top-green)",
    border:    "var(--g-icon-border-green)",
    shadow:    "var(--g-icon-shadow-green)",
    iconColor: "var(--g-icon-color-green)",
    glow:      "var(--g-icon-glow-green)",
  },
  red: {
    bg:        "var(--g-icon-bg-red)",
    borderTop: "var(--g-icon-border-top-red)",
    border:    "var(--g-icon-border-red)",
    shadow:    "var(--g-icon-shadow-red)",
    iconColor: "var(--g-icon-color-red)",
    glow:      "var(--g-icon-glow-red)",
  },
  yellow: {
    bg:        "var(--g-icon-bg-yellow)",
    borderTop: "var(--g-icon-border-top-yellow)",
    border:    "var(--g-icon-border-yellow)",
    shadow:    "var(--g-icon-shadow-yellow)",
    iconColor: "var(--g-icon-color-yellow)",
    glow:      "var(--g-icon-glow-yellow)",
  },
  blue: {
    bg:        "var(--g-icon-bg-blue)",
    borderTop: "var(--g-icon-border-top-blue)",
    border:    "var(--g-icon-border-blue)",
    shadow:    "var(--g-icon-shadow-blue)",
    iconColor: "var(--g-icon-color-blue)",
    glow:      "var(--g-icon-glow-blue)",
  },
  dim: {
    bg:        "var(--g-icon-bg-dim)",
    borderTop: "var(--g-icon-border-top-dim)",
    border:    "var(--g-icon-border-dim)",
    shadow:    "var(--g-icon-shadow-dim)",
    iconColor: "var(--g-icon-color-dim)",
    glow:      "var(--g-icon-glow-dim)",
  },
  dark: {
    bg:        "var(--g-icon-bg-dark)",
    borderTop: "var(--g-icon-border-top-dark)",
    border:    "var(--g-icon-border-dark)",
    shadow:    "var(--g-icon-shadow-dark)",
    iconColor: "var(--g-icon-color-dark)",
    glow:      "var(--g-icon-glow-dark)",
  },
};

/* ── Per-size geometry ──────────────────────────────────────────────────── */
const SIZES: Record<GlassIconSize, { container: number; icon: number; radius: number }> = {
  xs: { container: 24, icon: 11, radius: 6  },
  sm: { container: 32, icon: 14, radius: 8  },
  md: { container: 44, icon: 20, radius: 12 },
  lg: { container: 58, icon: 26, radius: 16 },
  xl: { container: 72, icon: 32, radius: 20 },
};

/* ── Component ──────────────────────────────────────────────────────────── */
export default function GlassIcon({
  icon: Icon,
  variant = "default",
  size    = "md",
  className,
  style,
  animate = false,
  delay   = 0,
  strokeWidth = 1.6,
}: GlassIconProps) {
  const v = VARIANTS[variant];
  const s = SIZES[size];

  const container: React.CSSProperties = {
    width:           s.container,
    height:          s.container,
    borderRadius:    s.radius,
    flexShrink:      0,
    display:         "flex",
    alignItems:      "center",
    justifyContent:  "center",
    position:        "relative",
    overflow:        "hidden",

    /* Glassmorphism */
    background:      `${v.bg}`,
    backdropFilter:  "blur(24px) saturate(160%)",
    WebkitBackdropFilter: "blur(24px) saturate(160%)",

    /* Four-edge border */
    borderTop:    `1px solid ${v.borderTop}`,
    borderLeft:   `1px solid ${v.border}`,
    borderRight:  `1px solid ${v.border}`,
    borderBottom: `1px solid rgba(255,255,255,0.04)`,

    boxShadow: v.shadow,
    ...style,
  };

  const innerGlow: React.CSSProperties = {
    position:    "absolute",
    inset:       0,
    borderRadius: "inherit",
    background:  `radial-gradient(ellipse at 50% -10%, ${v.glow} 0%, transparent 65%)`,
    pointerEvents: "none",
  };

  const specular: React.CSSProperties = {
    position: "absolute",
    top: 0, left: "10%", right: "10%",
    height: 1,
    background: `linear-gradient(90deg, transparent, ${v.borderTop}, transparent)`,
    pointerEvents: "none",
  };

  const Wrapper = animate ? motion.div : "div";
  const wrapperProps = animate
    ? {
        initial:    { opacity: 0, scale: 0.75, y: 8 },
        animate:    { opacity: 1, scale: 1,    y: 0 },
        transition: { delay, type: "spring" as const, stiffness: 260, damping: 20 },
        whileHover: { scale: 1.10, y: -2, transition: { type: "spring" as const, stiffness: 300, damping: 18 } },
      }
    : {};

  return (
    <Wrapper style={container} className={className} {...wrapperProps}>
      <div style={innerGlow} />
      <div style={specular} />
      <Icon size={s.icon} color={v.iconColor} strokeWidth={strokeWidth} />
    </Wrapper>
  );
}
