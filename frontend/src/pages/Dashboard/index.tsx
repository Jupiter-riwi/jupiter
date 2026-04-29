import React from 'react';
import { User, Activity, Shield } from 'lucide-react';

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-8">
      <header className="mb-12">
        <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
          Perfil del Riwer
        </h1>
        <p className="text-slate-400 mt-2">Visión general del estado del sistema Júpiter</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 hover:border-slate-500 transition-all cursor-pointer">
          <div className="flex items-center space-x-4 mb-4">
            <div className="p-3 bg-blue-500/20 text-blue-400 rounded-lg">
              <User size={24} />
            </div>
            <h3 className="text-xl font-semibold">Identidad</h3>
          </div>
          <p className="text-slate-400">Gestión de roles y accesos al gateway principal.</p>
        </div>

        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 hover:border-slate-500 transition-all cursor-pointer">
          <div className="flex items-center space-x-4 mb-4">
            <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-lg">
              <Activity size={24} />
            </div>
            <h3 className="text-xl font-semibold">Métricas IA</h3>
          </div>
          <p className="text-slate-400">Rendimiento en tiempo real de los workers procesando datos.</p>
        </div>

        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 hover:border-slate-500 transition-all cursor-pointer">
          <div className="flex items-center space-x-4 mb-4">
            <div className="p-3 bg-purple-500/20 text-purple-400 rounded-lg">
              <Shield size={24} />
            </div>
            <h3 className="text-xl font-semibold">Seguridad</h3>
          </div>
          <p className="text-slate-400">Estado de las conexiones WebSocket y endpoints protegidos.</p>
        </div>
      </div>
    </div>
  );
}
