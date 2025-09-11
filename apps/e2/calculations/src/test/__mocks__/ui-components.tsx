import React from 'react';

// Card components
export const Card = ({ children, className = '', ...props }: any) => (
  <div className={`card ${className}`} {...props}>{children}</div>
);

export const CardContent = ({ children, className = '', ...props }: any) => (
  <div className={`card-content ${className}`} {...props}>{children}</div>
);

export const CardDescription = ({ children, className = '', ...props }: any) => (
  <p className={`card-description ${className}`} {...props}>{children}</p>
);

export const CardHeader = ({ children, className = '', ...props }: any) => (
  <div className={`card-header ${className}`} {...props}>{children}</div>
);

export const CardTitle = ({ children, className = '', ...props }: any) => (
  <h3 className={`card-title ${className}`} {...props}>{children}</h3>
);

// Button component
export const Button = React.forwardRef<HTMLButtonElement, any>(
  ({ children, className = '', onClick, variant = 'default', size = 'default', ...props }, ref) => (
    <button
      ref={ref}
      className={`button ${variant} ${size} ${className}`}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  )
);
Button.displayName = 'Button';

// Select components
export const Select = ({ children, value, onValueChange, ...props }: any) => (
  <div className="select" {...props}>
    {React.Children.map(children, child =>
      React.cloneElement(child, { value, onValueChange })
    )}
  </div>
);

export const SelectContent = ({ children, ...props }: any) => (
  <div className="select-content" {...props}>{children}</div>
);

export const SelectItem = ({ children, value, ...props }: any) => (
  <div className="select-item" data-value={value} {...props}>{children}</div>
);

export const SelectTrigger = ({ children, ...props }: any) => (
  <button className="select-trigger" role="combobox" {...props}>{children}</button>
);

export const SelectValue = ({ placeholder, ...props }: any) => (
  <span className="select-value" {...props}>{placeholder}</span>
);

// Tabs components
export const Tabs = ({ children, value, onValueChange, defaultValue, ...props }: any) => {
  const [currentValue, setCurrentValue] = React.useState(value || defaultValue);
  
  return (
    <div className="tabs" {...props}>
      {React.Children.map(children, child =>
        React.cloneElement(child, {
          value: currentValue,
          onValueChange: onValueChange || setCurrentValue
        })
      )}
    </div>
  );
};

export const TabsContent = ({ children, value, ...props }: any) => (
  <div className="tabs-content" data-value={value} {...props}>{children}</div>
);

export const TabsList = ({ children, ...props }: any) => (
  <div className="tabs-list" role="tablist" {...props}>{children}</div>
);

export const TabsTrigger = ({ children, value, onValueChange, ...props }: any) => (
  <button
    className="tabs-trigger"
    role="tab"
    data-value={value}
    onClick={() => onValueChange?.(value)}
    {...props}
  >
    {children}
  </button>
);

// Badge component
export const Badge = ({ children, variant = 'default', className = '', ...props }: any) => (
  <span className={`badge ${variant} ${className}`} {...props}>{children}</span>
);

// Skeleton component
export const Skeleton = ({ className = '', ...props }: any) => (
  <div className={`skeleton ${className}`} data-testid="skeleton" {...props} />
);

// Alert components
export const Alert = ({ children, variant = 'default', className = '', ...props }: any) => (
  <div className={`alert ${variant} ${className}`} role="alert" {...props}>{children}</div>
);

export const AlertDescription = ({ children, ...props }: any) => (
  <div className="alert-description" {...props}>{children}</div>
);

export const AlertTitle = ({ children, ...props }: any) => (
  <h5 className="alert-title" {...props}>{children}</h5>
);

// Tooltip components
export const Tooltip = ({ children, ...props }: any) => (
  <div className="tooltip" {...props}>{children}</div>
);

export const TooltipContent = ({ children, ...props }: any) => (
  <div className="tooltip-content" role="tooltip" {...props}>{children}</div>
);

export const TooltipProvider = ({ children, ...props }: any) => (
  <div className="tooltip-provider" {...props}>{children}</div>
);

