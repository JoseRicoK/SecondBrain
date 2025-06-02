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
        fixed bottom-4 left-4 z-40
        flex items-center space-x-2 px-4 py-3
        bg-gradient-to-r from-purple-600 to-blue-600 
        hover:from-purple-700 hover:to-blue-700
        text-white rounded-full shadow-lg hover:shadow-xl
        transition-all duration-300 transform hover:scale-105
        ${isActive ? 'ring-4 ring-purple-300 ring-opacity-50' : ''}
        ${className}
      `}
    >
      <div className="relative">
        <FiZap size={20} className="animate-pulse" />
        {!isActive && (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white animate-ping"></div>
        )}
      </div>
      <span className="font-medium text-sm">Chat Personal</span>
    </button>
  );
};

export default PersonalChatButton;
