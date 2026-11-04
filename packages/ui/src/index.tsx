import type { ButtonHTMLAttributes, ReactNode } from 'react';
export function Button(props: ButtonHTMLAttributes<HTMLButtonElement>) { return <button {...props} className={['acao', props.className].filter(Boolean).join(' ')} />; }
export function AppShell({ title, children }: { title: string; children: ReactNode }) {
  return <div className="shell"><header><span className="brand">Restaurante</span><span>{title}</span></header><main>{children}</main></div>;
}

