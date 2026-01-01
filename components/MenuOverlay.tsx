"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import gsap from "gsap";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

const LINKS = [
  "Home", "About", "Gallery", "Events", "Contact",
  "Home", "About", "Gallery", "Events", "Contact",
  "Home", "About", "Gallery", "Events", "Contact",
  "Home", "About", "Gallery", "Events", "Contact",
  "Home", "About", "Gallery", "Events", "Contact",
  "Home", "About", "Gallery", "Events", "Contact"
];

const vertexShader = `
  uniform float uStretchFactor;
  uniform vec2 uViewportSizes;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vec3 newPosition = position;
    
    vec4 worldPos = modelMatrix * vec4(newPosition, 1.0);
    vec4 viewPos = viewMatrix * worldPos;
    
    viewPos.y *= uStretchFactor;

    gl_Position = projectionMatrix * viewPos;
  }
`;

const fragmentShader = `
  uniform sampler2D uTexture;
  varying vec2 vUv;

  void main() {
    vec4 color = texture2D(uTexture, vUv);
    if(color.a < 0.1) discard; 
    gl_FragColor = color;
  }
`;

// Optimized texture creation with caching
const textureCache = new Map<string, THREE.CanvasTexture>();

function createTextTexture(text: string, color: string = "white"): THREE.CanvasTexture {
  const cacheKey = `${text}-${color}`;
  
  if (textureCache.has(cacheKey)) {
    return textureCache.get(cacheKey)!;
  }
  
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { alpha: true, willReadFrequently: false });
  
  if (!ctx) {
    throw new Error("Could not get 2D context");
  }
  
  // Higher resolution for crisp text (using device pixel ratio)
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const baseWidth = 1024;
  const baseHeight = 256;
  canvas.width = baseWidth * dpr;
  canvas.height = baseHeight * dpr;
  
  // Scale context to account for DPR
  ctx.scale(dpr, dpr);
  
  ctx.clearRect(0, 0, baseWidth, baseHeight);
  
  // Enable text antialiasing
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  
  ctx.font = "400 120px Anton";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.fillText(text.toUpperCase(), 250, baseHeight / 2);
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearMipMapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 16;
  texture.needsUpdate = true;
  
  textureCache.set(cacheKey, texture);
  
  return texture;
}

interface StretchItemProps {
  text: string;
  index: number;
  velocityRef: React.MutableRefObject<number>;
  positionRef: React.MutableRefObject<number>;
  itemHeight: number;
  loopHeight: number;
  isHovered: boolean;
  onHover: (index: number | null) => void;
  onClick: () => void;
}

