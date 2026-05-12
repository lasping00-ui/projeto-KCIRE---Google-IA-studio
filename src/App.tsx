import { Home, Camera, Mic, MessageSquare, Settings } from 'lucide-react';
import { motion } from 'motion/react';
import React, { useEffect, useRef, useState } from 'react';

// --- Particle System Logic ---
class Star {
  x: number = 0;
  y: number = 0;
  radius: number = 0;
  alpha: number = 0;
  pulseSpeed: number = 0;
  pulseOffset: number = 0;
  driftSpeed: number = 0;

  constructor(width: number, height: number) {
    this.x = Math.random() * width;
    this.y = Math.random() * height;
    this.radius = Math.random() * 1.5 + 0.2;
    this.alpha = Math.random();
    this.pulseSpeed = Math.random() * 0.02 + 0.005;
    this.pulseOffset = Math.random() * Math.PI * 2;
    this.driftSpeed = this.radius * 0.15;
  }

  update(time: number, height: number) {
    this.y -= this.driftSpeed;
    if (this.y < 0) this.y = height;
    // Base alpha + pulse, clamped between 0.1 and 1
    return Math.max(0.1, Math.min(1, this.alpha + Math.sin(time * this.pulseSpeed + this.pulseOffset) * 0.4));
  }
}

class Particle {
  x: number = 0;
  y: number = 0;
  baseX: number = 0;
  baseY: number = 0;
  vx: number = 0;
  vy: number = 0;
  angle: number;
  radius: number;
  speed: number;
  size: number;
  offset: number;
  pulseSpeed: number;
  pulseAmp: number;
  isInner: boolean;

  constructor(cx: number, cy: number, ringRadius: number) {
    this.angle = Math.random() * Math.PI * 2;
    // Create a thicker ring (dust cloud)
    const spread = (Math.random() - 0.5) * (Math.random() - 0.5) * 140; 
    this.radius = ringRadius + spread;
    
    // Closer to center = slightly larger and slower sometimes
    this.isInner = Math.abs(spread) < 20;

    this.speed = (Math.random() * 0.002 + 0.001) * (Math.random() > 0.5 ? 1 : -1);
    this.size = Math.random() * 1.5 + 0.5;
    if (this.isInner) this.size += 0.5;

    this.offset = Math.random() * 1000;
    this.pulseSpeed = Math.random() * 0.02 + 0.01;
    this.pulseAmp = Math.random() * 1.5;

    this.updateBasePosition(cx, cy);
  }

  updateBasePosition(cx: number, cy: number) {
    this.baseX = cx + Math.cos(this.angle) * this.radius;
    this.baseY = cy + Math.sin(this.angle) * this.radius;
  }

  update(cx: number, cy: number, time: number) {
    this.angle += this.speed;
    
    // Gentle pulse in radius
    const currentRadius = this.radius + Math.sin(time * this.pulseSpeed + this.offset) * this.pulseAmp;
    
    this.x = cx + Math.cos(this.angle) * currentRadius;
    this.y = cy + Math.sin(this.angle) * currentRadius;
  }
}

