/**
 * Background grid layout computation and presets.
 */

export const GRID_PRESETS = [
  { label: '2×1', cols: 2, rows: 1 },
  { label: '3×1', cols: 3, rows: 1 },
  { label: '2×2', cols: 2, rows: 2 },
  { label: '3×2', cols: 3, rows: 2 },
  { label: '4×2', cols: 4, rows: 2 },
  { label: '3×3', cols: 3, rows: 3 },
  { label: '4×3', cols: 4, rows: 3 },
  { label: '5×2', cols: 5, rows: 2 },
  { label: '5×3', cols: 5, rows: 3 },
  { label: '5×4', cols: 5, rows: 4 },
  { label: '5×5', cols: 5, rows: 5 },
  { label: '5×6', cols: 5, rows: 6 },
  { label: '5×7', cols: 5, rows: 7 },
  { label: '5×8', cols: 5, rows: 8 },
  { label: '6×2', cols: 6, rows: 2 },
  { label: '6×3', cols: 6, rows: 3 },
  { label: '6×4', cols: 6, rows: 4 },
  { label: '6×5', cols: 6, rows: 5 },
  { label: '6×6', cols: 6, rows: 6 },
  { label: '6×7', cols: 6, rows: 7 },
  { label: '6×8', cols: 6, rows: 8 },
  { label: '7×4', cols: 7, rows: 4 },
  { label: '7×5', cols: 7, rows: 5 },
  { label: '7×6', cols: 7, rows: 6 },
  { label: '7×7', cols: 7, rows: 7 },
  { label: '7×8', cols: 7, rows: 8 },
  { label: '8×4', cols: 8, rows: 4 },
  { label: '8×5', cols: 8, rows: 5 },
  { label: '8×6', cols: 8, rows: 6 },
  { label: '8×7', cols: 8, rows: 7 },
  { label: '8×8', cols: 8, rows: 8 },
  { label: '9×5', cols: 9, rows: 5 },
  { label: '9×6', cols: 9, rows: 6 },
  { label: '9×7', cols: 9, rows: 7 },
  { label: '10×5', cols: 10, rows: 5 },
  { label: '10×6', cols: 10, rows: 6 },
  { label: '10×7', cols: 10, rows: 7 },
];

export function computeGrid(cols, rows) {
  const n = cols * rows;
  const slots = [];
  for (let i = 0; i < n; i++) {
    slots.push({
      index: i,
      active: true,
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
