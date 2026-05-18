import type { ReactElement, ReactNode } from 'react';

interface DialogHeaderProps {
  eyebrow: string;
  title: string;
  description?: string;
  meta?: ReactNode;
}

interface DialogFooterProps {
  left?: ReactNode;
  children: ReactNode;
}

export function DialogHeader({ eyebrow, title, description, meta }: DialogHeaderProps): ReactElement {
  return (
    <div className="dialog-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 title={title}>{title}</h2>
        {description ? <span>{description}</span> : null}
      </div>
      {meta ? <div className="dialog-header-meta">{meta}</div> : null}
    </div>
  );
}

export function DialogFooter({ left, children }: DialogFooterProps): ReactElement {
  return (
    <div className="dialog-footer">
      <div className="dialog-footer-left">{left}</div>
      <div className="dialog-footer-actions">{children}</div>
    </div>
  );
}
