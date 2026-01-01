// "use client";

// import React from 'react';
// import { useEffect, useRef, useState } from "react";
// import gsap from "gsap";
// import { Draggable } from "gsap/all";
// import InertiaPlugin from "gsap/InertiaPlugin";
// import Noise from "./Noise";
// import MenuOverlay from "./MenuOverlay";

// gsap.registerPlugin(Draggable, InertiaPlugin);

// type MediaItem = {
//   type: "image" | "video";
//   src: string;
// };

// const MEDIA: MediaItem[] = [
//   { type: "video", src: "/videos/video-01.mp4" },
//   { type: "video", src: "/videos/video-02.mp4" },
//   { type: "video", src: "/videos/video-03.mp4" },
//   { type: "image", src: "https://images.unsplash.com/photo-1469474968028-56623f02e42e" },
//   { type: "image", src: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23" },
// ];

// export default function InfinitusViewer(): React.JSX.Element {
//   const [menuOpen, setMenuOpen] = useState(false);
//   const containerRef = useRef<HTMLDivElement | null>(null);
//   const windowsRef = useRef<HTMLDivElement[]>([]);

//   const currentImage = useRef(0);
//   const isTransitioning = useRef(false);
//   const scrollAccumulator = useRef(0);

//   const SCROLL_THRESHOLD = 120;

//   function smoothMediaTransition(nextIndex: number) {
//     windowsRef.current.forEach((win) => {
//       const view = win.querySelector(".window-view") as HTMLDivElement;

//       gsap.to(view, {
//         opacity: 0,
//         duration: 0.3,
//         ease: "power2.out",
//         onComplete: () => {
//           const media = MEDIA[nextIndex];
          
//           view.innerHTML = "";
          
//           if (media.type === "video") {
//             const video = document.createElement("video");
//             video.src = media.src;
//             video.autoplay = true;
//             video.loop = true;
//             video.muted = true;
//             video.style.width = "100%";
//             video.style.height = "100%";
//             video.style.objectFit = "cover";
//             view.appendChild(video);
//           } else {
//             view.style.backgroundImage = `url(${media.src})`;
//           }

//           gsap.to(view, {
//             opacity: 1,
//             duration: 0.3,
//             ease: "power2.out",
//           });
//         },
//       });
//     });
//   }

//   function updateCoordinates(win: HTMLDivElement, x: number, y: number) {
//     const header = win.querySelector(".window-header") as HTMLDivElement;
//     if (header) {
//       const xPadded = Math.round(x).toString().padStart(4, '0');
//       const yPadded = Math.round(y).toString().padStart(4, '0');
//       header.textContent = `X:${xPadded}px Y:${yPadded}px`;
//     }
//   }

//   function createWindow(
//     x: number,
//     y: number,
//     w: number,
//     h: number,
//     delay = 0
//   ) {
//     const container = containerRef.current;
//     if (!container) return;

//     const cx = container.offsetWidth / 2 - w / 2;
//     const cy = container.offsetHeight / 2 - h / 2;

//     const win = document.createElement("div");
//     win.className = "window";
//     win.style.width = `${w}px`;
//     win.style.height = `${h}px`;

//     const media = MEDIA[currentImage.current];
    
//     const xPadded = Math.round(x).toString().padStart(4, '0');
//     const yPadded = Math.round(y).toString().padStart(4, '0');
    
//     win.innerHTML = `
//       <div class="window-header">X:${xPadded}px Y:${yPadded}px</div>
//       <div class="window-content">
//         <div class="window-view"></div>
//       </div>
//     `;

//     container.appendChild(win);
//     windowsRef.current.push(win);

//     const view = win.querySelector(".window-view") as HTMLDivElement;
    
//     if (media.type === "video") {
//       const video = document.createElement("video");
//       video.src = media.src;
//       video.autoplay = true;
//       video.loop = true;
//       video.muted = true;
//       video.style.width = "100%";
//       video.style.height = "100%";
//       video.style.objectFit = "cover";
//       view.appendChild(video);
//     } else {
//       view.style.backgroundImage = `url(${media.src})`;
//     }

//     gsap.set(win, { x, y, scale: 0, opacity: 1 });
//     win.style.transformOrigin = '0 0';

