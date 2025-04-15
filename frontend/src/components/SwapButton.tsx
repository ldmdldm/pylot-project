import React from 'react';

interface SwapButtonProps {
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}

export const SwapButton: React.FC<SwapButtonProps> = ({ loading, disabled, onClick }) => {
  return (
    <button
      className="swap-button"
      onClick={onClick}
      disabled={disabled || loading}
    >
      {loading ? 'Swapping...' : 'Swap'}
    </button>
  );
}; 