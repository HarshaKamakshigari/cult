"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import Draggable from "gsap/Draggable";
import InertiaPlugin from "gsap/InertiaPlugin";
import Noise from "./Noise";
import MenuOverlay from "./MenuOverlay";

gsap.registerPlugin(Draggable, InertiaPlugin);

type MediaItem = {
  type: "image" | "video";
  src: string;
};

const MEDIA: MediaItem[] = [
  { type: "video", src: "/videos/video-01.mp4" },
  { type: "video", src: "/videos/video-02.mp4" },
  { type: "video", src: "/videos/video-03.mp4" },
  { type: "image", src: "https://images.unsplash.com/photo-1469474968028-56623f02e42e" },
  { type: "image", src: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23" },
];

export default function InfinitusViewer(): JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const windowsRef = useRef<HTMLDivElement[]>([]);

  const currentImage = useRef(0);
  const isTransitioning = useRef(false);
  const scrollAccumulator = useRef(0);

  const SCROLL_THRESHOLD = 120;

  /* ================= IMAGE TRANSITION ================= */

  function smoothMediaTransition(nextIndex: number) {
    windowsRef.current.forEach((win) => {
      const view = win.querySelector(".window-view") as HTMLDivElement;

      gsap.to(view, {
        opacity: 0,
        duration: 0.3,
        ease: "power2.out",
        onComplete: () => {
          const media = MEDIA[nextIndex];
          
          // Remove existing content
          view.innerHTML = "";
          
          if (media.type === "video") {
            const video = document.createElement("video");
            video.src = media.src;
            video.autoplay = true;
            video.loop = true;
            video.muted = true;
            video.style.width = "100%";
            video.style.height = "100%";
            video.style.objectFit = "cover";
            view.appendChild(video);
          } else {
            view.style.backgroundImage = `url(${media.src})`;
          }

          gsap.to(view, {
            opacity: 1,
            duration: 0.3,
            ease: "power2.out",
          });
        },
      });
    });
  }

  /* ================= UPDATE COORDINATES ================= */

  function updateCoordinates(win: HTMLDivElement, x: number, y: number) {
    const header = win.querySelector(".window-header") as HTMLDivElement;
    if (header) {
      const xPadded = Math.round(x).toString().padStart(4, '0');
      const yPadded = Math.round(y).toString().padStart(4, '0');
      header.textContent = `X:${xPadded}px Y:${yPadded}px`;
    }
  }

  /* ================= CREATE WINDOW ================= */

  function createWindow(
    x: number,
    y: number,
    w: number,
    h: number,
    delay = 0
  ) {
    const container = containerRef.current;
    if (!container) return;

    const cx = container.offsetWidth / 2 - w / 2;
    const cy = container.offsetHeight / 2 - h / 2;

    const win = document.createElement("div");
    win.className = "window";
    win.style.width = `${w}px`;
    win.style.height = `${h}px`;

    const media = MEDIA[currentImage.current];
    
    const xPadded = Math.round(x).toString().padStart(4, '0');
    const yPadded = Math.round(y).toString().padStart(4, '0');
    
    win.innerHTML = `
      <div class="window-header">X:${xPadded}px Y:${yPadded}px</div>
      <div class="window-content">
        <div class="window-view"></div>
      </div>
    `;

    container.appendChild(win);
    windowsRef.current.push(win);

    const view = win.querySelector(".window-view") as HTMLDivElement;
    
    // Set initial media content
    if (media.type === "video") {
      const video = document.createElement("video");
      video.src = media.src;
      video.autoplay = true;
      video.loop = true;
      video.muted = true;
      video.style.width = "100%";
      video.style.height = "100%";
      video.style.objectFit = "cover";
      view.appendChild(video);
    } else {
      view.style.backgroundImage = `url(${media.src})`;
    }

    // Place window at its target and set initial hidden state.
    // Headers will appear first (instantly), then the windows will pop out from the header's top-left corner.
    gsap.set(win, { x, y, scale: 0, opacity: 1 });
    win.style.transformOrigin = '0 0';

    const headerEl = win.querySelector('.window-header') as HTMLElement;
    if (headerEl) {
      // keep header hidden until spawn sequence; headers will be shown instantly by spawn
      headerEl.style.opacity = '0';
      // ensure header has its own transform origin for any future transforms
      headerEl.style.transformOrigin = '0 0';
    }

    gsap.set(view, { x: -x, y: -y });

    // Smooth position state for window
    let currentX = x;
    let currentY = y;
    let targetX = x;
    let targetY = y;
    
    // Smooth animation loop for buttery window drag
    const tickerCallback = () => {
      // Lerp towards target
      currentX += (targetX - currentX) * 0.15;
      currentY += (targetY - currentY) * 0.15;
      
      // Apply smooth position to window
      gsap.set(win, { x: currentX, y: currentY });
      // View follows window immediately (no lag)
      view.style.transform = `translate(${-currentX}px, ${-currentY}px)`;
      updateCoordinates(win, currentX, currentY);
    };
    
    gsap.ticker.add(tickerCallback);

    const dragInstances = Draggable.create(win, {
      type: "x,y",
      bounds: container,
      inertia: false,
      allowEventDefault: true,
      onDrag() {
        // Set target - window will smooth towards it
        targetX = this.x;
        targetY = this.y;
        // Override Draggable's position with our smooth one
        gsap.set(this.target, { x: currentX, y: currentY });
      },
    });

    const dragInstance = dragInstances && dragInstances[0];

    // Attach cleanup handler to the window element so we can remove ticker & draggable when deleting
    (win as any)._cleanup = () => {
      try { gsap.ticker.remove(tickerCallback); } catch (e) {}
      try { if (dragInstance && typeof dragInstance.kill === 'function') dragInstance.kill(); } catch (e) {}
      try { gsap.killTweensOf(win); } catch (e) {}
    };
  }

  /* ================= INIT WINDOWS ================= */

  function clearWindows() {
    // remove all existing windows from the DOM and clear refs (with cleanup)
    windowsRef.current.forEach((w) => {
      try { (w as any)._cleanup?.(); } catch (e) {}
      try { w.remove(); } catch (e) {}
    });
    windowsRef.current = [];
  }

  function hideWindowsStaggered(interval = 80) {
    // hide windows one by one with an instant-feel effect and cleanup
    const wins = [...windowsRef.current];
    wins.forEach((win, i) => {
      setTimeout(() => {
        try { (win as any)._cleanup?.(); } catch (e) {}
        // Instant individual disappearance - use a very short tween for a snappy feel
        gsap.to(win, { opacity: 0, scale: 0.96, duration: 0.06, ease: 'power1.out', onComplete: () => {
          try { win.remove(); } catch (e) {}
          const idx = windowsRef.current.indexOf(win);
          if (idx > -1) windowsRef.current.splice(idx, 1);
        }});
      }, i * interval);
    });
  }

  function spawnWindows() {
    const container = containerRef.current;
    if (!container) return;

    const containerW = container.offsetWidth;
    const containerH = container.offsetHeight;
    const rem = 16;
    // 16:9 aspect ratio
    const aspect = 9 / 16;

    // Make windows 1 & 2 dynamic relative to container size
    let w1 = Math.round(containerW * 0.39); // ~752px at 1920px wide
    let h1 = Math.round(w1 * aspect);

    let w2 = Math.round(containerW * 0.695); // ~1336px at 1920px wide
    let h2 = Math.round(w2 * aspect);

    // Reduce the largest of the two by 15% and shrink the other by 10%
    if (w2 > w1) {
      w2 = Math.round(w2 * 0.85); // largest reduced by 15%
      h2 = Math.round(w2 * aspect);
      w1 = Math.round(w1 * 0.9); // other reduced by 10%
      h1 = Math.round(w1 * aspect);
    } else {
      w1 = Math.round(w1 * 0.85);
      h1 = Math.round(w1 * aspect);
      w2 = Math.round(w2 * 0.9);
      h2 = Math.round(w2 * aspect);
    }

    // Shrink windows 3-6 by 10%
    const w3 = Math.round(18 * rem * 0.9);
    const h3 = Math.round(w3 * aspect);

    const w4 = Math.round(40 * rem * 0.9);
    const h4 = Math.round(w4 * aspect);

    const w5 = Math.round(40 * rem * 0.9);
    const h5 = Math.round(w5 * aspect);

    const w6 = Math.round(24 * rem * 0.9);
    const h6 = Math.round(w6 * aspect);

    // Helper to place windows allowing up to 50% overlap (tries up to 30 times)
    const placed: Array<{ x: number; y: number; w: number; h: number }> = [];
    const pad = Math.round(rem * 1.5); // padding around the page to keep windows in bounds
    function placeWithLimitedOverlap(w: number, h: number) {
      let tries = 0;
      const MAX_TRIES = 30;
      const MAX_OVERLAP_FRAC = 0.5; // allow up to 50% overlap relative to smaller window area

      function overlapFraction(x: number, y: number, r: { x: number; y: number; w: number; h: number }) {
        const overlapX = Math.max(0, Math.min(x + w, r.x + r.w) - Math.max(x, r.x));
        const overlapY = Math.max(0, Math.min(y + h, r.y + r.h) - Math.max(y, r.y));
        const overlapArea = overlapX * overlapY;
        if (overlapArea <= 0) return 0;
        const minArea = Math.min(w * h, r.w * r.h);
        return overlapArea / minArea;
      }

      const maxXRange = Math.max(0, containerW - pad * 2 - w);
      const maxYRange = Math.max(0, containerH - pad * 2 - h);

      while (tries < MAX_TRIES) {
        const x = Math.round(pad + Math.random() * maxXRange);
        const y = Math.round(pad + Math.random() * maxYRange);
        let ok = true;
        for (const r of placed) {
          if (overlapFraction(x, y, r) > MAX_OVERLAP_FRAC) {
            ok = false;
            break;
          }
        }
        if (ok) {
          placed.push({ x, y, w, h });
          return { x, y };
        }
        tries++;
      }

      // fallback: pick position with minimal maximum overlap fraction (sampled)
      let best = { x: pad, y: pad, worst: Infinity };
      for (let i = 0; i < 50; i++) {
        const x = Math.round(pad + Math.random() * maxXRange);
        const y = Math.round(pad + Math.random() * maxYRange);
        let worstFrac = 0;
        for (const r of placed) {
          const frac = overlapFraction(x, y, r);
          if (frac > worstFrac) worstFrac = frac;
        }
        if (worstFrac < best.worst) best = { x, y, worst: worstFrac };
      }
      placed.push({ x: best.x, y: best.y, w, h });
      return { x: best.x, y: best.y };
    }

    const specs = [
      { w: w1, h: h1 },
      { w: w2, h: h2 },
      { w: w3, h: h3 },
      { w: w4, h: h4 },
      { w: w5, h: h5 },
      { w: w6, h: h6 },
    ];

    // Clear existing windows and place new ones randomly
    clearWindows();

    specs.forEach((s, i) => {
      const pos = placeWithLimitedOverlap(s.w, s.h);
      createWindow(pos.x, pos.y, s.w, s.h, i * 0.12);
    });

    // After all windows are created, first show headers for all, then pop windows out from header top-left
    const newWins = [...windowsRef.current];
    const headers = newWins.map((w) => w.querySelector('.window-header') as HTMLElement).filter(Boolean);

    if (headers.length) {
      // show headers instantly (no opacity animation) with a slight stagger
      gsap.to(headers, {
        opacity: 1,
        duration: 0,
        stagger: 0.04,
        onComplete: () => {
          // pop windows out from their header origin with a buttery, smooth animation (no opacity change)
          newWins.forEach((w) => { w.style.transformOrigin = '0 0'; });
          // ensure they start scaled from 0 and slightly above the header for a pop-from-header effect
          gsap.set(newWins, { y: -12, scale: 0 });
          gsap.fromTo(newWins,
            { y: -12, scale: 0 },
            {
              y: 0,
              scale: 1,
              duration: 1.4,
              ease: 'power3.out',
              stagger: 0.08,
            }
          );
        },
      });
    } else {
      // fallback: smooth pop with same buttery feel (no opacity change)
      gsap.set(newWins, { y: -12, scale: 0 });
      gsap.fromTo(newWins,
        { y: -12, scale: 0 },
        {
          y: 0,
          scale: 1,
          duration: 1.4,
          ease: 'power3.out',
          stagger: 0.08,
        }
      );
    }
  }

  /* ================= SCROLL HANDLER ================= */

  useEffect(() => {
    // Ensure only one video change per continuous scroll gesture
    const SCROLL_END_DELAY = 2000; // ms to consider scroll as ended (increased to 2s)
    const scrollLocked = { current: false } as { current: boolean };
    let scrollEndTimer: number | null = null;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();

      // If locked due to an ongoing gesture, ignore further wheel events
      if (scrollLocked.current || isTransitioning.current) {
        // Reset end timer so lock only releases after no wheel for SCROLL_END_DELAY
        if (scrollEndTimer) clearTimeout(scrollEndTimer);
        scrollEndTimer = window.setTimeout(() => {
          scrollLocked.current = false;
          scrollEndTimer = null;
        }, SCROLL_END_DELAY);
        return;
      }

      scrollAccumulator.current += e.deltaY;

      if (Math.abs(scrollAccumulator.current) > SCROLL_THRESHOLD) {
        // Lock further scroll-triggered changes until user stops scrolling
        scrollLocked.current = true;
        if (scrollEndTimer) { clearTimeout(scrollEndTimer); scrollEndTimer = null; }

        isTransitioning.current = true;

        const direction = scrollAccumulator.current > 0 ? 1 : -1;
        let next = currentImage.current + direction;

        if (next >= MEDIA.length) next = 0;
        if (next < 0) next = MEDIA.length - 1;

        // Hide windows one-by-one instantly (staggered) so they disappear individually at the start of the transition
        hideWindowsStaggered(70);

        smoothMediaTransition(next);
        currentImage.current = next;
        scrollAccumulator.current = 0;

        setTimeout(() => {
          // After the media transition completes, respawn windows in new random spots
          spawnWindows();
          isTransitioning.current = false;

          // Start end timer which will unlock scroll after the user stops scrolling for some time
          scrollEndTimer = window.setTimeout(() => {
            scrollLocked.current = false;
            scrollEndTimer = null;
          }, SCROLL_END_DELAY);
        }, 650);
      }
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      window.removeEventListener("wheel", onWheel);
      if (scrollEndTimer) clearTimeout(scrollEndTimer);
    };
  }, []);

  /* ================= MOUNT ================= */

  useEffect(() => {
    setTimeout(spawnWindows, 500);
  }, []);

  return (
    <>
      {/* SVG Filter for Frosted Glass Effect */}
      <svg className="absolute w-0 h-0">
        <defs>
          <filter id="frosted-glass">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.04"
              numOctaves="3"
              result="noise"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale="6"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>

      {/* Header */}
      <div 
        className="fixed top-0 left-0 w-full flex justify-between items-center z-[9998] pointer-events-auto"
        style={{ padding: '32px 48px' }}
      >
        <div className="text-lg md:text-xl tracking-[0.1em] font-medium text-white cursor-default" style={{ fontFamily: '"Climate Crisis", sans-serif' }}>
          INFINITUS
        </div>
        <button
          className="absolute right-0 bg-transparent border-none cursor-pointer flex flex-col gap-1.5 hover:opacity-70 transition-opacity"
          style={{ right: '48px' }}
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
        >
          <span className="block h-[4px] w-18 bg-white" />
          <span className="block h-[4px] w-18 bg-white" />
          {/* <span className="block h-[4px] w-8 bg-white" /> */}
        </button>
      </div>

      {/* Menu Overlay */}
      <MenuOverlay isOpen={menuOpen} onClose={() => setMenuOpen(false)} />

      <div 
        className="relative w-full h-screen overflow-hidden bg-black" 
        ref={containerRef}
      >
        <div 
          className="absolute inset-0"
          style={{
            backgroundImage: "url(/images/hero_background.png)",
            backgroundSize: "cover",
            backgroundPosition: "center",
            opacity: 0.4,
          }}
        />
        <Noise
          patternSize={250}
          patternScaleX={1}
          patternScaleY={1}
          patternRefreshInterval={2}
          patternAlpha={15}
        />
        <div className="absolute left-5 bottom-[15px] text-sm text-white/70">
          Amaravati, IN
        </div>
        <div className="absolute right-5 top-1/2 -translate-y-1/2 rotate-[-90deg] origin-center text-sm text-white/70 whitespace-nowrap tracking-wider">
          16.433"N, 80.550"E
        </div>
      </div>
    </>
  );
}