export const TooltipTrigger = ({ children, ...props }: any) => (
  <div className="tooltip-trigger" {...props}>{children}</div>
);

// Input component
export const Input = React.forwardRef<HTMLInputElement, any>(
  ({ className = '', type = 'text', ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={`input ${className}`}
      {...props}
    />
  )
);
Input.displayName = 'Input';

// Label component
export const Label = ({ children, className = '', htmlFor, ...props }: any) => (
  <label className={`label ${className}`} htmlFor={htmlFor} {...props}>
    {children}
  </label>
);

// Progress component
export const Progress = ({ value = 0, max = 100, className = '', ...props }: any) => (
  <div className={`progress ${className}`} role="progressbar" aria-valuenow={value} aria-valuemax={max} {...props}>
    <div className="progress-bar" style={{ width: `${(value / max) * 100}%` }} />
  </div>
);

// ScrollArea component
export const ScrollArea = ({ children, className = '', ...props }: any) => (
  <div className={`scroll-area ${className}`} {...props}>{children}</div>
);

// Separator component
export const Separator = ({ className = '', orientation = 'horizontal', ...props }: any) => (
  <div
    className={`separator ${orientation} ${className}`}
    role="separator"
    aria-orientation={orientation}
    {...props}
  />
);

// Dialog components
export const Dialog = ({ children, open, onOpenChange, ...props }: any) => {
  if (!open) return null;
  return <div className="dialog" {...props}>{children}</div>;
};

export const DialogContent = ({ children, ...props }: any) => (
  <div className="dialog-content" {...props}>{children}</div>
);

export const DialogDescription = ({ children, ...props }: any) => (
  <p className="dialog-description" {...props}>{children}</p>
);

export const DialogFooter = ({ children, ...props }: any) => (
  <div className="dialog-footer" {...props}>{children}</div>
);

export const DialogHeader = ({ children, ...props }: any) => (
  <div className="dialog-header" {...props}>{children}</div>
);

export const DialogTitle = ({ children, ...props }: any) => (
  <h2 className="dialog-title" {...props}>{children}</h2>
);

export const DialogTrigger = ({ children, ...props }: any) => (
  <button className="dialog-trigger" {...props}>{children}</button>
);

// Switch component
export const Switch = ({ checked, onCheckedChange, className = '', ...props }: any) => (
  <button
    role="switch"
    aria-checked={checked}
    className={`switch ${className}`}
    onClick={() => onCheckedChange?.(!checked)}
    {...props}
  />
);

// Checkbox component
export const Checkbox = ({ checked, onCheckedChange, className = '', ...props }: any) => (
  <input
    type="checkbox"
    checked={checked}
    onChange={(e) => onCheckedChange?.(e.target.checked)}
    className={`checkbox ${className}`}
    {...props}
  />
);

// RadioGroup components
export const RadioGroup = ({ children, value, onValueChange, ...props }: any) => (
  <div className="radio-group" role="radiogroup" {...props}>
    {React.Children.map(children, child =>
      React.cloneElement(child, { selectedValue: value, onValueChange })
    )}
  </div>
);

export const RadioGroupItem = ({ value, selectedValue, onValueChange, ...props }: any) => (
  <input
    type="radio"
    value={value}
    checked={value === selectedValue}
    onChange={() => onValueChange?.(value)}
    {...props}
  />
);

// Table components
export const Table = ({ children, className = '', ...props }: any) => (
  <table className={`table ${className}`} {...props}>{children}</table>
);

export const TableBody = ({ children, ...props }: any) => (
  <tbody {...props}>{children}</tbody>
);

export const TableCell = ({ children, className = '', ...props }: any) => (
  <td className={`table-cell ${className}`} {...props}>{children}</td>
);

export const TableHead = ({ children, ...props }: any) => (
  <thead {...props}>{children}</thead>
);

export const TableHeader = ({ children, className = '', ...props }: any) => (
  <th className={`table-header ${className}`} {...props}>{children}</th>
);

export const TableRow = ({ children, className = '', ...props }: any) => (
  <tr className={`table-row ${className}`} {...props}>{children}</tr>
);