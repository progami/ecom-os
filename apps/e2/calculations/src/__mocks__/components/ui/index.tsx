// Mock implementations for all UI components
import React from 'react';

// Dialog components
export const Dialog = ({ children, open }: any) => open ? <div data-testid="dialog">{children}</div> : null;
export const DialogContent = ({ children, className }: any) => <div className={className} data-testid="dialog-content">{children}</div>;
export const DialogHeader = ({ children }: any) => <div data-testid="dialog-header">{children}</div>;
export const DialogTitle = ({ children }: any) => <h2 data-testid="dialog-title">{children}</h2>;
export const DialogDescription = ({ children }: any) => <p data-testid="dialog-description">{children}</p>;
export const DialogFooter = ({ children }: any) => <div data-testid="dialog-footer">{children}</div>;
export const DialogTrigger = ({ children, asChild, ...props }: any) => {
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, props);
  }
  return <button {...props}>{children}</button>;
};

// Button component
export const Button = React.forwardRef<HTMLButtonElement, any>(
  ({ children, className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={className}
      data-variant={variant}
      data-size={size}
      {...props}
    >
      {children}
    </button>
  )
);
Button.displayName = 'Button';

// Input component
export const Input = React.forwardRef<HTMLInputElement, any>(
  ({ className, type = 'text', ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={className}
      {...props}
    />
  )
);
Input.displayName = 'Input';

// Label component
export const Label = React.forwardRef<HTMLLabelElement, any>(
  ({ children, className, ...props }, ref) => (
    <label
      ref={ref}
      className={className}
      {...props}
    >
      {children}
    </label>
  )
);
Label.displayName = 'Label';

// Select components
export const Select = ({ children, value, onValueChange, ...props }: any) => {
  const childProps = { value, onValueChange };
  return <div data-testid="select" {...props}>{React.Children.map(children, child => 
    React.isValidElement(child) ? React.cloneElement(child, childProps) : child
  )}</div>;
};

export const SelectContent = ({ children }: any) => <div data-testid="select-content">{children}</div>;
export const SelectItem = ({ value, children, onClick, ...props }: any) => (
  <div data-testid="select-item" data-value={value} onClick={() => onClick?.(value)} {...props}>
    {children}
  </div>
);
export const SelectTrigger = React.forwardRef<HTMLButtonElement, any>(
  ({ children, className, value, onValueChange, ...props }, ref) => (
    <button
      ref={ref}
      className={className}
      data-testid="select-trigger"
      {...props}
    >
      {children}
    </button>
  )
);
SelectTrigger.displayName = 'SelectTrigger';

export const SelectValue = ({ placeholder }: any) => <span>{placeholder}</span>;

// Checkbox component
export const Checkbox = React.forwardRef<HTMLInputElement, any>(
  ({ className, checked, onCheckedChange, ...props }, ref) => (
    <input
      ref={ref}
      type="checkbox"
      className={className}
      checked={checked}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
      {...props}
    />
  )
);
Checkbox.displayName = 'Checkbox';

// Table components
export const Table = React.forwardRef<HTMLTableElement, any>(
  ({ children, className, ...props }, ref) => (
    <table ref={ref} className={className} {...props}>
      {children}
    </table>
  )
);
Table.displayName = 'Table';

export const TableHeader = ({ children, ...props }: any) => <thead {...props}>{children}</thead>;
export const TableBody = ({ children, ...props }: any) => <tbody {...props}>{children}</tbody>;
export const TableFooter = ({ children, ...props }: any) => <tfoot {...props}>{children}</tfoot>;
export const TableRow = ({ children, ...props }: any) => <tr {...props}>{children}</tr>;
export const TableHead = ({ children, ...props }: any) => <th {...props}>{children}</th>;
export const TableCell = ({ children, ...props }: any) => <td {...props}>{children}</td>;

// Card components
export const Card = React.forwardRef<HTMLDivElement, any>(
  ({ children, className, ...props }, ref) => (
    <div ref={ref} className={className} {...props}>
      {children}
    </div>
  )
);
Card.displayName = 'Card';

export const CardHeader = ({ children, ...props }: any) => <div {...props}>{children}</div>;
export const CardTitle = ({ children, ...props }: any) => <h3 {...props}>{children}</h3>;
export const CardDescription = ({ children, ...props }: any) => <p {...props}>{children}</p>;
export const CardContent = ({ children, ...props }: any) => <div {...props}>{children}</div>;
export const CardFooter = ({ children, ...props }: any) => <div {...props}>{children}</div>;

// Alert components
export const Alert = ({ children, className, variant, ...props }: any) => (
  <div className={className} data-variant={variant} role="alert" {...props}>
    {children}
  </div>
);
export const AlertTitle = ({ children, ...props }: any) => <h5 {...props}>{children}</h5>;
export const AlertDescription = ({ children, ...props }: any) => <div {...props}>{children}</div>;

// Badge component
export const Badge = ({ children, className, variant, ...props }: any) => (
  <span className={className} data-variant={variant} {...props}>
    {children}
  </span>
);

// Textarea component
export const Textarea = React.forwardRef<HTMLTextAreaElement, any>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={className} {...props} />
  )
);
Textarea.displayName = 'Textarea';

