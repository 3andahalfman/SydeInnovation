'use client';

import { useState, useRef, useEffect, ReactNode } from 'react';
import { HelpCircle, ExternalLink } from 'lucide-react';

interface TooltipProps {
  content: string;
  learnMoreUrl?: string;
  children: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
}

export default function Tooltip({ 
  content, 
  learnMoreUrl, 
  children, 
  position = 'top',
  delay = 200 
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const showTooltip = () => {
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsVisible(false);
  };

  useEffect(() => {
    if (isVisible && triggerRef.current && tooltipRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      
      let x = 0, y = 0;
      
      switch (position) {
        case 'top':
          x = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2);
          y = triggerRect.top - tooltipRect.height - 8;
          break;
        case 'bottom':
          x = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2);
          y = triggerRect.bottom + 8;
          break;
        case 'left':
          x = triggerRect.left - tooltipRect.width - 8;
          y = triggerRect.top + (triggerRect.height / 2) - (tooltipRect.height / 2);
          break;
        case 'right':
          x = triggerRect.right + 8;
          y = triggerRect.top + (triggerRect.height / 2) - (tooltipRect.height / 2);
          break;
      }
      
      // Keep tooltip within viewport
      x = Math.max(8, Math.min(x, window.innerWidth - tooltipRect.width - 8));
      y = Math.max(8, Math.min(y, window.innerHeight - tooltipRect.height - 8));
      
      setCoords({ x, y });
    }
  }, [isVisible, position]);

  return (
    <div 
      ref={triggerRef}
      className="inline-flex"
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
    >
      {children}
      
      {isVisible && (
        <div
          ref={tooltipRef}
          className="fixed z-[9999] pointer-events-auto"
          style={{ left: coords.x, top: coords.y }}
        >
          {/* Liquid glass tooltip */}
          <div className="
            relative px-3 py-2 max-w-xs
            bg-gradient-to-br from-white/10 to-white/5
            backdrop-blur-xl
            border border-white/20
            rounded-xl
            shadow-[0_8px_32px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.1)]
            before:absolute before:inset-0 before:rounded-xl
            before:bg-gradient-to-br before:from-cyan-500/10 before:to-blue-500/5
            before:pointer-events-none
            overflow-hidden
          ">
            {/* Water ripple effect */}
            <div className="absolute inset-0 opacity-30">
              <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-radial from-cyan-400/20 to-transparent rounded-full animate-pulse" />
            </div>
            
            <p className="relative text-sm text-white/90 leading-relaxed">
              {content}
            </p>
            
            {learnMoreUrl && (
              <a
                href={learnMoreUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="relative flex items-center gap-1 mt-2 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                Learn more
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
          
          {/* Arrow */}
          <div className={`
            absolute w-3 h-3 
            bg-gradient-to-br from-white/10 to-white/5
            backdrop-blur-xl
            border border-white/20
            transform rotate-45
            ${position === 'top' ? 'bottom-[-6px] left-1/2 -translate-x-1/2 border-t-0 border-l-0' : ''}
            ${position === 'bottom' ? 'top-[-6px] left-1/2 -translate-x-1/2 border-b-0 border-r-0' : ''}
            ${position === 'left' ? 'right-[-6px] top-1/2 -translate-y-1/2 border-l-0 border-b-0' : ''}
            ${position === 'right' ? 'left-[-6px] top-1/2 -translate-y-1/2 border-r-0 border-t-0' : ''}
          `} />
        </div>
      )}
    </div>
  );
}

// Helper component for info icons with tooltips
interface InfoTooltipProps {
  content: string;
  learnMoreUrl?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export function InfoTooltip({ content, learnMoreUrl, position = 'top' }: InfoTooltipProps) {
  return (
    <Tooltip content={content} learnMoreUrl={learnMoreUrl} position={position}>
      <button className="p-1 text-slate-400 hover:text-cyan-400 transition-colors" title="More info" aria-label="More info">
        <HelpCircle className="w-4 h-4" />
      </button>
    </Tooltip>
  );
}