//     const headerEl = win.querySelector('.window-header') as HTMLElement;
//     if (headerEl) {
//       headerEl.style.opacity = '0';
//       headerEl.style.transformOrigin = '0 0';
//     }

//     gsap.set(view, { x: -x, y: -y });

//     let currentX = x;
//     let currentY = y;
//     let targetX = x;
//     let targetY = y;
    
//     const tickerCallback = () => {
//       currentX += (targetX - currentX) * 0.15;
//       currentY += (targetY - currentY) * 0.15;
      
//       gsap.set(win, { x: currentX, y: currentY });
//       view.style.transform = `translate(${-currentX}px, ${-currentY}px)`;
//       updateCoordinates(win, currentX, currentY);
//     };
    
//     gsap.ticker.add(tickerCallback);

//     const dragInstances = Draggable.create(win, {
//       type: "x,y",
//       bounds: container,
//       inertia: true,
//       allowEventDefault: true,
//       onDrag() {
//         targetX = this.x;
//         targetY = this.y;
//         gsap.set(this.target, { x: currentX, y: currentY });
//       },
//     });

//     const dragInstance = dragInstances && dragInstances[0];

//     (win as any)._cleanup = () => {
//       try { gsap.ticker.remove(tickerCallback); } catch (e) {}
//       try { if (dragInstance && typeof dragInstance.kill === 'function') dragInstance.kill(); } catch (e) {}
//       try { gsap.killTweensOf(win); } catch (e) {}
//     };
//   }

//   function clearWindows() {
//     windowsRef.current.forEach((w) => {
//       try { (w as any)._cleanup?.(); } catch (e) {}
//       try { w.remove(); } catch (e) {}
//     });
//     windowsRef.current = [];
//   }

//   function hideWindowsStaggered(interval = 80) {
//     const wins = [...windowsRef.current];
//     wins.forEach((win, i) => {
//       setTimeout(() => {
//         try { (win as any)._cleanup?.(); } catch (e) {}
//         gsap.to(win, { opacity: 0, scale: 0.96, duration: 0.06, ease: 'power1.out', onComplete: () => {
//           try { win.remove(); } catch (e) {}
//           const idx = windowsRef.current.indexOf(win);
//           if (idx > -1) windowsRef.current.splice(idx, 1);
//         }});
//       }, i * interval);
//     });
//   }

//   function spawnWindows() {
//     const container = containerRef.current;
//     if (!container) return;

//     const containerW = container.offsetWidth;
//     const containerH = container.offsetHeight;
//     const rem = 16;
//     const aspect = 9 / 16;

//     let w1 = Math.round(containerW * 0.39);
//     let h1 = Math.round(w1 * aspect);

//     let w2 = Math.round(containerW * 0.695);
//     let h2 = Math.round(w2 * aspect);

//     if (w2 > w1) {
//       w2 = Math.round(w2 * 0.85);
//       h2 = Math.round(w2 * aspect);
//       w1 = Math.round(w1 * 0.9);
//       h1 = Math.round(w1 * aspect);
//     } else {
//       w1 = Math.round(w1 * 0.85);
//       h1 = Math.round(w1 * aspect);
//       w2 = Math.round(w2 * 0.9);
//       h2 = Math.round(w2 * aspect);
//     }

//     const w3 = Math.round(18 * rem * 0.9);
//     const h3 = Math.round(w3 * aspect);

//     const w4 = Math.round(40 * rem * 0.9);
//     const h4 = Math.round(w4 * aspect);

//     const w5 = Math.round(40 * rem * 0.9);
//     const h5 = Math.round(w5 * aspect);

//     const w6 = Math.round(24 * rem * 0.9);
//     const h6 = Math.round(w6 * aspect);

//     const placed: Array<{ x: number; y: number; w: number; h: number }> = [];
//     const pad = Math.round(rem * 1.5);
//     function placeWithLimitedOverlap(w: number, h: number) {
//       let tries = 0;
//       const MAX_TRIES = 30;
//       const MAX_OVERLAP_FRAC = 0.5;

