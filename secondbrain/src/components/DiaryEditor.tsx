import React, { useState, useEffect } from 'react';
import { useDiaryStore } from '@/lib/store';
import DOMPurify from 'isomorphic-dompurify';

interface DiaryEditorProps {
  userId: string;
}

const DiaryEditor: React.FC<DiaryEditorProps> = ({ userId }) => {
  const { 
    currentEntry, 
    isEditing, 
    isLoading,
    saveCurrentEntry, 
    toggleEditMode 
  } = useDiaryStore();
  
  const [content, setContent] = useState<string>('');
  
  // Sincronizar el contenido con la entrada actual
  useEffect(() => {
    if (currentEntry) {
      setContent(currentEntry.content);
    } else {
      setContent('');
    }
  }, [currentEntry]);

  const handleSave = () => {
    saveCurrentEntry(content, userId);
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 min-h-[400px] flex flex-col justify-center items-center">
        <svg className="animate-spin h-8 w-8 text-slate-500 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p className="text-slate-500 text-lg">Cargando entrada...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-xl p-6 sm:p-8 space-y-6 min-h-[400px] flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-semibold text-slate-800">
          {isEditing ? 'Editando entrada' : 'Entrada del día'}
        </h2>
        <div>
          {isEditing ? (
            <div className="space-x-2">
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Guardar
              </button>
              <button
                onClick={toggleEditMode}
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-md hover:bg-slate-300 transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              onClick={toggleEditMode}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!currentEntry}
            >
              Editar
            </button>
          )}
        </div>
      </div>

      {isEditing ? (
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full flex-grow p-4 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow duration-150 ease-in-out text-slate-700 leading-relaxed placeholder-slate-400 resize-none"
          placeholder="Escribe tus pensamientos, reflexiones o tareas del día..."
        />
      ) : (
        <div 
          className="prose prose-slate max-w-none flex-grow p-4 border border-slate-200 rounded-md bg-slate-50 overflow-y-auto cursor-pointer hover:bg-slate-100 transition-colors duration-150 ease-in-out"
          onClick={toggleEditMode}
          title="Haz clic para editar"
        >
          {content ? (
            <div
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(content).replace(/\n/g, '<br />'),
              }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full">
              <svg className="w-16 h-16 text-slate-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
              <p className="text-slate-400 italic text-center">No hay contenido para esta entrada.</p>
              <p className="text-slate-400 text-sm mt-1 text-center">Haz clic aquí para comenzar a escribir.</p>
            </div>
          )}
        </div>
      )}
      {/* Ensure the parent div grows to fill space if content is short */}
      {!isEditing && !content && <div className="flex-grow"></div>}
    </div>
  );
};

export default DiaryEditor;
