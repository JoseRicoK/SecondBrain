import React, { useState, useEffect } from 'react';
import { useDiaryStore } from '@/lib/store';

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
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-400">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-800">
          {isEditing ? 'Editando entrada' : 'Entrada del día'}
        </h2>
        <div>
          {isEditing ? (
            <div className="space-x-2">
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition"
              >
                Guardar
              </button>
              <button
                onClick={toggleEditMode}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              onClick={toggleEditMode}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
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
          className="w-full min-h-[300px] p-4 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Escribe tus pensamientos, reflexiones o tareas del día..."
        />
      ) : (
        <div className="prose max-w-none min-h-[300px] p-4 border border-gray-100 rounded-md bg-gray-50">
          {content ? (
            <div dangerouslySetInnerHTML={{ __html: content.replace(/\n/g, '<br />') }} />
          ) : (
            <p className="text-gray-400 italic">No hay contenido para mostrar.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default DiaryEditor;
