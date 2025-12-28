/**
 * MenuOverlay Component
 * 
 * A full-screen menu overlay with advanced 3D text effects and physics-based scrolling.
 * 
 * Key Features:
 * ============================================================================
 * 1. VELOCITY-BASED STRETCH EFFECT (Desktop)
 *    - Custom GLSL shaders that create dynamic text distortion based on scroll velocity
 *    - Sine wave patterns that flow across menu items during scrolling
 *    - Smooth interpolation for oil-like viscous movement
 * 
 * 2. INFINITE SCROLLING LOOP
 *    - Menu items arranged in a continuous vertical loop
 *    - Seamless wrapping with proper modulo calculations
 *    - Focus-based scaling and opacity for depth perception
 * 
 * 3. ADVANCED PHYSICS SYSTEM
 *    - Velocity-based momentum with configurable friction
 *    - Separate handling for wheel scroll and mouse drag interactions
 *    - Smooth interpolation between target and current positions
 *    - Adaptive scroll speed detection (slow vs fast scrolling)
 * 
 * 4. INTERACTIVE HOVER EFFECTS
 *    - Text color changes from white to red on hover
 *    - Synchronized hover state between DOM and WebGL elements
 *    - Cursor changes (grab/grabbing) for intuitive UX
 * 
 * 5. RESPONSIVE DESIGN
 *    - Desktop: 3D WebGL canvas with shader effects (left) + background image (right)
 *    - Mobile: Simplified vertical list with red indicator dots
 *    - Automatic detection and adaptation based on viewport width
 * 
 * 6. SMOOTH ANIMATIONS
 *    - GSAP for open/close transitions
 *    - RequestAnimationFrame for scroll updates (better than GSAP for continuous motion)
 *    - Direct DOM updates for optimal performance during scrolling
 * 
 * Technical Stack:
 * ============================================================================
 * - React + TypeScript for component logic
 * - Three.js (via @react-three/fiber) for 3D rendering
 * - Custom GLSL shaders for visual effects
 * - GSAP for animation transitions
 * - CSS-in-JS for scoped styling
 */

"use client";

// ============================================================================
// IMPORTS
// ============================================================================
import { useEffect, useRef, useState, useMemo } from "react";
import gsap from "gsap";                                    // Animation library
import { Canvas, useFrame, useThree } from "@react-three/fiber"; // React Three.js
import * as THREE from "three";                             // Three.js core

// ============================================================================
// CONSTANTS
// ============================================================================
/**
 * LINKS - Menu items array
 * 
 * Contains 6 repetitions of the same 5 items to create the infinite scroll loop.
 * Total: 30 items arranged in a vertical carousel.
 * Duplication ensures smooth wrapping without visible gaps or jumps.
 */
const LINKS = [
  "Home", "About", "Gallery", "Events", "Contact",
  "Home", "About", "Gallery", "Events", "Contact",
  "Home", "About", "Gallery", "Events", "Contact",
  "Home", "About", "Gallery", "Events", "Contact",
  "Home", "About", "Gallery", "Events", "Contact",
  "Home", "About", "Gallery", "Events", "Contact"
];

// ============================================================================
// GLSL SHADERS - Velocity-Based Stretch Effect
// ============================================================================
/**
 * VERTEX SHADER
 * 
 * Purpose: Distorts text geometry based on scroll velocity to create a dynamic
 *          stretching effect that flows in a sine wave pattern.
 * 
 * Uniforms:
 * - uVelocity: Current scroll velocity (updated each frame)
 * - uViewportSizes: Viewport dimensions for proper scaling
 * - uScrollPhase: Normalized position in the scroll loop (0-1)
 * 
 * Effect Breakdown:
 * 1. Transform vertex to view space for screen-relative distortion
 * 2. Calculate sine wave based on scroll phase for smooth flowing motion
 * 3. Apply vertical stretch proportional to velocity and wave position
 * 4. The result: text appears to stretch/compress as you scroll, with a
 *    wave pattern that connects multiple items visually
 * 
 * Visual Result: Creates an oil-like viscous effect where faster scrolling
 *                produces more dramatic stretching, and the distortion flows
 *                smoothly across all visible items.
 */
const vertexShader = `
  uniform float uVelocity;      // Current scroll velocity
  uniform vec2 uViewportSizes;  // Viewport width and height
  uniform float uScrollPhase;   // Normalized scroll position (0-1)
  varying vec2 vUv;             // UV coordinates passed to fragment shader

  void main() {
    vUv = uv;
    vec3 newPosition = position;
    
    // Transform vertex to view space for screen-space effects
    vec4 worldPos = modelMatrix * vec4(newPosition, 1.0);
    vec4 viewPos = viewMatrix * worldPos;
    
    // Stretch amplitude - controls strength of distortion effect
    float ampStretch = 0.0012;
    float M_PI = 3.1415926535897932;
    
    // Create vertical sine wave that scrolls across all items
    // Lower frequency = longer, smoother waves connecting more items
    // Higher frequency = shorter, more localized wave patterns
    float waveFrequency = 1.2; // Number of complete waves across the loop
    float wave = sin(uScrollPhase * M_PI * 2.0 * waveFrequency);
    
    // Calculate stretch amount: velocity * wave * amplitude
    // Positive velocity = upward scroll, negative = downward scroll
    float stretchAmount = wave * uVelocity * ampStretch;
    
    // Apply Y-axis stretch in view space
    // Multiplying by viewPos.y makes stretch proportional to distance from center
    viewPos.y += stretchAmount * viewPos.y;

    // Transform to clip space for final rendering
    gl_Position = projectionMatrix * viewPos;
  }
`;

