import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, Pause, Mic, MessageCircle, Info, 
  Notebook as Notes, ChevronLeft, ChevronRight, Volume2, 
  Settings, Save, Image as ImageIcon, Type, 
  Music, ExternalLink, Send, Plus, Trash2, Sliders,
  LayoutDashboard, Monitor, Smartphone, Upload, X,
  GripVertical, Sparkles, Loader2, LogOut, LogIn,
  Maximize, Minimize, Frame, Wifi, Signal, Battery, RotateCcw, Hash,
  Video
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { cn } from '@/src/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { 
  db, auth, storage, 
  loginWithGoogle, logout, 
  handleFirestoreError, OperationType 
} from './firebase';
import { 
  doc, onSnapshot, setDoc, updateDoc, getDoc,
  Timestamp 
} from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { 
  ref, 
  uploadBytesResumable, 
  getDownloadURL 
} from 'firebase/storage';
import {
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// --- Types ---

interface SlideData {
  id: string;
  mediaType: 'image' | 'video' | 'gif';
  mediaUrl: string;
  textContent: string;
  slideType?: 'photo' | 'video';
  aspectRatio?: '1:1' | '4:3' | '3:4' | '9:16' | '16:9';
  audioUrl?: string;
  voiceId?: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
  useSpeakerBoost?: boolean;
  deeperDiveTitle?: string;
  deeperDiveContent?: string;
  deeperDiveImageUrl?: string;
  deeperDiveMediaType?: 'image' | 'video' | 'gif' | 'youtube';
}

interface ContentData {
  slides: SlideData[];
  globalVoiceId?: string;
}

const DEFAULT_CONTENT: ContentData = {
  globalVoiceId: 'F1QAmjRIjqM9llULermx',
  slides: [
    {
      id: 'slide-1',
      mediaType: 'image',
      mediaUrl: 'https://picsum.photos/seed/cinema/800/600',
      textContent: "The art of visual storytelling begins with understanding the relationship between light and shadow. In this module, we explore how cinematic lighting can evoke deep emotional responses from an audience.",
      slideType: 'photo',
      aspectRatio: '4:3',
      voiceId: 'F1QAmjRIjqM9llULermx',
      stability: 0.5,
      similarityBoost: 0.75,
      style: 0.0,
      useSpeakerBoost: true,
      deeperDiveTitle: "Cinematic Lighting Basics",
      deeperDiveContent: "Cinematic lighting isn't just about visibility; it's about mood. Key lighting techniques include Three-Point Lighting (Key, Fill, and Back light) which helps create depth and separation from the background.",
      deeperDiveImageUrl: "https://picsum.photos/seed/lighting-detail/800/450",
      deeperDiveMediaType: 'image'
    },
    {
      id: 'slide-2',
      mediaType: 'image',
      mediaUrl: 'https://picsum.photos/seed/lighting/800/600',
      textContent: "Notice how the high-contrast lighting in the image above creates a sense of mystery and tension. By scrolling through these notes, you'll learn the technical settings required to achieve this look.",
      slideType: 'photo',
      aspectRatio: '4:3',
      voiceId: 'F1QAmjRIjqM9llULermx',
      stability: 0.5,
      similarityBoost: 0.75,
      style: 0.0,
      useSpeakerBoost: true,
      deeperDiveTitle: "Technical Specs for High Contrast",
      deeperDiveContent: "To achieve high-contrast (Chiaroscuro) lighting, you need a strong key light and minimal fill. Using a low ISO (100-200) and a wide aperture (f/2.8) helps isolate the subject and keep the shadows deep and clean.",
      deeperDiveImageUrl: "https://picsum.photos/seed/tech-detail/800/450",
      deeperDiveMediaType: 'image'
    }
  ]
};

// --- Components ---

const MobileFrame = ({ 
  children, 
  onToggleAdmin,
  isLandscape = false
}: { 
  children: React.ReactNode, 
  onToggleAdmin: () => void,
  isLandscape?: boolean
}) => {
  const [time, setTime] = useState(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-100 p-4 overflow-hidden">
      {/* Admin Toggle */}
      <div className="fixed top-4 right-4 z-[200]">
        <Button 
          onClick={onToggleAdmin}
          className="bg-white text-neutral-900 hover:bg-neutral-100 shadow-lg rounded-full px-6 border border-neutral-200 font-bold"
        >
          <Settings className="mr-2 h-4 w-4" />
          Admin Dashboard
        </Button>
      </div>

      <motion.div 
        className="relative w-full max-w-[400px] aspect-[9/19] bg-white rounded-[3rem] shadow-2xl border-[8px] border-neutral-900 overflow-hidden flex flex-col transition-all duration-700 ease-in-out"
        animate={{ 
          rotate: isLandscape ? -90 : 0,
          scale: isLandscape ? 0.85 : 1,
          x: isLandscape ? 0 : 0
        }}
      >
        {/* Android Status Bar */}
        <div className="bg-neutral-900 text-white px-6 py-2 flex justify-between items-center z-50">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold">{time}</span>
            <div className="flex gap-1 opacity-60">
              <MessageCircle size={10} />
              <Send size={10} />
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Wifi size={10} className="opacity-80" />
            <Signal size={10} className="opacity-80" />
            <div className="flex items-center gap-0.5">
              <span className="text-[8px] font-bold opacity-80">83%</span>
              <Battery size={10} className="opacity-80" />
            </div>
          </div>
        </div>

        {/* Camera Hole */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-2 h-2 bg-neutral-800 rounded-full z-[60] border border-white/10" />
        
        <div className="flex-1 relative overflow-hidden flex flex-col">
          {children}
        </div>
      </motion.div>
    </div>
  );
};

// --- Helpers ---

const processTextForTTS = (text: string) => {
  return text
    .replace(/\n\n+/g, '<break time="3.0s" />')
    .replace(/\n/g, '<break time="1.5s" />')
    .replace(/\(pause\)/gi, '<break time="1.5s" />')
    .replace(/\((\d+(\.\d+)?)\s*sec\)/gi, '<break time="$1s" />');
};

const createAlignmentMapping = (original: string, alignmentChars: string[]) => {
  const mapping = new Array(alignmentChars.length);
  let originalIdx = 0;
  
  // Character normalization helper
  const normalize = (c: string) => {
    if (!c) return '';
    return c.replace(/[\u2018\u2019]/g, "'")
            .replace(/[\u201C\u201D]/g, '"')
            .replace(/\u2013|\u2014/g, "-")
            .toLowerCase();
  };

  const tagRegex = /^(\([\d.]+\s*sec\)|\(pause\))/i;
  
  for (let i = 0; i < alignmentChars.length; i++) {
    const spokenChar = normalize(alignmentChars[i]);
    const isSpokenWhitespace = /\s/.test(spokenChar || ' ');

    // 1. Skip tags and extra whitespace in original to get to potential next match
    while (originalIdx < original.length) {
      const remaining = original.slice(originalIdx);
      const tagMatch = remaining.match(tagRegex);
      if (tagMatch) {
        originalIdx += tagMatch[0].length;
      } else if (!isSpokenWhitespace && /\s/.test(original[originalIdx])) {
        originalIdx++;
      } else {
        break;
      }
    }

    // 2. Try to match the character
    if (originalIdx < original.length) {
      const originalChar = normalize(original[originalIdx]);
      if (originalChar === spokenChar || (isSpokenWhitespace && /\s/.test(originalChar))) {
        mapping[i] = originalIdx;
        originalIdx++;
      } else {
        // Mismatch! Search ahead a bit
        let searchAhead = 1;
        let found = false;
        while (searchAhead < 100 && originalIdx + searchAhead < original.length) {
          const aheadChar = normalize(original[originalIdx + searchAhead]);
          if (aheadChar === spokenChar || (isSpokenWhitespace && /\s/.test(aheadChar))) {
            originalIdx += searchAhead;
            mapping[i] = originalIdx;
            originalIdx++;
            found = true;
            break;
          }
          searchAhead++;
        }
        
        if (!found) {
          mapping[i] = originalIdx;
        }
      }
    } else {
      mapping[i] = original.length > 0 ? original.length - 1 : 0;
    }
  }
  return mapping;
};

const MediaSection = ({ 
  type = 'image', 
  src,
  isLandscape = false,
  onToggleLandscape,
  forcedAspectRatio
}: { 
  type?: 'image' | 'video' | 'gif', 
  src: string,
  isLandscape?: boolean,
  onToggleLandscape?: () => void,
  forcedAspectRatio?: string
}) => {
  const [detectedAspectRatio, setDetectedAspectRatio] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasEnded, setHasEnded] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleMediaLoad = (e: any) => {
    if (type === 'video') {
      const { videoWidth, videoHeight, duration } = e.target;
      setDetectedAspectRatio(videoWidth / videoHeight);
      setDuration(duration);
    } else {
      const { naturalWidth, naturalHeight } = e.target;
      setDetectedAspectRatio(naturalWidth / naturalHeight);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (hasEnded) {
        videoRef.current.currentTime = 0;
        videoRef.current.play();
        setIsPlaying(true);
        setHasEnded(false);
      } else {
        if (isPlaying) {
          videoRef.current.pause();
        } else {
          videoRef.current.play();
        }
        setIsPlaying(!isPlaying);
      }
    }
  };

  const handleVideoEnded = () => {
    setIsPlaying(false);
    setHasEnded(true);
  };

  const currentAspectRatio = forcedAspectRatio || detectedAspectRatio;
  const aspectRatioValue = currentAspectRatio ? String(currentAspectRatio).replaceAll(':', '/') : 'auto';

  return (
    <div 
      className={cn(
        "w-full bg-neutral-900 relative group flex items-center justify-center transition-all duration-500 ease-in-out",
        isLandscape ? "absolute inset-0 z-[100]" : "overflow-hidden"
      )}
      style={{ 
        height: isLandscape ? '100%' : (currentAspectRatio ? 'auto' : '33.333%'),
        aspectRatio: !isLandscape ? aspectRatioValue : 'auto',
        maxHeight: isLandscape ? 'none' : '72%'
      }}
    >
      <div 
        className={cn(
          "relative flex items-center justify-center transition-all duration-500 ease-in-out",
          isLandscape ? "w-[211.11%] h-[100%] rotate-90" : "w-full h-full"
        )}
      >
        {type === 'video' ? (
          <div className="relative w-full h-full cursor-pointer flex items-center justify-center" onClick={togglePlay}>
            <video 
              ref={videoRef}
              src={src} 
              playsInline 
              onLoadedMetadata={handleMediaLoad}
              onTimeUpdate={handleTimeUpdate}
              onEnded={handleVideoEnded}
              className="w-full h-full object-contain"
              referrerPolicy="no-referrer"
            />
            
            {/* Video Controls Overlay */}
            <div 
              className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-2 z-20"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3">
                <input 
                  type="range" 
                  min="0" 
                  max={duration || 0} 
                  step="0.1" 
                  value={currentTime} 
                  onChange={handleSeek}
                  className="flex-1 h-1 bg-white/30 rounded-lg appearance-none cursor-pointer accent-orange-500"
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button 
                    onClick={togglePlay}
                    className="text-white hover:text-orange-500 transition-colors"
                  >
                    {hasEnded ? <RotateCcw size={18} /> : isPlaying ? <Pause size={18} /> : <Play size={18} />}
                  </button>
                  <span className="text-[10px] font-bold text-white tabular-nums">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </div>
                {onToggleLandscape && (
                  <button 
                    onClick={onToggleLandscape}
                    className="text-white hover:text-orange-500 transition-colors"
                  >
                    <Frame size={16} />
                  </button>
                )}
              </div>
            </div>

            {hasEnded ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 transition-all z-10">
                <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/30 shadow-2xl transform hover:scale-110 transition-transform">
                  <RotateCcw className="text-white" size={32} />
                </div>
              </div>
            ) : !isPlaying && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-all">
                <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/30 shadow-2xl transform group-hover:scale-110 transition-transform">
                  <Play className="text-white fill-current ml-1" size={32} />
                </div>
              </div>
            )}
            {isPlaying && !hasEnded && (
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                <div className="w-16 h-16 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center border border-white/20">
                  <Pause className="text-white fill-current" size={32} />
                </div>
              </div>
            )}
          </div>
        ) : (
          <img 
            src={src} 
            alt="Content media" 
            onLoad={handleMediaLoad}
            className="w-full h-full object-contain"
            referrerPolicy="no-referrer"
          />
        )}
      </div>

      <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
};

