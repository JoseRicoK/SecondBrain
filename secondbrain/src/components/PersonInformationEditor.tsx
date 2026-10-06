import { useState } from "react";
import { FiPlus, FiX } from "react-icons/fi";
import {
  currentPersonValue,
  localPersonDetailDate,
  PROFILE_FIELDS,
} from "@/lib/person-information";
import type { PersonDetailCategory } from "@/lib/supabase-operations";
import styles from "./PeopleManager.module.css";

const labels: Record<string, string> = {
  rol: "Profesión o rol",
  relacion: "Relación contigo",
  cumpleaños: "Cumpleaños",
  direccion: "Dirección",
  detalles: "Recuerdo",
};
type Props = {
  details: Record<string, PersonDetailCategory>;
  profileValues: Record<string, string>;
  onProfileChange: (key: string, value: string) => void;
  onCategoryChange: (key: string, value: PersonDetailCategory) => void;
  onRemoveCategory: (key: string) => void;
};
export default function PersonInformationEditor({
  details,
  profileValues,
  onProfileChange,
  onCategoryChange,
  onRemoveCategory,
}: Props) {
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState("detalles");
  const addMemory = () =>
    onCategoryChange("detalles", {
      entries: [
        ...(details.detalles?.entries || []),
        { value: "", date: localPersonDetailDate() },
      ],
    });
  const datedEntries = (key: string, label: string) =>
    (details[key]?.entries || []).map((entry, index) => (
      <div key={`${key}-${index}`} className={styles.memoryEditor}>
        <div className={styles.editorRow}>
          <span>
            {label} {index + 1}
          </span>
          <button
            type="button"
            aria-label={`Eliminar ${label.toLowerCase()} ${index + 1}`}
            onClick={() =>
              onCategoryChange(key, {
                entries: details[key].entries.filter((_, i) => i !== index),
              })
            }
          >
            <FiX />
          </button>
        </div>
        <textarea
          aria-label={`${label} ${index + 1}`}
          rows={3}
          value={entry.value}
          placeholder="Escribe lo que quieres recordar…"
          onChange={(event) =>
            onCategoryChange(key, {
              entries: details[key].entries.map((item, i) =>
                i === index ? { ...item, value: event.target.value } : item,
              ),
            })
          }
        />
        <label className={styles.memoryDate}>
          Fecha
          <input
            type="date"
            aria-label={`Fecha del ${label.toLowerCase()} ${index + 1}`}
            value={entry.date}
            onChange={(event) =>
              onCategoryChange(key, {
                entries: details[key].entries.map((item, i) =>
                  i === index ? { ...item, date: event.target.value } : item,
                ),
              })
            }
          />
        </label>
      </div>
    ));
  return (
    <div className={styles.informationEditor}>
      <section className={styles.editorSection} aria-label="Datos de perfil">
        <h4>Datos de perfil</h4>
        {PROFILE_FIELDS.filter((key) => key in details).map((key) => (
          <div key={key} className={styles.profileEditor}>
            <div className={styles.editorRow}>
              <label htmlFor={`profile-${key}`}>{labels[key]}</label>
              <button
                type="button"
                aria-label={`Eliminar ${labels[key].toLowerCase()}`}
                onClick={() => onRemoveCategory(key)}
              >
                <FiX />
              </button>
            </div>
            <input
              id={`profile-${key}`}
              aria-label={`Información sobre ${key}`}
              value={profileValues[key] ?? currentPersonValue(details, key)}
              onChange={(event) => onProfileChange(key, event.target.value)}
            />
          </div>
        ))}
        {!PROFILE_FIELDS.some((key) => key in details) && (
          <p className={styles.emptyDetail}>Todavía no hay datos de perfil.</p>
        )}
      </section>
      <section className={styles.editorSection} aria-label="Recuerdos">
        <div className={styles.editorRow}>
          <h4>Recuerdos</h4>
          <button
            type="button"
            className={styles.addInformation}
            onClick={addMemory}
          >
            <FiPlus /> Añadir recuerdo
          </button>
        </div>
        {datedEntries("detalles", "Recuerdo")}
        {!details.detalles?.entries.length && (
          <p className={styles.emptyDetail}>Todavía no hay recuerdos.</p>
        )}
      </section>
      {Object.keys(details)
        .filter((key) => key !== "detalles" && !PROFILE_FIELDS.includes(key))
        .map((key) => (
          <section key={key} className={styles.editorSection}>
            <div className={styles.editorRow}>
              <h4>{key}</h4>
              <button
                type="button"
                aria-label={`Eliminar ${key}`}
                onClick={() => onRemoveCategory(key)}
              >
                <FiX />
              </button>
            </div>
            {datedEntries(key, key)}
          </section>
        ))}
      {adding ? (
        <div className={styles.addInformationPanel}>
          <label htmlFor="person-information-type">Qué quieres añadir</label>
          <select
            id="person-information-type"
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
          >
            {[...PROFILE_FIELDS, "detalles"].map((key) => (
              <option
                key={key}
                value={key}
                disabled={key !== "detalles" && key in details}
              >
                {labels[key]}
              </option>
            ))}
          </select>
          <div className={styles.editorRow}>
            <button type="button" onClick={() => setAdding(false)}>
              Cancelar
            </button>
            <button
              type="button"
              className={styles.addInformation}
              onClick={() => {
                if (selected === "detalles") addMemory();
                else if (!(selected in details))
                  onCategoryChange(selected, { entries: [] });
                setAdding(false);
              }}
            >
              Añadir
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className={styles.addInformation}
          onClick={() => {
            setSelected(
              PROFILE_FIELDS.find((key) => !(key in details)) || "detalles",
            );
            setAdding(true);
          }}
        >
          <FiPlus /> Añadir información
        </button>
      )}
    </div>
  );
}
