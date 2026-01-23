import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface TutorialSpotlightProps {
  targetSelector: string | null;
}

export const TutorialSpotlight: React.FC<TutorialSpotlightProps> = ({ targetSelector }) => {
  const [rect, setRect] = useState<SpotlightRect | null>(null);

  useEffect(() => {
    if (!targetSelector) {
      setRect(null);
      return;
    }

    const updateRect = () => {
      const element = document.querySelector(targetSelector);
      if (element) {
        const elementRect = element.getBoundingClientRect();
        const padding = 8;
        setRect({
          top: elementRect.top - padding,
          left: elementRect.left - padding,
          width: elementRect.width + padding * 2,
          height: elementRect.height + padding * 2,
        });
      }
    };

    // Initial calculation
    updateRect();

    // Recalculate on scroll/resize
    window.addEventListener('scroll', updateRect, true);
    window.addEventListener('resize', updateRect);

    return () => {
      window.removeEventListener('scroll', updateRect, true);
      window.removeEventListener('resize', updateRect);
    };
  }, [targetSelector]);

  // If no target or rect, show full overlay without spotlight
  if (!targetSelector || !rect) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 z-40"
      />
    );
  }

  // Create spotlight effect using box-shadow
  const shadowSpread = Math.max(window.innerWidth, window.innerHeight) * 2;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-40 pointer-events-none"
    >
      {/* Background overlay with spotlight cutout using box-shadow */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{
          opacity: 1,
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        }}
        transition={{ duration: 0.3 }}
        className="absolute rounded-lg"
        style={{
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          boxShadow: `0 0 0 ${shadowSpread}px rgba(0, 0, 0, 0.6)`,
        }}
      />

      {/* Highlight ring around the target */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{
          opacity: 1,
          scale: 1,
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="absolute rounded-lg ring-2 ring-brand-500 ring-offset-2 ring-offset-transparent"
        style={{
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        }}
      />
    </motion.div>
  );
};

export const getTooltipPosition = (
  targetSelector: string | null,
  position: 'top' | 'bottom' | 'left' | 'right' | 'center'
): { top: number; left: number; transformOrigin: string } => {
  if (!targetSelector || position === 'center') {
    // Center of viewport
    return {
      top: window.innerHeight / 2,
      left: window.innerWidth / 2,
      transformOrigin: 'center center',
    };
  }

  const element = document.querySelector(targetSelector);
  if (!element) {
    return {
      top: window.innerHeight / 2,
      left: window.innerWidth / 2,
      transformOrigin: 'center center',
    };
  }

  const rect = element.getBoundingClientRect();
  const tooltipMargin = 16;

  switch (position) {
    case 'top':
      return {
        top: rect.top - tooltipMargin,
        left: rect.left + rect.width / 2,
        transformOrigin: 'bottom center',
      };
    case 'bottom':
      return {
        top: rect.bottom + tooltipMargin,
        left: rect.left + rect.width / 2,
        transformOrigin: 'top center',
      };
    case 'left':
      return {
        top: rect.top + rect.height / 2,
        left: rect.left - tooltipMargin,
        transformOrigin: 'center right',
      };
    case 'right':
      return {
        top: rect.top + rect.height / 2,
        left: rect.right + tooltipMargin,
        transformOrigin: 'center left',
      };
    default:
      return {
        top: window.innerHeight / 2,
        left: window.innerWidth / 2,
        transformOrigin: 'center center',
      };
  }
};
