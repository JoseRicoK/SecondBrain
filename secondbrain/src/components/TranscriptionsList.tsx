import React from 'react';
import { useDiaryStore } from '@/lib/store';
import { FaVolumeUp } from 'react-icons/fa';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const TranscriptionsList: React.FC = () => {
  const { transcriptions } = useDiaryStore();
  
  if (transcriptions.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-xl p-6 sm:p-8 text-center">
        <h2 className="text-2xl font-semibold text-slate-800 mb-4">
          Transcripciones de audio
        </h2>
        <div className="flex flex-col items-center justify-center py-8">
          <svg className="w-16 h-16 text-slate-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15zM16 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
          <p className="text-slate-500 text-lg">Aún no hay transcripciones.</p>
          <p className="text-slate-400 text-sm mt-1">Graba un audio y transcríbelo para verlo aquí.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-xl p-6 sm:p-8 space-y-6">
      <h2 className="text-2xl font-semibold text-slate-800 mb-2">
        Transcripciones de audio
      </h2>
      
      <div className="space-y-5">
        {transcriptions.map((transcription) => (
          <div 
            key={transcription.id} 
            className="p-4 bg-slate-50 border border-slate-200 rounded-lg hover:shadow-md transition-shadow duration-150 ease-in-out"
          >
            <div className="flex items-start">
              <FaVolumeUp className="text-blue-500 mt-1 mr-3 flex-shrink-0" size={20} />
              <div>
                <p className="text-sm text-slate-500 font-medium">
                  {format(
                    new Date(transcription.created_at), 
                    "d 'de' MMMM, HH:mm", 
                    { locale: es }
                  )}
                </p>
                <div className="mt-2 text-slate-700 prose prose-sm max-w-none leading-relaxed">
                  {/* Render newlines correctly */}
                  {transcription.transcription.split('\n').map((line, index, array) => (
                    <React.Fragment key={index}>
                      {line}
                      {index < array.length - 1 && <br />}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>
            
            {transcription.audio_url && (
              <div className="mt-4 pt-3 border-t border-slate-200">
                <audio 
                  src={transcription.audio_url} 
                  controls 
                  className="w-full h-10 rounded-md shadow-sm"
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
