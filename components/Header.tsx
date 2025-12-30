"use client";

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps): JSX.Element {
  return (
    <>
      <style jsx>{`
        .header-menu-btn span::after {
          content: "";
          position: absolute;
          left: 0;
          bottom: -4px;
          width: 100%;
          height: 1px;
          transform: scaleX(0);
          transform-origin: left;
          transition: transform 0.4s ease;
        }

        .header-menu-btn:hover span::after {
          transform: scaleX(1);
        }
      `}</style>

      <header className="fixed top-0 left-0 w-full px-10 py-7 flex justify-between items-center z-[10000] pointer-events-auto mix-blend-difference md:px-6 md:py-[22px]">
        <div className="flex items-center">
          <span className="text-base tracking-[0.35em] font-medium text-white cursor-default md:text-sm md:tracking-[0.28em]">
            INFINITUS
          </span>
        </div>

        <button
          className="header-menu-btn bg-transparent border-none cursor-pointer text-white text-sm tracking-[0.3em] py-2 px-0 relative md:text-xs md:tracking-[0.25em]"
          onClick={onMenuClick}
          aria-label="Open menu"
        >
          {/* <span>MENU</span> */}
        </button>
      </header>
    </>
  );
}