/**
 * FRAGMENT SHADER
 * 
 * Purpose: Renders the text texture onto the distorted geometry.
 * 
 * Uniforms:
 * - uTexture: Canvas texture containing the rendered text
 * 
 * Features:
 * - Samples the text texture using UV coordinates from vertex shader
 * - Discards transparent pixels to maintain clean text edges
 * - Supports both white and red textures for hover effects
 * 
 * Note: The texture itself is created dynamically on a 2D canvas using the
 *       Anton font, then uploaded to WebGL as a texture.
 */
const fragmentShader = `
  uniform sampler2D uTexture;  // Text texture from 2D canvas
  varying vec2 vUv;            // UV coordinates from vertex shader

  void main() {
    // Sample the text texture at current UV coordinates
    vec4 color = texture2D(uTexture, vUv);
    
    // Discard fully transparent pixels (alpha < 0.1)
    // This creates clean text edges without a visible background
    if(color.a < 0.1) discard; 
    
    // Output the final color
    gl_FragColor = color;
  }
`;

// ============================================================================
// TEXTURE GENERATION UTILITIES
// ============================================================================
/**
 * createTextTexture
 * 
 * Generates a Three.js texture from text rendered on a 2D canvas.
 * This allows us to display styled text in the 3D WebGL scene.
 * 
 * Process:
 * 1. Create an offscreen 2D canvas element
 * 2. Draw the text onto the canvas using specified font and color
 * 3. Wait for font to load completely (document.fonts.ready)
 * 4. Convert canvas to Three.js CanvasTexture
 * 5. Return texture for use in ShaderMaterial
 * 
 * @param text - The text string to render (will be uppercased)
 * @param font - CSS font string (default: "400 120px Anton")
 * @param color - Text color (default: "white", can be "#ff0000" for hover)
 * @param addRect - Whether to add a border rectangle (default: false)
 * @returns THREE.CanvasTexture containing the rendered text
 * 
 * Technical Notes:
 * - Canvas size: 1024x256 pixels (optimized for performance)
 * - Text is positioned at (180, height/2) for proper alignment
 * - Font loading is async - texture updates when font is ready
 * - Texture uses transparent background for clean compositing
 */
function createTextTexture(text: string, font: string = "400 120px Anton", color: string = "white", addRect: boolean = false): THREE.CanvasTexture {
  // Create an offscreen 2D canvas for text rendering
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  
  // Ensure canvas context is available
  if (!ctx) {
    throw new Error("Could not get 2D context");
  }
  
  // Set canvas dimensions (1024x256 provides good quality without excessive memory)
  canvas.width = 1024; 
  canvas.height = 256;
  
  // Initialize with transparent background
  ctx.fillStyle = "transparent";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Optionally add a border rectangle (used for debugging/testing)
  if (addRect) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(50, 50, canvas.width - 100, canvas.height - 100);
  }
  
  // Configure text rendering properties
  ctx.font = font;                  // Use Anton font at 120px
  ctx.textAlign = "left";           // Left-align text
  ctx.textBaseline = "middle";      // Vertical center alignment
  ctx.fillStyle = color;            // Set text color (white or red)
  
  // Wait for fonts to load completely before re-rendering
  // This prevents FOUT (Flash of Unstyled Text) in the 3D scene
  document.fonts.ready.then(() => {
    // Clear and redraw once font is loaded
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Redraw border if requested
    if (addRect) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(50, 50, canvas.width - 100, canvas.height - 100);
    }
    
    // Reapply text rendering properties
    ctx.font = font;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = color;
    
    // Render text (uppercase for consistent styling)
    ctx.fillText(text.toUpperCase(), 180, canvas.height / 2);
    
    // Mark texture for update in Three.js
    texture.needsUpdate = true;
  });
  
  // Initial render (will be replaced once font loads)
  ctx.fillText(text.toUpperCase(), 180, canvas.height / 2);
  
  // Create and return Three.js texture from canvas
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// ============================================================================
// STRETCH ITEM COMPONENT - Individual Menu Item with 3D Effects
// ============================================================================
/**
 * StretchItemProps - Props for individual menu items
 * 
 * @property text - Display text for the menu item
 * @property index - Position in the LINKS array (0-29)
 * @property velocityRef - Shared ref containing current scroll velocity
 * @property positionRef - Shared ref containing current scroll position
 * @property itemHeight - Height of each item in pixels (70px)
 * @property loopHeight - Total height of the loop (itemHeight * total items)
 * @property isHovered - Whether this item is currently hovered
 * @property onHover - Callback to update hover state (null = no hover)
 * @property onClick - Callback when item is clicked (closes menu)
 */
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

