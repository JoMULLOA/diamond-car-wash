import { useState, useCallback } from 'react';
import { 
  normalizePatent, 
  tryNormalizePatent, 
  getPatentType,
  getPatentTypeDescription,
  type PatentType 
} from '../shared';

interface PatentInputProps {
  value: string;
  onChange: (patent: string) => void;
  onError?: (error: string | null) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

export function PatentInput({
  value,
  onChange,
  onError,
  disabled = false,
  placeholder = 'BBBB-00',
  className = '',
  autoFocus = false,
}: PatentInputProps) {
  const [error, setError] = useState<string | null>(null);
  const [isValid, setIsValid] = useState(false);
  const [patentType, setPatentType] = useState<PatentType | null>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.toUpperCase().replace(/[^A-Z0-9*]/g, '');
      const truncated = raw.slice(0, 8);

      const normalized = tryNormalizePatent(truncated);
      
      if (normalized) {
        setError(null);
        setIsValid(true);
        const type = getPatentType(normalized);
        setPatentType(type);
        onChange(normalized);
        onError?.(null);
      } else if (truncated.length >= 4) {
        setError('Formato no reconocido. Ej: BBBB-00');
        setIsValid(false);
        setPatentType(null);
        onError?.('Formato no reconocido');
      } else {
        setError(null);
        setIsValid(false);
        setPatentType(null);
        onError?.(null);
      }
    },
    [onChange, onError]
  );

  const handleBlur = useCallback(() => {
    if (value.length > 0 && !isValid) {
      setError('Formato de patente no válido');
      onError?.('Formato de patente no válido');
    } else if (value.length === 0) {
      setError(null);
      setIsValid(false);
      setPatentType(null);
      onError?.(null);
    }
  }, [value, isValid, onError]);

  return (
    <div className={className}>
      <input
        type="text"
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        maxLength={8}
        className={`
          w-full px-4 py-3 border rounded-lg text-center text-2xl 
          tracking-widest font-mono uppercase
          focus:ring-2 focus:ring-blue-500 focus:border-blue-500
          outline-none transition-shadow
          ${error ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''}
          ${isValid && !error ? 'border-green-500 focus:ring-green-500 focus:border-green-500' : ''}
          ${disabled ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''}
        `}
        style={{ fontFamily: 'monospace' }}
      />
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
      {isValid && !error && patentType && (
        <div className="mt-1">
          <p className="text-sm text-green-600">✓ Patente válida</p>
          <p className="text-xs text-gray-500">{getPatentTypeDescription(patentType)}</p>
        </div>
      )}
      {!error && !isValid && (
        <p className="mt-1 text-xs text-gray-400">
          Formatos: BBBB-00 (auto), BBB-00 (moto), A123456 (histórica)
        </p>
      )}
    </div>
  );
}

export default PatentInput;
