import React, { useState, useEffect } from 'react';
import { FiUser, FiEdit2, FiChevronRight, FiChevronDown, FiX, FiEye, FiEyeOff } from 'react-icons/fi';
import { Person, getPeopleByUserId, savePerson } from '@/lib/supabase';

interface PeopleManagerProps {
  userId: string;
  className?: string;
  refreshTrigger?: number;
  initialSelectedName?: string | null;
}

export const PeopleManager: React.FC<PeopleManagerProps> = ({ userId, className = '', refreshTrigger = 0, initialSelectedName = null }) => {
  const [people, setPeople] = useState<Person[]>([]);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editedDetails, setEditedDetails] = useState<Record<string, any>>({});
  const [editedName, setEditedName] = useState<string>("");
  const [collapsed, setCollapsed] = useState(false);

  // Cargar personas al montar el componente o cuando se dispare una actualización
  useEffect(() => {
    loadPeople();
    console.log('Cargando personas. refreshTrigger:', refreshTrigger);
  }, [userId, refreshTrigger]);
  
  // Efecto para seleccionar automáticamente la persona por nombre cuando cambia initialSelectedName
  useEffect(() => {
    if (initialSelectedName && people.length > 0) {
      // Buscar la persona por nombre
      const person = people.find(p => p.name === initialSelectedName);
      if (person) {
        setSelectedPersonId(person.id);
      }
    }
  }, [initialSelectedName, people]);

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
      setEditedName(selectedPerson.name);
      setEditMode(true);
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedPersonId) return;
    
    try {
      setIsLoading(true);
      const result = await savePerson({
        id: selectedPersonId,
        name: editedName,
        details: editedDetails
      });
      
      if (result) {
        // Actualizar la lista local de personas
        setPeople(prevPeople => 
          prevPeople.map(person => 
            person.id === selectedPersonId
              ? { ...person, name: editedName, details: editedDetails }
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
      <div className="mt-3 space-y-4">
        {sortedEntries.map(([key, value]) => (
          <div key={key} className="border-b border-slate-100 pb-3 last:border-b-0 last:pb-0">
            <div className="w-full">
              {editMode ? (
                <div className="mb-2">
                  <div className="flex items-center justify-between mb-1">
                    <label 
                      htmlFor={`detail-${key}`} 
                      className="font-medium text-slate-700 text-sm uppercase tracking-wide"
                    >
                      {key}
                    </label>
                    <button 
                      onClick={() => handleRemoveDetail(key)}
                      className="p-1 text-red-500 hover:text-red-700 rounded-full hover:bg-red-50 transition-colors"
                      title="Eliminar categoría"
                    >
                      <FiX size={16} />
                    </button>
                  </div>
                  {Array.isArray(value) ? (
                    <textarea
                      id={`detail-${key}`}
                      value={value.join('\n')}
                      onChange={e => handleDetailChange(key, e.target.value.split('\n'))}
                      className="w-full p-2 text-sm border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                      rows={Math.min(4, value.length + 1)}
                      placeholder={`Información sobre ${key} (un detalle por línea)`}
                      aria-label={`Información sobre ${key}`}
                    />
                  ) : (
                    <textarea
                      id={`detail-${key}`}
                      value={value as string}
                      onChange={e => handleDetailChange(key, e.target.value)}
                      className="w-full p-2 text-sm border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                      rows={2}
                      placeholder={`Información sobre ${key}`}
                      aria-label={`Información sobre ${key}`}
                    />
                  )}
                </div>
              ) : (
                <div>
                  <div className="font-medium text-slate-700 text-sm uppercase tracking-wide mb-1">{key}</div>
                  {Array.isArray(value) ? (
                    <div className="text-slate-600 text-sm bg-slate-50 p-2 rounded-md">
                      {value.length > 0 ? value.map((item, index) => (
                        <div key={index} className="py-1 border-b border-slate-100 last:border-b-0 flex">
                          <span className="text-blue-500 mr-2">•</span> 
                          <span>{item}</span>
                        </div>
                      )) : <div className="text-slate-400 italic">Sin información</div>}
                    </div>
                  ) : (
                    <div className="text-slate-600 text-sm whitespace-pre-wrap bg-slate-50 p-2 rounded-md">
                      {(value as string).trim() ? (value as string) : <span className="text-slate-400 italic">Sin información</span>}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        
        {editMode && (
          <div className="mt-4 text-center">
            <button 
              onClick={handleAddDetail}
              className="inline-flex items-center px-3 py-1.5 text-sm bg-slate-100 text-slate-700 rounded-md hover:bg-slate-200 transition-colors"
            >
              <span className="mr-1 font-bold">+</span> Añadir categoría
            </button>
          </div>
        )}
      </div>
    );
  };

  if (isLoading && people.length === 0) {
    return (
      <div className={`bg-white rounded-lg shadow-md p-4 ${className}`}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-slate-800">Personas</h2>
          <button 
            onClick={() => setCollapsed(!collapsed)}
            className="text-slate-500 hover:text-slate-700 transition-colors"
            title={collapsed ? "Mostrar panel" : "Ocultar panel"}
          >
            {collapsed ? <FiEye size={18} /> : <FiEyeOff size={18} />}
          </button>
        </div>
        <div className="flex justify-center items-center h-20">
          <div className="w-6 h-6 border-2 border-slate-300 border-t-purple-500 rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg ${className.includes('shadow-none') ? '' : 'shadow-md'} p-4 ${className} transition-all duration-300`}>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-slate-800">Personas</h2>
        <button 
          onClick={() => setCollapsed(!collapsed)}
          className="text-slate-500 hover:text-slate-700 transition-colors"
          title={collapsed ? "Mostrar panel" : "Ocultar panel"}
        >
          {collapsed ? <FiEye size={18} /> : <FiEyeOff size={18} />}
        </button>
      </div>
      
      {!collapsed && (
        <>
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
              {error}
            </div>
          )}
          
          {people.length === 0 ? (
            <div className="text-center text-slate-500 py-8 px-4 bg-slate-50 rounded-lg">
              <FiUser className="mx-auto mb-3" size={32} />
              <p className="font-medium">No hay personas registradas aún.</p>
              <p className="text-sm mt-2 text-slate-400">
                La información sobre personas mencionadas en tus entradas aparecerá aquí.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {people.map(person => (
                <div key={person.id} className="border border-slate-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all duration-200">
                  <div 
                    className={`flex items-center justify-between p-3 cursor-pointer ${selectedPersonId === person.id ? 'bg-purple-50 border-b border-purple-100' : 'bg-white'}`}
                    onClick={() => handlePersonClick(person.id)}
                  >
                    <div className="flex items-center">
                      <div className="bg-purple-100 text-purple-600 p-2 rounded-full mr-3">
                        <FiUser size={16} />
                      </div>
                      <span className="font-medium">{person.name}</span>
                    </div>
                    <div className="text-slate-400">
                      {selectedPersonId === person.id ? (
                        <FiChevronDown size={18} />
                      ) : (
                        <FiChevronRight size={18} />
                      )}
                    </div>
                  </div>
                  
                  {selectedPersonId === person.id && (
                    <div className="bg-white p-4">
                      <div className="flex justify-end mb-3">
                        {editMode ? (
                          <div className="flex space-x-2">
                            <button 
                              onClick={handleCancelEdit}
                              className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800 border border-slate-300 rounded-md transition-colors"
                              disabled={isLoading}
                            >
                              Cancelar
                            </button>
                            <button 
                              onClick={handleSaveEdit}
                              className="px-3 py-1.5 text-sm bg-purple-500 text-white rounded-md hover:bg-purple-600 transition-colors"
                              disabled={isLoading}
                            >
                              {isLoading ? 'Guardando...' : 'Guardar'}
                            </button>
                          </div>
                        ) : (
                          <button 
                            onClick={handleEditClick}
                            className="flex items-center text-sm px-3 py-1.5 text-purple-600 hover:text-purple-700 border border-purple-200 rounded-md hover:bg-purple-50 transition-colors"
                          >
                            <FiEdit2 size={14} className="mr-2" />
                            Editar
                          </button>
                        )}
                      </div>
                      
                      {editMode && (
                        <div className="mb-4 border-b border-slate-200 pb-4">
                          <div className="mb-1">
                            <label 
                              htmlFor="person-name" 
                              className="font-medium text-slate-700 text-sm uppercase tracking-wide"
                            >
                              Nombre
                            </label>
                          </div>
                          <input
                            id="person-name"
                            type="text"
                            value={editedName}
                            onChange={(e) => setEditedName(e.target.value)}
                            className="w-full p-2 text-sm border border-slate-300 rounded-md focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none transition-shadow"
                            placeholder="Nombre de la persona"
                          />
                        </div>
                      )}
                      
                      {renderPersonDetails(person)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default PeopleManager;