const TextSection = ({ 
  content, 
  audioUrl, 
  voiceId, 
  stability, 
  similarityBoost,
  style,
  useSpeakerBoost,
  onNext,
  showNext,
  onPrev,
  showPrev,
  globalVoiceId
}: { 
  content: string, 
  audioUrl?: string, 
  voiceId?: string,
  stability?: number,
  similarityBoost?: number,
  style?: number,
  useSpeakerBoost?: boolean,
  onNext?: () => void,
  showNext?: boolean,
  onPrev?: () => void,
  showPrev?: boolean,
  globalVoiceId?: string
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isHQ, setIsHQ] = useState(false);
  const [activeCharIndex, setActiveCharIndex] = useState(-1);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const alignmentRef = useRef<{ characters: string[], character_start_times_seconds: number[], character_end_times_seconds: number[] } | null>(null);
  const mappingRef = useRef<number[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activeWordRef = useRef<HTMLSpanElement | null>(null);

  // Split content into words while preserving spaces and tags
  const words = content.split(/(\s+|\([\d.]+\s*sec\)|\(pause\))/gi);

  // Reset audio when content changes
  useEffect(() => {
    if (isPlaying) {
      if (audioRef.current) audioRef.current.pause();
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      setActiveCharIndex(-1);
    }
    audioRef.current = null;
    alignmentRef.current = null;
  }, [content]);

  // Auto-scroll effect
  useEffect(() => {
    if (isPlaying && activeWordRef.current && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const element = activeWordRef.current;
      
      const containerRect = container.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();
      
      const isVisible = (
        elementRect.top >= containerRect.top + 100 &&
        elementRect.bottom <= containerRect.bottom - 100
      );
      
      if (!isVisible) {
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }
    }
  }, [activeCharIndex, isPlaying]);

  const toggleAudio = async () => {
    if (isPlaying) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      setActiveCharIndex(-1);
      return;
    }

    // If a custom MP3 URL is provided in Admin, use it (no highlighting for external MP3s yet)
    if (audioUrl) {
      if (!audioRef.current) {
        audioRef.current = new Audio(audioUrl);
        audioRef.current.onended = () => setIsPlaying(false);
      }
      audioRef.current.play();
      setIsPlaying(true);
      setIsHQ(true);
      return;
    }

    // Try ElevenLabs via our proxy
    setIsLoading(true);
    setIsHQ(false);
    try {
      const processedText = processTextForTTS(content);
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: processedText,
          voiceId: voiceId || globalVoiceId,
          stability: stability,
          similarity_boost: similarityBoost,
          style: style,
          use_speaker_boost: useSpeakerBoost
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const audioBlob = await (await fetch(`data:audio/mpeg;base64,${data.audio_base64}`)).blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        
        if (audioRef.current) {
          audioRef.current.pause();
        }
        
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        alignmentRef.current = data.alignment;
        mappingRef.current = createAlignmentMapping(content, data.alignment.characters);

        audio.ontimeupdate = () => {
          if (alignmentRef.current) {
            const currentTime = audio.currentTime;
            const { character_start_times_seconds } = alignmentRef.current;
            
            // Find the character index that matches current time
            let charIndex = -1;
            for (let i = 0; i < character_start_times_seconds.length; i++) {
              if (currentTime >= character_start_times_seconds[i]) {
                charIndex = i;
              } else {
                break;
              }
            }
            setActiveCharIndex(charIndex);
          }
        };

        audio.onended = () => {
          setIsPlaying(false);
          setActiveCharIndex(-1);
          URL.revokeObjectURL(audioUrl);
        };

        await audio.play();
        setIsPlaying(true);
        setIsHQ(true);
      } else {
        throw new Error('ElevenLabs failed');
      }
    } catch (error) {
      console.warn('ElevenLabs failed, falling back to TTS:', error);
      // Fallback to TTS with Highlighting and Pauses
      const segments = content.split(/(\n+|\(pause\)|\([\d.]+\s*sec\))/i);
      let currentSegmentIndex = 0;
      let charOffset = 0;

      const playNextSegment = () => {
        if (currentSegmentIndex >= segments.length) {
          setIsPlaying(false);
          setActiveCharIndex(-1);
          return;
        }

        const segment = segments[currentSegmentIndex];
        const pauseMatch = segment.match(/\(([\d.]+)\s*sec\)/i);
        
        if (segment.startsWith('\n') || segment.toLowerCase() === '(pause)' || pauseMatch) {
          // It's a pause
          let pauseDuration = 1500;
          if (pauseMatch) {
            pauseDuration = parseFloat(pauseMatch[1]) * 1000;
          } else if (segment.length > 1 && segment.startsWith('\n')) {
            pauseDuration = 3000;
          }
          
          setTimeout(() => {
            charOffset += segment.length;
            currentSegmentIndex++;
            playNextSegment();
          }, pauseDuration);
        } else {
          const utterance = new SpeechSynthesisUtterance(segment);
          utterance.onboundary = (event) => {
            if (event.name === 'word') {
              setActiveCharIndex(charOffset + event.charIndex);
            }
          };
          utterance.onend = () => {
            charOffset += segment.length;
            currentSegmentIndex++;
            playNextSegment();
          };
          window.speechSynthesis.speak(utterance);
        }
      };
      
      playNextSegment();
      setIsPlaying(true);
      setIsHQ(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
      audioRef.current?.pause();
    };
  }, []);

  // Helper to render words with highlighting
  const renderHighlightedText = () => {
    let charCount = 0;
    const mappedActiveIndex = (alignmentRef.current && activeCharIndex !== -1 && mappingRef.current && mappingRef.current[activeCharIndex] !== undefined) 
      ? mappingRef.current[activeCharIndex] 
      : activeCharIndex;

    return words.map((word, index) => {
      const isTag = word.toLowerCase() === '(pause)' || /^\([\d.]+\s*sec\)$/i.test(word);
      const isHighlighted = mappedActiveIndex >= charCount && mappedActiveIndex < charCount + word.length && word.trim().length > 0;
      charCount += word.length;
      
      if (isTag) return null;

      return (
        <span 
          key={index} 
          ref={isHighlighted ? activeWordRef : null}
          className={cn(
            "transition-colors duration-150 rounded-sm px-0.5 whitespace-pre-wrap",
            isHighlighted ? "bg-sky-200 text-sky-950 shadow-[0_0_0_2px_rgba(186,230,253,0.5)]" : ""
          )}
        >
          {word}
        </span>
      );
    });
  };

  return (
    <div className="flex-1 overflow-hidden flex flex-col bg-white">
      <div className="px-6 py-3 flex justify-between items-center border-b border-neutral-100">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-bold uppercase tracking-widest text-neutral-400">Text</h2>
          {isHQ && (
            <div className="flex items-center gap-1 bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full text-[10px] font-bold animate-pulse">
              <Volume2 size={10} />
              HQ AUDIO
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {showPrev && (
            <button 
              onClick={onPrev}
              className="p-2 bg-neutral-100 text-neutral-600 rounded-full hover:bg-neutral-200 transition-all active:scale-95 shadow-sm"
            >
              <ChevronLeft size={18} />
            </button>
          )}
          
          <button 
            onClick={toggleAudio}
            disabled={isLoading}
            className={cn(
              "p-2 rounded-full transition-all active:scale-95 disabled:opacity-50",
              isPlaying ? "bg-orange-500 text-white shadow-lg shadow-orange-200" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
            )}
          >
            {isLoading ? (
              <div className="w-[18px] h-[18px] border-2 border-neutral-400 border-t-transparent rounded-full animate-spin" />
            ) : isPlaying ? (
              <Volume2 size={18} className="animate-pulse" />
            ) : (
              <Volume2 size={18} />
            )}
          </button>
          
          {showNext && (
            <button 
              onClick={onNext}
              className="p-2 bg-neutral-900 text-white rounded-full hover:bg-neutral-800 transition-all active:scale-95 shadow-md"
            >
              <ChevronRight size={18} />
            </button>
          )}
        </div>
      </div>
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar scroll-smooth"
      >
        <div className="text-neutral-800 leading-relaxed text-lg font-medium">
          {renderHighlightedText()}
        </div>
        <div className="h-20" />
      </div>
    </div>
  );
};

const BottomNav = ({ activeTab, onTabChange }: { activeTab: string, onTabChange: (tab: string) => void }) => {
  const tabs = [
    { id: 'notes', label: 'Notes', icon: Notes },
    { id: 'more', label: 'More', icon: Info },
    { id: 'connect', label: 'Connect', icon: MessageCircle },
  ];

  return (
    <div className="bg-white border-t border-neutral-100 px-6 py-2 flex justify-between items-center">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={cn(
            "flex flex-col items-center gap-1 transition-colors",
            activeTab === tab.id ? "text-orange-500" : "text-neutral-400 hover:text-neutral-600"
          )}
        >
          <tab.icon size={20} />
          <span className="text-[10px] font-bold uppercase tracking-tighter">{tab.label}</span>
        </button>
      ))}
    </div>
  );
};

