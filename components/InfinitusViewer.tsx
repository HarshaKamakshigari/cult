"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import Draggable from "gsap/Draggable";
import InertiaPlugin from "gsap/InertiaPlugin";

gsap.registerPlugin(Draggable, InertiaPlugin);

const IMAGES: string[] = [
  "https://images.unsplash.com/photo-1506905925346-21bda4d32df4",
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee",
  "https://images.unsplash.com/photo-1469474968028-56623f02e42e",
  "https://images.unsplash.com/photo-1501785888041-af3ef285b470",
  "https://images.unsplash.com/photo-1518709268805-4e9042af9f23",
];

export default function InfinitusViewer(): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const windowsRef = useRef<HTMLDivElement[]>([]);

  const currentImage = useRef(0);
  const isTransitioning = useRef(false);
  const scrollAccumulator = useRef(0);

  const SCROLL_THRESHOLD = 120;

  /* ================= IMAGE TRANSITION ================= */

 function smoothImageTransition(nextIndex: number) {
  windowsRef.current.forEach((win) => {
    const view = win.querySelector(".window-view") as HTMLDivElement;

    gsap.to(view, {
      opacity: 0,
      duration: 0.3,
      ease: "power2.out",
      onComplete: () => {
        view.style.backgroundImage = `url(${IMAGES[nextIndex]})`;

        gsap.to(view, {
          opacity: 1,
          duration: 0.3,
          ease: "power2.out",
        });
      },
    });
  });
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

    win.innerHTML = `
      <div class="window-header">Infinitus 26</div>
      <div class="window-content">
        <div class="window-view" style="background-image:url('${IMAGES[currentImage.current]}')"></div>
      </div>
    `;

    container.appendChild(win);
    windowsRef.current.push(win);

    const view = win.querySelector(".window-view") as HTMLDivElement;

    gsap.fromTo(
      win,
      {
        x: cx,
        y: cy,
        scale: 0.2,
        opacity: 0,
      },
      {
        x,
        y,
        scale: 1,
        opacity: 1,
        duration: 1.1,
        delay,
        ease: "elastic.out(1, 0.5)",
      }
    );

    gsap.set(view, { x: -x, y: -y });

    Draggable.create(win, {
      type: "x,y",
      bounds: container,
      inertia: false,
      onDrag() {
        gsap.set(view, { x: -this.x, y: -this.y });
      },
    });
  }

  /* ================= INIT WINDOWS ================= */

  function spawnWindows() {
    const offsets = [
      { x: 100, y: 100, w: 580, h: 320 },
      { x: 700, y: 100, w: 240, h: 180 },
      { x: 200, y: 400, w: 320, h: 200 },
      { x: 500, y: 200, w: 700, h: 350 },
      { x: 1000, y: 100, w: 420, h: 240 },
      { x: 1090, y: 400, w: 240, h: 180 },
    ];

    offsets.forEach((o, i) =>
      createWindow(o.x, o.y, o.w, o.h, i * 0.12)
    );
  }

  /* ================= SCROLL HANDLER ================= */

  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (isTransitioning.current) return;

      scrollAccumulator.current += e.deltaY;

      if (Math.abs(scrollAccumulator.current) > SCROLL_THRESHOLD) {
        isTransitioning.current = true;

        const direction = scrollAccumulator.current > 0 ? 1 : -1;
        let next = currentImage.current + direction;

        if (next >= IMAGES.length) next = 0;
        if (next < 0) next = IMAGES.length - 1;

        smoothImageTransition(next);
        currentImage.current = next;
        scrollAccumulator.current = 0;

        setTimeout(() => {
          isTransitioning.current = false;
        }, 650);
      }
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, []);

  /* ================= MOUNT ================= */

  useEffect(() => {
    setTimeout(spawnWindows, 500);
  }, []);

  return (
    <>
      {/* <div className="header">
        <div className="logo">INFINITUS</div>
        <div className="menu-icon">
          <span />
          <span />
          <span />
        </div>
      </div> */}

      <div className="container" ref={containerRef}>
        <div className="location-bottom">Amaravati, IN</div>
        <div className="coordinates-vertical">
          16.433"N, 80.550"E
        </div>
      </div>
    </>
  );
}
