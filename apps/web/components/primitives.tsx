"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export function Button({
  children,
  variant = "primary",
  type = "button",
  disabled,
  onClick,
  href,
  className = "",
}: {
  children: ReactNode;
  variant?: "primary" | "quiet" | "soft";
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  onClick?: () => void;
  href?: string;
  className?: string;
}) {
  const classes = `button button-${variant} ${className}`.trim();
  if (href)
    return (
      <Link className={classes} href={href}>
        {children}
      </Link>
    );
  return (
    <button
      className={classes}
      type={type}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function Panel({
  children,
  className = "",
  as: Tag = "section",
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "article" | "div";
}) {
  return <Tag className={`ui-panel ${className}`.trim()}>{children}</Tag>;
}

export function StatusPill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  return <span className={`ui-status-pill ui-status-${tone}`}>{children}</span>;
}

export function ScoreMeter({
  label,
  value,
  explanation,
}: {
  label: string;
  value: number;
  explanation?: string;
}) {
  const safeValue = Math.max(0, Math.min(100, value));
  return (
    <div className="ui-score-meter">
      <div className="ui-score-meter-heading">
        <span>{label}</span>
        <strong>{Math.round(safeValue)}/100</strong>
      </div>
      <div
        className="ui-score-meter-track"
        role="progressbar"
        aria-label={`${label} score`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(safeValue)}
      >
        <span style={{ width: `${safeValue}%` }} />
      </div>
      {explanation && <p>{explanation}</p>}
    </div>
  );
}

export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  label = "Filter",
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  label?: string;
}) {
  return (
    <div className="ui-filter-group" aria-label={label} role="list">
      {options.map((option) => (
        <button
          className={value === option.value ? "active" : ""}
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function FormField({
  label,
  children,
  hint,
  error,
  htmlFor,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  error?: string;
  htmlFor?: string;
}) {
  return (
    <label className="ui-form-field" htmlFor={htmlFor}>
      <span>{label}</span>
      {children}
      {error ? (
        <small className="ui-field-error" role="alert">
          {error}
        </small>
      ) : hint ? (
        <small>{hint}</small>
      ) : null}
    </label>
  );
}

export function Alert({
  children,
  tone = "error",
}: {
  children: ReactNode;
  tone?: "error" | "warning" | "success" | "info";
}) {
  return (
    <div
      className={`ui-alert ui-alert-${tone}`}
      role={tone === "error" ? "alert" : "status"}
    >
      {children}
    </div>
  );
}

export function Drawer({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="ui-drawer-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <aside
        className="ui-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ui-drawer-title"
      >
        <div className="ui-drawer-heading">
          <h2 id="ui-drawer-title">{title}</h2>
          <button
            className="ui-icon-button"
            type="button"
            aria-label="Close panel"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        {children}
      </aside>
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`ui-skeleton ${className}`.trim()} aria-hidden="true" />
  );
}

export function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <section className="ui-empty-state" aria-live="polite">
      <span aria-hidden="true">—</span>
      <h2>{title}</h2>
      <p>{message}</p>
      {action}
    </section>
  );
}
