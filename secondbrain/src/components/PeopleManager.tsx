import React, { useState, useEffect } from 'react';
import { FiUser, FiEdit2, FiChevronRight, FiChevronDown, FiX, FiEye, FiEyeOff, FiCalendar, FiSearch, FiMessageCircle } from 'react-icons/fi';
import { Person, PersonDetailCategory, PersonDetailEntry, getPeopleByUserId, savePerson, getPersonDetailsWithDates } from '@/lib/firebase-operations';
import PersonChat from './PersonChat';
import styles from './PeopleManager.module.css';

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
  const [editedDetails, setEditedDetails] = useState<Record<string, unknown>>({});
  const [editedName, setEditedName] = useState<string>("");
  const [collapsed, setCollapsed] = useState(false);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [chatPerson, setChatPerson] = useState<Person | null>(null);

  // Cargar personas al montar el componente o cuando se dispare una actualización
  useEffect(() => {
    loadPeople();
    console.log('Cargando personas. refreshTrigger:', refreshTrigger);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      // Usar getPersonDetailsWithDates para asegurar formato correcto
      const detailsWithDates = getPersonDetailsWithDates(selectedPerson);
      setEditedDetails(detailsWithDates);
      setEditedName(selectedPerson.name);
      setEditMode(true);
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedPersonId) return;
    
    try {
      setIsLoading(true);
      
      // Limpiar espacios en blanco de los valores antes de guardar
      const cleanedDetails: Record<string, PersonDetailCategory> = {};
      for (const [key, value] of Object.entries(editedDetails)) {
        if (value && typeof value === 'object' && 'entries' in value) {
          const categoryValue = value as PersonDetailCategory;
          cleanedDetails[key] = {
            entries: categoryValue.entries
              .map(entry => ({
                ...entry,
                value: entry.value.trim()
              }))
              .filter(entry => entry.value) // Eliminar entradas vacías
          };
        } else {
          // Convertir valor simple al formato de categoría con entradas
          cleanedDetails[key] = {
            entries: [{
              value: String(value).trim(),
              date: new Date().toISOString().split('T')[0]
            }]
          };
        }
      }
      
      const result = await savePerson({
        id: selectedPersonId,
        name: editedName.trim(),
        details: cleanedDetails
      });
      
      if (result) {
        // Actualizar la lista local de personas
        setPeople(prevPeople => 
          prevPeople.map(person => 
            person.id === selectedPersonId
              ? { ...person, name: editedName.trim(), details: cleanedDetails }
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

  const handleDetailChange = (key: string, value: unknown) => {
    setEditedDetails(prev => {
      const currentDate = new Date().toISOString().split('T')[0];
      
      // Convertir el valor al formato con fechas
      let newValue: PersonDetailCategory;
      
      if (Array.isArray(value)) {
        // Si es un array (viene del textarea en modo edición), crear entradas con fecha
        newValue = {
          entries: value
            .filter(item => item && String(item).trim()) // Filtrar elementos vacíos
            .map(item => ({
              value: String(item).trim(),
              date: currentDate
            }))
        };
      } else if (typeof value === 'string') {
        // Si es un string, crear el formato con fechas (permitir strings vacíos para edición en tiempo real)
        newValue = {
          entries: [{
            value: value, // No hacer trim aquí para permitir espacios mientras se escribe
            date: currentDate
          }]
        };
      } else if (value && typeof value === 'object' && 'entries' in value) {
        // Si ya tiene el formato correcto, mantenerlo
        newValue = value as PersonDetailCategory;
      } else {
        // Para otros casos, convertir a string
        newValue = {
          entries: [{
            value: String(value || ''),
            date: currentDate
          }]
        };
      }
      
      return {
        ...prev,
        [key]: newValue
      };
    });
  };

  const handleChatClick = (person: Person, e: React.MouseEvent) => {
    e.stopPropagation(); // Evitar que se expanda/contraiga la sección de detalles
    setChatPerson(person);
  };

  const handleChatClose = () => {
    setChatPerson(null);
  };

  const handleAddDetail = () => {
    const newKey = prompt('Introduce el nombre de la nueva categoría:');
    if (newKey && newKey.trim() !== '') {
      const currentDate = new Date().toISOString().split('T')[0];
      setEditedDetails(prev => ({
        ...prev,
        [newKey.trim()]: {
          entries: [{
            value: '',
            date: currentDate
          }]
        }
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

  // Función auxiliar para formatear fechas
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  // Función para determinar si un valor es del nuevo formato con fechas
  const isNewFormat = (value: unknown): value is PersonDetailCategory => {
    return typeof value === 'object' && value !== null && 'entries' in value;
  };

  // Función para ordenar entradas por fecha (más recientes primero)
  const sortEntriesByDate = (entries: PersonDetailEntry[]): PersonDetailEntry[] => {
    return [...entries].sort((a, b) => {
      try {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        // Orden descendente: fechas más recientes primero
        return dateB.getTime() - dateA.getTime();
      } catch {
        // Si hay error en las fechas, mantener orden original
        return 0;
      }
    });
  };

  // Función para filtrar personas por nombre, relación y rol
  const filterPeople = (people: Person[], searchTerm: string): Person[] => {
    if (!searchTerm.trim()) {
      return people;
    }

    const lowercaseSearchTerm = searchTerm.toLowerCase().trim();

    return people.filter(person => {
      // Filtrar por nombre
      if (person.name.toLowerCase().includes(lowercaseSearchTerm)) {
        return true;
      }

      // Filtrar por contenido en los detalles (relación, rol, etc.)
      if (person.details && typeof person.details === 'object') {
        for (const [key, value] of Object.entries(person.details)) {
          // Buscar en las categorías (rol, relacion, etc.)
          if (key.toLowerCase().includes(lowercaseSearchTerm)) {
            return true;
          }

          // Buscar en el contenido de cada categoría
          if (isNewFormat(value)) {
            // Nuevo formato con entradas fechadas
            const entries = value.entries || [];
            for (const entry of entries) {
              if (entry.value && entry.value.toLowerCase().includes(lowercaseSearchTerm)) {
                return true;
              }
            }
          } else if (Array.isArray(value)) {
            // Formato antiguo con arrays
            for (const item of value as string[]) {
              if (typeof item === 'string' && item.toLowerCase().includes(lowercaseSearchTerm)) {
                return true;
              }
            }
          } else if (typeof value === 'string') {
            // Formato antiguo con strings
            if ((value as string).toLowerCase().includes(lowercaseSearchTerm)) {
              return true;
            }
          }
        }
      }

      return false;
    });
  };
  
  const renderPersonDetails = (person: Person) => {
    const details = editMode ? editedDetails : person.details;
    
    if (!details) return null;
    
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
      <div className="mt-2 space-y-2 sm:mt-3 sm:space-y-3">
        {sortedEntries.map(([key, value]) => (
          <div key={key} className="border-b border-slate-100 pb-1 sm:pb-3 last:border-b-0 last:pb-0">
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
                  
                  {/* Determinar si es un campo de valor único o múltiple */}
                  {(() => {
                    const singleValueCategories = ['rol', 'relacion'];
                    const isSingleValueCategory = singleValueCategories.includes(key.toLowerCase());
                    
                    if (isSingleValueCategory) {
                      // Para campos de valor único (rol, relación), usar input de texto
                      let currentValue = '';
                      if (isNewFormat(value) && value.entries.length > 0) {
                        currentValue = value.entries[value.entries.length - 1].value; // Usar el más reciente
                      } else if (typeof value === 'string') {
                        currentValue = value;
                      } else if (Array.isArray(value) && value.length > 0) {
                        currentValue = String(value[0]); // Tomar solo el primero
                      }
                      
                      return (
                        <input
                          type="text"
                          id={`detail-${key}`}
                          value={currentValue}
                          onChange={e => handleDetailChange(key, e.target.value)}
                          className="w-full p-2 text-sm border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                          placeholder={`Información sobre ${key}`}
                          aria-label={`Información sobre ${key}`}
                        />
                      );
                    } else {
                      // Para campos de múltiples valores, usar textarea
                      if (Array.isArray(value)) {
                        return (
                          <textarea
                            id={`detail-${key}`}
                            value={value.join('\n')}
                            onChange={e => handleDetailChange(key, e.target.value.split('\n'))}
                            className="w-full p-2 text-sm border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                            rows={Math.min(4, value.length + 1)}
                            placeholder={`Información sobre ${key} (un detalle por línea)`}
                            aria-label={`Información sobre ${key}`}
                          />
                        );
                      } else if (isNewFormat(value)) {
                        return (
                          <textarea
                            id={`detail-${key}`}
                            value={sortEntriesByDate(value.entries).map(entry => entry.value).join('\n')}
                            onChange={e => handleDetailChange(key, e.target.value.split('\n'))}
                            className="w-full p-2 text-sm border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                            rows={Math.min(4, value.entries.length + 1)}
                            placeholder={`Información sobre ${key} (un detalle por línea)`}
                            aria-label={`Información sobre ${key}`}
                          />
                        );
                      } else {
                        return (
                          <textarea
                            id={`detail-${key}`}
                            value={value as string}
                            onChange={e => handleDetailChange(key, e.target.value)}
                            className="w-full p-2 text-sm border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                            rows={2}
                            placeholder={`Información sobre ${key}`}
                            aria-label={`Información sobre ${key}`}
                          />
                        );
                      }
                    }
                  })()}
                </div>
              ) : (
                <div>
                  <div className="font-medium text-slate-700 text-sm uppercase tracking-wide sm:mb-1">{key}</div>
                  {isNewFormat(value) ? (
                    // Nuevo formato con fechas - ORDENADO POR FECHA (más recientes primero)
                    <div 
                      onClick={handleEditClick} 
                      className="text-slate-600 text-sm bg-slate-50 px-1 pb-0.5 sm:px-2 sm:py-2 rounded-md sm:mt-0 cursor-pointer hover:bg-slate-100 transition-colors">
                      {value.entries.length > 0 ? sortEntriesByDate(value.entries).map((entry, index) => (
                        <div key={index} className="pb-0.5 sm:py-1 border-b border-slate-100 last:border-b-0">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start flex-1">
                              <span className="text-blue-500 mr-1 mt-0.5">•</span> 
                              <span className="flex-1">{entry.value}</span>
                            </div>
                            <div className="flex items-center ml-2 text-xs text-slate-400">
                              <FiCalendar size={12} className="mr-1" />
                              {formatDate(entry.date)}
                            </div>
                          </div>
                        </div>
                      )) : <div className="text-slate-400 italic">Sin información</div>}
                    </div>
                  ) : Array.isArray(value) ? (
                    // Formato antiguo con arrays
                    <div 
                      onClick={handleEditClick} 
                      className="text-slate-600 text-sm bg-slate-50 px-1 pb-0.5 sm:px-2 sm:py-2 rounded-md sm:mt-0 cursor-pointer hover:bg-slate-100 transition-colors">
                      {value.length > 0 ? value.map((item, index) => (
                        <div key={index} className="pb-0.5 sm:py-1 border-b border-slate-100 last:border-b-0 flex">
                          <span className="text-blue-500 mr-1">•</span> 
                          <span>{item}</span>
                        </div>
                      )) : <div className="text-slate-400 italic">Sin información</div>}
                    </div>
                  ) : (
                    // Formato antiguo con strings
                    <div 
                      onClick={handleEditClick}
                      className="text-slate-600 text-sm whitespace-pre-wrap bg-slate-50 px-1 py-1 sm:px-2 sm:py-2 rounded-md sm:mt-0 cursor-pointer hover:bg-slate-100 transition-colors">
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
              className="inline-flex items-center px-4 py-2 text-sm bg-slate-100 text-slate-700 rounded-md hover:bg-slate-200 transition-colors"
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
            className="text-slate-500 hover:text-slate-700 transition-colors p-1"
            title={collapsed ? "Mostrar panel" : "Ocultar panel"}
          >
            {collapsed ? <FiEye size={20} /> : <FiEyeOff size={20} />}
          </button>
        </div>
        <div className="flex justify-center items-center h-20">
          <div className="w-6 h-6 border-2 border-slate-300 border-t-purple-500 rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg ${className.includes('shadow-none') ? '' : 'shadow-md'} py-0.5 px-0 sm:py-1 sm:px-0 ${className} transition-all duration-300`}>
      <div className="flex justify-between items-center mb-4 px-1 sm:px-1">
        <h2 className="text-lg font-semibold text-slate-800">Personas</h2>
        <button 
          onClick={() => setCollapsed(!collapsed)}
          className="text-slate-500 hover:text-slate-700 transition-colors p-1"
          title={collapsed ? "Mostrar panel" : "Ocultar panel"}
        >
          {collapsed ? <FiEye size={20} /> : <FiEyeOff size={20} />}
        </button>
      </div>
      
      {!collapsed && (
        <div className="px-0.5 sm:px-0.5">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
              {error}
            </div>
          )}

          {/* Campo de búsqueda */}
          {people.length > 0 && (
            <div className="mb-4">
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="Buscar por nombre, relación, rol..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`w-full pl-10 pr-4 py-2 text-sm border border-slate-300 rounded-md focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none transition-shadow ${styles.searchInput}`}
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    title="Limpiar búsqueda"
                  >
                    <FiX size={16} />
                  </button>
                )}
              </div>
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
            <>
              {(() => {
                const filteredPeople = filterPeople(people, searchTerm);
                
                if (filteredPeople.length === 0) {
                  return (
                    <div className="text-center text-slate-500 py-8 px-4 bg-slate-50 rounded-lg">
                      <FiSearch className="mx-auto mb-3" size={32} />
                      <p className="font-medium">No se encontraron personas</p>
                      <p className="text-sm mt-2 text-slate-400">
                        Intenta con otros términos de búsqueda.
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-4">
                    {filteredPeople.map(person => (
                <div key={person.id} className="border border-slate-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all duration-200">
                  <div 
                    className={`flex items-center justify-between px-3 py-2 cursor-pointer ${selectedPersonId === person.id ? 'bg-purple-50 border-b border-purple-100' : 'bg-white'}`}
                    onClick={() => handlePersonClick(person.id)}
                  >
                    <div className="flex items-center">
                      <div className="bg-purple-100 text-purple-600 p-1.5 rounded-full mr-2">
                        <FiUser size={14} />
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
                    <div className="bg-white px-4 py-3">
                      <div className="flex justify-between items-center mb-3">
                        <button 
                          onClick={(e) => handleChatClick(person, e)}
                          className="flex items-center px-3 py-2 text-sm text-purple-600 bg-purple-50 rounded-md hover:bg-purple-100 transition-colors"
                        >
                          <FiMessageCircle size={14} className="mr-1.5" />
                          Chat con {person.name}
                        </button>
                        
                        <div className="flex space-x-2">
                          {editMode ? (
                            <>
                              <button 
                                onClick={handleCancelEdit}
                                className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-md hover:bg-slate-200 transition-colors"
                              >
                                Cancelar
                              </button>
                              <button 
                                onClick={handleSaveEdit}
                                className="px-4 py-2 text-sm text-white bg-purple-600 rounded-md hover:bg-purple-700 transition-colors"
                                disabled={isLoading}
                              >
                                {isLoading ? 'Guardando...' : 'Guardar'}
                              </button>
                            </>
                          ) : (
                            <button 
                              onClick={handleEditClick}
                              className="flex items-center px-4 py-2 text-sm text-purple-600 bg-purple-50 rounded-md hover:bg-purple-100 transition-colors"
                            >
                              <FiEdit2 size={16} className="mr-2" />
                              Editar
                            </button>
                          )}
                        </div>
                      </div>
                      
                      {renderPersonDetails(person)}
                    </div>
                  )}
                </div>
                    ))}
                  </div>
                );
              })()}
            </>
          )}
        </div>
      )}
      
      {/* Chat Component */}
      {chatPerson && (
        <PersonChat
          person={chatPerson}
          isOpen={!!chatPerson}
          onClose={handleChatClose}
        />
      )}
    </div>
  );
};

export default PeopleManager;
