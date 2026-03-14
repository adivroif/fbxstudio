
import React from 'react';

interface CameraControlsProps {
  onAction: (action: string) => void;
}

const CameraControls: React.FC<CameraControlsProps> = ({ onAction }) => {
  return (
    <div className="absolute right-4 sm:right-6 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-30">
      {[
        { id: 'zoomIn', icon: 'M12 4v16m8-8H4', label: 'Zoom In' },
        { id: 'zoomOut', icon: 'M20 12H4', label: 'Zoom Out' },
        { id: 'reset', icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15', label: 'Reset View' },
      ].map((btn) => (
        <button
          key={btn.id}
          onClick={() => onAction(btn.id)}
          className="w-8 h-8 sm:w-10 sm:h-10 bg-[#18181b] border border-white/5 rounded-lg sm:rounded-xl flex items-center justify-center text-zinc-400 hover:text-yellow-500 hover:bg-zinc-800 transition-all shadow-xl group relative"
          title={btn.label}
        >
          <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d={btn.icon} />
          </svg>
          <span className="hidden sm:block absolute right-full mr-3 px-2 py-1 bg-black text-white text-[8px] font-black uppercase tracking-widest rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap border border-white/10">
            {btn.label}
          </span>
        </button>
      ))}
    </div>
  );
};

export default CameraControls;
