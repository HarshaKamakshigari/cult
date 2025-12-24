"use client";

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps): JSX.Element {
  return (
    <header className="header-aww">
      <div className="header-left">
        <span className="header-logo">INFINITUS</span>
      </div>

      <button
        className="header-menu-btn"
        onClick={onMenuClick}
        aria-label="Open menu"
      >
        {/* <span>MENU</span> */}
      </button>
    </header>
  );
}
