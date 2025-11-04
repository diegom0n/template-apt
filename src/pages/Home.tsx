import React, { useState } from 'react';
import { Link } from 'react-router-dom';

type HomeProps = {
  onGoToLogin?: () => void; // opcional para compatibilidad con usos anteriores
};

export default function Home(_props: HomeProps) {
  const [logoSrc, setLogoSrc] = useState<string>('/pepsico-logo.png');
  const handleLogoError = () => {
    // Intenta svg local, luego un recurso existente del proyecto
    if (logoSrc === '/pepsico-logo.png') {
      setLogoSrc('/pepsico-logo.svg');
      return;
    }
    if (logoSrc === '/pepsico-logo.svg') {
      setLogoSrc('/truck.svg');
      return;
    }
  };
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
      <div className="w-full max-w-5xl bg-white shadow rounded-2xl overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2">
          {/* Columna izquierda: logo */}
          <div className="flex items-center justify-center p-10 bg-white">
            <img
              src={logoSrc}
              alt="PepsiCo"
              className="max-h-24 w-auto object-contain"
              onError={handleLogoError}
            />
          </div>

          {/* Columna derecha: panel azul con acciones */}
          <div className="bg-blue-900 text-white p-10 flex flex-col">
            <h2 className="text-center text-sm font-semibold tracking-widest">SISTEMA DE GESTIÓN TALLER PEPSICO</h2>

            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Tarjeta 1 */}
              <Link
                to="/login"
                className="bg-white/95 text-slate-800 rounded-xl p-6 shadow hover:shadow-md transition flex items-center justify-center text-center font-semibold"
              >
                <span>
                  Ingresar
                  <br />
                  vehículo
                </span>
              </Link>

              {/* Tarjeta 2 */}
              <Link
                to="/login"
                className="bg-white/95 text-slate-800 rounded-xl p-6 shadow hover:shadow-md transition flex items-center justify-center text-center font-semibold"
              >
                <span>
                  Agendar
                  <br />
                  visita
                </span>
              </Link>

              {/* Tarjeta 3 */}
              <Link
                to="/login"
                className="bg-white/95 text-slate-800 rounded-xl p-6 shadow hover:shadow-md transition flex items-center justify-center text-center font-semibold"
              >
                <span>
                  Portería
                  <br />
                  NFC
                </span>
              </Link>

              {/* Tarjeta 4 */}
              <Link
                to="/login"
                className="bg-white/95 text-slate-800 rounded-xl p-6 shadow hover:shadow-md transition flex items-center justify-center text-center font-semibold"
              >
                <span>
                  Perfil
                  <br />
                  personal
                </span>
              </Link>
            </div>

            <div className="mt-10 text-[11px] text-slate-200 text-right">© 2024 PEPSICO, Inc.</div>
          </div>
        </div>
      </div>
    </div>
  );
}


