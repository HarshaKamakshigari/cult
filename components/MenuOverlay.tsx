"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

interface MenuOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

const LINKS = ["Home", "About", "Gallery", "Events", "Contact"];

export default function MenuOverlay({
  isOpen,
  onClose,
}: MenuOverlayProps): JSX.Element {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const navRefs = useRef<HTMLAnchorElement[]>([]);
  const imageRef = useRef<HTMLDivElement | null>(null);
  const mounted = useRef(false);

  useEffect(() => {
    if (!overlayRef.current) return;

    if (!mounted.current) {
      gsap.set(overlayRef.current, { y: "100%" });
      mounted.current = true;
      return;
    }

    if (isOpen) {
      gsap.to(overlayRef.current, {
        y: 0,
        duration: 1.1,
        ease: "expo.out",
      });

      gsap.fromTo(
        navRefs.current,
        { y: 80, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          stagger: 0.12,
          delay: 0.3,
          duration: 1,
          ease: "power4.out",
        }
      );

      gsap.fromTo(
        imageRef.current,
        { scale: 1.15, opacity: 0 },
        {
          scale: 1,
          opacity: 1,
          duration: 1.4,
          ease: "power3.out",
          delay: 0.2,
        }
      );
    } else {
      gsap.to(overlayRef.current, {
        y: "100%",
        duration: 0.9,
        ease: "expo.in",
      });
    }
  }, [isOpen]);

  return (
    <div ref={overlayRef} className="menu-overlay-aww">
      {/* LEFT — NAV */}
      <div className="menu-aww-left">
        {LINKS.map((text, i) => (
          <a
            key={text}
            ref={(el) => {
              if (el) navRefs.current[i] = el;
            }}
            onClick={onClose}
            className="menu-aww-link"
          >
            <span>{text}</span>
          </a>
        ))}
      </div>

      {/* RIGHT — IMAGE */}
      <div className="menu-aww-right">
        <div
          ref={imageRef}
          className="menu-aww-image"
          style={{
            backgroundImage: "url('/menu-image.jpg')",
          }}
        />
      </div>

      {/* CLOSE */}
      <button className="menu-aww-close" onClick={onClose}>
        CLOSE
      </button>
    </div>
  );
}
