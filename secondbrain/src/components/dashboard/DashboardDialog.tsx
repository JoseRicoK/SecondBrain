"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { FiX } from "react-icons/fi";
import styles from "./dashboard.module.css";
export default function DashboardDialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const focus = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      focus?.focus();
    };
  }, []);
  return createPortal(
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <header className={styles.dialogHeader}>
        <h2>{title}</h2>
        <button
          className={styles.iconButton}
          onClick={onClose}
          aria-label="Cerrar ventana"
        >
          <FiX />
        </button>
      </header>
      <div className={styles.dialogBody}>{children}</div>
    </dialog>,
    document.body,
  );
}
