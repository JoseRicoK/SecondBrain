import React from 'react';
import { useDiaryStore } from '@/lib/store';
import { FaVolumeUp } from 'react-icons/fa';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const TranscriptionsList: React.FC = () => {
  const { transcriptions } = useDiaryStore();
  
  if (transcriptions.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h2 className="text-xl font-semibold text-gray-800 mb-4">
        Transcripciones de audio
      </h2>
      
      <div className="space-y-4">
        {transcriptions.map((transcription) => (
          <div 
            key={transcription.id} 
            className="p-4 border border-gray-200 rounded-md hover:border-blue-300 transition"
          >
            <div className="flex items-start mb-2">
              <FaVolumeUp className="text-blue-500 mt-1 mr-2" />
              <div>
                <p className="text-sm text-gray-500">
                  {format(
                    new Date(transcription.created_at), 
                    "d 'de' MMMM, HH:mm", 
                    { locale: es }
                  )}
                </p>
                <div className="mt-2 text-gray-700">
                  {transcription.transcription}
                </div>
              </div>
            </div>
            
            {transcription.audio_url && (
              <div className="mt-3">
                <audio 
                  src={transcription.audio_url} 
                  controls 
                  className="w-full"
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TranscriptionsList;