const ParticleCloud = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let particles: Particle[] = [];
    let stars: Star[] = [];
    let width = 0;
    let height = 0;
    let cx = 0;
    let cy = 0;

    const resize = () => {
      // Create high DPI canvas based on actual display size
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (!rect) return;
      
      const dpr = window.devicePixelRatio || 1;
      width = rect.width;
      height = rect.height;
      
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      
      ctx.scale(dpr, dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      cx = width / 2;
      cy = height / 2;

      // Re-initialize particles AND stars
      particles = [];
      stars = [];
      const numParticles = width < 500 ? 1500 : 3000;
      const numStars = Math.floor((width * height) / 2500); // Density of stars
      const ringRadius = Math.min(width, height) * 0.35; // 35% of container size
      
      for (let i = 0; i < numParticles; i++) {
        particles.push(new Particle(cx, cy, ringRadius));
      }
      for (let i = 0; i < numStars; i++) {
        stars.push(new Star(width, height));
      }
    };

    window.addEventListener('resize', resize);
    resize();

    let time = 0;

    const draw = () => {
      time++;
      
      // Deep dark blue night sky background with slight trail fade
      ctx.fillStyle = 'rgba(5, 10, 31, 0.35)'; // matches #050A1F roughly
      ctx.fillRect(0, 0, width, height);

      // --- Draw Stars (Background Layer) ---
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        ctx.globalAlpha = s.update(time, height);
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // --- Draw Nucleus Particles (Foreground Layer) ---
      ctx.globalCompositeOperation = 'screen';

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.update(cx, cy, time);

        // Calculate color gradient based on X position relative to center
        // Left: Purple/Blue (#8000FF to #3A00FF)
        // Right: Vibrant Pink (#FF00FF to #FF00A0)
        
        // Normalize x between -1 and 1 (roughly within the ring)
        const nx = Math.max(-1, Math.min(1, (p.x - cx) / (width * 0.4))); 
        
        let r, g, b;
        
        if (nx < 0) {
          // Left side (Purple/Blue dominant)
          // Interpolate from deep blue center to purple edge
          const t = Math.abs(nx);
          r = Math.floor(60 + t * 68);     // 60 -> 128
          g = 0;
          b = 255;
        } else {
          // Right side (Pink dominant)
          // Interpolate from purple center to pink edge
          const t = nx;
          r = Math.floor(128 + t * 127);   // 128 -> 255
          g = 0;
          b = 255;
        }

        // Add a bit of white to the very inner particles for a hotter core
        if (p.isInner && Math.sin(time * p.pulseSpeed * 2 + p.offset) > 0.8) {
             r = 255; g = 180; b = 255;
        }

        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;

        // Opacity pulsing
        const alpha = Math.max(0.1, 0.6 + Math.sin(time * p.pulseSpeed + p.offset) * 0.4);
        ctx.globalAlpha = alpha;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />;
};

export default function App() {
  const [activeTab, setActiveTab] = useState('home');

  return (
    <div className="relative flex flex-col min-h-screen bg-[#050A1F] overflow-hidden font-sans selection:bg-pink-500/30">
      
      {/* HEADER */}
      <header className="relative z-10 flex items-center justify-between px-6 pt-12 pb-4">
        <div className="w-20">
          <span className="text-[10px] font-mono tracking-widest text-blue-500/80 uppercase">
            13 Marvel
          </span>
        </div>
        
        {/* Center Logo */}
        <div className="flex-1 flex justify-center">
          <h1 className="text-2xl tracking-[0.2em] font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-400">
            KCIRE
          </h1>
        </div>
        
        {/* Right Ring Indicator */}
        <div className="w-20 flex justify-end items-center">
          <div className="relative w-10 h-10 flex items-center justify-center">
            <div className="absolute w-10 h-10 rounded-full border border-purple-500/40 border-r-transparent border-b-transparent animate-[spin_8s_linear_infinite]" />
            <div className="absolute w-8 h-8 rounded-full border border-cyan-500/50 border-l-transparent border-b-transparent animate-[spin_6s_linear_infinite_reverse]" />
          </div>
        </div>
      </header>

      {/* MAIN CONTENT AREA - THE NUCLEUS */}
      <main className="relative flex-1 flex items-center justify-center -mt-10 overflow-hidden z-10">
        
        <ParticleCloud />

        {/* Central UI Elements (Sphere & Eyes) */}
        <motion.div 
          className="relative z-20 flex items-center justify-center w-40 h-40 md:w-48 md:h-48"
          animate={{
            y: [-5, 5, -5],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          {/* Glassmorphic Sphere */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/10 to-transparent backdrop-blur-[2px] border border-white/5" />
          
          {/* Inner Glow Border */}
          <div className="absolute inset-0 rounded-full border-2 border-transparent" 
               style={{
                 backgroundImage: 'linear-gradient(black, black), linear-gradient(135deg, #00D2FF, #8000FF, #FF00FF)',
                 backgroundOrigin: 'border-box',
                 backgroundClip: 'content-box, border-box',
                 boxShadow: 'inset 0 0 20px rgba(128,0,255,0.4), 0 0 30px rgba(128,0,255,0.2)'
               }}
          />

          {/* Core Inner Shadow */}
          <div className="absolute inset-2 rounded-full shadow-[inset_0_-10px_30px_rgba(0,0,0,0.8)] pointer-events-none" />

          {/* IA Eyelids / Eyes */}
          <div className="relative z-30 flex gap-4">
            {/* Left Eye */}
            <motion.div 
              className="w-4 h-9 rounded-full bg-blue-100 shadow-[0_0_15px_#8000FF] overflow-hidden relative"
              animate={{
                scaleY: [1, 0.1, 1], // Blink
              }}
              transition={{
                duration: 0.3,
                repeat: Infinity,
                repeatDelay: 4, // Fixed delay for synchronized blinking
                ease: "easeInOut"
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/50 to-transparent animate-[pulse_2s_ease-in-out_infinite]" />
            </motion.div>

            {/* Right Eye */}
            <motion.div 
              className="w-4 h-9 rounded-full bg-blue-100 shadow-[0_0_15px_#8000FF] overflow-hidden relative"
              animate={{
                scaleY: [1, 0.1, 1],
              }}
              transition={{
                duration: 0.3,
                repeat: Infinity,
                repeatDelay: 4, // Fixed delay for synchronized blinking
                ease: "easeInOut"
              }}
            >
               <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/50 to-transparent animate-[pulse_2s_ease-in-out_infinite]" />
            </motion.div>
          </div>
        </motion.div>

      </main>

      {/* BOTTOM NAVIGATION BAR */}
      <footer className="relative z-20 px-4 pb-8 w-full max-w-md mx-auto">
        {/* Gradient Border Wrapper */}
        <div className="relative p-[1.5px] rounded-[36px]">
          
          {/* Inner Glowing Border Background (The visible line) */}
          <div className="absolute inset-0 rounded-[36px] bg-gradient-to-r from-blue-500 via-purple-500 via-pink-500 to-orange-500 animate-gradient-x bg-[length:200%_auto]" />
          
          {/* Outer Blur Glow (Diffused light) */}
          <div className="absolute inset-[-4px] rounded-[38px] bg-gradient-to-r from-blue-500 via-purple-500 via-pink-500 to-orange-500 animate-gradient-x bg-[length:200%_auto] blur-md opacity-60 pointer-events-none" />

          {/* Inner Glass Container */}
          <div className="relative flex items-center justify-between px-2 py-3 bg-[#050505]/95 backdrop-blur-2xl rounded-[34px]">
            
            <NavButton 
              icon={<Home className="w-6 h-6" />} 
              label="home" 
              isActive={activeTab === 'home'} 
              onClick={() => setActiveTab('home')} 
            />
            
            <NavButton 
              icon={<Camera className="w-6 h-6" />} 
              label="câmera" 
              isActive={activeTab === 'camera'} 
              onClick={() => setActiveTab('camera')} 
            />

            {/* CENTRAL MIC BUTTON */}
            <div className="relative flex items-center justify-center -mt-8 mx-1">
               {/* Decorative rings behind the central button */}
               <div className="absolute inset-0 -m-4 rounded-full border border-pink-500/30 animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite]" />
               <div className="absolute inset-0 -m-2 rounded-full border border-purple-500/50" />
               
               <button 
                 onClick={() => setActiveTab('mic')}
                 className={`
                    relative z-10 flex flex-col items-center justify-center
                    w-16 h-16 rounded-full bg-black border-[1.5px] border-purple-400
                    shadow-[0_0_20px_rgba(128,0,255,0.5),inset_0_0_15px_rgba(255,0,255,0.2)]
                    transition-transform active:scale-95
                 `}
               >
                 <Mic className="w-7 h-7 text-white" strokeWidth={1.5} />
               </button>
            </div>

            <NavButton 
              icon={<MessageSquare className="w-6 h-6" />} 
              label="message" 
              isActive={activeTab === 'message'} 
              onClick={() => setActiveTab('message')} 
            />

            <NavButton 
              icon={<Settings className="w-6 h-6" />} 
              label="configuração" 
              isActive={activeTab === 'config'} 
              onClick={() => setActiveTab('config')} 
            />

          </div>

          {/* iOS-style System Bar Indicator at very bottom of the nav */}
          <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-1/3 h-[3px] bg-purple-600/80 rounded-full shadow-[0_0_8px_#8000FF]" />
        </div>
      </footer>

    </div>
  );
}

// Sub-component for standard nav buttons
function NavButton({ 
  icon, 
  label, 
  isActive, 
  onClick 
}: { 
  icon: React.ReactNode; 
  label: string; 
  isActive: boolean; 
  onClick: () => void; 
}) {
  return (
    <button 
      onClick={onClick}
      className="flex flex-col items-center justify-center w-16 gap-1 group"
    >
      <div className={`transition-colors duration-300 ${isActive ? 'text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]' : 'text-gray-400 group-hover:text-gray-300'}`}>
        {React.cloneElement(icon as React.ReactElement, { strokeWidth: 1.5 })}
      </div>
      <span className={`text-[9px] font-medium tracking-wide transition-colors duration-300 ${isActive ? 'text-white' : 'text-gray-500 group-hover:text-gray-400'}`}>
        {label}
      </span>
    </button>
  );
}
