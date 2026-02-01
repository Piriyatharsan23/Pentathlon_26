import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.ts';

interface School {
  id: number;
  school_name: string;
  pressed_at: string;
  created_at: string;
}

interface DisplayProps {
  isLoggedIn?: boolean;
}

const Display = ({ isLoggedIn = false }: DisplayProps) => {
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Fetch leaderboard data
  const fetchSchools = async () => {
    try {
      const { data, error } = await supabase
        .from('schools')
        .select('id, school_name, pressed_at, created_at')
        .not('pressed_at', 'is', null)
        .order('pressed_at', { ascending: true })
        .limit(100); // Limit to 100 records for faster load

      if (error) {
        console.error('Error fetching schools:', error);
      } else {
        setSchools(data || []);
        setLoading(false);
      }
    } catch (err) {
      console.error('Failed to fetch schools:', err);
      setLoading(false);
    }
  };

  const handleResetBuzzer = async () => {
    if (!confirm('Are you sure you want to reset all buzzer data? This will clear press times and counts.')) {
      return;
    }
    
    setResetting(true);
    try {
      const { error } = await supabase
        .from('schools')
        .update({ pressed_at: null, press_count: 0 })
        .gte('id', 0); // Update all rows (id >= 0)
      
      if (error) throw error;
      
      // Broadcast reset event to all users
      await supabase
        .channel('buzzer-broadcast')
        .send({
          type: 'broadcast',
          event: 'BUZZER_RESET',
          payload: { timestamp: new Date().toISOString() }
        });
      
      // Refresh the display
      fetchSchools();
      alert('Buzzer data reset successfully!');
    } catch (error) {
      console.error('Error resetting buzzer data:', error);
      alert('Failed to reset buzzer data');
    } finally {
      setResetting(false);
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm('⚠️ WARNING: This will permanently delete ALL school data! Are you absolutely sure?')) {
      return;
    }
    
    if (!confirm('This action cannot be undone. Type DELETE to confirm.')) {
      return;
    }
    
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('schools')
        .delete()
        .gte('id', 0); // Delete all rows (id >= 0)
      
      if (error) throw error;
      
      setSchools([]);
      alert('All school data deleted successfully!');
    } catch (error) {
      console.error('Error deleting data:', error);
      alert('Failed to delete school data');
    } finally {
      setDeleting(false);
    }
  };

  // Medal colors and icons
  const getMedalColor = (position: number) => {
    switch(position) {
      case 1: return 'from-yellow-400 to-yellow-600'; // Gold
      case 2: return 'from-gray-300 to-gray-500'; // Silver
      case 3: return 'from-orange-400 to-orange-600'; // Bronze
      default: return 'from-blue-500 to-blue-700';
    }
  };

  const getMedalEmoji = (position: number) => {
    switch(position) {
      case 1: return '🏆';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return '🎖️';
    }
  };

  const getPositionText = (position: number) => {
    const suffixes = ['th', 'st', 'nd', 'rd'];
    return position + (suffixes[position % 10] || 'th');
  };

  useEffect(() => {
    fetchSchools();

    // Subscribe to real-time updates ONLY (no polling)
    const subscription = supabase
      .channel('schools-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'schools' },
        () => {
          // Refetch on any change
          fetchSchools();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-80px)] p-3 sm:p-6 md:p-12 flex items-center justify-center">
        <p className="text-white text-sm sm:text-base md:text-lg">Loading leaderboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-80px)] bg-[#0f1729] p-3 sm:p-6 md:p-12 flex flex-col items-center gap-6 sm:gap-8 md:gap-10">
      <div className="max-w-2xl w-full">
        {/* Title */}
        <h1 className="text-2xl sm:text-3xl md:text-5xl lg:text-6xl font-bold text-white text-center mb-6 sm:mb-10 md:mb-12 italic">
          Who Buzzed First?
        </h1>

        {schools.length === 0 ? (
          <div className="text-center">
            <p className="text-gray-300 text-sm sm:text-base md:text-lg">No schools have pressed the buzzer yet.</p>
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {schools.map((school, index) => {
              const position = index + 1;
              const medalColor = getMedalColor(position);
              const medalEmoji = getMedalEmoji(position);
              const positionText = getPositionText(position);

              return (
                <div
                  key={school.id}
                  className={`relative bg-gradient-to-r ${medalColor} p-0.5 rounded-lg transition-all duration-300 hover:scale-105 group`}
                >
                  <div className="bg-[#1a2332] p-3 sm:p-4 md:p-6 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                    {/* Position Badge */}
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className={`flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br ${medalColor} shadow-lg flex-shrink-0`}>
                        <div className="text-xl sm:text-3xl">{medalEmoji}</div>
                      </div>
                      
                      <div>
                        <div className={`text-2xl sm:text-3xl font-bold bg-gradient-to-r ${medalColor} bg-clip-text text-transparent`}>
                          {position}
                          <span className="text-sm sm:text-lg text-gray-400">
                            {positionText.replace(position.toString(), '')}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* School Name */}
                    <div className="text-left sm:text-right w-full sm:w-auto">
                      <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-white">
                        {school.school_name}
                      </h3>
                      <p className="text-gray-400 text-xs sm:text-sm mt-1">
                        {new Date(school.pressed_at).toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit',
                          second: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Admin Controls - Only visible when logged in, stacked below leaderboard */}
      {isLoggedIn && (
        <div className="max-w-3xl w-full px-3 sm:px-4 md:px-6 pb-8 md:pb-12">
          <h3 className="text-xl sm:text-2xl font-bold text-white mb-4 sm:mb-6 text-center">Admin Controls</h3>
          <div className="flex flex-col gap-4 sm:gap-6">
            {/* Reset Buzzer Card */}
            <div className="bg-[#1a2332] border border-white/10 rounded-lg sm:rounded-xl md:rounded-2xl p-3 sm:p-4 shadow-xl">
              <div className="flex items-start gap-2 sm:gap-3 mb-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center flex-shrink-0">
                  <span className="text-lg sm:text-2xl">🔄</span>
                </div>
                <div>
                  <h4 className="text-sm sm:text-lg font-bold text-white mb-1">Reset Buzzer Data</h4>
                  <p className="text-gray-400 text-xs sm:text-sm leading-relaxed">
                    Clear all buzzer press times and reset press counts to zero. School names will remain in the database. Use this to start a new round while keeping registered schools.
                  </p>
                </div>
              </div>
              <button
                onClick={handleResetBuzzer}
                disabled={resetting}
                className="w-full py-2 sm:py-3 px-4 sm:px-5 rounded-lg text-sm sm:text-base font-semibold text-white transition-all duration-300 bg-gradient-to-r from-yellow-500 to-orange-600 hover:shadow-lg hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resetting ? 'Resetting...' : 'Reset Buzzer Data'}
              </button>
            </div>

            {/* Delete All Data Card */}
            <div className="bg-[#1a2332] border border-red-500/30 rounded-lg sm:rounded-xl md:rounded-2xl p-3 sm:p-4 shadow-xl">
              <div className="flex items-start gap-2 sm:gap-3 mb-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center flex-shrink-0">
                  <span className="text-lg sm:text-2xl">⚠️</span>
                </div>
                <div>
                  <h4 className="text-sm sm:text-lg font-bold text-red-400 mb-1">Delete All Schools</h4>
                  <p className="text-gray-400 text-xs sm:text-sm leading-relaxed">
                    <span className="text-red-400 font-semibold">DANGER:</span> Permanently delete all school records from the database. This action cannot be undone. Use this to completely clear the system and start fresh.
                  </p>
                </div>
              </div>
              <button
                onClick={handleDeleteAll}
                disabled={deleting}
                className="w-full py-2 sm:py-3 px-4 sm:px-5 rounded-lg text-sm sm:text-base font-semibold text-white transition-all duration-300 bg-gradient-to-r from-red-500 to-red-700 hover:shadow-lg hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting ? 'Deleting...' : 'Delete All Data'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Display;
