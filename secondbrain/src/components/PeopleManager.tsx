import React, { useState, useEffect } from 'react';
import { FiUser, FiEdit2, FiChevronRight, FiChevronDown, FiX } from 'react-icons/fi';
import { Person, getPeopleByUserId, savePerson } from '@/lib/supabase';

interface PeopleManagerProps {
  userId: string;
  className?: string;
  refreshTrigger?: number; // Nuevo prop para forzar la actualización
}

export const PeopleManager: React.FC<PeopleManagerProps> = ({ userId, className = '', refreshTrigger = 0 }) => {
  const [people, setPeople] = useState<Person[]>([]);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editedDetails, setEditedDetails] = useState<Record<string, any>>({});

  // Cargar personas al montar el componente o cuando se dispare una actualización
  useEffect(() => {
    loadPeople();
    console.log('Cargando personas. refreshTrigger:', refreshTrigger);
  }, [userId, refreshTrigger]);

  const loadPeople = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const peopleData = await getPeopleByUserId(userId);
      setPeople(peopleData);
    } catch (err) {
      console.error('Error al cargar personas:', err);
      setError('No se pudieron cargar las personas');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePersonClick = (personId: string) => {
    setSelectedPersonId(selectedPersonId === personId ? null : personId);
    setEditMode(false); // Salir del modo edición al cambiar de persona
  };

  const handleEditClick = () => {
    if (!selectedPersonId) return;
    
    const selectedPerson = people.find(p => p.id === selectedPersonId);
    if (selectedPerson) {
      setEditedDetails({...selectedPerson.details});
      setEditMode(true);
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedPersonId) return;
    
    try {
      setIsLoading(true);
      const result = await savePerson({
        id: selectedPersonId,
        details: editedDetails
      });
      
      if (result) {
        // Actualizar la lista local de personas
        setPeople(prevPeople => 
          prevPeople.map(person => 
            person.id === selectedPersonId
              ? { ...person, details: editedDetails }
              : person
          )
        );
        setEditMode(false);
      }
    } catch (err) {
      console.error('Error al guardar cambios:', err);
      setError('No se pudieron guardar los cambios');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setEditMode(false);
  };

  const handleDetailChange = (key: string, value: any) => {
    setEditedDetails(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleAddDetail = () => {
    const newKey = prompt('Introduce el nombre de la nueva categoría:');
    if (newKey && newKey.trim() !== '') {
      setEditedDetails(prev => ({
        ...prev,
        [newKey.trim()]: ''
      }));
    }
  };

  const handleRemoveDetail = (key: string) => {
    setEditedDetails(prev => {
      const newDetails = {...prev};
      delete newDetails[key];
      return newDetails;
    });
  };

  // Orden preferido de las categorías
  const categoryOrder = ['rol', 'relacion', 'detalles', 'relationship', 'role', 'details'];
  
  const renderPersonDetails = (person: Person) => {
    const details = editMode ? editedDetails : person.details;
    
    // Ordenar las categorías según el orden preferido
    const sortedEntries = Object.entries(details).sort((a, b) => {
      const indexA = categoryOrder.indexOf(a[0]);
      const indexB = categoryOrder.indexOf(b[0]);
      
      // Si ambas categorías están en la lista, usar ese orden
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      // Si solo una está en la lista, ponerla primero
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      // Si ninguna está en la lista, orden alfabético
      return a[0].localeCompare(b[0]);
    });
    
    return (
      <div className="mt-3 pl-6 space-y-2">
        {sortedEntries.map(([key, value]) => (
          <div key={key} className="flex items-start">
            <div className="w-full">
              {editMode ? (
                <div className="flex items-center mb-2">
                  <div className="flex-1">
                    <label htmlFor={`detail-${key}`} className="font-bold text-slate-800 text-sm">{key.toUpperCase()}</label>
                    {Array.isArray(value) ? (
                      <textarea
                        id={`detail-${key}`}
                        value={value.join('\n')}
                        onChange={e => handleDetailChange(key, e.target.value.split('\n'))}
                        className="w-full p-1 text-sm border border-slate-300 rounded"
                        rows={Math.min(4, value.length + 1)}
                        placeholder={`Información sobre ${key} (un detalle por línea)`}
                        aria-label={`Información sobre ${key}`}
                      />
                    ) : (
                      <textarea
                        id={`detail-${key}`}
                        value={value as string}
                        onChange={e => handleDetailChange(key, e.target.value)}
                        className="w-full p-1 text-sm border border-slate-300 rounded"
                        rows={2}
                        placeholder={`Información sobre ${key}`}
                        aria-label={`Información sobre ${key}`}
                      />
                    )}
                  </div>
                  <button 
                    onClick={() => handleRemoveDetail(key)}
                    className="ml-2 p-1 text-red-500 hover:text-red-700"
                    title="Eliminar"
                  >
                    <FiX size={16} />
                  </button>
                </div>
              ) : (
                <div>
                  <div className="font-bold text-slate-800 text-sm">{key.toUpperCase()}</div>
                  {Array.isArray(value) ? (
                    <div className="text-slate-600 text-sm">
                      {value.map((item, index) => (
                        <div key={index} className="ml-2">• {item}</div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-slate-600 text-sm whitespace-pre-wrap">{value as string}</div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        
        {editMode && (
          <div className="mt-3">
            <button 
              onClick={handleAddDetail}
              className="text-sm text-blue-500 hover:text-blue-700"
            >
              + Añadir categoría
            </button>
          </div>
        )}
      </div>
    );
  };

  if (isLoading && people.length === 0) {
    return (
      <div className={`bg-white rounded-lg shadow p-4 ${className}`}>
        <div className="flex justify-center items-center h-20">
          <div className="w-6 h-6 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow p-4 ${className}`}>
      <h2 className="text-lg font-semibold text-slate-800 mb-4">Personas</h2>
      
      {error && (
        <div className="mb-4 p-2 bg-red-100 text-red-700 rounded text-sm">
          {error}
        </div>
      )}
      
      {people.length === 0 ? (
        <div className="text-center text-slate-500 py-6">
          <FiUser className="mx-auto mb-2" size={32} />
          <p>No hay personas registradas aún.</p>
          <p className="text-sm mt-2">
            La información sobre personas mencionadas en tus entradas aparecerá aquí.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {people.map(person => (
            <div key={person.id} className="border border-slate-200 rounded-lg overflow-hidden">
              <div 
                className={`flex items-center justify-between p-3 cursor-pointer ${selectedPersonId === person.id ? 'bg-slate-50' : 'bg-white'}`}
                onClick={() => handlePersonClick(person.id)}
              >
                <div className="flex items-center">
                  <FiUser className="text-slate-500 mr-3" size={18} />
                  <span className="font-medium">{person.name}</span>
                </div>
                {selectedPersonId === person.id ? (
                  <FiChevronDown className="text-slate-500" size={18} />
                ) : (
                  <FiChevronRight className="text-slate-500" size={18} />
                )}
              </div>
              
              {selectedPersonId === person.id && (
                <div className="border-t border-slate-200 p-3">
                  <div className="flex justify-end mb-2">
                    {editMode ? (
                      <div className="flex space-x-2">
                        <button 
                          onClick={handleCancelEdit}
                          className="px-2 py-1 text-sm text-slate-600 hover:text-slate-800"
                          disabled={isLoading}
                        >
                          Cancelar
                        </button>
                        <button 
                          onClick={handleSaveEdit}
                          className="px-2 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                          disabled={isLoading}
                        >
                          {isLoading ? 'Guardando...' : 'Guardar'}
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={handleEditClick}
                        className="flex items-center text-sm text-blue-500 hover:text-blue-700"
                      >
                        <FiEdit2 size={14} className="mr-1" />
                        Editar
                      </button>
                    )}
                  </div>
                  
                  {renderPersonDetails(person)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PeopleManager;
