import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.ts';

interface SchoolLeaderboard {
  id: number;
  school_name: string;
  press_count?: number;
  pressed_at: string;
}

interface LeaderboardProps {
  onFullscreenChange?: (isFullscreen: boolean) => void;
}

const Leaderboard = ({ onFullscreenChange }: LeaderboardProps) => {
  const [leaderboard, setLeaderboard] = useState<SchoolLeaderboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Toggle fullscreen
  const toggleFullscreen = async () => {
    try {
      const elem = document.documentElement;
      if (!isFullscreen) {
        // Request fullscreen
        if (elem.requestFullscreen) {
          await elem.requestFullscreen();
        } else if ((elem as any).webkitRequestFullscreen) {
          await (elem as any).webkitRequestFullscreen();
        } else if ((elem as any).mozRequestFullScreen) {
          await (elem as any).mozRequestFullScreen();
        } else if ((elem as any).msRequestFullscreen) {
          await (elem as any).msRequestFullscreen();
        }
        setIsFullscreen(true);
        onFullscreenChange?.(true);
      } else {
        // Exit fullscreen
        if (document.fullscreenElement || (document as any).webkitFullscreenElement || (document as any).mozFullScreenElement) {
          if (document.exitFullscreen) {
            await document.exitFullscreen();
          } else if ((document as any).webkitExitFullscreen) {
            await (document as any).webkitExitFullscreen();
          } else if ((document as any).mozCancelFullScreen) {
            await (document as any).mozCancelFullScreen();
          } else if ((document as any).msExitFullscreen) {
            await (document as any).msExitFullscreen();
          }
        }
        setIsFullscreen(false);
        onFullscreenChange?.(false);
      }
    } catch (err) {
      console.error('Fullscreen toggle error:', err);
    }
  };

  // Fetch leaderboard data sorted by press time
  const fetchLeaderboard = async () => {
    try {
      const { data, error } = await supabase
        .from('schools')
        .select('id, school_name, press_count, pressed_at')
        .not('pressed_at', 'is', null)
        .order('pressed_at', { ascending: true })
        .limit(100);

      if (error) {
        console.error('Error fetching leaderboard:', error);
      } else {
        setLeaderboard(data || []);
        setLoading(false);
      }
    } catch (err) {
      console.error('Failed to fetch leaderboard:', err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();

    // Subscribe to real-time updates
    const subscription = supabase
      .channel('schools-leaderboard')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'schools' },
        () => {
          fetchLeaderboard();
        }
      )
      .subscribe();

    // Subscribe to broadcast reset event
    const broadcastSubscription = supabase
      .channel('buzzer-broadcast')
      .on('broadcast', { event: 'BUZZER_RESET' }, () => {
        fetchLeaderboard();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
      broadcastSubscription.unsubscribe();
    };
  }, []);

  // Get medal info for each position
  const getMedalInfo = (position: number) => {
    switch (position) {
      case 1:
        return {
          color: 'from-yellow-400 to-yellow-600',
          textColor: 'text-yellow-400',
          bgColor: 'bg-yellow-500',
          emoji: '🥇',
          label: '1'
        };
      case 2:
        return {
          color: 'from-gray-300 to-gray-500',
          textColor: 'text-gray-400',
          bgColor: 'bg-gray-400',
          emoji: '🥈',
          label: '2'
        };
      case 3:
        return {
          color: 'from-orange-400 to-orange-600',
          textColor: 'text-orange-400',
          bgColor: 'bg-orange-500',
          emoji: '🥉',
          label: '3'
        };
      default:
        return {
          color: 'from-blue-400 to-blue-600',
          textColor: 'text-blue-400',
          bgColor: 'bg-blue-500',
          emoji: '🎖️',
          label: position.toString()
        };
    }
  };

  // Get avatar background color (consistent per school)
  const getAvatarColor = (schoolName: string) => {
    const colors = [
      'from-pink-400 to-pink-600',
      'from-purple-400 to-purple-600',
      'from-blue-400 to-blue-600',
      'from-cyan-400 to-cyan-600',
      'from-teal-400 to-teal-600',
    ];
    const hash = schoolName.charCodeAt(0) % colors.length;
    return colors[hash];
  };

  // Get initials from school name
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-80px)] bg-[#0f1729] p-3 sm:p-6 md:p-12 flex items-center justify-center">
        <p className="text-white text-sm sm:text-base md:text-lg">Loading leaderboard...</p>
      </div>
    );
  }

  return (
    <>
      {/* Fullscreen Button - Outside Main Container */}
      <button
        onClick={toggleFullscreen}
        className="fixed bottom-6 right-6 w-12 h-12 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 hover:scale-110 transition-all duration-300 shadow-lg shadow-blue-400/30 flex items-center justify-center text-white font-bold text-lg z-50"
        title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
      >
        {isFullscreen ? '✕' : '⛶'}
      </button>

      <div className="min-h-[calc(100vh-80px)] bg-[#0f1729] p-3 sm:p-6 md:p-12 flex flex-col items-center gap-6 sm:gap-8 md:gap-10" style={{ paddingTop: isFullscreen ? '0' : 'auto', minHeight: isFullscreen ? '100vh' : 'calc(100vh-80px)' }}>
        <div className="w-full max-w-4xl">
        {/* Title */}
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white text-center mb-8 sm:mb-12">
          LEADERBOARD
        </h1>

        {leaderboard.length === 0 ? (
          <div className="text-center">
            <p className="text-gray-300 text-sm sm:text-base md:text-lg">
              No schools have pressed the buzzer yet.
            </p>
          </div>
        ) : (
          <div className="space-y-4 sm:space-y-6">
            {leaderboard.map((school, index) => {
              const position = index + 1;
              const medal = getMedalInfo(position);
              const avatarColor = getAvatarColor(school.school_name);
              const initials = getInitials(school.school_name);

              return (
                <div
                  key={school.id}
                  className="relative bg-gradient-to-r from-pink-500 via-pink-400 to-yellow-300 p-0.5 rounded-2xl sm:rounded-3xl transition-all duration-300 hover:scale-105 hover:shadow-2xl group"
                >
                  <div className="bg-[#1a2332] p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl flex items-center gap-4 sm:gap-6 md:gap-8">
                    {/* Medal Badge */}
                    <div className="relative flex-shrink-0">
                      <div
                        className={`w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-br ${medal.color} flex items-center justify-center shadow-lg`}
                      >
                        <span className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">
                          {medal.label}
                        </span>
                      </div>
                      {position <= 3 && (
                        <div className="absolute -top-2 -right-2 text-2xl sm:text-3xl md:text-4xl">
                          {medal.emoji}
                        </div>
                      )}
                    </div>

                    {/* Avatar and Name */}
                    <div className="flex items-center gap-3 sm:gap-4 md:gap-5 flex-1">
                      <div
                        className={`w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-full bg-gradient-to-br ${avatarColor} flex items-center justify-center shadow-lg flex-shrink-0`}
                      >
                        <span className="text-white font-bold text-sm sm:text-base md:text-lg">
                          {initials}
                        </span>
                      </div>

                      <div className="flex-1">
                        <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-white">
                          {school.school_name}
                        </h3>
                      </div>
                    </div>

                    {/* Score */}
                    <div className="text-right flex-shrink-0">
                      <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">
                        {school.press_count || 0}
                      </div>
                      <p className="text-gray-400 text-xs sm:text-sm mt-1">Presses</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        </div>
      </div>
    </>
  );
};

export default Leaderboard;
