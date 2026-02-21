import { useMemo } from "react";

const DistributionPanel = ({
  players = [],
  meId,
  giveOutRemaining = 0,
  allocations = {},
  onInc,
  onDec,
  onSubmit,
  submitting = false,
}) => {
  const totalAllocated = useMemo(
    () => Object.values(allocations).reduce((a, b) => a + b, 0),
    [allocations],
  );
  const leftToAllocate = Math.max(0, giveOutRemaining - totalAllocated);
  const targets = players.filter((p) => p.id !== meId && !p.isSpectator);

  return (
    <div className="space-y-3">
      <p className="font-medium">Give out your drinks ({giveOutRemaining})</p>

      {targets.map((p) => (
        <div
          key={p.id}
          className="flex items-center justify-between border rounded p-2"
        >
          <span>{p.nickname}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onDec(p.id)}
              className="px-3 py-1 bg-gray-200 rounded"
            >
              -
            </button>
            <span className="w-6 text-center">{allocations[p.id] || 0}</span>
            <button
              onClick={() => onInc(p.id)}
              disabled={leftToAllocate <= 0}
              className="px-3 py-1 bg-blue-600 text-white rounded disabled:opacity-50"
            >
              +
            </button>
          </div>
        </div>
      ))}

      <p className="text-sm text-gray-600">
        Left to allocate: {leftToAllocate}
      </p>

      <button
        disabled={leftToAllocate !== 0 || submitting}
        onClick={onSubmit}
        className="w-full py-3 bg-green-600 text-white rounded-lg font-bold disabled:opacity-50"
      >
        Confirm Distribution
      </button>
    </div>
  );
};

export default DistributionPanel;
