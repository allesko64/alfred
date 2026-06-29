"use client";

import React, { useState, useRef } from "react";
import {
  motion,
  useTransform,
  AnimatePresence,
  useMotionValue,
  useSpring,
} from "motion/react";
import { type LucideIcon } from "lucide-react";

export const AnimatedTooltip = ({
  items,
}: {
  items: {
    id: number;
    name: string;
    designation: string;
    icon: LucideIcon;
    color: string;
  }[];
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const springConfig = { stiffness: 100, damping: 15 };
  const x = useMotionValue(0);
  const animationFrameRef = useRef<number | null>(null);

  const rotate = useSpring(
    useTransform(x, [-100, 100], [-45, 45]),
    springConfig,
  );
  const translateX = useSpring(
    useTransform(x, [-100, 100], [-50, 50]),
    springConfig,
  );

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    animationFrameRef.current = requestAnimationFrame(() => {
      const halfWidth = event.currentTarget.offsetWidth / 2;
      x.set(event.nativeEvent.offsetX - halfWidth);
    });
  };

  return (
    <>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div
            className="group relative -mr-4"
            key={item.name}
            onMouseEnter={() => setHoveredIndex(item.id)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <AnimatePresence>
              {hoveredIndex === item.id && (
                <motion.div
                  initial={{ opacity: 0, y: 20, scale: 0.6 }}
                  animate={{
                    opacity: 1,
                    y: 0,
                    scale: 1,
                    transition: {
                      type: "spring",
                      stiffness: 260,
                      damping: 10,
                    },
                  }}
                  exit={{ opacity: 0, y: 20, scale: 0.6 }}
                  style={{
                    translateX: translateX,
                    rotate: rotate,
                    whiteSpace: "nowrap",
                  }}
                  className="absolute -top-16 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center justify-center rounded-md bg-black px-4 py-2 text-xs shadow-xl"
                >
                  <div
                    className="absolute inset-x-10 -bottom-px z-30 h-px w-[20%]"
                    style={{
                      background: `linear-gradient(to right, transparent, ${item.color}, transparent)`,
                    }}
                  />
                  <div className="relative z-30 text-base font-bold text-white">
                    {item.name}
                  </div>
                  <div className="text-xs text-white/70">
                    {item.designation}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div
              onMouseMove={handleMouseMove}
              className="relative flex h-14 w-14 items-center justify-center rounded-full border-2 border-white object-cover object-top transition duration-500 group-hover:z-30 group-hover:scale-105"
              style={{
                backgroundColor: `${item.color}1A`,
                borderColor: `${item.color}66`,
              }}
            >
              <Icon
                className="h-6 w-6"
                style={{ color: item.color }}
                strokeWidth={2}
              />
            </div>
          </div>
        );
      })}
    </>
  );
};