//       function overlapFraction(x: number, y: number, r: { x: number; y: number; w: number; h: number }) {
//         const overlapX = Math.max(0, Math.min(x + w, r.x + r.w) - Math.max(x, r.x));
//         const overlapY = Math.max(0, Math.min(y + h, r.y + r.h) - Math.max(y, r.y));
//         const overlapArea = overlapX * overlapY;
//         if (overlapArea <= 0) return 0;
//         const minArea = Math.min(w * h, r.w * r.h);
//         return overlapArea / minArea;
//       }

//       const maxXRange = Math.max(0, containerW - pad * 2 - w);
//       const maxYRange = Math.max(0, containerH - pad * 2 - h);

//       while (tries < MAX_TRIES) {
//         const x = Math.round(pad + Math.random() * maxXRange);
//         const y = Math.round(pad + Math.random() * maxYRange);
//         let ok = true;
//         for (const r of placed) {
//           if (overlapFraction(x, y, r) > MAX_OVERLAP_FRAC) {
//             ok = false;
//             break;
//           }
//         }
//         if (ok) {
//           placed.push({ x, y, w, h });
//           return { x, y };
//         }
//         tries++;
//       }

//       let best = { x: pad, y: pad, worst: Infinity };
//       for (let i = 0; i < 50; i++) {
//         const x = Math.round(pad + Math.random() * maxXRange);
//         const y = Math.round(pad + Math.random() * maxYRange);
//         let worstFrac = 0;
//         for (const r of placed) {
//           const frac = overlapFraction(x, y, r);
//           if (frac > worstFrac) worstFrac = frac;
//         }
//         if (worstFrac < best.worst) best = { x, y, worst: worstFrac };
//       }
//       placed.push({ x: best.x, y: best.y, w, h });
//       return { x: best.x, y: best.y };
//     }

//     const specs = [
//       { w: w1, h: h1 },
//       { w: w2, h: h2 },
//       { w: w3, h: h3 },
//       { w: w4, h: h4 },
//       { w: w5, h: h5 },
//       { w: w6, h: h6 },
//     ];

//     clearWindows();

//     specs.forEach((s, i) => {
//       const pos = placeWithLimitedOverlap(s.w, s.h);
//       createWindow(pos.x, pos.y, s.w, s.h, i * 0.12);
//     });

//     const newWins = [...windowsRef.current];
//     const headers = newWins.map((w) => w.querySelector('.window-header') as HTMLElement).filter(Boolean);

//     if (headers.length) {
//       gsap.to(headers, {
//         opacity: 1,
//         duration: 0,
//         stagger: 0.04,
//         onComplete: () => {
//           newWins.forEach((w) => { w.style.transformOrigin = '0 0'; });
//           gsap.set(newWins, { y: -12, scale: 0 });
//           gsap.fromTo(newWins,
//             { y: -12, scale: 0 },
//             {
//               y: 0,
//               scale: 1,
//               duration: 1.4,
//               ease: 'power3.out',
//               stagger: 0.08,
//             }
//           );
//         },
//       });
//     } else {
//       gsap.set(newWins, { y: -12, scale: 0 });
//       gsap.fromTo(newWins,
//         { y: -12, scale: 0 },
//         {
//           y: 0,
//           scale: 1,
//           duration: 1.4,
//           ease: 'power3.out',
//           stagger: 0.08,
//         }
//       );
//     }
//   }

//   useEffect(() => {
//     const SCROLL_END_DELAY = 2000;
//     const scrollLocked = { current: false } as { current: boolean };
//     let scrollEndTimer: number | null = null;

//     const onWheel = (e: WheelEvent) => {
//       e.preventDefault();

//       if (scrollLocked.current || isTransitioning.current) {
//         if (scrollEndTimer) clearTimeout(scrollEndTimer);
//         scrollEndTimer = window.setTimeout(() => {
//           scrollLocked.current = false;
//           scrollEndTimer = null;
//         }, SCROLL_END_DELAY);
//         return;
//       }

//       scrollAccumulator.current += e.deltaY;

//       if (Math.abs(scrollAccumulator.current) > SCROLL_THRESHOLD) {
//         scrollLocked.current = true;
//         if (scrollEndTimer) { clearTimeout(scrollEndTimer); scrollEndTimer = null; }

//         isTransitioning.current = true;

