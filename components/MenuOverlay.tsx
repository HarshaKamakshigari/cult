"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";

const LINKS = ["Home", "About", "Gallery", "Events", "Contact"];
const REPEAT = 4;

export default function MenuOverlay({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<HTMLDivElement[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Physics with better performance
  const position = useRef(0);
  const velocity = useRef(0);
  const lastTime = useRef(0);
  const animationId = useRef<number | null>(null);
  const targetPosition = useRef(0); // Target for smooth interpolation
  const isAnimating = useRef(false); // Prevent multiple simultaneous animations

  // Tuning - optimized values
  const ITEM_HEIGHT = 112;
  const LOOP_HEIGHT = ITEM_HEIGHT * LINKS.length * REPEAT;
  const TOTAL_ITEMS = LINKS.length * REPEAT;

  /* ================= RESPONSIVE ================= */

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  /* ================= OPEN / CLOSE ================= */

  useEffect(() => {
    if (!overlayRef.current) return;

    if (isOpen) {
      // Ensure overlay is visible before animating
      overlayRef.current.style.display = 'flex';
      
      // Smooth open animation
      gsap.to(overlayRef.current, {
        y: 0,
        autoAlpha: 1,
        duration: 1.2,
        ease: "power3.out",
        onStart: () => {
          if (!isMobile) startAnimation();
        }
      });
    } else {
      stopAnimation();
      
      // Then animate the overlay itself with delay
      gsap.to(overlayRef.current, {
        y: "100%",
        autoAlpha: 0,
        duration: 0.8,
        delay: 0.3,
        ease: "power3.in",
        onComplete: () => {
          if (overlayRef.current) {
            overlayRef.current.style.display = 'none';
          }
        }
      });
    }
  }, [isOpen, isMobile]);

  /* ================= HOVER EFFECTS ================= */

  const handleMouseEnter = (index: number) => {
    if (isMobile) return;
    setHoveredIndex(index);
    
    const item = itemsRef.current[index];
    if (item) {
      // Create and append red square if it doesn't exist
      let square = item.querySelector('.red-square') as HTMLElement;
      if (!square) {
        square = document.createElement('div');
        square.className = 'red-square';
        item.appendChild(square);
        
        // Initial state - small red square (hidden)
        gsap.set(square, {
          width: '8px',
          height: '8px',
          backgroundColor: '#ff0000',
          position: 'absolute',
          right: '-30px',
          top: '40%',
          transform: 'translateY(-50%)',
          opacity: 0,
          scale: 0,
        });
      }
      
      // Animation sequence
      const timeline = gsap.timeline();
      
      // 1. Square appears
      timeline.to(square, {
        opacity: 1,
        scale: 1,
        duration: 0.15,
        ease: "power2.out",
      })
      
      // 2. Quick glitch effect - fast horizontal shakes
      .to(square, {
        x: () => Math.random() * 4 - 2,
        duration: 0.03,
        ease: "none",
        repeat: 4,
        yoyo: true,
      })
      
      // 3. Grow to image size
      .to(square, {
        width: '60px',
        height: '60px',
        x: 0,
        duration: 0.3,
        ease: "power2.out",
        onUpdate: function() {
          const progress = this.progress();
          if (progress > 0.3) {
            if (Math.random() > 0.9) {
              square.style.transform = `translateY(-50%) translateX(${Math.random() * 2 - 1}px)`;
            }
            
            if (progress > 0.5) {
              square.style.backgroundImage = 'url("https://images.unsplash.com/photo-1506905925346-21bda4d32df4")';
              square.style.backgroundSize = 'cover';
              square.style.backgroundPosition = 'center 20%';
              square.style.backgroundColor = 'transparent';
            }
          }
        }
      });
    }
  };

  const handleMouseLeave = (index: number) => {
    if (isMobile) return;
    setHoveredIndex(null);
    
    const item = itemsRef.current[index];
    if (item) {
      const square = item.querySelector('.red-square') as HTMLElement;
      if (square) {
        // Quick glitch before disappearing
        gsap.to(square, {
          x: () => Math.random() * 3 - 1.5,
          duration: 0.02,
          repeat: 2,
          yoyo: true,
          ease: "none",
          onComplete: () => {
            gsap.to(square, {
              width: '8px',
              height: '8px',
              opacity: 0,
              scale: 0,
              x: 0,
              duration: 0.2,
              ease: "power2.in",
              onComplete: () => {
                if (square.parentNode) {
                  square.parentNode.removeChild(square);
                }
              }
            });
          }
        });
      }
    }
  };

  /* ================= FIXED SMOOTH ANIMATION LOOP ================= */

  const startAnimation = () => {
    if (animationId.current) return;
    lastTime.current = performance.now();
    targetPosition.current = position.current;
    
    const animate = (currentTime: number) => {
      if (!animationId.current) return;
      
      // Calculate delta time for consistent physics
      const deltaTime = Math.min(currentTime - lastTime.current, 32) / 16;
      lastTime.current = currentTime;
      
      // Apply smooth friction
      velocity.current *= 0.93;
      
      // Update target position based on velocity
      targetPosition.current += velocity.current * deltaTime;
      
      // Smoothly interpolate to target position (removes glitches)
      position.current += (targetPosition.current - position.current) * 0.2;
      
      // Handle wrapping - CRITICAL FIX for glitches
      if (position.current < 0) {
        position.current += LOOP_HEIGHT;
        targetPosition.current += LOOP_HEIGHT;
      }
      if (position.current > LOOP_HEIGHT) {
        position.current -= LOOP_HEIGHT;
        targetPosition.current -= LOOP_HEIGHT;
      }
      
      // Update items WITHOUT GSAP - direct updates are smoother for scrolling
      const centerY = window.innerHeight / 2;
      const items = itemsRef.current;
      
      // Use requestAnimationFrame for direct updates (smoother than GSAP for scrolling)
      for (let i = 0; i < items.length; i++) {
        const el = items[i];
        if (!el) continue;
        
        // Calculate position without intermediate wrapping
        const rawY = i * ITEM_HEIGHT - position.current;
        let y = rawY;
        
        // Simple wrap logic
        if (y < -LOOP_HEIGHT / 2) y += LOOP_HEIGHT;
        else if (y > LOOP_HEIGHT / 2) y -= LOOP_HEIGHT;
        
        const dist = Math.abs(y);
        const focus = Math.max(0, Math.min(1, 1 - dist / 380));
        const scale = 0.85 + focus * 0.25;
        const opacity = 0.3 + focus * 0.7;
        
        // Direct DOM updates - faster and smoother for scrolling
        el.style.transform = `translate3d(0, ${centerY + y}px, 0) scale(${scale})`;
        el.style.opacity = opacity.toString();
        el.style.willChange = 'transform, opacity';
        
        // Update red square position
        const square = el.querySelector('.red-square') as HTMLElement;
        if (square) {
          square.style.transform = 'translateY(-50%)';
        }
      }
      
      animationId.current = requestAnimationFrame(animate);
    };
    
    animationId.current = requestAnimationFrame(animate);
  };

  const stopAnimation = () => {
    if (animationId.current) {
      cancelAnimationFrame(animationId.current);
      animationId.current = null;
    }
    velocity.current = 0;
    targetPosition.current = position.current;
  };

  /* ================= OPTIMIZED WHEEL HANDLING ================= */

  useEffect(() => {
    if (isMobile || !isOpen) return;
    
    let wheelTimeout: NodeJS.Timeout | null = null;
    let accumulatedDeltaY = 0;
    let lastWheelTime = 0;
    
    const onWheel = (e: WheelEvent) => {
      if (!isOpen) return;
      
      e.preventDefault();
      
      const now = Date.now();
      const timeDiff = now - lastWheelTime;
      lastWheelTime = now;
      
      // Accumulate with time-based weighting for smoothness
      const timeWeight = Math.min(timeDiff / 16, 2); // Normalize to ~60fps
      accumulatedDeltaY += e.deltaY * timeWeight;
      
      // Apply with easing curve for smooth acceleration
      const baseVelocity = accumulatedDeltaY * 0.25;
      const easedVelocity = Math.sign(baseVelocity) * 
                           Math.pow(Math.abs(baseVelocity), 0.85);
      
      velocity.current += easedVelocity;
      
      // Gentle velocity clamping
      const maxVelocity = 65;
      if (Math.abs(velocity.current) > maxVelocity) {
        velocity.current = Math.sign(velocity.current) * maxVelocity;
      }
      
      // Reset accumulated delta
      accumulatedDeltaY = 0;
      
      // Smooth debouncing
      if (wheelTimeout) clearTimeout(wheelTimeout);
      wheelTimeout = setTimeout(() => {
        // Only reduce velocity if no recent wheel events
        velocity.current *= 0.96;
        wheelTimeout = null;
      }, 100);
    };
    
    window.addEventListener("wheel", onWheel, { passive: false });
    
    return () => {
      window.removeEventListener("wheel", onWheel);
      if (wheelTimeout) clearTimeout(wheelTimeout);
    };
  }, [isOpen, isMobile]);

  /* ================= SMOOTH MOUSE DRAG ================= */

  useEffect(() => {
    if (isMobile || !isOpen) return;
    
    let isDragging = false;
    let startY = 0;
    let startPosition = 0;
    let lastDragTime = 0;
    let lastDragY = 0;
    const dragVelocities: number[] = [];
    const MAX_VELOCITY_HISTORY = 5;
    
    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      startY = e.clientY;
      startPosition = position.current;
      lastDragY = e.clientY;
      lastDragTime = performance.now();
      dragVelocities.length = 0;
      
      // Reduce existing velocity
      velocity.current *= 0.3;
      targetPosition.current = position.current;
    };
    
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      
      const currentTime = performance.now();
      const deltaTime = Math.max(currentTime - lastDragTime, 1);
      
      // Calculate immediate drag delta
      const deltaY = lastDragY - e.clientY; // Inverted for natural feel
      const immediateVelocity = deltaY / deltaTime * 40;
      
      // Store velocity for averaging
      dragVelocities.push(immediateVelocity);
      if (dragVelocities.length > MAX_VELOCITY_HISTORY) {
        dragVelocities.shift();
      }
      
      // Update position directly for responsive dragging
      position.current = startPosition + (startY - e.clientY) * 1.5;
      
      // Wrap position
      if (position.current < 0) position.current += LOOP_HEIGHT;
      else if (position.current > LOOP_HEIGHT) position.current -= LOOP_HEIGHT;
      
      // Keep target position in sync
      targetPosition.current = position.current;
      
      lastDragY = e.clientY;
      lastDragTime = currentTime;
    };
    
    const onMouseUp = () => {
      if (!isDragging) return;
      
      // Calculate average velocity from history
      if (dragVelocities.length > 0) {
        const avgVelocity = dragVelocities.reduce((a, b) => a + b, 0) / dragVelocities.length;
        velocity.current = avgVelocity * 0.7;
        
        // Clamp to reasonable values
        const maxReleaseVelocity = 50;
        if (Math.abs(velocity.current) > maxReleaseVelocity) {
          velocity.current = Math.sign(velocity.current) * maxReleaseVelocity;
        }
      }
      
      isDragging = false;
    };
    
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    
    return () => {
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [isOpen, isMobile]);

  /* ================= RENDER ================= */

  return (
    <>
      <div ref={overlayRef} className="menu" style={{ display: 'none' }}>
        {/* LEFT */}
        <div className="menu-left">
          <div className="menu-column">
            {isMobile
              ? LINKS.map((text, i) => (
                  <div 
                    key={text} 
                    className="menu-item mobile" 
                    onClick={onClose}
                    onMouseEnter={() => handleMouseEnter(i)}
                    onMouseLeave={() => handleMouseLeave(i)}
                  >
                    {text}
                    <div className="mobile-indicator"></div>
                  </div>
                ))
              : Array.from({ length: REPEAT })
                  .flatMap(() => LINKS)
                  .map((text, i) => {
                    const isHovered = hoveredIndex === i;
                    return (
                      <div
                        key={i}
                        ref={(el) => {
                          if (el && !itemsRef.current.includes(el)) {
                            itemsRef.current[i] = el;
                          }
                        }}
                        className={`menu-item ${isHovered ? 'hovered' : ''}`}
                        onClick={onClose}
                        onMouseEnter={() => handleMouseEnter(i)}
                        onMouseLeave={() => handleMouseLeave(i)}
                        style={{
                          transition: 'color 0.2s ease',
                          willChange: 'transform, opacity, color'
                        }}
                      >
                        {text}
                      </div>
                    );
                  })}
          </div>
        </div>

        {/* RIGHT */}
        {!isMobile && (
          <div className="menu-right">
            <div className="menu-media" />
          </div>
        )}

        <button className="menu-close" onClick={onClose}>
          CLOSE
        </button>
      </div>

      {/* ================= OPTIMIZED CSS ================= */}
      <style jsx>{`
        .menu {
          position: fixed;
          inset: 0;
          display: flex;
          background: #0a0a0a;
          z-index: 9999;
          overflow: hidden;
          transform: translateZ(0);
          backface-visibility: hidden;
          perspective: 1000px;
          will-change: transform, opacity;
          cursor: grab;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }

        .menu:active {
          cursor: grabbing;
        }

        /* LEFT */
        .menu-left {
          width: 45%;
          display: flex;
          justify-content: center;
          overflow: hidden;
          user-select: none;
          -webkit-user-select: none;
        }

        .menu-column {
          position: relative;
          width: 100%;
          max-width: 520px;
          padding-left: 40px;
          contain: layout style; /* Performance optimization */
        }

        .menu-item {
          position: absolute;
          left: 0;
          font-size: 4.1rem;
          font-weight: 500;
          color: #ffffff;
          text-transform: uppercase;
          white-space: nowrap;
          cursor: pointer;
          text-align: left;
          will-change: transform, opacity;
          transform: translate3d(0, 0, 0);
          backface-visibility: hidden;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          padding-right: 80px;
          box-sizing: border-box;
          user-select: none;
          -webkit-user-select: none;
          pointer-events: auto;
          contain: layout style; /* Performance optimization */
        }

        .menu-item.hovered {
          color: #ff0000;
        }

        /* MOBILE */
        .menu-item.mobile {
          position: relative;
          font-size: 2.3rem;
          margin-bottom: 26px;
          opacity: 1;
          transform: none !important;
          letter-spacing: 0.08em;
          padding-right: 30px;
          transition: color 0.2s ease;
        }

        .menu-item.mobile:hover {
          color: #ff0000;
        }

        .mobile-indicator {
          position: absolute;
          right: 0;
          top: 50%;
          width: 6px;
          height: 6px;
          background-color: #ff0000;
          transform: translateY(-50%);
          opacity: 0;
          transition: opacity 0.2s ease;
        }

        .menu-item.mobile:hover .mobile-indicator {
          opacity: 1;
        }

        /* Custom styles for the red square */
        :global(.red-square) {
          position: absolute;
          right: -30px;
          top: 40%;
          transform: translateY(-50%);
          background-position: center 20%;
          background-size: cover;
          background-repeat: no-repeat;
          will-change: transform, opacity, width, height;
          transform-origin: center center;
          contain: layout style; /* Performance optimization */
        }

        /* RIGHT */
        .menu-right {
          width: 55%;
          overflow: hidden;
          transform: translateZ(0);
        }

        .menu-media {
          width: 100%;
          height: 100%;
          background-image: url("https://images.unsplash.com/photo-1506905925346-21bda4d32df4");
          background-size: cover;
          background-position: center;
          animation: breathe 20s ease-in-out infinite alternate;
          transform: translateZ(0);
          will-change: transform;
        }

        @keyframes breathe {
          from {
            transform: scale(1.05) translateZ(0);
          }
          to {
            transform: scale(1.15) translateZ(0);
          }
        }

        /* CLOSE BUTTON */
        .menu-close {
          position: absolute;
          top: 36px;
          right: 44px;
          background: transparent;
          border: 0px solid rgba(255, 255, 255, 0.15);
          color: #ffffff;
          font-size: 0.8rem;
          letter-spacing: 0.32em;
          cursor: pointer;
          z-index: 10000;
          padding: 12px 24px;
          transition: all 0.2s ease;
          font-family: monospace;
        }

        .menu-close:hover {
          border-color: rgba(255, 255, 255, 0.3);
          color: #ff0000;
        }

        @media (max-width: 768px) {
          .menu {
            flex-direction: column;
            padding: 120px 32px;
            cursor: default;
          }

          .menu-left {
            width: 100%;
            justify-content: flex-start;
          }

          .menu-column {
            max-width: none;
            padding-left: 0;
          }
          
          .menu-item.mobile {
            padding-right: 0;
          }
          
          .menu-close {
            top: 24px;
            right: 24px;
            padding: 10px 20px;
          }
        }
      `}</style>
    </>
  );
}