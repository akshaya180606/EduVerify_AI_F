import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: string;
  badge?: React.ReactNode;
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  badge,
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-lg p-4 sm:p-4.5 border border-[#D9E7E4] shadow-2xs flex flex-col justify-between transition-all hover:border-[#0D9488]/50 ${
        onClick ? 'cursor-pointer hover:shadow-xs' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-[#647A78]">{title}</p>
          <h3 className="text-2xl font-bold text-[#193A39] mt-1 tracking-tight">{value}</h3>
        </div>
        <div className="w-8 h-8 rounded-md bg-[#F3F8F7] text-[#115E59] flex items-center justify-center border border-[#D9E7E4]/70 shrink-0">
          {icon}
        </div>
      </div>
      {(subtitle || trend || badge) && (
        <div className="mt-2.5 pt-2.5 border-t border-[#F3F8F7] flex items-center justify-between text-[11px] text-[#647A78]">
          {subtitle && <span className="truncate">{subtitle}</span>}
          {trend && <span className="font-medium text-[#115E59] shrink-0">{trend}</span>}
          {badge}
        </div>
      )}
    </div>
  );
};