/**
 * StretchItem - Individual 3D menu item with shader effects
 * 
 * This component renders a single menu item as a 3D plane with custom shaders.
 * Each item:
 * - Responds to scroll velocity with dynamic stretching
 * - Changes color from white to red on hover
 * - Loops seamlessly in the vertical carousel
 * - Updates position every frame via useFrame hook
 * 
 * Technical Details:
 * - Uses Three.js PlaneGeometry (5x1.2 units, 64x64 subdivisions for smooth distortion)
 * - ShaderMaterial with custom vertex/fragment shaders
 * - Canvas texture swapping for hover effects (white <-> red)
 * - Modulo-based wrapping for infinite scroll
 * - Interpolated velocity for smooth oil-like motion
 */
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
  // Reference to the Three.js mesh for direct manipulation
  const meshRef = useRef<THREE.Mesh>(null);
  
  // Access Three.js viewport dimensions for responsive calculations
  const { viewport } = useThree();
  
  // Create both white (default) and red (hover) textures
  // Memoized to prevent recreation on every render
  const whiteTexture = useMemo(() => createTextTexture(text, "400 120px Anton", "white", false), [text]);
  const redTexture = useMemo(() => createTextTexture(text, "400 120px Anton", "#ff0000", false), [text]);
  
  // Shader uniforms - values passed to vertex/fragment shaders
  // These control the visual appearance and distortion of the text
  const uniforms = useMemo(() => ({
    uTexture: { value: whiteTexture },        // Current texture (switches on hover)
    uVelocity: { value: 0 },                  // Current scroll velocity (smoothed)
    uViewportSizes: { value: new THREE.Vector2(viewport.width, viewport.height) }, // Viewport dimensions
    uScrollPhase: { value: 0 }                // Normalized position in loop (0-1)
  }), [whiteTexture, viewport]);

  // useFrame hook - called every frame by React Three Fiber
  // This is where we update the mesh position, shader uniforms, and handle all animation
  useFrame((state) => {
    // Early return if mesh hasn't been created yet
    if (!meshRef.current) return;

    // Access the shader material to update uniforms
    const material = meshRef.current.material as THREE.ShaderMaterial;

    // ========================================================================
    // HOVER EFFECT - Switch between white and red texture
    // ========================================================================
    material.uniforms.uTexture.value = isHovered ? redTexture : whiteTexture;

    // ========================================================================
    // VELOCITY TRACKING - Amplify velocity for visible stretch effect
    // ========================================================================
    // Scale up velocity (40x) to make the stretch effect visible
    const velocity = velocityRef.current * 40.0;
    
    // Smoothly interpolate velocity using linear interpolation (lerp)
    // 0.04 = interpolation factor (lower = smoother but slower response)
    // This creates the "oil-like" viscous feel during scrolling
    material.uniforms.uVelocity.value = THREE.MathUtils.lerp(
      material.uniforms.uVelocity.value,
      velocity,
      0.04
    );

    // ========================================================================
    // VIEWPORT UPDATE - Keep shader aware of viewport changes (window resize)
    // ========================================================================
    material.uniforms.uViewportSizes.value.set(
      state.viewport.width, 
      state.viewport.height
    );

    // ========================================================================
    // POSITION CALCULATION - Infinite loop with seamless wrapping
    // ========================================================================
    // Calculate raw Y position based on item index and current scroll position
    const rawY = index * itemHeight - positionRef.current;
    
    // Apply modulo wrapping to create infinite loop
    // This math ensures items wrap smoothly without visible jumps:
    // 1. First modulo: brings value into 0 to loopHeight range
    // 2. Add loopHeight: ensures positive values for second modulo
    // 3. Second modulo: final wrap with guaranteed positive result
    // 4. Subtract half: centers the loop around zero
    let y = ((rawY % loopHeight) + loopHeight) % loopHeight;
    if (y > loopHeight / 2) y -= loopHeight;
    
    // ========================================================================
    // VIEWPORT SPACE CONVERSION - Convert pixel Y to Three.js units
    // ========================================================================
    // Scale Y from pixels to Three.js viewport units
    // Multiply by 2 because Three.js viewport goes from -1 to 1
    const viewportY = (y / window.innerHeight) * viewport.height * 2;
    
    // ========================================================================
    // MESH POSITION UPDATE - Apply calculated position
    // ========================================================================
    meshRef.current.position.x = 0;           // Keep X constant for alignment
    meshRef.current.position.y = viewportY;   // Update Y based on scroll
    
    // ========================================================================
    // SCROLL PHASE - Normalized position for shader wave calculation
    // ========================================================================
    // Calculate phase (0-1) for the sine wave in the vertex shader
    // This ensures the wave pattern flows smoothly across all items
    const scrollPhase = (y + loopHeight / 2) / loopHeight;
    material.uniforms.uScrollPhase.value = scrollPhase;
    
    // ========================================================================
    // SCALE & OPACITY - Keep constant (no focus scaling in current design)
    // ========================================================================
    meshRef.current.scale.set(1, 1, 1);  // Uniform scale
    material.opacity = 1;                 // Full opacity
  });

  // ==========================================================================
  // RENDER - Three.js mesh with shader material
  // ==========================================================================
  return (
    <mesh 
      ref={meshRef} 
      position={[0, 0, 0]}                      // Initial position (will be updated in useFrame)
      onPointerEnter={() => onHover(index)}     // Trigger hover state on mouse enter
      onPointerLeave={() => onHover(null)}      // Clear hover state on mouse leave
      onClick={onClick}                         // Close menu on click
    >
      {/* PlaneGeometry: 5 units wide, 1.2 units tall, 64x64 subdivisions for smooth distortion */}
      <planeGeometry args={[5, 1.2, 64, 64]} />
      
      {/* ShaderMaterial: Custom GLSL shaders with uniforms */}
      <shaderMaterial
        vertexShader={vertexShader}        // Custom vertex shader (distortion)
        fragmentShader={fragmentShader}    // Custom fragment shader (texture sampling)
        uniforms={uniforms}                // Shader uniforms (texture, velocity, etc.)
        transparent={true}                 // Enable transparency for clean text edges
      />
    </mesh>
  );
};