const StretchItem: React.FC<StretchItemProps> = ({ 
  text, 
  index, 
  velocityRef, 
  positionRef,
  itemHeight,
  loopHeight,
  isHovered,
  onHover,
  onClick
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const { viewport } = useThree();
  
  // Cache textures
  const whiteTexture = useMemo(() => createTextTexture(text, "white"), [text]);
  const redTexture = useMemo(() => createTextTexture(text, "#ff0000"), [text]);
  
  const uniforms = useMemo(() => ({
    uTexture: { value: whiteTexture },
    uStretchFactor: { value: 1.0 },
    uViewportSizes: { value: new THREE.Vector2(viewport.width, viewport.height) },
  }), [whiteTexture, viewport]);

  useFrame((state) => {
    if (!meshRef.current) return;

    const material = meshRef.current.material as THREE.ShaderMaterial;
    material.uniforms.uTexture.value = isHovered ? redTexture : whiteTexture;

    const velocity = velocityRef.current;
    const scrollDirection = Math.sign(velocity);
    
    const rawY = index * itemHeight - positionRef.current;
    let y = ((rawY % loopHeight) + loopHeight) % loopHeight;
    if (y > loopHeight / 2) y -= loopHeight;
    
    const viewportY = (y / window.innerHeight) * viewport.height * 2;
    
    const centerY = 0;
    const distanceFromCenter = Math.abs(viewportY - centerY);
    const maxDistance = viewport.height;
    
    let stretchFactor = 1.0;
    
    if (Math.abs(velocity) > 0.01) {
      const velocityMagnitude = Math.min(Math.abs(velocity), 10);
      const normalizedVelocity = velocityMagnitude / 40;
      
      if (scrollDirection > 0) {
        if (viewportY > centerY) {
          const distanceRatio = Math.min(distanceFromCenter / maxDistance, 1);
          stretchFactor = 1.0 - (distanceRatio * 1.5 * normalizedVelocity);
        } else {
          const distanceRatio = Math.min(distanceFromCenter / maxDistance, 1);
          const reverseFactor = 1.0 - distanceRatio;
          stretchFactor = 1.0 + (reverseFactor * 1.5* normalizedVelocity);
        }
      } else {
        if (viewportY < centerY) {
          const distanceRatio = Math.min(distanceFromCenter / maxDistance, 1);
          stretchFactor = 1.0 - (distanceRatio * 1.5* normalizedVelocity);
        } else {
          const distanceRatio = Math.min(distanceFromCenter / maxDistance, 1);
          const reverseFactor = 1.0 - distanceRatio;
          stretchFactor = 1.0 + (reverseFactor * 1.5* normalizedVelocity);
        }
      }
    }
    
    stretchFactor = Math.max(0, Math.min(stretchFactor, 10));
    
    material.uniforms.uStretchFactor.value = THREE.MathUtils.lerp(
      material.uniforms.uStretchFactor.value,
      stretchFactor,
      0.15
    );

    material.uniforms.uViewportSizes.value.set(
      state.viewport.width, 
      state.viewport.height
    );
    
    meshRef.current.position.x = 0;
    meshRef.current.position.y = viewportY;
    
    meshRef.current.scale.set(1, 1, 1);
    material.opacity = 1;
  });

  return (
    <mesh 
      ref={meshRef} 
      position={[0, 0, 0]}
      onPointerEnter={() => onHover(index)}
      onPointerLeave={() => onHover(null)}
      onClick={onClick}
    >
      <planeGeometry args={[5, 1.2, 32, 32]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent={true}
      />
    </mesh>
  );
};

interface StretchSceneProps {
  velocityRef: React.MutableRefObject<number>;
  positionRef: React.MutableRefObject<number>;
  itemHeight: number;
  loopHeight: number;
  hoveredIndex: number | null;
  onHover: (index: number | null) => void;
  onClose: () => void;
}

const StretchScene: React.FC<StretchSceneProps> = ({ 
  velocityRef, 
  positionRef,
  itemHeight,
  loopHeight,
  hoveredIndex,
  onHover,
  onClose
}) => {
  return (
    <>
      {LINKS.map((text, i) => (
        <StretchItem 
          key={i}
          text={text}
          index={i}
          velocityRef={velocityRef}
          positionRef={positionRef}
          itemHeight={itemHeight}
          loopHeight={loopHeight}
          isHovered={hoveredIndex === i}
          onHover={onHover}
          onClick={onClose}
        />
      ))}
    </>
  );
};

export default function MenuOverlay({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const hoverImageRefs = useRef<(HTMLDivElement | null)[]>([]);

  const position = useRef(0);
  const velocity = useRef(0);
  const lastTime = useRef(0);
  const animationId = useRef<number | null>(null);
  const targetPosition = useRef(0);

  const ITEM_HEIGHT = 70;
  const LOOP_HEIGHT = ITEM_HEIGHT * LINKS.length;

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (!overlayRef.current) return;

    if (isOpen) {
      overlayRef.current.style.display = 'flex';
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

  /* ================= OPTIMIZED HOVER EFFECTS ================= */

  const handleMouseEnter = (index: number) => {
    if (isMobile) return;
    setHoveredIndex(index);
    
    const hoverImg = hoverImageRefs.current[index];
    if (hoverImg) {
      // Simple, performant animation
      gsap.killTweensOf(hoverImg);
      gsap.set(hoverImg, { scale: 0, opacity: 0 });
      
      gsap.to(hoverImg, {
        scale: 1,
        opacity: 1,
        duration: 0.3,
        ease: "power2.out"
      });
    }
  };

  const handleMouseLeave = (index: number) => {
    if (isMobile) return;
    setHoveredIndex(null);
    
    const hoverImg = hoverImageRefs.current[index];
    if (hoverImg) {
      gsap.to(hoverImg, {
        scale: 0,
        opacity: 0,
        duration: 0.2,
        ease: "power2.in"
      });
    }
  };

  const startAnimation = () => {
    if (animationId.current) return;
    
    lastTime.current = performance.now();
    targetPosition.current = position.current;
    
    const animate = (currentTime: number) => {
      if (!animationId.current) return;
      
      const deltaTime = Math.min(currentTime - lastTime.current, 32) / 16;
      lastTime.current = currentTime;
      
      velocity.current *= 0.95;
      targetPosition.current += velocity.current * deltaTime;
      position.current += (targetPosition.current - position.current) * 0.06;
      
      if (position.current < 0) {
        position.current += LOOP_HEIGHT;
        targetPosition.current += LOOP_HEIGHT;
      }
      if (position.current > LOOP_HEIGHT) {
        position.current -= LOOP_HEIGHT;
        targetPosition.current -= LOOP_HEIGHT;
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
      
      const timeWeight = Math.min(timeDiff / 16, 2);
      accumulatedDeltaY += e.deltaY * timeWeight;
      
      const scrollSpeed = Math.abs(e.deltaY);
      const isFastScroll = scrollSpeed > 50;
      
      const speedMultiplier = isFastScroll ? 0.156 : 0.084;
      const baseVelocity = accumulatedDeltaY * speedMultiplier;
      
      const easingPower = isFastScroll ? 0.88 : 0.95;
      const easedVelocity = Math.sign(baseVelocity) * 
                           Math.pow(Math.abs(baseVelocity), easingPower);
      
      velocity.current += easedVelocity;
      
      const maxVelocity = isFastScroll ? 35 : 18;
      if (Math.abs(velocity.current) > maxVelocity) {
        velocity.current = Math.sign(velocity.current) * maxVelocity;
      }
      
      accumulatedDeltaY = 0;
      
      if (wheelTimeout) clearTimeout(wheelTimeout);
      wheelTimeout = setTimeout(() => {
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
      velocity.current *= 0.3;
      targetPosition.current = position.current;
    };
    
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      
      const currentTime = performance.now();
      const deltaTime = Math.max(currentTime - lastDragTime, 1);
      const deltaY = lastDragY - e.clientY;
      const immediateVelocity = deltaY / deltaTime * 40;
      
      dragVelocities.push(immediateVelocity);
      if (dragVelocities.length > MAX_VELOCITY_HISTORY) {
        dragVelocities.shift();
      }
      
      position.current = startPosition + (startY - e.clientY) * 1.5;
      
      if (position.current < 0) position.current += LOOP_HEIGHT;
      else if (position.current > LOOP_HEIGHT) position.current -= LOOP_HEIGHT;
      
      targetPosition.current = position.current;
      lastDragY = e.clientY;
      lastDragTime = currentTime;
    };
    
    const onMouseUp = () => {
      if (!isDragging) return;
      
      if (dragVelocities.length > 0) {
        const avgVelocity = dragVelocities.reduce((a, b) => a + b, 0) / dragVelocities.length;
        velocity.current = avgVelocity * 0.7;
        
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

  return (
    <>
      <div ref={overlayRef} className="menu" style={{ display: 'none' }}>
        <div className="menu-left">
          {isMobile ? (
            <div className="menu-column">
              {LINKS.map((text, i) => (
                <div 
                  key={`mobile-${i}`}
                  className="menu-item mobile" 
                  onClick={onClose}
                >
                  {text}
                  <div className="mobile-indicator"></div>
                </div>
              ))}
            </div>
          ) : (
            <>
              <Canvas 
                camera={{ position: [0, 0, 5], fov: 50 }}
                dpr={[1, 1.5]}
                performance={{ min: 0.5 }}
              >
                <StretchScene 
                  velocityRef={velocity}
                  positionRef={position}
                  itemHeight={ITEM_HEIGHT}
                  loopHeight={LOOP_HEIGHT}
                  hoveredIndex={hoveredIndex}
                  onHover={setHoveredIndex}
                  onClose={onClose}
                />
              </Canvas>
              
              {/* Hover images overlay */}
              <div className="hover-images-container">
                {LINKS.map((text, i) => (
                  <div
                    key={`hover-${i}`}
                    ref={(el) => { hoverImageRefs.current[i] = el; }}
                    className="hover-image"
                    onMouseEnter={() => handleMouseEnter(i)}
                    onMouseLeave={() => handleMouseLeave(i)}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {!isMobile && (
          <div className="menu-right flex items-center justify-center">
            <div className="flex flex-col items-center justify-center gap-8 w-[100%]">
              {/* Video Section */}
              <div className="w-full h-[70vh] relative overflow-hidden rounded-lg">
                <video 
                  className="w-full h-full object-cover"
                  autoPlay 
                  loop 
                  muted 
                  playsInline
                >
                  <source src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4" type="video/mp4" />
                </video>
              </div>
              
              {/* Options Below Video */}
              <div className="flex items-center justify-center gap-6" style={{fontFamily:'monospace'}}>
                <button className="px-6 py-3 bg-transparent  text-white text-sm tracking-widest hover:border-white/40 hover:text-red-500 transition-all duration-300">
                  OPTION 01
                </button>
                <button className="px-6 py-3 bg-transparent  text-white text-sm tracking-widest hover:border-white/40 hover:text-red-500 transition-all duration-300">
                  OPTION 02
                </button>
                <button className="px-6 py-3 bg-transparent  text-white text-sm tracking-widest hover:border-white/40 hover:text-red-500 transition-all duration-300">
                  OPTION 03
                </button>
              </div>
            </div>
          </div>
        )}

        <button className="menu-close" onClick={onClose}>
          <h1>CLOSE</h1>
        </button>
      </div>

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

        .menu-left {
          width: 40%;
          height: 100%;
          display: flex;
          justify-content: center;
          overflow: hidden;
          user-select: none;
          -webkit-user-select: none;
          position: relative;
        }

        .menu-left :global(canvas) {
          width: 100% !important;
          height: 100% !important;
          cursor: pointer;
        }

        .hover-images-container {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 10;
        }

        .hover-image {
          position: absolute;
          right: 5%;
          top: 50%;
          width: 80px;
          height: 80px;
          background-image: url("https://images.unsplash.com/photo-1506905925346-21bda4d32df4");
          background-size: cover;
          background-position: center;
          border-radius: 4px;
          transform: translateY(-50%) scale(0);
          opacity: 0;
          pointer-events: auto;
          will-change: transform, opacity;
        }

        .menu-column {
          position: relative;
          width: 100%;
          max-width: 520px;
          padding-left: 40px;
          contain: layout style;
        }

        .menu-item.mobile {
          position: relative;
          font-size: 2.3rem;
          margin-bottom: 26px;
          opacity: 1;
          transform: none !important;
          letter-spacing: 0.08em;
          padding-right: 30px;
          transition: color 0.2s ease;
          color: #ffffff;
          cursor: pointer;
          text-transform: uppercase;
          font-weight: 500;
          user-select: none;
          -webkit-user-select: none;
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

        .menu-right {
          width: 55%;
          height: 100%;
          overflow: hidden;
          transform: translateZ(0);
          background: #0a0a0a;
        }

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