// --- Views ---

const LessonHeader = ({ 
  current, 
  total, 
  onLogout, 
  onToggleLandscape 
}: { 
  current: number, 
  total: number, 
  onLogout: () => void,
  onToggleLandscape: () => void
}) => {
  const progress = ((current + 1) / total) * 100;

  return (
    <div className="bg-white border-b border-neutral-100 px-6 py-1.5 flex items-center justify-between z-[110] shadow-sm relative">
      {/* Logout Button (Left) */}
      <button 
        onClick={onLogout}
        className="p-2 text-neutral-400 hover:text-neutral-900 transition-colors active:scale-90 flex items-center gap-1"
        title="Logout"
      >
        <LogOut size={18} strokeWidth={2.5} />
      </button>

      {/* Progress Bar (Center) */}
      <div className="flex-1 max-w-[150px] mx-4">
        <div className="h-2 bg-white rounded-full border-1.5 border-neutral-200 p-[1px] relative overflow-hidden">
          <motion.div 
            className="h-full bg-neutral-900 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: "circOut" }}
          />
        </div>
      </div>

      {/* Landscape Toggle (Right) */}
      <button 
        onClick={onToggleLandscape}
        className="p-2 text-neutral-400 hover:text-orange-500 transition-colors active:scale-90"
        title="Landscape View"
      >
        <Frame size={18} strokeWidth={2} />
      </button>
    </div>
  );
};

