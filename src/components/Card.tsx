import { LucideIcon } from 'lucide-react';

interface CardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
}

export default function Card({ title, value, icon: Icon, color }: CardProps) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
        </div>
        <div className={`${color} p-4 rounded-lg`}>
          <Icon size={32} className="text-white" />
        </div>
      </div>
    </div>
  );
}