// ============================================================================
// STRETCH SCENE COMPONENT - Container for all 3D menu items
// ============================================================================
/**
 * StretchSceneProps - Props for the 3D scene container
 * 
 * @property velocityRef - Shared scroll velocity reference
 * @property positionRef - Shared scroll position reference
 * @property itemHeight - Height of each item (70px)
 * @property loopHeight - Total loop height (itemHeight * total items)
 * @property hoveredIndex - Index of currently hovered item (null if none)
 * @property onHover - Hover state change callback
 * @property onClose - Menu close callback
 */
interface StretchSceneProps {
  velocityRef: React.MutableRefObject<number>;
  positionRef: React.MutableRefObject<number>;
  itemHeight: number;
  loopHeight: number;
  hoveredIndex: number | null;
  onHover: (index: number | null) => void;
  onClose: () => void;
}

/**
 * StretchScene - Renders all menu items in the 3D scene
 * 
 * This component maps over the LINKS array and creates a StretchItem
 * for each menu entry. All items share the same velocity and position
 * refs for synchronized scrolling behavior.
 * 
 * The scene itself doesn't contain any Three.js elements - it simply
 * renders multiple StretchItem components which each contain their own mesh.
 */
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
      {/* Render a StretchItem for each menu link */}
      {LINKS.map((text, i) => (
        <StretchItem 
          key={i}                          // Unique key for each item
          text={text}                      // Display text
          index={i}                        // Position in array
          velocityRef={velocityRef}        // Shared velocity reference
          positionRef={positionRef}        // Shared position reference
          itemHeight={itemHeight}          // Individual item height
          loopHeight={loopHeight}          // Total loop height
          isHovered={hoveredIndex === i}   // Hover state for this item
          onHover={onHover}                // Hover callback
          onClick={onClose}                // Click closes menu
        />
      ))}
    </>
  );
};

// ============================================================================
// MAIN MENU OVERLAY COMPONENT
// ============================================================================
/**
 * MenuOverlay - Full-screen menu with 3D effects and physics-based scrolling
 * 
 * Props:
 * @param isOpen - Controls menu visibility (open/closed)
 * @param onClose - Callback to close the menu
 * 
 * State Management:
 * - menuOpen: Controlled by parent via isOpen prop
 * - hoveredIndex: Tracks which menu item is currently hovered
 * - isMobile: Responsive flag for mobile vs desktop rendering
 * 
 * Physics System:
 * - position: Current scroll position in pixels
 * - velocity: Current scroll velocity (pixels per frame)
 * - targetPosition: Target position for smooth interpolation
 * - Friction, momentum, and inertia for natural feel
 * 
 * Layout:
 * - Desktop: Split view (45% 3D menu left, 55% background image right)
 * - Mobile: Full-width vertical list with simplified styling
 */
