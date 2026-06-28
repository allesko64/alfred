"use client";
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";

export const LayoutTextFlip = ({
  words,
  colors,
  duration = 3000,
  className,
}: {
  words: string[];
  colors?: string[];
  duration?: number;
  className?: string;
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % words.length);
    }, duration);

    return () => clearInterval(interval);
  }, [words.length, duration]);

  const color = colors?.[currentIndex];
  const pillStyle = color
    ? {
        color,
        backgroundColor: `${color}1A`,
        borderColor: `${color}66`,
        borderWidth: "1px",
        borderStyle: "solid",
        transition:
          "color 500ms ease, background-color 500ms ease, border-color 500ms ease",
      }
    : undefined;

  return (
    <motion.span
      layout
      style={pillStyle}
      className={cn(
        "relative inline-flex w-fit items-center justify-center overflow-hidden",
        className
      )}
    >
      <AnimatePresence mode="popLayout">
        <motion.span
          key={currentIndex}
          initial={{ y: -40, filter: "blur(10px)" }}
          animate={{
            y: 0,
            filter: "blur(0px)",
          }}
          exit={{ y: 50, filter: "blur(10px)", opacity: 0 }}
          transition={{
            duration: 0.5,
          }}
          className={cn("inline-block whitespace-nowrap")}
        >
          {words[currentIndex]}
        </motion.span>
      </AnimatePresence>
    </motion.span>
  );
};
