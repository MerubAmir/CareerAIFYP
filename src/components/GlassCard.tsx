import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface GlassCardProps {
  glow?: "blue" | "purple" | "none";
  hover?: boolean;
  className?: string;
  children?: React.ReactNode;
  onClick?: () => void;
}

const glowClassMap = {
  none: "",
  blue: "shadow-[0_0_0_1px_rgba(103,232,249,0.08),0_24px_70px_rgba(34,211,238,0.12)]",
  purple: "shadow-[0_0_0_1px_rgba(191,219,254,0.08),0_24px_70px_rgba(125,211,252,0.12)]",
};

const GlassCard: React.FC<GlassCardProps> = ({ className, glow = "none", hover = false, children, onClick }) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.35 }}
    onClick={onClick}
    className={cn(
      "panel-surface rounded-lg p-6",
      glowClassMap[glow],
      hover && "cursor-pointer transition duration-300 hover:-translate-y-1 hover:border-border",
      className,
    )}
  >
    {children}
  </motion.div>
);

export { GlassCard };
