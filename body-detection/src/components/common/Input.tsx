import React, { forwardRef } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  onIconClick?: () => void;
  iconClassName?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, onIconClick, iconClassName = '', className = '', id, ...props }, ref) => {
    
    // Auto-generar id si no se provee, para vincular el label
    const inputId = id || React.useId();

    return (
      <div className="mb-[18px]">
        {label && (
          <label 
            htmlFor={inputId} 
            className="block text-[10px] tracking-[0.16em] uppercase text-[#a0c0e8] mb-[7px] font-semibold"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <input
            id={inputId}
            ref={ref}
            className={`w-full px-[14px] py-[13px] bg-[#0a1520] border-[1.5px] border-[#00d4e8]/50 rounded-[10px] text-white font-['DM_Sans',sans-serif] text-[14px] outline-none transition-all duration-300 placeholder:text-[#82a0c8]/60 focus:border-[#00d4e8] focus:bg-[#0c1a2e] focus:shadow-[0_0_0_3px_rgba(0,212,232,0.18)] ${
              icon ? 'pr-[42px]' : ''
            } ${error ? 'border-red-500/50 focus:border-red-500 focus:shadow-[0_0_0_3px_rgba(239,68,68,0.18)]' : ''} ${className}`}
            {...props}
          />
          {icon && (
            <button
              type="button"
              className={`absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-none text-[#7a8aa8] p-1 flex transition-colors duration-200 hover:text-[#00d4e8] ${onIconClick ? 'cursor-pointer' : 'cursor-default'} ${iconClassName}`}
              onClick={onIconClick}
              tabIndex={onIconClick ? 0 : -1}
            >
              {icon}
            </button>
          )}
        </div>
        {error && (
          <p className="mt-1.5 text-[11px] text-red-500">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
