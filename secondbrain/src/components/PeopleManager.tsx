import { hasMixedFamilyIdentity } from "@/lib/person-identity";
import React, { useState, useEffect, useRef } from "react";
import {
  currentPersonValue,
  personNameKey,
  mergePersonInformation,
  normalizePersonDetails,
  PROFILE_FIELDS,
  localPersonDetailDate,
} from "@/lib/person-information";
import {
  FiUser,
  FiEdit2,
  FiChevronRight,
  FiChevronDown,
  FiX,
  FiEye,
  FiEyeOff,
  FiCalendar,
  FiSearch,
  FiMessageCircle,
} from "react-icons/fi";
import {
  Person,
  PersonDetailCategory,
  PersonDetailEntry,
  getPeopleByUserId,
  savePerson,
  getPersonDetailsWithDates,
} from "@/lib/supabase-operations";
import PersonChat from "./PersonChat";
import PersonInformationEditor from "./PersonInformationEditor";
import styles from "./PeopleManager.module.css";

interface PeopleManagerProps {
  userId: string;
  className?: string;
  refreshTrigger?: number;
  initialSelectedName?: string | null;
}

export const PeopleManager: React.FC<PeopleManagerProps> = ({
  userId,
  className = "",
  refreshTrigger = 0,
  initialSelectedName = null,
}) => {
  const [people, setPeople] = useState<Person[]>([]);
  const loadRevision = useRef(0);
  const personHeaders = useRef(new Map<string, HTMLButtonElement>());
  const editSession = useRef(0);
  const currentOwner = useRef(userId);
  currentOwner.current = userId;
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editedDetails, setEditedDetails] = useState<
    Record<string, PersonDetailCategory>
  >({});
  const [profileValues, setProfileValues] = useState<Record<string, string>>(
    {},
  );
  const [editedVersion, setEditedVersion] = useState<string | undefined>();
  const [editedName, setEditedName] = useState<string>("");
  const [collapsed, setCollapsed] = useState(false);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [chatPerson, setChatPerson] = useState<Person | null>(null);

  // Cargar personas al montar el componente o cuando se dispare una actualización
  useEffect(() => {
    void loadPeople();
    return () => {
      loadRevision.current++;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, refreshTrigger]);

  useEffect(() => {
    setPeople([]);
    setSelectedPersonId(null);
    setEditMode(false);
    setChatPerson(null);
  }, [userId]);

  // Efecto para seleccionar automáticamente la persona por nombre cuando cambia initialSelectedName
  useEffect(() => {
    if (initialSelectedName && people.length > 0) {
      // Buscar la persona por nombre
      const byId = people.find((p) => p.id === initialSelectedName);
      const byName = people.filter(
        (p) => personNameKey(p.name) === personNameKey(initialSelectedName),
      );
      const person = byId || (byName.length === 1 ? byName[0] : undefined);
      if (person) {
        setSelectedPersonId(person.id);
        setSearchTerm("");
        setCollapsed(false);
      }
    }
  }, [initialSelectedName, people]);

  useEffect(() => {
    if (selectedPersonId)
      personHeaders.current
        .get(selectedPersonId)
        ?.scrollIntoView?.({ block: "start", behavior: "instant" });
  }, [selectedPersonId, people]);

  const loadPeople = async () => {
    const revision = ++loadRevision.current;
    try {
      setIsLoading(true);
      setError(null);
      const peopleData = await getPeopleByUserId(userId);
      if (revision === loadRevision.current && currentOwner.current === userId)
        setPeople(peopleData);
    } catch (err) {
      console.error("Error al cargar personas:", err);
      if (revision === loadRevision.current && currentOwner.current === userId)
        setError("No se pudieron cargar las personas");
    } finally {
      if (revision === loadRevision.current && currentOwner.current === userId)
        setIsLoading(false);
    }
  };

  const handlePersonClick = (personId: string) => {
    editSession.current++;
    setSelectedPersonId(selectedPersonId === personId ? null : personId);
    setEditMode(false); // Salir del modo edición al cambiar de persona
  };

  const handleEditClick = () => {
    if (!selectedPersonId) return;

    const selectedPerson = people.find((p) => p.id === selectedPersonId);
    if (selectedPerson) {
      // Usar getPersonDetailsWithDates para asegurar formato correcto
      const detailsWithDates = getPersonDetailsWithDates(selectedPerson);

      const editDetails = Object.fromEntries(
        Object.entries(detailsWithDates).map(([key, value]) => [
          key,
          { entries: sortEntriesByDate(value.entries) },
        ]),
      );
      editSession.current++;
      setEditedVersion(selectedPerson.updated_at);
      setProfileValues({});
      setEditedDetails(editDetails);
      setEditedName(selectedPerson.name);
      setEditMode(true);
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedPersonId) return;
    const session = editSession.current;

    try {
      setIsLoading(true);

      const cleanedDetails: Record<string, PersonDetailCategory> = {};
      for (const [key, category] of Object.entries(editedDetails)) {
        if (PROFILE_FIELDS.includes(key) && key in profileValues) {
          const value = profileValues[key].trim();
          if (value) {
            const merged = mergePersonInformation(
              { [key]: category },
              { [key]: value },
              localPersonDetailDate(),
            );
            if (merged[key]) cleanedDetails[key] = merged[key];
          }
        } else {
          cleanedDetails[key] = {
            entries: category.entries
              .map((entry) => ({ ...entry, value: entry.value.trim() }))
              .filter((entry) => entry.value),
          };
        }
      }

      const personToSave = {
        id: selectedPersonId,
        name: editedName.trim(),
        details: cleanedDetails,
      };

      if (!editedName.trim())
        throw new Error("El nombre no puede estar vacío.");
      const result = await savePerson({
        ...personToSave,
        user_id: userId,
        updated_at: editedVersion,
      });
      if (currentOwner.current !== userId || session !== editSession.current)
        return;
      if (!result)
        throw new Error(
          "No se pudieron guardar los cambios. La persona puede haber cambiado durante la edición; vuelve a abrirla.",
        );

      if (result) {
        // Actualizar la lista local de personas
        setPeople((prevPeople) =>
          prevPeople.map((person) =>
            person.id === selectedPersonId ? result : person,
          ),
        );

        setEditedDetails(cleanedDetails);
        setProfileValues({});
        setEditMode(false);
      }
    } catch (err) {
      console.error("Error al guardar cambios:", err);
      if (currentOwner.current === userId && session === editSession.current)
        setError(
          err instanceof Error
            ? err.message
            : "No se pudieron guardar los cambios",
        );
    } finally {
      if (currentOwner.current === userId) setIsLoading(false);
    }
  };

  const handleCancelEdit = () => {
    editSession.current++;
    setEditMode(false);
    setEditedDetails({}); // Limpiar todas las keys temporales
    setProfileValues({});
  };

  const handleChatClick = (person: Person, e: React.MouseEvent) => {
    e.stopPropagation(); // Evitar que se expanda/contraiga la sección de detalles
    setChatPerson(person);
  };

  const handleChatClose = () => {
    setChatPerson(null);
  };

  // Orden preferido de las categorías
  const categoryOrder = [
    "rol",
    "relacion",
    "detalles",
    "relationship",
    "role",
    "details",
  ];

  // Función auxiliar para formatear fechas
  const formatDate = (dateString: string) => {
    try {
      if (!dateString) return "Sin fecha";
      const date = new Date(dateString + "T12:00:00");
      if (!Number.isFinite(date.getTime())) return "Sin fecha";
      return date.toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  // Función para determinar si un valor es del nuevo formato con fechas
  const isNewFormat = (value: unknown): value is PersonDetailCategory => {
    return typeof value === "object" && value !== null && "entries" in value;
  };

  // Función para ordenar entradas por fecha (más recientes primero)
  const sortEntriesByDate = (
    entries: PersonDetailEntry[],
  ): PersonDetailEntry[] => {
    return [...entries].sort((a, b) => b.date.localeCompare(a.date));
  };

  // Función para filtrar personas por nombre, relación y rol
  const filterPeople = (people: Person[], searchTerm: string): Person[] => {
    if (!searchTerm.trim()) {
      return people;
    }

    const lowercaseSearchTerm = searchTerm.toLowerCase().trim();

    return people.filter((person) => {
      // Filtrar por nombre
      if (person.name.toLowerCase().includes(lowercaseSearchTerm)) {
        return true;
      }

      // Filtrar por contenido en los detalles (relación, rol, etc.)
      if (person.details && typeof person.details === "object") {
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
              if (
                entry.value &&
                entry.value.toLowerCase().includes(lowercaseSearchTerm)
              ) {
                return true;
              }
            }
          } else if (Array.isArray(value)) {
            // Formato antiguo con arrays
            for (const item of value as string[]) {
              if (
                typeof item === "string" &&
                item.toLowerCase().includes(lowercaseSearchTerm)
              ) {
                return true;
              }
            }
          } else if (typeof value === "string") {
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
    if (editMode)
      return (
        <PersonInformationEditor
          details={editedDetails}
          profileValues={profileValues}
          onProfileChange={(key, value) =>
            setProfileValues((prev) => ({ ...prev, [key]: value }))
          }
          onCategoryChange={(key, category) =>
            setEditedDetails((prev) => ({ ...prev, [key]: category }))
          }
          onRemoveCategory={(key) => {
            setEditedDetails((prev) => {
              const next = { ...prev };
              delete next[key];
              return next;
            });
            setProfileValues((prev) => {
              const next = { ...prev };
              delete next[key];
              return next;
            });
          }}
        />
      );
    const details = normalizePersonDetails(person.details);
    const sortedEntries = Object.entries(details).sort((a, b) => {
      const first = categoryOrder.indexOf(a[0]);
      const second = categoryOrder.indexOf(b[0]);
      if (first !== -1 && second !== -1) return first - second;
      if (first !== -1) return -1;
      if (second !== -1) return 1;
      return a[0].localeCompare(b[0]);
    });
    const labels: Record<string, string> = {
      rol: "Profesión o rol",
      relacion: "Relación",
      detalles: "Recuerdos y detalles",
      gustos: "Gustos",
      cumpleaños: "Cumpleaños",
      direccion: "Dirección",
    };
    return (
      <div className="mt-2 space-y-3">
        {sortedEntries.map(([key, value]) => (
          <section key={key} className={styles.detailCategory}>
            <h4>{labels[key] || key}</h4>
            {value.entries.length ? (
              <ul className={styles.detailList}>
                {sortEntriesByDate(value.entries).map((entry, index) => (
                  <li key={index} className={styles.detailEntry}>
                    <span>{entry.value}</span>
                    <time dateTime={entry.date || undefined}>
                      <FiCalendar size={12} />
                      {formatDate(entry.date)}
                    </time>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.emptyDetail}>Sin información</p>
            )}
          </section>
        ))}
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
    <div
      className={`bg-white rounded-lg ${className.includes("shadow-none") ? "" : "shadow-md"} py-0.5 px-0 sm:py-1 sm:px-0 ${className} transition-all duration-300`}
    >
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
                <FiSearch
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400"
                  size={16}
                />
                <input
                  type="text"
                  placeholder="Buscar por nombre, relación, rol..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`w-full pl-10 pr-4 py-2 text-sm border border-slate-300 rounded-md focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none transition-shadow ${styles.searchInput}`}
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
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
                La información sobre personas mencionadas en tus entradas
                aparecerá aquí.
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
                  <div className={styles.personList}>
                    {filteredPeople.map((person) => (
                      <div
                        key={person.id}
                        className={`${styles.personCard} ${selectedPersonId === person.id ? styles.personCardOpen : ""}`}
                      >
                        <button
                          type="button"
                          ref={(element) => {
                            if (element)
                              personHeaders.current.set(person.id, element);
                            else personHeaders.current.delete(person.id);
                          }}
                          className={styles.personHeader}
                          aria-expanded={selectedPersonId === person.id}
                          aria-controls={`person-details-${person.id}`}
                          onClick={() => handlePersonClick(person.id)}
                        >
                          <span className={styles.personAvatar}>
                            {person.name
                              .trim()
                              .split(/\s+/)
                              .slice(0, 2)
                              .map((part) => part[0])
                              .join("")
                              .toLocaleUpperCase("es")}
                          </span>
                          <span className={styles.personIdentity}>
                            <strong>{person.name}</strong>
                            {(currentPersonValue(person.details, "relacion") ||
                              currentPersonValue(person.details, "rol")) && (
                              <small>
                                {currentPersonValue(
                                  person.details,
                                  "relacion",
                                ) || currentPersonValue(person.details, "rol")}
                              </small>
                            )}
                          </span>
                          <span className={styles.personChevron}>
                            {selectedPersonId === person.id ? (
                              <FiChevronDown size={18} />
                            ) : (
                              <FiChevronRight size={18} />
                            )}
                          </span>
                        </button>

                        {selectedPersonId === person.id && (
                          <div
                            id={`person-details-${person.id}`}
                            className={styles.personBody}
                          >
                            {hasMixedFamilyIdentity(person) && (
                              <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-relaxed text-amber-900">
                                Esta ficha contiene relaciones de personas
                                distintas. Sus datos anteriores se conservan
                                pendientes de revisión; los nuevos análisis no
                                los mezclarán.
                              </p>
                            )}
                            <div className={styles.personActions}>
                              <button
                                onClick={(e) => handleChatClick(person, e)}
                                className={styles.chatAction}
                                aria-label={`Chat con ${person.name}`}
                                title={`Chat con ${person.name}`}
                              >
                                <FiMessageCircle
                                  size={14}
                                  className={editMode ? "" : "mr-1.5"}
                                />
                                {!editMode && "Abrir chat"}
                              </button>

                              <div className={styles.editActions}>
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
                                      {isLoading ? "Guardando..." : "Guardar"}
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    onClick={handleEditClick}
                                    className={styles.editAction}
                                  >
                                    <FiEdit2 size={16} className="mr-2" />
                                    Editar
                                  </button>
                                )}
                              </div>
                            </div>

                            {editMode && (
                              <div className="mb-4">
                                <div className="mb-2">
                                  <label
                                    htmlFor="person-name"
                                    className="font-medium text-slate-700 text-sm uppercase tracking-wide"
                                  >
                                    Nombre
                                  </label>
                                </div>
                                <input
                                  type="text"
                                  id="person-name"
                                  value={editedName}
                                  onChange={(e) => {
                                    setEditedName(e.target.value);
                                  }}
                                  className="w-full p-2 text-sm border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow border-2 border-purple-400"
                                  placeholder="Nombre de la persona"
                                  aria-label="Nombre de la persona"
                                  autoFocus
                                />
                              </div>
                            )}

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