export default function MenuOverlay({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  // ==========================================================================
  // REFS & STATE
  // ==========================================================================
  
  // DOM reference to the overlay container (for GSAP animations)
  const overlayRef = useRef<HTMLDivElement>(null);
  
  // Array of refs to individual menu items (for direct DOM updates during scroll)
  const itemsRef = useRef<HTMLDivElement[]>([]);
  
  // Responsive flag - true if viewport width < 768px
  const [isMobile, setIsMobile] = useState(false);
  
  // Hover state - index of currently hovered item (null if none)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // ==========================================================================
  // PHYSICS SYSTEM - Refs for performance (avoid re-renders)
  // ==========================================================================
  
  // Current scroll position in pixels (0 to LOOP_HEIGHT, then wraps)
  const position = useRef(0);
  
  // Current scroll velocity in pixels per frame (can be positive or negative)
  const velocity = useRef(0);
  
  // Timestamp of last animation frame (for delta time calculation)
  const lastTime = useRef(0);
  
  // RequestAnimationFrame ID (used to cancel animation loop)
  const animationId = useRef<number | null>(null);
  
  // Target position for smooth interpolation (prevents jarring jumps)
  const targetPosition = useRef(0);
  
  // Flag to prevent multiple simultaneous animation loops
  const isAnimating = useRef(false);

  // ==========================================================================
  // TUNING CONSTANTS - Adjust these to change scroll behavior
  // ==========================================================================
  
  const ITEM_HEIGHT = 70;                          // Height of each menu item in pixels
  const LOOP_HEIGHT = ITEM_HEIGHT * LINKS.length;  // Total height of the scrolling loop
  const TOTAL_ITEMS = LINKS.length;                // Total number of menu items (30)

  // ==========================================================================
  // EFFECT: RESPONSIVE DETECTION
  // ==========================================================================
  /**
   * Monitors window width and updates isMobile state.
   * 
   * Mobile threshold: 768px
   * - Below 768px: Use simplified vertical list (no 3D effects)
   * - Above 768px: Use full 3D WebGL scene with shaders
   * 
   * Cleanup: Removes resize listener on unmount
   */
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();  // Initial check
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // ==========================================================================
  // EFFECT: OPEN / CLOSE ANIMATIONS
  // ==========================================================================
  /**
   * Handles menu open/close transitions using GSAP.
   * 
   * Opening:
   * 1. Set display to 'flex' immediately (makes overlay visible)
   * 2. Animate from y: 100% to y: 0 with opacity fade-in
   * 3. Start physics animation loop (desktop only)
   * Duration: 1.2s with power3.out easing
   * 
   * Closing:
   * 1. Stop physics animation loop immediately
   * 2. Animate to y: 100% with opacity fade-out
   * 3. Set display to 'none' after animation completes (removes from layout)
   * Duration: 0.8s with 0.3s delay and power3.in easing
   * 
   * Easing Details:
   * - power3.out: Fast start, slow end (feels responsive on open)
   * - power3.in: Slow start, fast end (smooth close animation)
   */
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

  // ==========================================================================
  // ANIMATION LOOP - Physics simulation and DOM updates
  // ==========================================================================
  /**
   * startAnimation
   * 
   * Initializes and runs the continuous animation loop for menu scrolling.
   * This loop runs via requestAnimationFrame for optimal performance.
   * 
   * Physics Implementation:
   * 1. Delta Time: Calculate time since last frame for frame-rate independence
   * 2. Friction: Apply 0.95 multiplier to velocity (5% decay per frame)
   * 3. Target Position: Update based on current velocity
   * 4. Interpolation: Smoothly move position toward target (6% per frame)
   * 5. Wrapping: Handle position overflow/underflow for infinite loop
   * 6. DOM Updates: Direct style manipulation for each menu item
   * 
   * Performance Optimizations:
   * - Uses requestAnimationFrame instead of GSAP for continuous motion
   * - Direct DOM manipulation (faster than React re-renders for scroll)
   * - will-change CSS hint for GPU acceleration
   * - Prevents multiple simultaneous loops with animationId check
   * 
   * Visual Effects Applied:
   * - Focus scaling: Items closer to center are larger (0.85 - 1.1 scale)
   * - Opacity gradient: Items closer to center are more opaque (0.3 - 1.0)
   * - Red square indicator: Positioned at focus point
   */
  const startAnimation = () => {
    // Prevent multiple animation loops
    if (animationId.current) return;
    
    // Initialize timing and position tracking
    lastTime.current = performance.now();
    targetPosition.current = position.current;
    
    // Main animation loop function
    const animate = (currentTime: number) => {
      // Exit if animation has been stopped
      if (!animationId.current) return;
      
      // ======================================================================
      // DELTA TIME CALCULATION - Frame-rate independence
      // ======================================================================
      // Calculate time elapsed since last frame (capped at 32ms to prevent large jumps)
      // Divide by 16 to normalize to ~60fps baseline (16.67ms per frame)
      const deltaTime = Math.min(currentTime - lastTime.current, 32) / 16;
      lastTime.current = currentTime;
      
      // ======================================================================
      // PHYSICS: FRICTION - Gradual velocity decay
      // ======================================================================
      // Apply strong friction (0.95 = 5% decay per frame)
      // This creates the "oil-like" resistance feel
      velocity.current *= 0.95;
      
      // ======================================================================
      // PHYSICS: VELOCITY APPLICATION - Update target position
      // ======================================================================
      // Move target position based on current velocity and delta time
      targetPosition.current += velocity.current * deltaTime;
      
      // ======================================================================
      // PHYSICS: SMOOTH INTERPOLATION - Oil-like viscosity
      // ======================================================================
      // Very slow interpolation (0.06 = 6% per frame) for thick oil feel
      // This is the key to the smooth, viscous scrolling behavior
      position.current += (targetPosition.current - position.current) * 0.06;
      
      // ======================================================================
      // POSITION WRAPPING - Keep position within loop bounds
      // ======================================================================
      // CRITICAL FIX: Wrap both position AND targetPosition to prevent glitches
      // When position wraps, target must wrap too to maintain smooth interpolation
      if (position.current < 0) {
        position.current += LOOP_HEIGHT;
        targetPosition.current += LOOP_HEIGHT;
      }
      if (position.current > LOOP_HEIGHT) {
        position.current -= LOOP_HEIGHT;
        targetPosition.current -= LOOP_HEIGHT;
      }
      
      // ======================================================================
      // DOM UPDATES - Direct manipulation for performance
      // ======================================================================
      const centerY = window.innerHeight / 2;  // Vertical center of viewport
      const items = itemsRef.current;          // Array of menu item DOM elements
      
      // Loop through all menu items and update their positions
      // Using direct DOM updates (faster than GSAP for continuous scrolling)
      for (let i = 0; i < items.length; i++) {
        const el = items[i];
        if (!el) continue;  // Skip if element doesn't exist
        
        // Calculate position for this item
        const rawY = i * ITEM_HEIGHT - position.current;
        let y = rawY;
        
        // Simple wrap logic for infinite loop
        if (y < -LOOP_HEIGHT / 2) y += LOOP_HEIGHT;
        else if (y > LOOP_HEIGHT / 2) y -= LOOP_HEIGHT;
        
        // ====================================================================
        // FOCUS EFFECTS - Scale and opacity based on distance from center
        // ====================================================================
        const dist = Math.abs(y);                               // Distance from center
        const focus = Math.max(0, Math.min(1, 1 - dist / 380)); // Normalized focus (0-1)
        const scale = 0.85 + focus * 0.25;                      // Scale: 0.85 - 1.1
        const opacity = 0.3 + focus * 0.7;                       // Opacity: 0.3 - 1.0
        
        // ====================================================================
        // APPLY TRANSFORMS - Direct style updates for best performance
        // ====================================================================
        // Use translate3d and scale for GPU-accelerated transforms
        el.style.transform = `translate3d(0, ${centerY + y}px, 0) scale(${scale})`;
        el.style.opacity = opacity.toString();
        el.style.willChange = 'transform, opacity';  // Hint for GPU acceleration
        
        // Update red square indicator position (always vertically centered)
        const square = el.querySelector('.red-square') as HTMLElement;
        if (square) {
          square.style.transform = 'translateY(-50%)';
        }
      }
      
      // Schedule next frame
      animationId.current = requestAnimationFrame(animate);
    };
    
    // Start the animation loop
    animationId.current = requestAnimationFrame(animate);
  };

  /**
   * stopAnimation
   * 
   * Cancels the animation loop and resets velocity.
   * Called when:
   * - Menu is closed
   * - Switching to mobile view
   * - Component unmounts
   * 
   * Important: Syncs targetPosition with current position to prevent
   * jumps if animation is restarted later.
   */
  const stopAnimation = () => {
    // Cancel the requestAnimationFrame loop
    if (animationId.current) {
      cancelAnimationFrame(animationId.current);
      animationId.current = null;
    }
    
    // Reset velocity to zero (stop all motion)
    velocity.current = 0;
    
    // Sync target with current position to prevent jumps
    targetPosition.current = position.current;
  };

  // ==========================================================================
  // EFFECT: WHEEL SCROLL HANDLER (Desktop only)
  // ==========================================================================
  /**
   * Handles mouse wheel scrolling with advanced velocity control.
   * 
   * Features:
   * 1. Accumulation: Combines multiple quick wheel events for smoother motion
   * 2. Time-based weighting: Adjusts for varying frame rates
   * 3. Speed detection: Different behavior for slow vs fast scrolling
   * 4. Adaptive multipliers:
   *    - Slow scroll: 30% slower (0.084x) for precise control
   *    - Fast scroll: 30% faster (0.156x) for responsive feel
   * 5. Easing: Power-based easing for natural acceleration curves
   * 6. Velocity capping: Prevents excessive speed
   * 7. Debouncing: Gradual velocity reduction when scrolling stops
   * 
   * Performance:
   * - Prevents default to avoid page scroll
   * - Clears timeout on new events to prevent accumulated timeouts
   * - Uses requestAnimationFrame for smooth updates (via startAnimation)
   */
  useEffect(() => {
    // Only enable on desktop when menu is open
    if (isMobile || !isOpen) return;
    
    // State for wheel event handling
    let wheelTimeout: NodeJS.Timeout | null = null;  // Debounce timer
    let accumulatedDeltaY = 0;                       // Accumulated scroll delta
    let lastWheelTime = 0;                           // Timestamp of last wheel event
    
    /**
     * onWheel - Mouse wheel event handler
     * 
     * Implements sophisticated scroll physics with adaptive speed control.
     * The key innovation: different multipliers for slow vs fast scrolling.
     */
    const onWheel = (e: WheelEvent) => {
      if (!isOpen) return;
      
      // Prevent default page scrolling
      e.preventDefault();
      
      // ======================================================================
      // TIME-BASED DELTA ACCUMULATION
      // ======================================================================
      const now = Date.now();
      const timeDiff = now - lastWheelTime;
      lastWheelTime = now;
      
      // Weight deltaY by time difference for frame-rate independence
      // Normalize to ~60fps (16ms baseline)
      // Cap at 2x to prevent extreme values from long delays
      const timeWeight = Math.min(timeDiff / 16, 2);
      accumulatedDeltaY += e.deltaY * timeWeight;
      
      // ======================================================================
      // SCROLL SPEED DETECTION
      // ======================================================================
      // Detect if user is scrolling fast or slow based on wheel delta
      const scrollSpeed = Math.abs(e.deltaY);
      const isFastScroll = scrollSpeed > 50; // Threshold: 50 pixels
      
      // ======================================================================
      // ADAPTIVE SPEED MULTIPLIERS
      // ======================================================================
      // Base multiplier: 0.12
      // Slow scroll: 0.12 * 0.7 = 0.084 (30% slower for precise control)
      // Fast scroll: 0.12 * 1.3 = 0.156 (30% faster for responsive feel)
      const speedMultiplier = isFastScroll ? 0.156 : 0.084;
      const baseVelocity = accumulatedDeltaY * speedMultiplier;
      
      // ======================================================================
      // EASING CURVE - Power-based for natural feel
      // ======================================================================
      // Different easing for slow vs fast scrolling
      // Slow: 0.95 = more damped (oil-like viscosity)
      // Fast: 0.88 = less damped (more responsive)
      const easingPower = isFastScroll ? 0.88 : 0.95;
      
      // Apply easing while preserving direction (sign)
      const easedVelocity = Math.sign(baseVelocity) * 
                           Math.pow(Math.abs(baseVelocity), easingPower);
      
      // Add to current velocity (accumulate momentum)
      velocity.current += easedVelocity;
      
      // ======================================================================
      // VELOCITY CAPPING - Prevent excessive speed
      // ======================================================================
      // Dynamic cap based on scroll type
      // Fast scroll: Higher cap (35) for more freedom
      // Slow scroll: Lower cap (18) for better control
      const maxVelocity = isFastScroll ? 35 : 18;
      if (Math.abs(velocity.current) > maxVelocity) {
        velocity.current = Math.sign(velocity.current) * maxVelocity;
      }
      
      // ======================================================================
      // RESET ACCUMULATOR
      // ======================================================================
      // Reset accumulated delta after applying to velocity
      accumulatedDeltaY = 0;
      
      // ======================================================================
      // DEBOUNCING - Gradual slowdown when scrolling stops
      // ======================================================================
      // Clear existing timeout to reset debounce timer
      if (wheelTimeout) clearTimeout(wheelTimeout);
      
      // Set new timeout to reduce velocity after 100ms of no wheel events
      wheelTimeout = setTimeout(() => {
        // Only reduce velocity if no recent wheel events
        velocity.current *= 0.96;  // 4% decay
        wheelTimeout = null;
      }, 100);
    };
    
    // Attach wheel listener with passive: false to allow preventDefault
    window.addEventListener("wheel", onWheel, { passive: false });
    
    // Cleanup on unmount or dependency change
    return () => {
      window.removeEventListener("wheel", onWheel);
      if (wheelTimeout) clearTimeout(wheelTimeout);
    };
  }, [isOpen, isMobile]);

  // ==========================================================================
  // EFFECT: MOUSE DRAG HANDLER (Desktop only)
  // ==========================================================================
  /**
   * Handles mouse drag interaction for manual scrolling.
   * 
   * Features:
   * 1. Click and drag: Direct position control while dragging
   * 2. Velocity tracking: Records movement history for throw/fling effect
   * 3. Release momentum: Applies calculated velocity on mouse release
   * 4. Smooth interpolation: Continues with physics after release
   * 
   * Interaction Flow:
   * 1. MouseDown: Start tracking, reduce existing velocity
   * 2. MouseMove: Update position directly, calculate immediate velocity
   * 3. MouseUp: Apply average velocity for smooth release momentum
   * 
   * Velocity History:
   * - Tracks last 5 velocity samples
   * - Averages on release for smooth throw behavior
   * - Prevents erratic motion from single fast movements
   */
  useEffect(() => {
    // Only enable on desktop when menu is open
    if (isMobile || !isOpen) return;
    
    // Drag state
    let isDragging = false;                      // Is mouse currently pressed?
    let startY = 0;                              // Initial mouse Y position
    let startPosition = 0;                       // Initial scroll position
    let lastDragTime = 0;                        // Timestamp of last move event
    let lastDragY = 0;                           // Previous mouse Y for delta calculation
    const dragVelocities: number[] = [];         // Velocity history buffer
    const MAX_VELOCITY_HISTORY = 5;              // Number of samples to keep
    
    /**
     * onMouseDown - Start drag interaction
     * 
     * Captures initial position and prepares for dragging.
     * Reduces existing velocity to prevent conflicting motion.
     */
    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      startY = e.clientY;                        // Record starting mouse Y
      startPosition = position.current;          // Record starting scroll position
      lastDragY = e.clientY;                     // Initialize previous Y
      lastDragTime = performance.now();          // Initialize timestamp
      dragVelocities.length = 0;                 // Clear velocity history
      
      // Reduce existing velocity by 70% for smooth drag start
      velocity.current *= 0.3;
      
      // Sync target position to prevent jumps
      targetPosition.current = position.current;
    };
    
    /**
     * onMouseMove - Handle drag movement
     * 
     * Updates scroll position in real-time while dragging.
     * Calculates and stores velocity for release momentum.
     */
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;  // Ignore if not dragging
      
      // ======================================================================
      // DELTA TIME CALCULATION
      // ======================================================================
      const currentTime = performance.now();
      const deltaTime = Math.max(currentTime - lastDragTime, 1); // Min 1ms to avoid division by zero
      
      // ======================================================================
      // VELOCITY CALCULATION
      // ======================================================================
      // Calculate immediate drag delta (inverted for natural feel)
      const deltaY = lastDragY - e.clientY;
      
      // Calculate velocity: pixels per millisecond * 40 for scaling
      const immediateVelocity = deltaY / deltaTime * 40;
      
      // ======================================================================
      // VELOCITY HISTORY - Store for averaging on release
      // ======================================================================
      dragVelocities.push(immediateVelocity);
      if (dragVelocities.length > MAX_VELOCITY_HISTORY) {
        dragVelocities.shift();  // Remove oldest sample
      }
      
      // ======================================================================
      // DIRECT POSITION UPDATE - Responsive dragging
      // ======================================================================
      // Update position based on total drag distance from start
      // Multiply by 1.5 for more responsive feel
      position.current = startPosition + (startY - e.clientY) * 1.5;
      
      // ======================================================================
      // POSITION WRAPPING - Keep within loop bounds
      // ======================================================================
      if (position.current < 0) position.current += LOOP_HEIGHT;
      else if (position.current > LOOP_HEIGHT) position.current -= LOOP_HEIGHT;
      
      // Keep target position synchronized with current position
      targetPosition.current = position.current;
      
      // Update tracking variables for next move event
      lastDragY = e.clientY;
      lastDragTime = currentTime;
    };
    
    /**
     * onMouseUp - Handle drag release
     * 
     * Applies averaged velocity for smooth throw/fling momentum.
     * The velocity continues via the physics system after release.
     */
    const onMouseUp = () => {
      if (!isDragging) return;  // Ignore if not dragging
      
      // ======================================================================
      // AVERAGE VELOCITY CALCULATION - Smooth release momentum
      // ======================================================================
      if (dragVelocities.length > 0) {
        // Calculate average of all recorded velocities
        const avgVelocity = dragVelocities.reduce((a, b) => a + b, 0) / dragVelocities.length;
        
        // Apply 70% of average velocity (reduce for controlled feel)
        velocity.current = avgVelocity * 0.7;
        
        // ====================================================================
        // VELOCITY CAPPING - Prevent excessive throw speed
        // ====================================================================
        const maxReleaseVelocity = 50;
        if (Math.abs(velocity.current) > maxReleaseVelocity) {
          velocity.current = Math.sign(velocity.current) * maxReleaseVelocity;
        }
      }
      
      // End drag state
      isDragging = false;
    };
    
    // Attach mouse event listeners
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    
    // Cleanup on unmount or dependency change
    return () => {
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [isOpen, isMobile]);

  // ==========================================================================
  // RENDER - JSX Output
  // ==========================================================================
  /**
   * Component Structure:
   * 
   * Desktop (>768px):
   * ┌─────────────────────────────────────────┐
   * │ CLOSE BUTTON                  [CLOSE]   │
   * ├──────────────────┬──────────────────────┤
   * │                  │                      │
   * │  3D WEBGL CANVAS │   BACKGROUND IMAGE   │
   * │  (StretchScene)  │   (Breathing Effect) │
   * │                  │                      │
   * │  • Shader text   │   • Unsplash photo   │
   * │  • Velocity fx   │   • Scale animation  │
   * │  • Infinite loop │                      │
   * │                  │                      │
   * └──────────────────┴──────────────────────┘
   *      45% width           55% width
   * 
   * Mobile (<768px):
   * ┌─────────────────────────────────────────┐
   * │                              [CLOSE]    │
   * │                                         │
   * │  HOME               •                   │
   * │  ABOUT              •                   │
   * │  GALLERY            •                   │
   * │  EVENTS             •                   │
   * │  CONTACT            •                   │
   * │                                         │
   * │  (Simple vertical list)                 │
   * │  (No 3D effects)                        │
   * └─────────────────────────────────────────┘
   */
  return (
    <>
      {/* ====================================================================== */}
      {/* MAIN OVERLAY CONTAINER                                                */}
      {/* ====================================================================== */}
      {/* Initially hidden (display: none), shown via GSAP animation */}
      <div ref={overlayRef} className="menu" style={{ display: 'none' }}>
        {/* ================================================================== */}
        {/* LEFT SECTION - 3D Menu Items (Desktop) or Simple List (Mobile)    */}
        {/* ================================================================== */}
        <div className="menu-left">
          {isMobile ? (
            /* ============================================================== */
            /* MOBILE VIEW - Simple vertical list                            */
            /* ============================================================== */
            <div className="menu-column">
              {LINKS.map((text, i) => (
                <div 
                  key={text} 
                  className="menu-item mobile" 
                  onClick={onClose}  // Close menu on item click
                >
                  {text}
                  {/* Red dot indicator (shows on hover) */}
                  <div className="mobile-indicator"></div>
                </div>
              ))}
            </div>
          ) : (
            /* ============================================================== */
            /* DESKTOP VIEW - 3D WebGL Canvas with shader effects            */
            /* ============================================================== */
            /* 
             * Canvas Component:
             * - Camera positioned at [0, 0, 5] with 50° FOV
             * - Contains StretchScene with all menu items
             * - Each item is a 3D plane with custom shaders
             * - Velocity-based distortion applied in real-time
             */
            <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
              <StretchScene 
                velocityRef={velocity}          // Shared velocity for all items
                positionRef={position}          // Shared position for synchronized scroll
                itemHeight={ITEM_HEIGHT}        // Individual item height (70px)
                loopHeight={LOOP_HEIGHT}        // Total loop height
                hoveredIndex={hoveredIndex}     // Currently hovered item index
                onHover={setHoveredIndex}       // Hover state update callback
                onClose={onClose}               // Close menu on item click
              />
            </Canvas>
          )}
        </div>

        {/* ================================================================== */}
        {/* RIGHT SECTION - Background Image with Breathing Animation (Desktop) */}
        {/* ================================================================== */}
        {!isMobile && (
          <div className="menu-right">
            {/* 
             * Background Image:
             * - Unsplash photo (mountain landscape)
             * - Breathing animation: slow scale from 1.05 to 1.15
             * - 20s duration with ease-in-out for smooth loop
             * - Adds depth and visual interest to the menu
             */}
            <div className="menu-media" />
          </div>
        )}

        {/* ================================================================== */}
        {/* CLOSE BUTTON - Top right corner                                   */}
        {/* ================================================================== */}
        {/* 
         * Close Button:
         * - Fixed position in top-right
         * - Monospace font with wide letter-spacing
         * - Border appears on hover
         * - Color changes to red on hover
         * - Calls onClose to trigger menu exit animation
         */}
        <button className="menu-close" onClick={onClose}>
          CLOSE
        </button>
      </div>

      {/* ====================================================================== */}
      {/* SCOPED CSS STYLES                                                     */}
      {/* ====================================================================== */}
      {/* 
       * CSS-in-JS using Next.js styled-jsx
       * All styles are scoped to this component
       * 
       * Performance Optimizations:
       * - transform: translateZ(0) - Forces GPU acceleration
       * - backface-visibility: hidden - Prevents flickering
       * - will-change - Hints GPU about animated properties
       * - contain: layout style - CSS containment for better performance
       * - -webkit-font-smoothing - Better font rendering
       */}
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
          height: 100%;
          display: flex;
          justify-content: center;
          overflow: hidden;
          user-select: none;
          -webkit-user-select: none;
        }

        .menu-left :global(canvas) {
          width: 100% !important;
          height: 100% !important;
          cursor: pointer;
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

        /* RIGHT */
        .menu-right {
          width: 55%;
          height: 100%;
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