// Switch component
export const Switch = React.forwardRef<HTMLInputElement, any>(
  ({ className, checked, onCheckedChange, ...props }, ref) => (
    <input
      ref={ref}
      type="checkbox"
      role="switch"
      className={className}
      checked={checked}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
      {...props}
    />
  )
);
Switch.displayName = 'Switch';

// Tabs components
export const Tabs = ({ children, defaultValue, value, onValueChange, ...props }: any) => {
  const [activeTab, setActiveTab] = React.useState(value || defaultValue);
  const contextValue = { activeTab, setActiveTab: onValueChange || setActiveTab };
  
  return (
    <div data-testid="tabs" {...props}>
      {React.Children.map(children, child =>
        React.isValidElement(child) ? React.cloneElement(child, { ...contextValue }) : child
      )}
    </div>
  );
};

export const TabsList = ({ children, ...props }: any) => (
  <div data-testid="tabs-list" {...props}>{children}</div>
);

export const TabsTrigger = ({ value, children, activeTab, setActiveTab, ...props }: any) => (
  <button
    data-testid="tabs-trigger"
    data-value={value}
    onClick={() => setActiveTab?.(value)}
    {...props}
  >
    {children}
  </button>
);

export const TabsContent = ({ value, children, activeTab, ...props }: any) => {
  if (activeTab !== value) return null;
  return <div data-testid="tabs-content" data-value={value} {...props}>{children}</div>;
};

// Popover components
export const Popover = ({ children, open, onOpenChange }: any) => {
  const contextValue = { open, onOpenChange };
  return (
    <div data-testid="popover">
      {React.Children.map(children, child =>
        React.isValidElement(child) ? React.cloneElement(child, contextValue) : child
      )}
    </div>
  );
};

export const PopoverTrigger = ({ children, asChild, onOpenChange, ...props }: any) => {
  const handleClick = () => onOpenChange?.(!props.open);
  
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, { ...props, onClick: handleClick });
  }
  return <button {...props} onClick={handleClick}>{children}</button>;
};

export const PopoverContent = ({ children, open, ...props }: any) => {
  if (!open) return null;
  return <div data-testid="popover-content" {...props}>{children}</div>;
};

// Calendar component
export const Calendar = ({ mode, selected, onSelect, ...props }: any) => (
  <div data-testid="calendar" {...props}>
    <input
      type="date"
      value={selected instanceof Date ? selected.toISOString().split('T')[0] : ''}
      onChange={(e) => onSelect?.(new Date(e.target.value))}
    />
  </div>
);

// Tooltip components
export const TooltipProvider = ({ children }: any) => <>{children}</>;
export const Tooltip = ({ children }: any) => <div data-testid="tooltip">{children}</div>;
export const TooltipTrigger = ({ children, asChild, ...props }: any) => {
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, props);
  }
  return <span {...props}>{children}</span>;
};
export const TooltipContent = ({ children, ...props }: any) => (
  <div data-testid="tooltip-content" {...props}>{children}</div>
);

// Additional utility components that might be needed
export const Separator = ({ className, orientation = 'horizontal', ...props }: any) => (
  <div 
    className={className} 
    data-orientation={orientation}
    role="separator"
    {...props}
  />
);

export const ScrollArea = ({ children, className, ...props }: any) => (
  <div className={className} {...props}>{children}</div>
);

export const ScrollBar = ({ orientation = 'vertical', ...props }: any) => (
  <div data-orientation={orientation} {...props} />
);