//         const direction = scrollAccumulator.current > 0 ? 1 : -1;
//         let next = currentImage.current + direction;

//         if (next >= MEDIA.length) next = 0;
//         if (next < 0) next = MEDIA.length - 1;

//         hideWindowsStaggered(70);

//         smoothMediaTransition(next);
//         currentImage.current = next;
//         scrollAccumulator.current = 0;

//         setTimeout(() => {
//           spawnWindows();
//           isTransitioning.current = false;

//           scrollEndTimer = window.setTimeout(() => {
//             scrollLocked.current = false;
//             scrollEndTimer = null;
//           }, SCROLL_END_DELAY);
//         }, 650);
//       }
//     };

//     window.addEventListener("wheel", onWheel, { passive: false });
//     return () => {
//       window.removeEventListener("wheel", onWheel);
//       if (scrollEndTimer) clearTimeout(scrollEndTimer);
//     };
//   }, []);

//   useEffect(() => {
//     setTimeout(spawnWindows, 500);
//   }, []);

//   return (
//     <>
//       <svg className="absolute w-0 h-0">
//         <defs>
//           <filter id="frosted-glass">
//             <feTurbulence
//               type="fractalNoise"
//               baseFrequency="0.04"
//               numOctaves="3"
//               result="noise"
//             />
//             <feDisplacementMap
//               in="SourceGraphic"
//               in2="noise"
//               scale="6"
//               xChannelSelector="R"
//               yChannelSelector="G"
//             />
//           </filter>
//         </defs>
//       </svg>

//       {/* Header */}
//       <div 
//         className="fixed top-0 left-0 w-full flex justify-between items-center z-[9998] pointer-events-auto"
//         style={{ padding: '32px 48px' }}
//       >
//         <div className="text-lg md:text-xl tracking-[0.1em] font-medium text-white cursor-default" style={{ fontFamily: '"Climate Crisis", sans-serif' }}>
//           INFINITUS
//         </div>
//         <button
//           className="absolute right-0 bg-transparent border-none cursor-pointer flex flex-col gap-1.5 hover:text-red-500 transition-opacity"
//           style={{ right: '48px' }}
//           onClick={() => setMenuOpen(true)}
//           aria-label="Open menu"
//         >
//           {/* <span className="block h-[4px] w-18 bg-white" />
//           <span className="block h-[4px] w-18 bg-white" /> */}
//           {/* <span className="block h-[4px] w-8 bg-white" /> */}
//           <h1>Menu</h1>
//         </button>
//       </div>

//       {/* Menu Overlay */}
//       <MenuOverlay isOpen={menuOpen} onClose={() => setMenuOpen(false)} />

//       <div 
//         className="relative w-full h-screen overflow-hidden bg-black" 
//         ref={containerRef}
//       >
//         <div 
//           className="absolute inset-0"
//           style={{
//             backgroundImage: "url(/images/hero_background.png)",
//             backgroundSize: "cover",
//             backgroundPosition: "center",
//             opacity: 0.4,
//           }}
//         />
//         <Noise
//           patternSize={250}
//           patternScaleX={1}
//           patternScaleY={1}
//           patternRefreshInterval={2}
//           patternAlpha={15}
//         />
        
//         <div className="absolute left-5 bottom-[15px] text-sm text-white/70">
//           Amaravati, IN
//         </div>
//         <div className="absolute right-5 top-1/2 -translate-y-1/2 rotate-[-90deg] origin-center text-sm text-white/70 whitespace-nowrap tracking-wider">
//           16.433"N, 80.550"E
//         </div>
//       </div>
//     </>
//   );
// }

"use client";

import React from 'react';
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { Draggable } from "gsap/all";
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

