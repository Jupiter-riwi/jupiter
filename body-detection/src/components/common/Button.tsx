import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline';
  className?: string;
  fullWidth?: boolean;
}

const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  className = '',
  fullWidth = true,
  ...props
}) => {
  const baseClasses = "py-[14px] px-6 text-[14px] font-['DM_Sans',sans-serif] font-semibold tracking-[0.06em] rounded-[10px] cursor-pointer relative overflow-hidden transition-all duration-[150ms] group flex justify-center items-center";
  
  const widthClass = fullWidth ? "w-full" : "w-auto";

  const variants = {
    primary: "bg-gradient-to-r from-[#00c8db] to-[#00e8ff] text-[#040e1a] border-none shadow-[0_4px_24px_rgba(0,212,232,0.28)] hover:-translate-y-[1px] hover:shadow-[0_8px_36px_rgba(0,212,232,0.45)] active:translate-y-0",
    secondary: "bg-[#0a1520] text-white border-[1.5px] border-[#00d4e8]/50 hover:bg-[#0c1a2e] hover:border-[#00d4e8] hover:shadow-[0_4px_16px_rgba(0,212,232,0.15)]",
    outline: "bg-transparent text-[#00d4e8] border border-[#00d4e8]/50 hover:bg-[#00d4e8]/10 hover:border-[#00d4e8]"
  };

  return (
    <button
      className={`${baseClasses} ${widthClass} ${variants[variant]} ${className}`}
      {...props}
    >
      <span className="relative z-10 flex items-center justify-center gap-2">
        {children}
      </span>
      {variant === 'primary' && (
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full transition-transform duration-[550ms] ease-out group-hover:translate-x-full z-0"></div>
      )}
    </button>
  );
};

export default Button;
