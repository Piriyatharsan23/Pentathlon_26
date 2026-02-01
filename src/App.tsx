import { useEffect, useState } from 'react';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import Navbar from './components/Navbar';
import Bazar from './pages/Bazar';
import Display from './pages/Display';
import Leaderboard from './pages/Leaderboard';
import Coding from './pages/Coding';
import Login from './pages/Login';
import { supabase } from './lib/supabase.ts';
import './App.css';

type Page = 'bazar' | 'display' | 'leaderboard' | 'coding';

function App() {
  const [activePage, setActivePage] = useState<Page>(() => {
    const saved = localStorage.getItem('activePage');
    return (saved as Page) || 'bazar';
  });

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isBazarFullscreen, setIsBazarFullscreen] = useState(false);
  const [isLeaderboardFullscreen, setIsLeaderboardFullscreen] = useState(false);
  
  // Restore path from 404 redirect
  useEffect(() => {
    const redirectPath = sessionStorage.getItem('redirectPath');
    if (redirectPath) {
      sessionStorage.removeItem('redirectPath');
      window.history.replaceState({}, '', redirectPath);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('activePage', activePage);
  }, [activePage]);

  // Prevent guests from landing on display if it was previously saved
  useEffect(() => {
    if (!isLoggedIn && activePage === 'display') {
      setActivePage('bazar');
    }
  }, [isLoggedIn, activePage]);

  useEffect(() => {
    const syncSession = async () => {
      // Check if user is already logged in
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      setIsLoggedIn(Boolean(session));
      if (session) {
        setActivePage('display');
      }
    };

    void syncSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((
      _event: AuthChangeEvent,
      session: Session | null
    ) => {
      setIsLoggedIn(Boolean(session));
      if (session) {
        setActivePage('display');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleNavigate = (page: Page) => {
    setActivePage(page);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsLoggedIn(false);
    setActivePage('bazar');
    // Force guests to the login portal after logout
    window.history.pushState({}, '', '/login');
  };

  // Detect /login even when hosted under a subpath (e.g., /Pentathlon_26/login)
  const isLoginRoute = typeof window !== 'undefined'
    && window.location.pathname.toLowerCase().endsWith('/login');

  return (
    <div className="min-h-screen bg-[#0f1729]">
      {!isLoginRoute && !isBazarFullscreen && !isLeaderboardFullscreen && <Navbar activePage={activePage} onNavigate={handleNavigate} isLoggedIn={isLoggedIn} onLogout={handleLogout} />}
      <main className={isBazarFullscreen || isLeaderboardFullscreen ? '' : 'pt-20'}>
        {isLoginRoute ? (
          <Login onLoginSuccess={() => {
            setIsLoggedIn(true);
            setActivePage('display');
            window.history.pushState({}, '', '/');
          }} />
        ) : (
          <>
            {activePage === 'bazar' && !isLoggedIn && <Bazar onFullscreenChange={setIsBazarFullscreen} />}
            {activePage === 'coding' && !isLoggedIn && <Coding />}
            {activePage === 'display' && isLoggedIn && <Display isLoggedIn={isLoggedIn} />}
            {activePage === 'leaderboard' && isLoggedIn && <Leaderboard onFullscreenChange={setIsLeaderboardFullscreen} />}
          </>
        )}
      </main>
    </div>
  );
}

export default App;
