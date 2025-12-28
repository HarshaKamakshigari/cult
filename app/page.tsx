/**
 * Home Page Component
 * 
 * The main landing page of the Infinitus application.
 * This is a simple wrapper that renders the InfinitusViewer component.
 * 
 * Route: / (root)
 */

// ============================================================================
// IMPORTS
// ============================================================================
import InfinitusViewer from "@/components/InfinitusViewer"; // Main 3D viewer component

// ============================================================================
// HOME PAGE COMPONENT
// ============================================================================
/**
 * Home - Root page component
 * 
 * Responsibilities:
 * - Serves as the entry point for the application
 * - Renders the InfinitusViewer component which contains the main 3D experience
 * 
 * Note: The actual content and interactivity are handled by the InfinitusViewer
 * component. This page component is intentionally minimal to maintain clean
 * separation of concerns.
 * 
 * @returns The InfinitusViewer component
 */
export default function Home() {
  return <InfinitusViewer />;
}
