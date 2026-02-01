interface NavbarProps {
  activePage: 'bazar' | 'display' | 'leaderboard' | 'coding' | null;
  onNavigate: (page: 'bazar' | 'display' | 'leaderboard' | 'coding') => void;
  isLoggedIn?: boolean;
  onLogout?: () => void;
}

const PentagonLogo = () => (
  <svg viewBox="0 0 100 100" className="w-8 sm:w-9 md:w-10 h-8 sm:h-9 md:h-10 flex-shrink-0">
    <defs>
      <linearGradient id="pentagonGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style={{ stopColor: '#3b82f6', stopOpacity: 1 }} />
        <stop offset="100%" style={{ stopColor: '#9333ea', stopOpacity: 1 }} />
      </linearGradient>
    </defs>
    <polygon 
      points="50,10 90,35 76,85 24,85 10,35" 
      fill="none" 
      stroke="url(#pentagonGradient)" 
      strokeWidth="4" 
      strokeLinejoin="round"
    />
    <polygon 
      points="50,18 84,40 72,80 28,80 16,40" 
      fill="none" 
      stroke="url(#pentagonGradient)" 
      strokeWidth="2" 
      strokeLinejoin="round" 
      opacity="0.6"
    />
  </svg>
);

const Navbar = ({ activePage, onNavigate, isLoggedIn = false, onLogout }: NavbarProps) => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0f1729] border-b border-white/10">
      <div className="w-full px-2 sm:px-4 md:px-6 lg:px-8 py-2 sm:py-3 md:py-4">
        <div className="flex items-center justify-between gap-1 sm:gap-2 md:gap-4">
          {/* Logo Section - Fixed at left */}
          <div className="flex items-center gap-1 sm:gap-2 md:gap-3 flex-shrink-0 min-w-0">
            <PentagonLogo />
            <span className="text-sm sm:text-lg md:text-2xl font-bold text-white whitespace-nowrap hidden sm:inline">Pentathlon</span>
          </div>

          {/* Center Navigation Links - Show on all screens */}
          <div className="flex items-center gap-2 sm:gap-4 md:gap-12 absolute left-1/2 transform -translate-x-1/2">
            {!isLoggedIn && (
              <button
                onClick={() => onNavigate('bazar')}
                className={`text-xs sm:text-sm md:text-lg font-medium transition-all duration-300 pb-2 border-b-2 outline-none focus:outline-none focus:ring-0 whitespace-nowrap ${
                  activePage === 'bazar'
                    ? 'text-cyan-400 border-cyan-400'
                    : 'text-gray-300 hover:text-white border-b-2 border-transparent'
                }`}
              >
                Bazar
              </button>
            )}

            {!isLoggedIn && <div className="w-px h-5 sm:h-6 bg-white/20"></div>}

            {!isLoggedIn && (
              <button
                onClick={() => onNavigate('coding')}
                className={`text-xs sm:text-sm md:text-lg font-medium transition-all duration-300 pb-2 border-b-2 outline-none focus:outline-none focus:ring-0 whitespace-nowrap ${
                  activePage === 'coding'
                    ? 'text-cyan-400 border-cyan-400'
                    : 'text-gray-300 hover:text-white border-b-2 border-transparent'
                }`}
              >
                Coding
              </button>
            )}

            {isLoggedIn && <div className="w-px h-5 sm:h-6 bg-white/20"></div>}

            {isLoggedIn && (
              <button
                onClick={() => onNavigate('display')}
                className={`text-xs sm:text-sm md:text-lg font-medium transition-all duration-300 pb-2 border-b-2 outline-none focus:outline-none focus:ring-0 whitespace-nowrap ${
                  activePage === 'display'
                    ? 'text-cyan-400 border-cyan-400'
                    : 'text-gray-300 hover:text-white border-b-2 border-transparent'
                }`}
              >
                Display
              </button>
            )}

            {isLoggedIn && <div className="w-px h-5 sm:h-6 bg-white/20"></div>}

            {isLoggedIn && (
              <button
                onClick={() => onNavigate('leaderboard')}
                className={`text-xs sm:text-sm md:text-lg font-medium transition-all duration-300 pb-2 border-b-2 outline-none focus:outline-none focus:ring-0 whitespace-nowrap ${
                  activePage === 'leaderboard'
                    ? 'text-cyan-400 border-cyan-400'
                    : 'text-gray-300 hover:text-white border-b-2 border-transparent'
                }`}
              >
                Leaderboard
              </button>
            )}
          </div>

          {/* Right Side - Logout Button */}
          {isLoggedIn && onLogout && (
            <button
              onClick={onLogout}
              className="px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm md:text-base bg-red-500/20 border border-red-500/50 text-red-400 hover:bg-red-500/30 hover:border-red-500 transition-all font-medium flex-shrink-0 whitespace-nowrap"
            >
              Logout
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