const LessonView = ({ 
  content, 
  onNavigate, 
  user,
  isLandscape,
  onToggleLandscape,
  currentSlideIndex,
  setCurrentSlideIndex
}: { 
  content: ContentData, 
  onNavigate: (view: string) => void, 
  user: User | null,
  isLandscape: boolean,
  onToggleLandscape: () => void,
  currentSlideIndex: number,
  setCurrentSlideIndex: React.Dispatch<React.SetStateAction<number>>
}) => {
  const currentSlide = content.slides[currentSlideIndex];

  const nextSlide = () => {
    if (currentSlideIndex < content.slides.length - 1) {
      setCurrentSlideIndex(prev => prev + 1);
      if (isLandscape) onToggleLandscape();
    }
  };

  const prevSlide = () => {
    if (currentSlideIndex > 0) {
      setCurrentSlideIndex(prev => prev - 1);
      if (isLandscape) onToggleLandscape();
    }
  };

  return (
    <div className="flex flex-col h-full relative">
      <LessonHeader 
        current={currentSlideIndex}
        total={content.slides.length}
        onLogout={() => logout()}
        onToggleLandscape={onToggleLandscape}
      />
      <AnimatePresence mode="wait">
        <motion.div
          key={currentSlideIndex}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col flex-1 overflow-hidden"
          drag={isLandscape ? false : "x"}
          dragConstraints={{ left: 0, right: 0 }}
          onDragEnd={(_, info) => {
            if (info.offset.x < -50) nextSlide();
            if (info.offset.x > 50) prevSlide();
          }}
        >
          <MediaSection 
            type={currentSlide.mediaType} 
            src={currentSlide.mediaUrl} 
            isLandscape={isLandscape}
            onToggleLandscape={onToggleLandscape}
            forcedAspectRatio={currentSlide.aspectRatio}
          />
          
          {!isLandscape && (
            <>
              <TextSection 
                content={currentSlide.textContent} 
                audioUrl={currentSlide.audioUrl} 
                voiceId={currentSlide.voiceId}
                stability={currentSlide.stability}
                similarityBoost={currentSlide.similarityBoost}
                style={currentSlide.style}
                useSpeakerBoost={currentSlide.useSpeakerBoost}
                onNext={() => {
                  if (currentSlideIndex < content.slides.length - 1) {
                    nextSlide();
                  } else {
                    setCurrentSlideIndex(0);
                    if (isLandscape) onToggleLandscape();
                  }
                }}
                showNext={content.slides.length > 1}
                onPrev={() => {
                  if (currentSlideIndex > 0) {
                    prevSlide();
                  } else {
                    setCurrentSlideIndex(content.slides.length - 1);
                    if (isLandscape) onToggleLandscape();
                  }
                }}
                showPrev={content.slides.length > 1}
                globalVoiceId={content.globalVoiceId}
              />
            </>
          )}
        </motion.div>
      </AnimatePresence>
      {!isLandscape && <BottomNav activeTab="lesson" onTabChange={onNavigate} />}
    </div>
  );
};

