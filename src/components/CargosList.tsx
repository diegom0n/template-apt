import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Cargo } from '../types/database';

function CargosList() {
  const { user, loading: authLoading } = useAuth(); // 🔹 obtener usuario y estado de carga
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || authLoading) return; // espera a que el usuario esté cargado

    const getCargos = async () => {
      setLoading(true);
      const { data, error } = await supabase.from('cargo').select('*');
      if (error) {
        console.error('❌ Error al obtener cargos:', error.message);
      } else {
        console.log('✅ Datos cargados:', data);
        setCargos(data ?? []);
      }
      setLoading(false);
    };

    getCargos();
  }, [user, authLoading]);

  if (loading) return <div>Cargando cargos...</div>;

  return (
    <div className="p-6 bg-white rounded-xl shadow-md">
      <h2 className="text-xl font-bold mb-4">Lista de Cargos</h2>
      {cargos.length === 0 ? (
        <p>No hay cargos disponibles.</p>
      ) : (
        <ul className="list-disc ml-6">
          {cargos.map((cargo) => (
            <li key={cargo.id_cargo}>
              <strong>{cargo.nombre_cargo}</strong>
              {cargo.descripcion_cargo && (
                <span className="text-gray-500"> — {cargo.descripcion_cargo}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default CargosList;
