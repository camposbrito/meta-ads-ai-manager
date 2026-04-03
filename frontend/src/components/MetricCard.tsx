interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon?: React.ReactNode;
  onClick?: () => void;
  actionLabel?: string;
}

export function MetricCard({ title, value, change, icon, onClick, actionLabel }: MetricCardProps) {
  const isPositive = change && change >= 0;
  const isInteractive = typeof onClick === 'function';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left bg-white rounded-xl shadow-sm border border-gray-200 p-6 ${
        isInteractive ? 'hover:border-blue-300 hover:shadow-md transition-all cursor-pointer' : ''
      }`}
      disabled={!isInteractive}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
          {isInteractive && actionLabel && <p className="mt-1 text-xs text-blue-600">{actionLabel}</p>}
        </div>
        {icon && (
          <div className="p-3 bg-blue-50 rounded-lg text-blue-600">
            {icon}
          </div>
        )}
      </div>
      {change !== undefined && (
        <div className="mt-4 flex items-center">
          <span
            className={`text-sm font-medium ${
              isPositive ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {isPositive ? '+' : ''}{change.toFixed(1)}%
          </span>
          <span className="ml-2 text-sm text-gray-500">vs. período anterior</span>
        </div>
      )}
    </button>
  );
}
