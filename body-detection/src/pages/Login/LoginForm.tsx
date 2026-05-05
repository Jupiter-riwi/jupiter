import React, { useState } from 'react';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';

const LoginForm: React.FC = () => {
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [remember, setRemember] = useState<boolean>(false);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');

  const togglePass = () => setShowPassword((prev) => !prev);
  const toggleCheck = () => setRemember((prev) => !prev);

  const handleLogin = () => {
    console.log('--- Intentando Iniciar Sesión ---');
    console.log('Email:', email);
    console.log('Contraseña:', password);
    console.log('Recordarme:', remember);
    // Lógica de autenticación aquí
  };

  return (
    <div className="relative z-10 w-[400px] mr-[6vw] bg-[#0d1b2e] border border-[#00d4e8]/[0.45] rounded-[20px] px-9 py-10 opacity-0 animate-[fadeUp_1s_ease_forwards_0.5s] shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_32px_80px_rgba(0,0,0,0.6),0_0_60px_rgba(0,212,232,0.12),inset_0_1px_0_rgba(255,255,255,0.1)]">
      {/* Top glow bar */}
      <div className="absolute top-0 left-[20%] right-[20%] h-[1px] bg-gradient-to-r from-transparent via-[#00d4e8] to-transparent rounded-[1px] shadow-[0_0_12px_rgba(0,212,232,0.4)]"></div>
      
      {/* Orbit decoration */}
      <div className="absolute -right-[60px] -top-[60px] w-[160px] h-[160px] rounded-full border border-[#00d4e8]/[0.07] pointer-events-none animate-[rotateRing_25s_linear_infinite] before:absolute before:w-[5px] before:h-[5px] before:bg-[#00d4e8] before:rounded-full before:-top-[2.5px] before:left-1/2 before:-translate-x-1/2 before:shadow-[0_0_8px_#00d4e8]"></div>

      {/* Logo */}
      <div className="flex items-center gap-3 mb-7">
        <div className="w-[42px] h-[42px] border-[1.5px] border-[#00d4e8]/40 rounded-xl flex items-center justify-center bg-[#00d4e8]/[0.06] shadow-[0_0_16px_rgba(0,212,232,0.1)] shrink-0">
          <svg viewBox="0 0 24 24" className="w-[22px] h-[22px] stroke-[#00d4e8] fill-none stroke-[1.5]">
            <circle cx="12" cy="12" r="5" />
            <ellipse cx="12" cy="12" rx="11" ry="4" transform="rotate(-20 12 12)" />
          </svg>
        </div>
        <div>
          <div className="font-['Playfair_Display',serif] text-[18px] font-bold tracking-[0.04em] leading-none text-white">
            Jupiter
          </div>
          <div className="text-[10px] tracking-[0.14em] uppercase text-[#96afd7]/80 mt-[3px]">
            Speech Intelligence
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="mb-[26px]">
        <h2 className="font-['Playfair_Display',serif] text-[22px] font-bold leading-[1.2] text-white">
          Bienvenido de vuelta
        </h2>
        <p className="text-[12.5px] text-[#A0BEE6]/80 mt-[5px]">
          Accede a tu panel de análisis
        </p>
      </div>

      {/* Divider */}
      <div className="h-[1px] bg-[#00d4e8]/[0.15] mb-6"></div>

      {/* Fields */}
      <Input 
        id="user"
        label="Usuario o Email"
        placeholder="tu@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <Input 
        id="pass"
        label="Contraseña"
        type={showPassword ? "text" : "password"}
        placeholder="••••••••••"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        icon={
          <svg viewBox="0 0 24 24" className="w-[15px] h-[15px] stroke-current fill-none stroke-[1.8]">
            <path d={showPassword ? "M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" : "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"} />
            {!showPassword && <circle cx="12" cy="12" r="3" />}
          </svg>
        }
        onIconClick={togglePass}
      />

      <div className="flex justify-between items-center -mt-2 mb-5">
        <label className="flex items-center gap-[7px] cursor-pointer group">
          <input type="checkbox" id="remember" className="hidden" checked={remember} onChange={toggleCheck} />
          <div className={`w-4 h-4 border rounded flex items-center justify-center transition-all duration-200 shrink-0 ${remember ? 'border-[#00d4e8] bg-[#00d4e8]/[0.12]' : 'border-white/10 bg-white/[0.035]'}`} id="checkBox">
            {remember && <span className="text-[9px] text-[#00d4e8]">✓</span>}
          </div>
          <span className="text-[11.5px] text-[#aac3e6]/90 select-none">Recordarme</span>
        </label>
        <a href="#" className="text-[11.5px] text-[#aac3e6]/90 no-underline transition-colors duration-200 hover:text-[#e8901a]">¿Olvidaste tu contraseña?</a>
      </div>

      <Button type="button" onClick={handleLogin}>
        Iniciar Sesión
      </Button>

      <div className="flex items-center gap-3 my-[18px] text-[#8caad2]/70 text-[10px] tracking-[0.12em] uppercase before:content-[''] before:flex-1 before:h-[1px] before:bg-[#00d4e8]/[0.15] after:content-[''] after:flex-1 after:h-[1px] after:bg-[#00d4e8]/[0.15]">
        o
      </div>

      <div className="text-center text-[12.5px] text-[#aac3e6]/90">
        ¿Nuevo en Jupiter? <a href="#" className="text-[#00d4e8] no-underline font-medium transition-colors duration-200 hover:text-[#e8901a]">Crear cuenta gratis</a>
      </div>

      <div className="flex items-center justify-center gap-[6px] mt-[18px] pt-4 border-t border-[#00d4e8]/[0.12] text-[10px] text-[#82a0c8]/60 tracking-[0.08em]">
        <span className="text-[#00d4e8]/50">⬡</span> Análisis en tiempo real · Datos encriptados <span className="text-[#00d4e8]/50">⬡</span>
      </div>
    </div>
  );
};

export default LoginForm;
