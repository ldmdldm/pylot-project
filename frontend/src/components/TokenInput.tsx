import React, { useState } from 'react';
import { TokenSelector } from './TokenSelector';
import { TokenAddresses } from '@/lib/contract';

interface TokenInputProps {
  label: string;
  token: keyof TokenAddresses;
  value: string;
  onChange: (value: string) => void;
  onTokenSelect: (token: keyof TokenAddresses) => void;
  balance?: string;
  disabled?: boolean;
  readOnly?: boolean;
  onMax?: () => void;
  usdValue?: string;
}

export function TokenInput({
  label,
  token,
  value,
  onChange,
  onTokenSelect,
  balance,
  disabled = false,
  readOnly = false,
  onMax,
  usdValue,
}: TokenInputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <div className={`p-4 rounded-lg border ${focused ? 'border-[#142c8e]' : 'border-gray-200'} bg-white transition-colors`}>
      <div className="flex justify-between mb-2">
        <label className="text-sm text-gray-500">{label}</label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Balance: {balance || '0.00'}</span>
          {onMax && !disabled && !readOnly && (
            <button
              onClick={onMax}
              className="text-xs px-2 py-1 rounded bg-[#142c8e] text-white hover:bg-[#1a3ab8] transition-colors"
            >
              MAX
            </button>
          )}
        </div>
      </div>
      {usdValue && (
        <div className="text-xs text-gray-500 mb-1">
          ≈ ${usdValue} USD
        </div>
      )}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="0.00"
          disabled={disabled}
          readOnly={readOnly}
          className="flex-1 text-2xl font-medium bg-transparent outline-none disabled:opacity-50 read-only:opacity-75 text-[#142c8e]"
        />
        <TokenSelector
          selectedToken={token}
          onSelect={onTokenSelect}
          disabled={disabled || readOnly}
        />
      </div>
    </div>
  );
}