export default function InfinitusViewer(): React.JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const windowsRef = useRef<HTMLDivElement[]>([]);

  const currentImage = useRef(0);
  const isTransitioning = useRef(false);
  const scrollAccumulator = useRef(0);

  const SCROLL_THRESHOLD = 120;

  function smoothMediaTransition(nextIndex: number) {
    windowsRef.current.forEach((win) => {
      const view = win.querySelector(".window-view") as HTMLDivElement;

      gsap.to(view, {
        opacity: 0,
        duration: 0.3,
        ease: "power2.out",
        onComplete: () => {
          const media = MEDIA[nextIndex];
          
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

  function updateCoordinates(win: HTMLDivElement, x: number, y: number) {
    const header = win.querySelector(".window-header") as HTMLDivElement;
    if (header) {
      const xPadded = Math.round(x).toString().padStart(4, '0');
      const yPadded = Math.round(y).toString().padStart(4, '0');
      header.textContent = `X:${xPadded}px Y:${yPadded}px`;
    }
  }

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

    gsap.set(win, { x, y, scale: 0, opacity: 1 });
    win.style.transformOrigin = '0 0';

    const headerEl = win.querySelector('.window-header') as HTMLElement;
    if (headerEl) {
      headerEl.style.opacity = '0';
      headerEl.style.transformOrigin = '0 0';
    }

    gsap.set(view, { x: -x, y: -y });

    let currentX = x;
    let currentY = y;
    let targetX = x;
    let targetY = y;
    
    const tickerCallback = () => {
      currentX += (targetX - currentX) * 0.15;
      currentY += (targetY - currentY) * 0.15;
      
      gsap.set(win, { x: currentX, y: currentY });
      view.style.transform = `translate(${-currentX}px, ${-currentY}px)`;
      updateCoordinates(win, currentX, currentY);
    };
    
    gsap.ticker.add(tickerCallback);

    const dragInstances = Draggable.create(win, {
      type: "x,y",
      bounds: container,
      inertia: true,
      allowEventDefault: true,
      onDrag() {
        targetX = this.x;
        targetY = this.y;
        gsap.set(this.target, { x: currentX, y: currentY });
      },
    });

    const dragInstance = dragInstances && dragInstances[0];

    (win as any)._cleanup = () => {
      try { gsap.ticker.remove(tickerCallback); } catch (e) {}
      try { if (dragInstance && typeof dragInstance.kill === 'function') dragInstance.kill(); } catch (e) {}
      try { gsap.killTweensOf(win); } catch (e) {}
    };
  }

  function clearWindows() {
    windowsRef.current.forEach((w) => {
      try { (w as any)._cleanup?.(); } catch (e) {}
      try { w.remove(); } catch (e) {}
    });
    windowsRef.current = [];
  }

  function hideWindowsStaggered(interval = 80) {
    const wins = [...windowsRef.current];
    wins.forEach((win, i) => {
      setTimeout(() => {
        try { (win as any)._cleanup?.(); } catch (e) {}
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
    const aspect = 9 / 16;

    let w1 = Math.round(containerW * 0.39);
    let h1 = Math.round(w1 * aspect);

    let w2 = Math.round(containerW * 0.695);
    let h2 = Math.round(w2 * aspect);

    if (w2 > w1) {
      w2 = Math.round(w2 * 0.85);
      h2 = Math.round(w2 * aspect);
      w1 = Math.round(w1 * 0.9);
      h1 = Math.round(w1 * aspect);
    } else {
      w1 = Math.round(w1 * 0.85);
      h1 = Math.round(w1 * aspect);
      w2 = Math.round(w2 * 0.9);
      h2 = Math.round(w2 * aspect);
    }

    const w3 = Math.round(18 * rem * 0.9);
    const h3 = Math.round(w3 * aspect);

    const w4 = Math.round(40 * rem * 0.9);
    const h4 = Math.round(w4 * aspect);

    const w5 = Math.round(40 * rem * 0.9);
    const h5 = Math.round(w5 * aspect);

    const w6 = Math.round(24 * rem * 0.9);
    const h6 = Math.round(w6 * aspect);

    const placed: Array<{ x: number; y: number; w: number; h: number }> = [];
    const pad = Math.round(rem * 1.5);
    function placeWithLimitedOverlap(w: number, h: number) {
      let tries = 0;
      const MAX_TRIES = 30;
      const MAX_OVERLAP_FRAC = 0.5;

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

    clearWindows();

    specs.forEach((s, i) => {
      const pos = placeWithLimitedOverlap(s.w, s.h);
      createWindow(pos.x, pos.y, s.w, s.h, i * 0.12);
    });

    const newWins = [...windowsRef.current];
    const headers = newWins.map((w) => w.querySelector('.window-header') as HTMLElement).filter(Boolean);

    if (headers.length) {
      gsap.to(headers, {
        opacity: 1,
        duration: 0,
        stagger: 0.04,
        onComplete: () => {
          newWins.forEach((w) => { w.style.transformOrigin = '0 0'; });
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

  useEffect(() => {
    const SCROLL_END_DELAY = 2000;
    const scrollLocked = { current: false } as { current: boolean };
    let scrollEndTimer: number | null = null;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();

      if (scrollLocked.current || isTransitioning.current) {
        if (scrollEndTimer) clearTimeout(scrollEndTimer);
        scrollEndTimer = window.setTimeout(() => {
          scrollLocked.current = false;
          scrollEndTimer = null;
        }, SCROLL_END_DELAY);
        return;
      }

      scrollAccumulator.current += e.deltaY;

      if (Math.abs(scrollAccumulator.current) > SCROLL_THRESHOLD) {
        scrollLocked.current = true;
        if (scrollEndTimer) { clearTimeout(scrollEndTimer); scrollEndTimer = null; }

        isTransitioning.current = true;

        const direction = scrollAccumulator.current > 0 ? 1 : -1;
        let next = currentImage.current + direction;

        if (next >= MEDIA.length) next = 0;
        if (next < 0) next = MEDIA.length - 1;

        hideWindowsStaggered(70);

        smoothMediaTransition(next);
        currentImage.current = next;
        scrollAccumulator.current = 0;

        setTimeout(() => {
          spawnWindows();
          isTransitioning.current = false;

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

  useEffect(() => {
    setTimeout(spawnWindows, 500);
  }, []);

  return (
    <>
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
        className="fixed top-0 left-0 w-full flex justify-between items-center z-[40] pointer-events-auto"
        style={{ padding: '32px 48px' }}
      >
        <div className="text-lg md:text-xl tracking-[0.1em] font-medium text-white cursor-default" style={{ fontFamily: '"Climate Crisis", sans-serif' }}>
          INFINITUS
        </div>
        <button
          className="absolute right-0 bg-transparent border-none cursor-pointer flex flex-col gap-1.5 hover:text-red-500 transition-opacity z-[41]"
          style={{ right: '48px' }}
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
        >
          <h1>Menu</h1>
        </button>
      </div>

      {/* Menu Overlay - Should have highest z-index when open */}
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
        
        {/* Bottom Left Content - Added as per image */}
        <div className="fixed left-12 bottom-0 z-[30] pointer-events-auto p-8">
          <div className="flex flex-col items-start gap-4" style={{ marginBottom: '30px' }}>
            {/* Fest Title */}
            <div className="text-white uppercase tracking-[0.2em] leading-tight mb-6" >
              <div className="text-4xl md:text-5xl font-light" style={{ fontFamily: '"Climate Crisis", sans-serif', marginBottom: '10px' }} >
                NATIONAL
              </div>
              <div className="text-4xl md:text-5xl font-bold ml-6" style={{ fontFamily: '"Climate Crisis", sans-serif' }}>
                TECHNO<span className='text-red-500'>-</span>CULTURAL FEST<span className='text-red-500'>'</span>26
              </div>
            </div>
           
            <button
              className="mt-6 bg-red-700 text-white font-semibold tracking-wider text-lg uppercase hover:bg-white hover:text-black transition-all duration-300"
              style={{ 
                fontFamily: '"Space Grotesk", sans-serif', 
                letterSpacing: '0.1em',
                padding: '10px 20px'
              }}
              onClick={() => {
                window.open('https://register.infinitus.com', '_blank');
              }}
            >
              Register Now
            </button>
          </div>
        </div>
        
        <div className="absolute right-12 bottom-[15px] text-sm text-white/70 z-[30]">
          Amaravati, IN
        </div>
        <div className="absolute right-0 top-1/2 z-[30] -translate-y-1/2 rotate-[-90deg] origin-center text-sm text-white/70 whitespace-nowrap tracking-wider">
          16.433"<span className='text-red-500'>N</span>, 80.550"<span className='text-red-500'>E</span>
        </div>
      </div>
    </>
  );
}