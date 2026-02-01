import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase.ts';

type BazarStep = 'form' | 'buzzer' | 'display';

interface BazarProps {
  onFullscreenChange?: (isFullscreen: boolean) => void;
}

const Bazar = ({ onFullscreenChange }: BazarProps) => {
  const [step, setStep] = useState<BazarStep>(() => {
    const saved = localStorage.getItem('bazarStep');
    return (saved as BazarStep) || 'form';
  });

  const [isFullscreen, setIsFullscreen] = useState(false);

  const [schoolName, setSchoolName] = useState(() => {
    return localStorage.getItem('schoolName') || '';
  });

  const [hasPressed, setHasPressed] = useState(false);
  const [loading, setLoading] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const [sessionToken] = useState<string>(() => {
    const existing = localStorage.getItem('bazarSessionToken');
    if (existing) return existing;
    const token = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
    localStorage.setItem('bazarSessionToken', token);
    return token;
  });

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

  useEffect(() => {
    localStorage.setItem('bazarStep', step);
  }, [step]);

  useEffect(() => {
    localStorage.setItem('schoolName', schoolName);
  }, [schoolName]);

  // Check if school has already pressed when entering buzzer step
  useEffect(() => {
    if (step === 'buzzer' && schoolName.trim()) {
      checkIfAlreadyPressed();
    }
  }, [step, schoolName]);

  const checkIfAlreadyPressed = async () => {
    try {
      const { data: schoolData, error } = await supabase
        .from('schools')
        .select('pressed_at')
        .eq('school_name', schoolName.trim())
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error checking pressed status:', error);
      } else if (schoolData && schoolData.pressed_at) {
        setHasPressed(true);
      } else {
        setHasPressed(false);
      }
    } catch (err) {
      console.error('Failed to check pressed status:', err);
    }
  };

  // Subscribe to buzzer reset changes
  useEffect(() => {
    if (step === 'buzzer' && schoolName.trim()) {
      const subscription = supabase
        .channel(`buzzer-reset-${schoolName.trim()}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'schools'
          },
          (payload: any) => {
            // Check if this is our school and if pressed_at was cleared
            if (payload.new.school_name === schoolName.trim() && payload.new.pressed_at === null) {
              setHasPressed(false);
            }
          }
        )
        .subscribe();

      const broadcastSubscription = supabase
        .channel('buzzer-broadcast')
        .on('broadcast', { event: 'BUZZER_RESET' }, () => {
          // Reset button for all users when admin clears data
          setHasPressed(false);
        })
        .subscribe();

      return () => {
        subscription.unsubscribe();
        broadcastSubscription.unsubscribe();
      };
    }
  }, [step, schoolName]);

  const handleNext = async () => {
    if (schoolName.trim()) {
      // Save to Supabase
      try {
        const { data: existingSchool, error: fetchError } = await supabase
          .from('schools')
          .select('*, session_token, session_expires')
          .eq('school_name', schoolName.trim())
          .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
          console.error('Error fetching school:', fetchError);
        } else if (existingSchool) {
          // Block if another active session exists for this school
          const expiresAt = existingSchool.session_expires ? new Date(existingSchool.session_expires).getTime() : 0;
          const isActive = !expiresAt || expiresAt > Date.now();
          if (existingSchool.session_token && existingSchool.session_token !== sessionToken && isActive) {
            alert('This school name is already active on another device/tab. Please use a different name or wait until the other session ends.');
            return;
          }

          // School already exists, just update
          const { error } = await supabase
            .from('schools')
            .update({
              login_at: new Date().toISOString(),
              session_token: sessionToken,
              session_expires: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString() // 8 hours
            })
            .eq('school_name', schoolName.trim());

          if (error) {
            console.error('Error updating school:', error);
          } else {
            console.log('School updated successfully');
          }
        } else {
          // Enforce max 10 schools total
          const { count, error: countError } = await supabase
            .from('schools')
            .select('id', { count: 'exact', head: true });

          if (countError) {
            console.error('Error counting schools:', countError);
            alert('Could not verify available slots. Please try again.');
            return;
          }

          if (count !== null && count >= 10) {
            alert('Maximum number of schools (10) already registered.');
            return;
          }

          // New school - insert it
          const { error } = await supabase
            .from('schools')
            .insert([{
              school_name: schoolName.trim(),
              login_at: new Date().toISOString(),
              session_token: sessionToken,
              session_expires: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()
            }]);

          if (error) {
            console.error('Error inserting school:', error);
          } else {
            console.log('School saved successfully');
          }
        }
      } catch (err) {
        console.error('Failed to save school name:', err);
      }

      setStep('buzzer');
    }
  };

  const handleBuzzerClick = async () => {
    // Create buzzer sound using Web Audio API
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Create oscillator for the buzzer tone
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      // Configure buzzer sound - harsh, loud tone
      oscillator.type = 'square'; // Square wave for harsh buzzer sound
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime); // 800Hz buzzer frequency
      
      // Envelope for sharp attack and quick decay
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.5, audioContext.currentTime + 0.01); // Fast attack
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4); // Quick decay
      
      // Connect nodes
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Play sound
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.4);
      
      // Cleanup
      setTimeout(() => {
        audioContext.close();
      }, 500);
    } catch (err) {
      console.error("Audio play error:", err);
    }

    // Save buzzer press to Supabase (no auth)
    try {
      const trimmedName = schoolName.trim();
      if (!trimmedName) {
        console.error('Missing school name for buzzer press');
        return;
      }

      // Ensure this device owns the session for this school
      const { data: schoolRow, error: fetchErr } = await supabase
        .from('schools')
        .select('session_token, session_expires')
        .eq('school_name', trimmedName)
        .single();

      if (fetchErr) {
        console.error('Error validating session:', fetchErr);
        alert('Could not validate session for this school.');
        return;
      }

      const expiresAt = schoolRow?.session_expires ? new Date(schoolRow.session_expires).getTime() : 0;
      const isActive = !expiresAt || expiresAt > Date.now();
      if (!schoolRow || (schoolRow.session_token && schoolRow.session_token !== sessionToken && isActive)) {
        alert('Another device is already using this school name right now.');
        return;
      }

      // Update pressed_at (trigger will auto-increment press_count and set to current time)
      const { error } = await supabase
        .from('schools')
        .update({
          pressed_at: new Date().toISOString() // Trigger will override with NOW()
        })
        .eq('school_name', trimmedName)
        .eq('session_token', sessionToken);

      if (error) {
        console.error('Error updating buzzer press:', error);
      } else {
        console.log('Buzzer pressed successfully');
        setHasPressed(true);
      }
    } catch (err) {
      console.error('Failed to update buzzer press:', err);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  if (step === 'form') {
    return (
      <div className="min-h-[calc(100vh-80px)] flex items-center justify-center p-3 sm:p-4 md:p-6">
        <div className="bg-[#1a2332] border border-white/10 w-full max-w-md p-4 sm:p-6 md:p-8 rounded-lg sm:rounded-xl md:rounded-2xl shadow-xl">
          <h2 className="text-2xl sm:text-3xl md:text-3xl font-bold gradient-text mb-4 sm:mb-6 text-center">
            Welcome to Bazar
          </h2>
          
          <div className="space-y-4 sm:space-y-6">
            <div>
              <label 
                htmlFor="schoolName" 
                className="block text-xs sm:text-sm font-medium text-gray-300 mb-2"
              >
                School Name
              </label>
              <input
                id="schoolName"
                type="text"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                className="w-full px-3 sm:px-4 py-2 sm:py-3 rounded-lg bg-[#0f1729] border border-white/20 text-white text-sm sm:text-base placeholder-gray-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 transition-all outline-none"
                placeholder="Enter your school name"
              />
            </div>

            <button
              onClick={handleNext}
              disabled={!schoolName.trim()}
              className={`w-full py-2 sm:py-3 px-4 sm:px-6 rounded-lg text-sm sm:text-base font-semibold text-white transition-all duration-300 ${
                schoolName.trim()
                  ? 'bg-gradient-to-r from-blue-500 to-purple-600 hover:shadow-lg hover:scale-105 neon-glow'
                  : 'bg-gray-300 cursor-not-allowed'
              }`}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'buzzer') {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#0f1729]" style={{ paddingTop: isFullscreen ? '0' : '80px' }}>
        <div className="text-center px-4">
          <button
            onClick={handleBuzzerClick}
            disabled={hasPressed}
            className={`w-80 h-80 sm:w-96 sm:h-96 md:w-[28rem] md:h-[28rem] rounded-full transition-all duration-300 shadow-lg shadow-red-400/30 flex items-center justify-center ${
              hasPressed
                ? 'bg-gradient-to-br from-gray-500 to-gray-700 cursor-not-allowed opacity-50'
                : 'bg-gradient-to-br from-red-400 to-red-600 hover:scale-110 hover:shadow-xl cursor-pointer'
            }`}
            style={{
              boxShadow: hasPressed ? 'none' : '0 20px 40px rgba(239, 68, 68, 0.3)',
            }}
          >
            <span className="text-white text-3xl sm:text-4xl md:text-5xl font-bold">
              {hasPressed ? 'ALREADY\nPRESSED' : 'BUZZ'}
            </span>
          </button>
          {hasPressed && (
            <p className="text-gray-400 text-sm sm:text-base md:text-lg mt-8">
              Your school has already pressed. Waiting for admin to reset...
            </p>
          )}
        </div>
        {/* Fullscreen Toggle Button - Bottom Right Corner */}
        <button
          onClick={toggleFullscreen}
          className="fixed bottom-6 right-6 w-12 h-12 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 hover:scale-110 transition-all duration-300 shadow-lg shadow-blue-400/30 flex items-center justify-center text-white font-bold text-lg"
          title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
        >
          {isFullscreen ? '✕' : '⛶'}
        </button>
      </div>
    );
  }

  return null;
};

export default Bazar;
