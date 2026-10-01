import { useEffect, useRef, useState } from 'react';
import type { CardData, ColumnId } from '../types';
import { COLUMNS, PRIORITIES } from '../types';
import styles from './CardModal.module.css';

interface CardModalProps {
  card: CardData;
  isNew: boolean;
  knownAssignees: string[];
  onSave: (card: CardData) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

interface FormErrors {
  title?: string;
  assignee?: string;
  dueDate?: string;
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function CardModal({
  card,
  isNew,
  knownAssignees,
  onSave,
  onDelete,
  onClose,
}: CardModalProps) {
  const [draft, setDraft] = useState<CardData>(card);
  const [errors, setErrors] = useState<FormErrors>({});
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    titleInputRef.current?.focus();
    return () => {
      previouslyFocused?.focus();
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        if (confirmingDelete) {
          setConfirmingDelete(false);
        } else {
          onClose();
        }
        return;
      }

      if (event.key === 'Tab' && modalRef.current) {
        const focusable = Array.from(
          modalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, confirmingDelete]);

  function validate(): boolean {
    const nextErrors: FormErrors = {};
    if (!draft.title.trim()) nextErrors.title = 'Title is required.';
    if (!draft.assignee.trim()) nextErrors.assignee = 'Assignee is required.';
    if (!draft.dueDate) nextErrors.dueDate = 'Due date is required.';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function handleSave() {
    if (!validate()) return;
    onSave({ ...draft, title: draft.title.trim(), assignee: draft.assignee.trim() });
  }

  return (
    <div
      className={styles.overlay}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div ref={modalRef} className={styles.modal} role="dialog" aria-modal="true" aria-label="Card">
        <div className={styles.header}>
          <h2 className={styles.headerTitle}>Card</h2>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="card-title">
              Name
            </label>
            <input
              id="card-title"
              ref={titleInputRef}
              className={styles.input}
              type="text"
              placeholder="Enter card name..."
              maxLength={200}
              aria-required="true"
              aria-invalid={Boolean(errors.title)}
              aria-describedby={errors.title ? 'card-title-error' : undefined}
              value={draft.title}
              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
            />
            {errors.title && (
              <p id="card-title-error" className={styles.error}>
                {errors.title}
              </p>
            )}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="card-description">
              Description
            </label>
            <textarea
              id="card-description"
              className={styles.textarea}
              placeholder="Add a description..."
              maxLength={2000}
              value={draft.description}
              onChange={(event) => setDraft({ ...draft, description: event.target.value })}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="card-assignee">
              Assignee
            </label>
            <input
              id="card-assignee"
              className={styles.input}
              type="text"
              list="card-assignee-suggestions"
              placeholder="Enter assignee name..."
              maxLength={100}
              aria-required="true"
              aria-invalid={Boolean(errors.assignee)}
              aria-describedby={errors.assignee ? 'card-assignee-error' : undefined}
              value={draft.assignee}
              onChange={(event) => setDraft({ ...draft, assignee: event.target.value })}
            />
            <datalist id="card-assignee-suggestions">
              {knownAssignees.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
            {errors.assignee && (
              <p id="card-assignee-error" className={styles.error}>
                {errors.assignee}
              </p>
            )}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="card-status">
              Status
            </label>
            <select
              id="card-status"
              className={styles.select}
              value={draft.status}
              onChange={(event) => setDraft({ ...draft, status: event.target.value as ColumnId })}
            >
              {COLUMNS.map((column) => (
                <option key={column.id} value={column.id}>
                  {column.title}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="card-priority">
                Priority
              </label>
              <select
                id="card-priority"
                className={styles.select}
                value={draft.priority}
                onChange={(event) =>
                  setDraft({ ...draft, priority: event.target.value as CardData['priority'] })
                }
              >
                {PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="card-due-date">
                Due Date
              </label>
              <input
                id="card-due-date"
                className={styles.input}
                type="date"
                min={today()}
                aria-required="true"
                aria-invalid={Boolean(errors.dueDate)}
                aria-describedby={errors.dueDate ? 'card-due-date-error' : undefined}
                value={draft.dueDate}
                onChange={(event) => setDraft({ ...draft, dueDate: event.target.value })}
              />
              {errors.dueDate && (
                <p id="card-due-date-error" className={styles.error}>
                  {errors.dueDate}
                </p>
              )}
            </div>
          </div>
        </div>

        {confirmingDelete ? (
          <div className={styles.confirmRow}>
            <span className={styles.confirmText}>Delete this card? This can't be undone.</span>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.cancelButton}
                onClick={() => setConfirmingDelete(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.confirmDeleteButton}
                onClick={() => onDelete(draft.id)}
              >
                Delete
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.footer}>
            {!isNew ? (
              <button
                type="button"
                className={styles.deleteButton}
                onClick={() => setConfirmingDelete(true)}
              >
                Delete card
              </button>
            ) : (
              <span />
            )}
            <div className={styles.actions}>
              <button type="button" className={styles.cancelButton} onClick={onClose}>
                Cancel
              </button>
              <button type="button" className={styles.saveButton} onClick={handleSave}>
                Save
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
