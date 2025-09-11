import * as React from 'react';

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary';
};

export function Button({ variant = 'primary', ...props }: ButtonProps) {
  const base = {
    primary: {
      backgroundColor: '#10b981',
      color: 'white',
      border: '1px solid #059669',
    },
    secondary: {
      backgroundColor: '#f3f4f6',
      color: '#111827',
      border: '1px solid #d1d5db',
    },
  } as const;

  return (
    <button
      style={{
        padding: '8px 12px',
        borderRadius: 6,
        cursor: 'pointer',
        ...base[variant],
      }}
      {...props}
    />
  );
}

