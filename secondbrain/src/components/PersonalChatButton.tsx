import React from 'react';
import { FiZap } from 'react-icons/fi';

interface PersonalChatButtonProps {
  onClick: () => void;
  isActive: boolean;
  className?: string;
}

export const PersonalChatButton: React.FC<PersonalChatButtonProps> = ({ 
  onClick, 
  isActive,
  className = ''
}) => {
  return (
    <button
      onClick={onClick}
      title="Chat Personal - Analiza tu vida con IA"
      className={`
        fixed left-[420px] bottom-20 z-40
        flex flex-col items-center justify-center w-16 h-24
        bg-gradient-to-br from-purple-500 to-blue-600 
        hover:from-purple-600 hover:to-blue-700
        text-white shadow-xl hover:shadow-2xl
        rounded-r-2xl border-l-4 border-purple-400
        transition-all duration-300 hover:w-20 hover:scale-105
        md:flex
        ${isActive ? 'from-purple-600 to-blue-700 scale-105' : ''}
        ${className}
      `}
    >
      <div className="relative mb-2">
        <FiZap size={22} className={isActive ? 'animate-pulse' : ''} />
        {!isActive && (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full border-2 border-white animate-ping"></div>
        )}
      </div>
      <span className="font-bold text-xs text-center leading-tight">CHAT</span>
      <span className="font-medium text-[10px] text-center leading-tight opacity-90">Personal</span>
    </button>
  );
};

export default PersonalChatButton;
