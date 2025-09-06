/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useRef, useEffect } from 'react';

const SpeakerOnIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.007 9.007 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.757 3.63 8.25 4.51 8.25H6.75z" />
    </svg>
);

const SpeakerOffIcon = () => (
     <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75L19.5 12m0 0l2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.007 9.007 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.757 3.63 8.25 4.51 8.25H6.75z" />
    </svg>
);

interface MusicPlayerProps {
    isSharedView?: boolean;
}

const MusicPlayer: React.FC<MusicPlayerProps> = ({ isSharedView = false }) => {
    const [isEnabled, setIsEnabled] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [isWaitingForUserInteraction, setIsWaitingForUserInteraction] = useState(false);

    useEffect(() => {
        console.log('🎵 MusicPlayer: Component mounting, isSharedView:', isSharedView);
        
        try {
            audioRef.current = new Audio('/background-music.mp3');
            audioRef.current.loop = true;
            audioRef.current.volume = 0.3;
            console.log('🎵 Audio object created successfully, src:', audioRef.current.src);
            
            // Add load error listener
            audioRef.current.addEventListener('error', (e) => {
                console.error('🎵 Audio load error:', e, 'Network state:', audioRef.current?.networkState, 'Ready state:', audioRef.current?.readyState);
            });
            
            audioRef.current.addEventListener('loadstart', () => {
                console.log('🎵 Audio load started');
            });
            
            audioRef.current.addEventListener('canplay', () => {
                console.log('🎵 Audio can play');
            });
            
            audioRef.current.addEventListener('loadeddata', () => {
                console.log('🎵 Audio data loaded');
            });
            
        } catch (error) {
            console.error('🎵 Failed to create Audio object:', error);
            return;
        }

        // Add audio event listeners to sync button state with actual playback
        const audio = audioRef.current;
        
        const handlePlay = () => {
            console.log('🎵 Audio play event fired', {
                currentTime: audioRef.current?.currentTime,
                duration: audioRef.current?.duration,
                volume: audioRef.current?.volume,
                muted: audioRef.current?.muted,
                paused: audioRef.current?.paused
            });
            
            // Ensure audio is not muted when play event fires
            if (audioRef.current?.muted) {
                console.log('🎵 Audio was muted, unmuting now');
                audioRef.current.muted = false;
            }
            
            setIsEnabled(true);
            setIsWaitingForUserInteraction(false);
        };
        
        const handlePause = () => {
            console.log('🎵 Audio pause event fired');
            setIsEnabled(false);
        };
        
        const handleEnded = () => {
            console.log('🎵 Audio ended event fired');
            setIsEnabled(false);
        };
        
        if (!audio) {
            console.error('🎵 Audio object is null, cannot add event listeners');
            return;
        }
        
        audio.addEventListener('play', handlePlay);
        audio.addEventListener('pause', handlePause);
        audio.addEventListener('ended', handleEnded);
        console.log('🎵 Event listeners added to audio object');

        // Auto-play when component mounts with multiple strategies
        const playAudio = async () => {
            console.log('🎵 Attempting to play audio, current state:', {
                paused: audioRef.current?.paused,
                currentTime: audioRef.current?.currentTime,
                duration: audioRef.current?.duration,
                readyState: audioRef.current?.readyState,
                networkState: audioRef.current?.networkState
            });
            
            try {
                // Strategy 1: Direct play
                await audioRef.current?.play();
                console.log('🎵 Direct auto-play succeeded');
            } catch (error) {
                console.log('🎵 Direct auto-play failed:', error);
                
                if (isSharedView) {
                    // Strategy 2: Try with muted audio first (browsers often allow this)
                    try {
                        audioRef.current!.muted = true;
                        await audioRef.current?.play();
                        console.log('Muted auto-play succeeded, unmuting...');
                        // Unmute after a short delay
                        setTimeout(() => {
                            if (audioRef.current) {
                                audioRef.current.muted = false;
                            }
                        }, 100);
                    } catch (mutedError) {
                        console.log('Muted auto-play also failed:', mutedError);
                        setIsWaitingForUserInteraction(true);
                    }
                } else {
                    setIsWaitingForUserInteraction(false);
                }
            }
        };
        
        playAudio();

        // Add multiple event listeners to start music on first user interaction
        let clickHandler: (() => void) | null = null;
        
        const createInteractionHandler = () => {
            clickHandler = async () => {
                try {
                    await audioRef.current?.play();
                    // setIsEnabled will be called by the 'play' event listener
                    // Remove all event listeners
                    document.removeEventListener('click', clickHandler!);
                    document.removeEventListener('touchstart', clickHandler!);
                    document.removeEventListener('keydown', clickHandler!);
                    document.removeEventListener('scroll', clickHandler!);
                    clickHandler = null;
                } catch (error) {
                    console.log('Music playback failed on interaction:', error);
                }
            };
            
            // Listen for multiple types of user interactions
            document.addEventListener('click', clickHandler, { once: true });
            document.addEventListener('touchstart', clickHandler, { once: true });
            document.addEventListener('keydown', clickHandler, { once: true });
            document.addEventListener('scroll', clickHandler, { once: true });
        };

        // Try to set up interaction handlers and multiple play attempts (always, not just in shared view)
        if (true) { // Always try aggressive auto-play
            createInteractionHandler();
            
            // Multiple delayed play attempts at different intervals
            const playAttempts = [100, 500, 1000, 2000];
            playAttempts.forEach((delay) => {
                setTimeout(async () => {
                    try {
                        if (audioRef.current?.paused) {
                            await audioRef.current?.play();
                            console.log(`Auto-play succeeded after ${delay}ms delay`);
                        }
                    } catch (error) {
                        console.log(`Auto-play attempt failed after ${delay}ms:`, error);
                        // Try muted play as fallback
                        try {
                            if (audioRef.current?.paused) {
                                audioRef.current.muted = true;
                                await audioRef.current?.play();
                                console.log(`Muted auto-play succeeded after ${delay}ms, unmuting...`);
                                setTimeout(() => {
                                    if (audioRef.current) {
                                        audioRef.current.muted = false;
                                    }
                                }, 100);
                            }
                        } catch (mutedError) {
                            console.log(`Muted auto-play also failed after ${delay}ms:`, mutedError);
                        }
                    }
                }, delay);
            });
            
            // Also try to play when the page becomes visible (if user switched tabs)
            const handleVisibilityChange = async () => {
                if (!document.hidden && audioRef.current?.paused) {
                    try {
                        await audioRef.current?.play();
                    } catch (error) {
                        console.log('Visibility change auto-play failed:', error);
                    }
                }
            };
            
            document.addEventListener('visibilitychange', handleVisibilityChange);
            
            // Strategy 3: Use Intersection Observer to try playing when page content is visible
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(async (entry) => {
                    if (entry.isIntersecting && audioRef.current?.paused) {
                        try {
                            await audioRef.current?.play();
                            console.log('Intersection Observer auto-play succeeded');
                            observer.disconnect();
                        } catch (error) {
                            console.log('Intersection Observer auto-play failed:', error);
                            // Try muted play
                            try {
                                audioRef.current!.muted = true;
                                await audioRef.current?.play();
                                console.log('Intersection Observer muted auto-play succeeded, unmuting...');
                                setTimeout(() => {
                                    if (audioRef.current) {
                                        audioRef.current.muted = false;
                                    }
                                }, 100);
                                observer.disconnect();
                            } catch (mutedError) {
                                console.log('Intersection Observer muted auto-play also failed:', mutedError);
                            }
                        }
                    }
                });
            }, { threshold: 0.1 });
            
            // Observe the document body
            if (document.body) {
                observer.observe(document.body);
            }
            
            // Try to play when DOM is ready and page is fully loaded
            if (document.readyState === 'complete') {
                setTimeout(async () => {
                    try {
                        if (audioRef.current?.paused) {
                            await audioRef.current?.play();
                            console.log('Auto-play succeeded on page load complete');
                        }
                    } catch (error) {
                        console.log('Page load auto-play failed:', error);
                    }
                }, 100);
            } else {
                window.addEventListener('load', async () => {
                    setTimeout(async () => {
                        try {
                            if (audioRef.current?.paused) {
                                await audioRef.current?.play();
                                console.log('Auto-play succeeded on window load');
                            }
                        } catch (error) {
                            console.log('Window load auto-play failed:', error);
                        }
                    }, 100);
                });
            }
            
            // Cleanup visibility listener
            return () => {
                if (audioRef.current) {
                    // Remove audio event listeners
                    audioRef.current.removeEventListener('play', handlePlay);
                    audioRef.current.removeEventListener('pause', handlePause);
                    audioRef.current.removeEventListener('ended', handleEnded);
                    audioRef.current.pause();
                    audioRef.current = null;
                }
                if (clickHandler) {
                    document.removeEventListener('click', clickHandler);
                    document.removeEventListener('touchstart', clickHandler);
                    document.removeEventListener('keydown', clickHandler);
                    document.removeEventListener('scroll', clickHandler);
                }
                document.removeEventListener('visibilitychange', handleVisibilityChange);
                observer.disconnect();
            };
        } else if (isWaitingForUserInteraction) {
            createInteractionHandler();
        }

        // Default cleanup for non-shared view
        return () => {
            if (audioRef.current) {
                // Remove audio event listeners
                audioRef.current.removeEventListener('play', handlePlay);
                audioRef.current.removeEventListener('pause', handlePause);
                audioRef.current.removeEventListener('ended', handleEnded);
                audioRef.current.pause();
                audioRef.current = null;
            }
            if (clickHandler) {
                document.removeEventListener('click', clickHandler);
                document.removeEventListener('touchstart', clickHandler);
                document.removeEventListener('keydown', clickHandler);
                document.removeEventListener('scroll', clickHandler);
            }
        };
    }, [isSharedView]);

    // Additional effect to handle isSharedView changes after initial mount
    useEffect(() => {
        if (isSharedView && audioRef.current?.paused) {
            console.log('isSharedView changed to true, attempting to play music...');
            
            const attemptPlay = async () => {
                try {
                    await audioRef.current?.play();
                    console.log('Play succeeded after isSharedView change');
                } catch (error) {
                    console.log('Direct play failed after isSharedView change:', error);
                    // Try muted play
                    try {
                        if (audioRef.current) {
                            audioRef.current.muted = true;
                            await audioRef.current?.play();
                            console.log('Muted play succeeded after isSharedView change, unmuting...');
                            setTimeout(() => {
                                if (audioRef.current) {
                                    audioRef.current.muted = false;
                                }
                            }, 100);
                        }
                    } catch (mutedError) {
                        console.log('Muted play also failed after isSharedView change:', mutedError);
                    }
                }
            };
            
            // Try immediately and with delays
            attemptPlay();
            setTimeout(attemptPlay, 100);
            setTimeout(attemptPlay, 500);
            setTimeout(attemptPlay, 1000);
        }
    }, [isSharedView]);

    const toggleMusic = async () => {
        console.log('🎵 toggleMusic called, current state:', {
            isEnabled,
            audioExists: !!audioRef.current,
            paused: audioRef.current?.paused,
            readyState: audioRef.current?.readyState
        });
        
        if (!audioRef.current) {
            console.error('🎵 Audio object is null in toggleMusic');
            return;
        }

        try {
            if (isEnabled) {
                console.log('🎵 Attempting to pause audio');
                audioRef.current.pause();
                // setIsEnabled will be called by the 'pause' event listener
            } else {
                console.log('🎵 Attempting to play audio manually');
                
                // Ensure audio is not muted before playing
                if (audioRef.current.muted) {
                    console.log('🎵 Unmuting audio before manual play');
                    audioRef.current.muted = false;
                }
                
                await audioRef.current.play();
                // setIsEnabled will be called by the 'play' event listener
                
                // Check if audio is actually playing after a short delay
                setTimeout(() => {
                    console.log('🎵 Audio status check after play attempt:', {
                        paused: audioRef.current?.paused,
                        currentTime: audioRef.current?.currentTime,
                        volume: audioRef.current?.volume,
                        muted: audioRef.current?.muted
                    });
                }, 100);
            }
        } catch (error) {
            console.error('🎵 Audio playback failed in toggleMusic:', error);
        }
    };

    return (
        <div className="fixed top-5 right-5 z-50">
            <button
                onClick={toggleMusic}
                className="p-3 bg-black/50 backdrop-blur-sm rounded-full text-white hover:bg-black/75 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all"
                aria-label={isEnabled ? "Disable music" : "Enable music"}
                title={isEnabled ? "Disable music" : "Enable music"}
            >
                {isEnabled ? <SpeakerOnIcon /> : <SpeakerOffIcon />}
            </button>
        </div>
    );
};

export default MusicPlayer;