const SubView = ({ 
  title, 
  children, 
  onBack,
  onToggleLandscape,
  isLandscape,
  current,
  total
}: { 
  title: string, 
  children: React.ReactNode, 
  onBack: () => void,
  onToggleLandscape?: () => void,
  isLandscape?: boolean,
  current?: number,
  total?: number
}) => {
  const progress = current !== undefined && total !== undefined ? ((current + 1) / total) * 100 : 0;

  return (
    <motion.div 
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className={cn(
        "absolute inset-0 bg-white flex flex-col pt-8",
        isLandscape ? "z-[200]" : "z-40"
      )}
    >
      <div className={cn(
        "p-6 flex items-center justify-between border-b border-neutral-100 relative bg-white",
        isLandscape ? "z-[210] py-4" : "z-10"
      )}>
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">
            <ChevronLeft size={24} />
          </button>
          {!isLandscape && <h1 className="text-xl font-bold text-neutral-900">{title}</h1>}
        </div>

        {isLandscape && current !== undefined && total !== undefined && (
          <div className="flex-1 max-w-[180px] mx-4">
            <div className="h-3 bg-white rounded-full border-2 border-neutral-200 p-[2px] relative overflow-hidden">
              <motion.div 
                className="h-full bg-neutral-900 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5, ease: "circOut" }}
              />
            </div>
          </div>
        )}

        {onToggleLandscape && (
          <button 
            onClick={onToggleLandscape}
            className={cn(
              "p-2 rounded-full transition-all active:scale-95",
              isLandscape ? "bg-orange-500 text-white shadow-lg" : "bg-neutral-100 text-neutral-400 hover:bg-neutral-200"
            )}
          >
            {isLandscape ? <RotateCcw size={20} /> : <Hash size={20} />}
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-6 relative">
        {children}
      </div>
    </motion.div>
  );
};

const NotesView = ({ onBack, user }: { onBack: () => void, user: User | null }) => {
  const [note, setNote] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const recognitionRef = useRef<any>(null);
  
  useEffect(() => {
    if (!user) return;

    const path = `users/${user.uid}/notes/main`;
    const unsubscribe = onSnapshot(doc(db, path), (docSnap) => {
      if (docSnap.exists()) {
        setNote(docSnap.data().content || '');
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });

    return () => unsubscribe();
  }, [user]);

  const saveNote = async (newContent: string) => {
    if (!user) return;
    const path = `users/${user.uid}/notes/main`;
    try {
      await setDoc(doc(db, path), {
        content: newContent,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }

    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. Try using Chrome.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsRecording(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[event.results.length - 1][0].transcript;
      const updatedNote = note + (note ? " " : "") + transcript;
      setNote(updatedNote);
      saveNote(updatedNote);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    try {
      recognition.start();
    } catch (err) {
      console.error("Failed to start recognition:", err);
      setIsRecording(false);
    }
  };

  const handleCleanup = async () => {
    if (!note.trim()) return;
    
    setIsCleaning(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Clean up and organize these rambling notes. 
        Follow this EXACT format:
        1. A short, one-sentence summary of the main point.
        2. A few bullet point highlights of the key details.
        
        Keep it professional and "tw" (tight and well-written). Do not provide multiple options or meta-commentary, just the final cleaned-up text.
        
        Notes:
        ${note}`,
      });

      if (response.text) {
        setNote(response.text);
        saveNote(response.text);
      }
    } catch (error) {
      console.error("AI Cleanup failed:", error);
    } finally {
      setIsCleaning(false);
    }
  };

  return (
    <SubView title="My Notes" onBack={onBack}>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-neutral-500 italic">Capture your "Aha!" moments here.</p>
        <button 
          onClick={onBack}
          className="p-2 bg-neutral-100 text-neutral-600 rounded-full hover:bg-neutral-200 transition-all active:scale-95 shadow-sm"
          title="Back to Lesson"
        >
          <ChevronLeft size={20} />
        </button>
      </div>
      <div className="relative">
        <textarea 
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            saveNote(e.target.value);
          }}
          placeholder="Start typing or tap the mic..."
          className="w-full h-80 p-4 bg-neutral-50 rounded-2xl border-none focus:ring-2 focus:ring-orange-500 transition-all resize-none text-neutral-800 font-medium leading-relaxed"
        />
        {isCleaning && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] rounded-2xl flex items-center justify-center z-10">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="animate-spin text-orange-500" size={32} />
              <span className="text-xs font-bold text-orange-600 uppercase tracking-widest">AI Polishing...</span>
            </div>
          </div>
        )}
      </div>
      
      <div className="mt-6 flex items-center gap-3">
        <button 
          onClick={toggleRecording}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-2xl font-bold text-sm transition-all shadow-md active:scale-95",
            isRecording 
              ? "bg-red-500 text-white animate-pulse" 
              : "bg-neutral-900 text-white hover:bg-neutral-800"
          )}
        >
          <Mic size={18} className={isRecording ? "animate-bounce" : ""} />
          {isRecording ? "Listening..." : "Voice Note"}
        </button>

        <button 
          onClick={handleCleanup}
          disabled={isCleaning || !note.trim()}
          className="flex-1 flex items-center justify-center gap-2 bg-orange-500 text-white px-6 py-4 rounded-2xl font-bold text-sm hover:bg-orange-600 transition-all shadow-md shadow-orange-100 disabled:opacity-50 disabled:shadow-none active:scale-95"
        >
          <Sparkles size={18} />
          Clean Up
        </button>
      </div>
    </SubView>
  );
};

const MoreView = ({ 
  onBack, 
  slide,
  isLandscape,
  onToggleLandscape,
  globalVoiceId,
  currentSlideIndex,
  totalSlides
}: { 
  onBack: () => void, 
  slide?: SlideData,
  isLandscape: boolean,
  onToggleLandscape: () => void,
  globalVoiceId?: string,
  currentSlideIndex?: number,
  totalSlides?: number
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const getYouTubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const toggleAudio = async () => {
    if (!slide?.deeperDiveContent) return;

    if (isPlaying) {
      if (audioRef.current) audioRef.current.pause();
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      return;
    }

    setIsLoading(true);
    try {
      const processedText = processTextForTTS(slide.deeperDiveContent);
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: processedText,
          voiceId: slide.voiceId || globalVoiceId,
          stability: slide.stability,
          similarity_boost: slide.similarityBoost,
          style: slide.style,
          use_speaker_boost: slide.useSpeakerBoost
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const audioBlob = await (await fetch(`data:audio/mpeg;base64,${data.audio_base64}`)).blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        
        if (audioRef.current) audioRef.current.pause();
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        audio.onended = () => {
          setIsPlaying(false);
          URL.revokeObjectURL(audioUrl);
        };
        await audio.play();
        setIsPlaying(true);
      } else {
        throw new Error('ElevenLabs failed');
      }
    } catch (error) {
      console.warn('ElevenLabs failed, falling back to TTS:', error);
      // Fallback with pauses
      const segments = slide.deeperDiveContent.split(/(\n+|\(pause\)|\([\d.]+\s*sec\))/i);
      let currentSegmentIndex = 0;

      const playNextSegment = () => {
        if (currentSegmentIndex >= segments.length) {
          setIsPlaying(false);
          return;
        }

        const segment = segments[currentSegmentIndex];
        const pauseMatch = segment.match(/\(([\d.]+)\s*sec\)/i);

        if (segment.startsWith('\n') || segment.toLowerCase() === '(pause)' || pauseMatch) {
          let pauseDuration = 1500;
          if (pauseMatch) {
            pauseDuration = parseFloat(pauseMatch[1]) * 1000;
          } else if (segment.length > 1 && segment.startsWith('\n')) {
            pauseDuration = 3000;
          }
          
          setTimeout(() => {
            currentSegmentIndex++;
            playNextSegment();
          }, pauseDuration);
        } else {
          const utterance = new SpeechSynthesisUtterance(segment);
          utterance.onend = () => {
            currentSegmentIndex++;
            playNextSegment();
          };
          window.speechSynthesis.speak(utterance);
        }
      };
      
      playNextSegment();
      setIsPlaying(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
      audioRef.current?.pause();
    };
  }, []);

  const renderMedia = () => {
    if (!slide?.deeperDiveImageUrl) return null;

    return (
      <div className={cn(
        "bg-neutral-100 rounded-2xl overflow-hidden relative group",
        isLandscape ? "absolute inset-0 z-[100] rounded-none bg-black" : "aspect-video"
      )}>
        <div className={cn(
          "w-full h-full flex items-center justify-center",
          isLandscape && "rotate-90 scale-[1.77]"
        )}>
          {slide.deeperDiveMediaType === 'youtube' ? (
            <iframe
              className="w-full h-full"
              src={`https://www.youtube.com/embed/${getYouTubeId(slide.deeperDiveImageUrl)}`}
              title="YouTube video player"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : slide.deeperDiveMediaType === 'video' ? (
            <video 
              src={slide.deeperDiveImageUrl} 
              controls={!isLandscape}
              className="w-full h-full object-contain"
              referrerPolicy="no-referrer"
            />
          ) : (
            <img 
              src={slide.deeperDiveImageUrl} 
              alt="Detail" 
              className="w-full h-full object-contain" 
              referrerPolicy="no-referrer" 
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <SubView 
      title="Deeper Dive" 
      onBack={onBack}
      onToggleLandscape={onToggleLandscape}
      isLandscape={isLandscape}
      current={currentSlideIndex}
      total={totalSlides}
    >
      <div className="space-y-6">
        {renderMedia()}
        
        {!isLandscape && (
          <>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">{slide?.deeperDiveTitle || "Deeper Dive"}</h3>
              <div className="flex items-center gap-2">
                <button 
                  onClick={onBack}
                  className="p-3 bg-neutral-100 text-neutral-600 rounded-full hover:bg-neutral-200 transition-all active:scale-95 shadow-md"
                >
                  <ChevronLeft size={20} />
                </button>
                <button 
                  onClick={toggleAudio}
                  disabled={isLoading}
                  className={cn(
                    "p-3 rounded-full transition-all active:scale-95 disabled:opacity-50 shadow-md",
                    isPlaying ? "bg-orange-500 text-white animate-pulse" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                  )}
                >
                  {isLoading ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : isPlaying ? (
                    <Volume2 size={20} />
                  ) : (
                    <Mic size={20} />
                  )}
                </button>
              </div>
            </div>
            <p className="text-neutral-700 leading-relaxed">
              {slide?.deeperDiveContent || "No additional content available for this slide."}
            </p>
          </>
        )}
      </div>
    </SubView>
  );
};

const ConnectView = ({ onBack }: { onBack: () => void }) => {
  const externalLinks = [
    { name: 'WhatsApp Group', icon: MessageCircle, url: 'https://wa.me/1234567890', color: 'bg-green-500' },
    { name: 'Telegram Channel', icon: Send, url: 'https://t.me/example', color: 'bg-blue-500' },
    { name: 'Mighty Networks', icon: ExternalLink, url: 'https://mightynetworks.com', color: 'bg-purple-600' },
  ];

  return (
    <SubView title="Connect" onBack={onBack}>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-neutral-500 italic">Join the conversation.</p>
        <button 
          onClick={onBack}
          className="p-2 bg-neutral-100 text-neutral-600 rounded-full hover:bg-neutral-200 transition-all active:scale-95 shadow-sm"
          title="Back to Lesson"
        >
          <ChevronLeft size={20} />
        </button>
      </div>
      <div className="space-y-6">
        <p className="text-neutral-600 leading-relaxed">
          Choose your preferred platform to connect and share insights with other players.
        </p>
        
        <div className="grid gap-4">
          {externalLinks.map((link) => (
            <a 
              key={link.name}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-4 bg-white border border-neutral-100 rounded-2xl shadow-sm hover:shadow-md transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className={cn("p-3 rounded-xl text-white", link.color)}>
                  <link.icon size={20} />
                </div>
                <span className="font-bold text-neutral-900">{link.name}</span>
              </div>
              <ChevronLeft size={20} className="rotate-180 text-neutral-300 group-hover:text-neutral-900 transition-colors" />
            </a>
          ))}
        </div>

        <div className="p-6 bg-orange-50 rounded-3xl border border-orange-100">
          <h4 className="font-bold text-orange-900 mb-2">Weekly Live Q&A</h4>
          <p className="text-sm text-orange-800 mb-4">Every Thursday at 6:00 PM EST. Join us live on Zoom!</p>
          <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-full font-bold">
            Add to Calendar
          </Button>
        </div>
      </div>
    </SubView>
  );
};

const MediaDropzone = ({ 
  url, 
  type, 
  onUpdate 
}: { 
  url: string, 
  type: 'image' | 'video' | 'gif', 
  onUpdate: (url: string, type: 'image' | 'video' | 'gif') => void 
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!auth.currentUser) {
      alert("You must be logged in to upload media.");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    
    try {
      const storageRef = ref(storage, `media/${Date.now()}_${file.name}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
        }, 
        (error: any) => {
          console.error("Upload failed. Code:", error.code, "Message:", error.message);
          alert(`Upload failed: ${error.message} (Code: ${error.code}). Please check your Firebase Storage rules.`);
          setIsUploading(false);
        }, 
        async () => {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          
          let detectedType: 'image' | 'video' | 'gif' = 'image';
          const fileExt = file.name.split('.').pop()?.toLowerCase();
          const isVideo = file.type.includes('video') || ['mp4', 'webm', 'ogg', 'mov'].includes(fileExt || '');
          const isGif = file.type.includes('gif') || fileExt === 'gif';

          if (isVideo) detectedType = 'video';
          else if (isGif) detectedType = 'gif';
          
          onUpdate(downloadUrl, detectedType);
          setIsUploading(false);
        }
      );
    } catch (error) {
      console.error("Setup failed:", error);
      setIsUploading(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <div 
      className={cn(
        "relative aspect-video rounded-xl overflow-hidden border-2 border-dashed transition-all group",
        isDragging ? "border-orange-500 bg-orange-50" : "border-neutral-200 bg-neutral-50 hover:border-neutral-300"
      )}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={onDrop}
      onClick={() => fileInputRef.current?.click()}
    >
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/*,video/*" 
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      
      {url ? (
        <>
          {type === 'video' ? (
            <video src={url} className="w-full h-full object-cover" muted loop autoPlay playsInline />
          ) : (
            <img src={url} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          )}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <div className="text-white text-xs font-bold flex items-center gap-2">
              <Upload size={16} />
              Change Media
            </div>
          </div>
        </>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-neutral-400 gap-2">
          <Upload size={24} />
          <span className="text-[10px] font-bold uppercase tracking-wider">Drag & Drop or Click</span>
        </div>
      )}

      {isUploading && (
        <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-20">
          <div className="relative w-16 h-16 flex items-center justify-center">
            <Loader2 className="animate-spin text-orange-500 w-full h-full" size={32} />
            <span className="absolute text-[10px] font-bold text-orange-600">
              {Math.round(uploadProgress)}%
            </span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] font-bold text-orange-600 uppercase tracking-widest">Uploading...</span>
            <div className="w-32 h-1 bg-neutral-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-orange-500 transition-all duration-300" 
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const SortableSlide: React.FC<{ 
  slide: SlideData, 
  index: number, 
  onUpdate: (data: Partial<SlideData>) => void, 
  onRemove: () => void,
  isOnlySlide: boolean
}> = ({ 
  slide, 
  index, 
  onUpdate, 
  onRemove, 
  isOnlySlide 
}) => {
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: slide.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : 1,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="h-full">
      <Card className={cn(
        "border-neutral-200 shadow-sm hover:shadow-md transition-shadow flex flex-col h-full bg-white relative overflow-hidden",
        isDragging && "shadow-2xl ring-2 ring-orange-500 border-transparent"
      )}>
        {/* Delete Confirmation Overlay */}
        <AnimatePresence>
          {showConfirmDelete && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center"
            >
              <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mb-4">
                <Trash2 className="text-red-500" size={24} />
              </div>
              <h3 className="text-sm font-bold text-neutral-900 mb-2">Delete this slide?</h3>
              <p className="text-xs text-neutral-500 mb-6">Are you sure you wanna delete this slide? It can't be undone.</p>
              <div className="flex flex-col w-full gap-2">
                <Button 
                  variant="destructive" 
                  className="w-full rounded-xl font-bold"
                  onClick={onRemove}
                >
                  Yes, Delete Slide
                </Button>
                <Button 
                  variant="ghost" 
                  className="w-full rounded-xl font-bold text-neutral-500"
                  onClick={() => setShowConfirmDelete(false)}
                >
                  Cancel
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <CardHeader className="p-4 flex flex-row items-center justify-between border-b border-neutral-50">
          <div className="flex items-center gap-2">
            <div 
              {...attributes} 
              {...listeners} 
              className="cursor-grab active:cursor-grabbing p-1 hover:bg-neutral-100 rounded transition-colors"
            >
              <GripVertical size={16} className="text-neutral-400" />
            </div>
            <div className="w-6 h-6 bg-neutral-100 rounded flex items-center justify-center text-[10px] font-bold text-neutral-500">
              {index + 1}
            </div>
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-neutral-400">Slide Content</CardTitle>
          </div>
          {!isOnlySlide && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setShowConfirmDelete(true)}
              className="h-8 w-8 text-neutral-300 hover:text-red-500 transition-colors"
            >
              <Trash2 size={14} />
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-4 space-y-4 flex-1">
          {/* Media Preview / Dropzone */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] font-bold uppercase text-neutral-400">Media ({slide.slideType || 'generic'})</Label>
              {slide.slideType === 'photo' && (
                <div className="flex bg-neutral-100 p-1 rounded-lg gap-1 border border-neutral-200 shadow-inner">
                  {['1:1', '4:3', '3:4'].map((ratio) => (
                    <button
                      key={ratio}
                      onClick={() => onUpdate({ aspectRatio: ratio as any })}
                      className={cn(
                        "text-[9px] font-bold px-2 py-1 rounded-md transition-all active:scale-95",
                        slide.aspectRatio === ratio 
                          ? "bg-white text-orange-600 shadow-sm" 
                          : "text-neutral-400 hover:text-neutral-600"
                      )}
                    >
                      {ratio}
                    </button>
                  ))}
                </div>
              )}
              {slide.slideType === 'video' && (
                <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-50 border border-blue-100 rounded-lg">
                  <Monitor size={10} className="text-blue-500" />
                  <span className="text-[9px] font-bold text-blue-600 uppercase">Fixed 9:16 / 16:9</span>
                </div>
              )}
            </div>
            
            <MediaDropzone 
              url={slide.mediaUrl} 
              type={slide.mediaType} 
              onUpdate={(url, type) => onUpdate({ mediaUrl: url, mediaType: type })} 
            />
            <Input 
              value={slide.mediaUrl} 
              onChange={(e) => {
                const url = e.target.value;
                const ext = url.split('.').pop()?.split('?')[0].toLowerCase();
                let type: 'image' | 'video' | 'gif' = 'image';
                if (['mp4', 'webm', 'ogg', 'mov'].includes(ext || '')) type = 'video';
                else if (ext === 'gif') type = 'gif';
                onUpdate({ mediaUrl: url, mediaType: type });
              }}
              placeholder="Or paste URL here..."
              className="text-[10px] h-8 bg-neutral-50"
            />
          </div>

          {/* Text Content */}
          <div className="space-y-2">
            <Label className="text-[10px] font-bold uppercase text-neutral-400">Story Text</Label>
            <Textarea 
              value={slide.textContent}
              onChange={(e) => onUpdate({ textContent: e.target.value })}
              className="min-h-[120px] text-sm resize-none bg-neutral-50 border-neutral-100 focus:bg-white transition-colors"
              placeholder="What happens in this part of the story?"
            />
          </div>

          {/* Voice Settings */}
          <div className="pt-4 border-t border-neutral-50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase text-neutral-400">Voice Tuning</span>
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-bold text-orange-500">{Math.round((slide.stability || 0.5) * 100)}%</span>
                <Sliders size={10} className="text-neutral-300" />
              </div>
            </div>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.1" 
              value={slide.stability || 0.5}
              onChange={(e) => onUpdate({ stability: parseFloat(e.target.value) })}
              className="w-full h-1 bg-neutral-100 rounded-lg appearance-none cursor-pointer accent-orange-500"
            />
          </div>

          {/* Deeper Dive Section */}
          <div className="pt-4 border-t border-neutral-100 space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-orange-500" />
              <span className="text-[10px] font-bold uppercase text-neutral-400 tracking-widest">Deeper Dive (More Section)</span>
            </div>
            
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-neutral-400">Section Title</Label>
              <Input 
                value={slide.deeperDiveTitle || ''} 
                onChange={(e) => onUpdate({ deeperDiveTitle: e.target.value })}
                placeholder="e.g., Technical Specifications"
                className="text-xs bg-neutral-50"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-neutral-400">Section Media (Drag & Drop or URL)</Label>
              <MediaDropzone 
                url={slide.deeperDiveImageUrl || ''} 
                type={slide.deeperDiveMediaType === 'youtube' ? 'image' : (slide.deeperDiveMediaType || 'image')} 
                onUpdate={(url, type) => onUpdate({ deeperDiveImageUrl: url, deeperDiveMediaType: type })} 
              />
              <Input 
                value={slide.deeperDiveImageUrl || ''} 
                onChange={(e) => {
                  const url = e.target.value;
                  let type: 'image' | 'video' | 'gif' | 'youtube' = 'image';
                  
                  if (url.includes('youtube.com') || url.includes('youtu.be')) {
                    type = 'youtube';
                  } else {
                    const ext = url.split('.').pop()?.split('?')[0].toLowerCase();
                    if (['mp4', 'webm', 'ogg', 'mov'].includes(ext || '')) type = 'video';
                    else if (ext === 'gif') type = 'gif';
                  }
                  
                  onUpdate({ deeperDiveImageUrl: url, deeperDiveMediaType: type });
                }}
                placeholder="Paste image, video, or YouTube URL..."
                className="text-[10px] bg-neutral-50"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-neutral-400">Section Content</Label>
              <Textarea 
                value={slide.deeperDiveContent || ''}
                onChange={(e) => onUpdate({ deeperDiveContent: e.target.value })}
                className="min-h-[100px] text-xs resize-none bg-neutral-50 border-neutral-100 focus:bg-white transition-colors"
                placeholder="Provide more in-depth details here..."
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const AdminDashboard = ({ 
  content, 
  onSave, 
  onExit 
}: { 
  content: ContentData, 
  onSave: (newContent: ContentData) => void,
  onExit: () => void
}) => {
  const [form, setForm] = useState<ContentData>(content);
  const [isSaving, setIsSaving] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showAddPlaceholderMenu, setShowAddPlaceholderMenu] = useState(false);
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);

  const handleMainScroll = () => {
    if (mainScrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = mainScrollRef.current;
      const maxScroll = scrollWidth - clientWidth;
      const progress = maxScroll > 0 ? scrollLeft / maxScroll : 0;
      setScrollProgress(progress);
    }
  };

  const scrollToPercent = (percent: number, smooth = true) => {
    if (mainScrollRef.current) {
      const { scrollWidth, clientWidth } = mainScrollRef.current;
      const targetScroll = percent * (scrollWidth - clientWidth);
      
      if (smooth) {
        mainScrollRef.current.scrollTo({
          left: targetScroll,
          behavior: 'smooth'
        });
      } else {
        mainScrollRef.current.scrollLeft = targetScroll;
      }
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const updateSlide = (index: number, data: Partial<SlideData>) => {
    const newSlides = [...form.slides];
    newSlides[index] = { ...newSlides[index], ...data };
    setForm({ ...form, slides: newSlides });
  };

  const addSlide = (type: 'photo' | 'video') => {
    setForm({
      ...form,
      slides: [...form.slides, { 
        id: `slide-${Date.now()}`,
        mediaType: type === 'video' ? 'video' : 'image',
        mediaUrl: type === 'video' 
          ? 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
          : 'https://picsum.photos/seed/new/800/800',
        textContent: 'New Slide Content',
        slideType: type,
        aspectRatio: type === 'video' ? '9:16' : '1:1',
        voiceId: form.globalVoiceId,
        stability: 0.5,
        similarityBoost: 0.75,
        style: 0.0,
        useSpeakerBoost: true
      }]
    });
  };

  const removeSlide = (index: number) => {
    if (form.slides.length <= 1) return;
    const newSlides = form.slides.filter((_, i) => i !== index);
    setForm({ ...form, slides: newSlides });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setForm((prev) => {
        const oldIndex = prev.slides.findIndex((s) => s.id === active.id);
        const newIndex = prev.slides.findIndex((s) => s.id === over.id);
        return {
          ...prev,
          slides: arrayMove(prev.slides, oldIndex, newIndex),
        };
      });
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    onSave(form);
    setTimeout(() => setIsSaving(false), 500);
  };

  const applyVoiceToAll = () => {
    const newSlides = form.slides.map(slide => ({
      ...slide,
      voiceId: form.globalVoiceId,
    }));
    setForm({ ...form, slides: newSlides });
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col">
      {/* Dashboard Header */}
      <header className="h-16 bg-white border-b border-neutral-200 flex items-center justify-between px-8 sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="bg-orange-500 p-2 rounded-lg text-white">
            <LayoutDashboard size={20} />
          </div>
          <div>
            <h1 className="text-sm font-bold text-neutral-900">Content Storyboard</h1>
            <p className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold">Admin Dashboard</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={onExit} className="rounded-full px-6">
            <Smartphone className="mr-2 h-4 w-4" />
            Preview App
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={isSaving}
            className="bg-orange-500 hover:bg-orange-600 text-white rounded-full px-8 font-bold shadow-lg shadow-orange-200"
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </header>

      <main className="flex-1 p-8 max-w-[1600px] mx-auto w-full space-y-8">
        {/* Global Settings Bar */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-200 flex flex-wrap items-end gap-6">
          <div className="flex-1 min-w-[300px] space-y-2">
            <Label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Global Voice ID</Label>
            <div className="flex gap-2">
              <Input 
                value={form.globalVoiceId} 
                onChange={(e) => setForm({ ...form, globalVoiceId: e.target.value })}
                placeholder="ElevenLabs Voice ID"
                className="bg-neutral-50 border-neutral-200 focus:ring-orange-500"
              />
              <Button variant="outline" onClick={applyVoiceToAll} className="shrink-0">Apply to All</Button>
            </div>
          </div>
          <div className="flex gap-4 relative">
            <div className="text-center px-4 border-r border-neutral-100 min-w-[100px]">
              <p className="text-2xl font-bold text-neutral-900">
                {Math.min(Math.round(scrollProgress * (form.slides.length > 1 ? form.slides.length - 1 : 1)) + 1, form.slides.length)}
                <span className="text-neutral-300 font-light mx-1">/</span>
                <span className="text-neutral-400">{form.slides.length}</span>
              </p>
              <p className="text-[10px] font-bold uppercase text-neutral-400 tracking-wider">Slide Position</p>
            </div>
            
            <div className="relative">
              <Button 
                onClick={() => setShowAddMenu(!showAddMenu)} 
                className="bg-neutral-900 text-white rounded-xl h-12 px-6 hover:bg-neutral-800 transition-colors shadow-lg"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add New Slide
              </Button>

              <AnimatePresence>
                {showAddMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowAddMenu(false)} />
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 top-14 w-56 bg-white rounded-2xl p-2 shadow-2xl border border-neutral-100 z-50 overflow-hidden"
                    >
                      <div className="text-[10px] font-bold uppercase text-neutral-400 px-3 py-2">Select Type</div>
                      <div className="h-[1px] bg-neutral-50 mb-1" />
                      <button 
                        onClick={() => { addSlide('photo'); setShowAddMenu(false); }}
                        className="w-full rounded-xl flex items-center gap-3 p-3 hover:bg-orange-50 transition-colors text-left"
                      >
                        <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600">
                          <ImageIcon size={18} />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-neutral-900">Photograph Slide</span>
                          <span className="text-[9px] text-neutral-500">Fixed ratios (1:1, 4:3, 3:4)</span>
                        </div>
                      </button>
                      <button 
                        onClick={() => { addSlide('video'); setShowAddMenu(false); }}
                        className="w-full rounded-xl flex items-center gap-3 p-3 hover:bg-blue-50 transition-colors text-left"
                      >
                        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
                          <Video size={18} />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-neutral-900">Video Slide</span>
                          <span className="text-[9px] text-neutral-500">Responsive (9:16 / 16:9)</span>
                        </div>
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Storyboard Grid */}
        <div className="space-y-6">
          {/* Visual Navigator (Track and Circle) */}
          <div className="px-1 py-6">
            <div 
              ref={trackRef}
              className="h-2 w-full bg-neutral-100 rounded-full relative cursor-pointer group shadow-inner"
              onClick={(e) => {
                if (trackRef.current) {
                  const rect = trackRef.current.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  scrollToPercent(x / rect.width);
                }
              }}
            >
              {/* Slide Marker Tracks */}
              <div className="absolute inset-0 flex justify-between px-1 z-10">
                {form.slides.map((_, i) => (
                  <button 
                    key={i} 
                    className="flex flex-col items-center h-full group/marker relative pointer-events-auto"
                    onClick={(e) => {
                      e.stopPropagation();
                      scrollToPercent(i / (form.slides.length > 1 ? form.slides.length - 1 : 1));
                    }}
                  >
                    <div className="h-full w-px bg-neutral-300 group-hover/marker:bg-orange-500 transition-colors" />
                    <span className="absolute -bottom-6 text-[10px] font-bold text-neutral-300 group-hover/marker:text-orange-500 transition-colors">
                      {i + 1}
                    </span>
                  </button>
                ))}
                <div className="h-full w-px bg-neutral-300" />
              </div>

              {/* Active Indicator (The Circle) */}
              <motion.div 
                drag="x"
                dragConstraints={trackRef}
                dragElastic={0}
                dragMomentum={false}
                onDrag={(event, info) => {
                  if (trackRef.current) {
                    const rect = trackRef.current.getBoundingClientRect();
                    // info.point.x is global, convert to local track relative
                    const x = info.point.x - rect.left;
                    const percent = Math.max(0, Math.min(1, x / rect.width));
                    scrollToPercent(percent, false);
                  }
                }}
                className="absolute top-1/2 -translate-y-1/2 w-8 h-8 bg-neutral-900 rounded-full border-4 border-white shadow-2xl cursor-grab active:cursor-grabbing z-20 flex items-center justify-center transition-shadow hover:shadow-orange-200/50"
                style={{ 
                  left: `calc(${scrollProgress * 100}% - 16px)`,
                  x: 0 // Reset x transform so it doesn't fight with our calculated left
                }}
                transition={{ type: "spring", stiffness: 400, damping: 35 }}
              >
                <div className="text-[10px] font-black text-white pointer-events-none">
                  {Math.min(Math.round(scrollProgress * (form.slides.length > 1 ? form.slides.length - 1 : 1)) + 1, form.slides.length)}
                </div>
                
                {/* Visual Glow */}
                <div className="absolute inset-0 rounded-full bg-neutral-900 animate-ping opacity-10 pointer-events-none" />

                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-neutral-900 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-all transform group-hover:-translate-y-1 whitespace-nowrap">
                  Current: Slide {Math.min(Math.round(scrollProgress * (form.slides.length > 1 ? form.slides.length - 1 : 1)) + 1, form.slides.length)}
                </div>
              </motion.div>

              {/* Progress Line */}
              <motion.div 
                className="absolute inset-y-0 left-0 bg-orange-100 rounded-full pointer-events-none z-10"
                style={{ width: `${scrollProgress * 100}%` }}
              />
            </div>
          </div>

          <DndContext 
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext 
              items={form.slides.map(s => s.id)}
              strategy={rectSortingStrategy}
            >
              <div 
                ref={mainScrollRef}
                onScroll={handleMainScroll}
                className="flex gap-6 overflow-x-auto pb-12 custom-scrollbar snap-x"
              >
              {form.slides.map((slide: SlideData, index: number) => (
                <div key={slide.id} className="min-w-[350px] snap-start">
                  <SortableSlide 
                    slide={slide}
                    index={index}
                    onUpdate={(data: Partial<SlideData>) => updateSlide(index, data)}
                    onRemove={() => removeSlide(index)}
                    isOnlySlide={form.slides.length <= 1}
                  />
                </div>
              ))}
              
              {/* Add Slide Placeholder */}
              <div className="relative">
                <button 
                  onClick={() => setShowAddPlaceholderMenu(!showAddPlaceholderMenu)}
                  className="min-w-[350px] border-2 border-dashed border-neutral-200 rounded-2xl flex flex-col items-center justify-center gap-3 text-neutral-400 hover:border-orange-300 hover:text-orange-500 hover:bg-orange-50/30 transition-all min-h-[600px] snap-start"
                >
                  <div className="p-4 bg-white rounded-full shadow-sm border border-neutral-100">
                    <Plus size={32} />
                  </div>
                  <span className="font-bold text-sm">Add Next Slide</span>
                </button>

                <AnimatePresence>
                  {showAddPlaceholderMenu && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowAddPlaceholderMenu(false)} />
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="absolute bottom-20 left-1/2 -translate-x-1/2 w-56 bg-white rounded-2xl p-2 shadow-2xl border border-neutral-100 z-50 overflow-hidden"
                      >
                        <button 
                          onClick={() => { addSlide('photo'); setShowAddPlaceholderMenu(false); }}
                          className="w-full rounded-xl flex items-center gap-3 p-3 hover:bg-orange-50 transition-colors text-left"
                        >
                          <ImageIcon size={18} className="text-orange-500" />
                          <span className="text-xs font-bold text-neutral-900">Photograph Slide</span>
                        </button>
                        <button 
                          onClick={() => { addSlide('video'); setShowAddPlaceholderMenu(false); }}
                          className="w-full rounded-xl flex items-center gap-3 p-3 hover:bg-blue-50 transition-colors text-left"
                        >
                          <Video size={18} className="text-blue-500" />
                          <span className="text-xs font-bold text-neutral-900">Video Slide</span>
                        </button>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </main>
    </div>
  );
};

// --- Main App ---

const LoginView = () => {
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    setIsLoading(true);
    try {
      await loginWithGoogle();
    } catch (error) {
      console.error("Login failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-50 p-6">
      <div className="w-full max-w-md bg-white p-10 rounded-[2.5rem] shadow-xl border border-neutral-100 text-center">
        <div className="w-20 h-20 bg-orange-500 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-lg shadow-orange-100">
          <Play className="text-white fill-current" size={40} />
        </div>
        <h1 className="text-3xl font-black text-neutral-900 mb-2 tracking-tight">ContentFlow</h1>
        <p className="text-neutral-500 mb-10 font-medium">Your interactive storyboard experience.</p>
        
        <Button 
          onClick={handleLogin}
          disabled={isLoading}
          className="w-full bg-neutral-900 hover:bg-neutral-800 text-white py-8 rounded-2xl font-bold text-lg shadow-xl shadow-neutral-200 transition-all active:scale-95"
        >
          {isLoading ? (
            <Loader2 className="animate-spin mr-2" />
          ) : (
            <LogIn className="mr-2" />
          )}
          Sign in with Google
        </Button>
        
        <p className="mt-8 text-xs text-neutral-400 font-medium">
          By signing in, you agree to our terms and conditions.
        </p>
      </div>
    </div>
  );
};

export default function App() {
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [activeView, setActiveView] = useState('lesson');
  const [isLandscape, setIsLandscape] = useState(false);
  const [content, setContent] = useState<ContentData>(DEFAULT_CONTENT);
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<'admin' | 'user' | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        // Fetch user role
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setUserRole(userDoc.data().role);
        } else {
          // New user, default to 'user' role
          const role = user.email === 'steve@soltheory.com' ? 'admin' : 'user';
          await setDoc(doc(db, 'users', user.uid), {
            email: user.email,
            role: role,
            displayName: user.displayName,
            photoURL: user.photoURL
          });
          setUserRole(role);
        }
      } else {
        setUserRole(null);
        setIsAdminMode(false);
      }
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const path = 'app_content/main';
    const unsubscribe = onSnapshot(doc(db, path), (docSnap) => {
      if (docSnap.exists()) {
        setContent(docSnap.data() as ContentData);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });
    return () => unsubscribe();
  }, []);

  const handleSaveContent = async (newContent: ContentData) => {
    const path = 'app_content/main';
    try {
      await setDoc(doc(db, path), {
        ...newContent,
        updatedAt: new Date().toISOString()
      });
      setContent(newContent);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  const handleNavigate = (view: string) => {
    setActiveView(view);
    setIsLandscape(false);
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <Loader2 className="animate-spin text-orange-500" size={40} />
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  if (isAdminMode && userRole === 'admin') {
    return (
      <AdminDashboard 
        content={content} 
        onSave={handleSaveContent}
        onExit={() => setIsAdminMode(false)}
      />
    );
  }

  return (
    <MobileFrame 
      onToggleAdmin={() => userRole === 'admin' && setIsAdminMode(true)}
      isLandscape={isLandscape}
    >
      <div className="flex-1 relative overflow-hidden">
        <LessonView 
          content={content} 
          onNavigate={handleNavigate} 
          user={user}
          isLandscape={isLandscape}
          onToggleLandscape={() => setIsLandscape(!isLandscape)}
          currentSlideIndex={currentSlideIndex}
          setCurrentSlideIndex={setCurrentSlideIndex}
        />
        
        <AnimatePresence>
          {activeView === 'notes' && (
            <NotesView onBack={() => handleNavigate('lesson')} user={user} />
          )}
          {activeView === 'more' && (
            <MoreView 
              onBack={() => handleNavigate('lesson')} 
              slide={content.slides[currentSlideIndex]}
              isLandscape={isLandscape}
              onToggleLandscape={() => setIsLandscape(!isLandscape)}
              globalVoiceId={content.globalVoiceId}
              currentSlideIndex={currentSlideIndex}
              totalSlides={content.slides.length}
            />
          )}
          {activeView === 'connect' && (
            <ConnectView onBack={() => handleNavigate('lesson')} />
          )}
        </AnimatePresence>
      </div>
    </MobileFrame>
  );
}
