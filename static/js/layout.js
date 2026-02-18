/**
 * Background grid layout computation.
 * Given N background activities (2-6), returns grid config and slot descriptors.
 */

const GRID_CONFIGS = {
  2: { cols: 2, rows: 1 },
  3: { cols: 3, rows: 1 },
  4: { cols: 2, rows: 2 },
  5: { cols: 3, rows: 2 },
  6: { cols: 3, rows: 2 },
};

export function computeGrid(n) {
  const { cols, rows } = GRID_CONFIGS[n] || { cols: 2, rows: 2 };
  const slots = [];
  for (let i = 0; i < cols * rows; i++) {
    slots.push({
      index: i,
      active: i < n,
      gridColumn: (i % cols) + 1,
      gridRow: Math.floor(i / cols) + 1,
    });
  }
  return {
    cols,
    rows,
    gridTemplateColumns: `repeat(${cols}, 1fr)`,
    gridTemplateRows: `repeat(${rows}, 1fr)`,
    slots,
  };
}

/**
 * Scale a server reference position/size (1920×1080) to actual viewport.
 */
export function scalePosition(pos, size) {
  const scaleX = window.innerWidth / 1920;
  const scaleY = window.innerHeight / 1080;
  return {
    left:   Math.round(pos.x * scaleX) + 'px',
    top:    Math.round(pos.y * scaleY) + 'px',
    width:  Math.round(size.w * scaleX) + 'px',
    height: Math.round(size.h * scaleY) + 'px',
  };
}
