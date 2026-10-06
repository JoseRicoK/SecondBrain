import { hasMixedFamilyIdentity } from "@/lib/person-identity";
import React, { useState, useEffect, useRef } from "react";
import {
  currentPersonValue,
  personNameKey,
  mergePersonInformation,
  normalizePersonDetails,
  PROFILE_FIELDS,
  detailValueKey,
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
  const [editedDetails, setEditedDetails] = useState<Record<string, unknown>>(
    {},
  );
  const [originalDates, setOriginalDates] = useState<
    Record<string, Record<string, string[]>>
  >({});
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

      // Capturar las fechas originales para preservarlas durante la edición
      const originalDatesMap: Record<string, Record<string, string[]>> = {};

      // Inicializar las keys temporales de textarea para campos multi-valor
      const editDetails: Record<string, unknown> = {};
      const singleValueCategories = PROFILE_FIELDS;

      for (const [key, value] of Object.entries(detailsWithDates)) {
        editDetails[key] = value;

        // Capturar fechas originales
        if (isNewFormat(value)) {
          originalDatesMap[key] = {};
          sortEntriesByDate(value.entries).forEach((entry) => {
            (originalDatesMap[key][detailValueKey(entry.value)] ||= []).push(
              entry.date,
            );
          });
        }

        // Para campos multi-valor, inicializar la key temporal del textarea
        if (
          !singleValueCategories.includes(key.toLowerCase()) &&
          isNewFormat(value)
        ) {
          const textContent = sortEntriesByDate(value.entries)
            .map((entry) => entry.value)
            .join("\n");
          editDetails[key + "_textarea"] = textContent;
        }
      }

      editSession.current++;
      setEditedVersion(selectedPerson.updated_at);
      setOriginalDates(originalDatesMap);
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

      // Limpiar y procesar los detalles antes de guardar
      const cleanedDetails: Record<string, PersonDetailCategory> = {};

      for (const [key, value] of Object.entries(editedDetails)) {
        // Saltar las keys temporales del textarea
        if (key.endsWith("_textarea") || key.endsWith("_input")) continue;

        const currentDate = localPersonDetailDate();

        // Verificar si hay una versión de textarea para esta key
        const inputValue = editedDetails[key + "_input"];
        if (typeof inputValue === "string") {
          if (inputValue.trim()) {
            const merged = mergePersonInformation(
              { [key]: value },
              { [key]: inputValue },
              currentDate,
            );
            if (merged[key]) cleanedDetails[key] = merged[key];
          }
          continue;
        }
        const originalDateQueues = Object.fromEntries(
          Object.entries(originalDates[key] || {}).map(([value, dates]) => [
            value,
            [...dates],
          ]),
        );
        const textareaValue = editedDetails[key + "_textarea"] as string;

        if (textareaValue !== undefined) {
          // Si hay valor de textarea, procesarlo línea por línea preservando fechas
          const lines = textareaValue.split("\n").filter((line) => line.trim());

          cleanedDetails[key] = {
            entries: lines
              .map((line) => {
                const trimmedLine = line.trim();
                const normalizedLine = detailValueKey(trimmedLine);

                // Buscar la fecha original usando el mapeo capturado al inicio de la edición
                const originalDate =
                  originalDateQueues[normalizedLine]?.shift();

                return {
                  value: trimmedLine,
                  date: originalDate ?? currentDate, // Solo usar fecha actual si es contenido completamente nuevo
                };
              })
              .filter((entry) => entry.value), // Eliminar entradas vacías
          };
        } else if (value && typeof value === "object" && "entries" in value) {
          // Valor normal con formato de categoría
          const categoryValue = value as PersonDetailCategory;
          cleanedDetails[key] = {
            entries: categoryValue.entries
              .map((entry) => ({
                ...entry,
                value: entry.value.trim(),
              }))
              .filter((entry) => entry.value), // Eliminar entradas vacías
          };
        } else {
          // Convertir valor simple al formato de categoría con entradas
          const stringValue = String(value).trim();
          if (stringValue) {
            cleanedDetails[key] = {
              entries: [
                {
                  value: stringValue,
                  date: currentDate,
                },
              ],
            };
          }
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

        // Limpiar los valores temporales del textarea
        const cleanedEditedDetails: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(cleanedDetails)) {
          cleanedEditedDetails[key] = value;
        }
        setEditedDetails(cleanedEditedDetails);
        setOriginalDates({}); // Limpiar el mapeo de fechas originales
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
    setOriginalDates({}); // Limpiar el mapeo de fechas originales
  };

  // Función especializada para manejar cambios en textarea sin problemas de cursor
  const handleTextareaChange = (key: string, newTextValue: string) => {
    // Solo actualizar la key temporal del textarea, no procesar hasta guardar
    setEditedDetails((prev) => ({
      ...prev,
      [key + "_textarea"]: newTextValue,
    }));
  };

  const handleDetailChange = (key: string, value: unknown) => {
    setEditedDetails((prev) => ({
      ...prev,
      [key + "_input"]: String(value ?? ""),
    }));
  };

  const handleChatClick = (person: Person, e: React.MouseEvent) => {
    e.stopPropagation(); // Evitar que se expanda/contraiga la sección de detalles
    setChatPerson(person);
  };

  const handleChatClose = () => {
    setChatPerson(null);
  };

  const handleAddDetail = () => {
    const newKey = prompt("Introduce el nombre de la nueva categoría:");
    if (newKey && newKey.trim() !== "") {
      const currentDate = localPersonDetailDate();
      setEditedDetails((prev) => ({
        ...prev,
        [newKey.trim()]: {
          entries: [
            {
              value: "",
              date: currentDate,
            },
          ],
        },
      }));
    }
  };

  const handleRemoveDetail = (key: string) => {
    setEditedDetails((prev) => {
      const newDetails = { ...prev };
      delete newDetails[key];
      return newDetails;
    });
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
    const details = editMode
      ? editedDetails
      : normalizePersonDetails(person.details);

    if (!details) return null;

    // Ordenar las categorías según el orden preferido Y filtrar las keys temporales
    const sortedEntries = Object.entries(details)
      .filter(([key]) => !key.endsWith("_textarea") && !key.endsWith("_input")) // Filtrar las keys temporales del textarea
      .sort((a, b) => {
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
          <div
            key={key}
            className="border-b border-slate-100 pb-1 sm:pb-3 last:border-b-0 last:pb-0"
          >
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
                    const singleValueCategories = PROFILE_FIELDS;
                    const isSingleValueCategory =
                      singleValueCategories.includes(key.toLowerCase());

                    if (isSingleValueCategory) {
                      // Para campos de valor único (rol, relación), usar input de texto
                      const currentValue =
                        typeof editedDetails[key + "_input"] === "string"
                          ? (editedDetails[key + "_input"] as string)
                          : currentPersonValue({ [key]: value }, key);

                      return (
                        <input
                          type="text"
                          id={`detail-${key}`}
                          value={currentValue}
                          onChange={(e) =>
                            handleDetailChange(key, e.target.value)
                          }
                          className="w-full p-2 text-sm border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                          placeholder={`Información sobre ${key}`}
                          aria-label={`Información sobre ${key}`}
                        />
                      );
                    } else {
                      // Para campos de múltiples valores, usar textarea
                      if (Array.isArray(value)) {
                        const textareaValue =
                          (editedDetails[key + "_textarea"] as
                            string | undefined) ?? value.join("\n");
                        return (
                          <textarea
                            id={`detail-${key}`}
                            value={textareaValue}
                            onChange={(e) =>
                              handleTextareaChange(key, e.target.value)
                            }
                            className="w-full p-2 text-sm border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                            rows={Math.min(4, value.length + 1)}
                            placeholder={`Información sobre ${key} (un detalle por línea)`}
                            aria-label={`Información sobre ${key}`}
                          />
                        );
                      } else if (isNewFormat(value)) {
                        const textareaValue =
                          (editedDetails[key + "_textarea"] as
                            string | undefined) ??
                          sortEntriesByDate(value.entries)
                            .map((entry) => entry.value)
                            .join("\n");
                        return (
                          <textarea
                            id={`detail-${key}`}
                            value={textareaValue}
                            onChange={(e) =>
                              handleTextareaChange(key, e.target.value)
                            }
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
                            onChange={(e) =>
                              handleDetailChange(key, e.target.value)
                            }
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
                <section className={styles.detailCategory}>
                  <h4>
                    {(
                      {
                        rol: "Rol",
                        relacion: "Relación",
                        detalles: "Recuerdos y detalles",
                        gustos: "Gustos",
                        cumpleaños: "Cumpleaños",
                        direccion: "Dirección",
                      } as Record<string, string>
                    )[key] || key}
                  </h4>
                  {isNewFormat(value) && value.entries.length ? (
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
