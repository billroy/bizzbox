/**
 * Scrolling data table — enhanced with cell change flash, alternating rows, scan line.
 */
export default {
  name: 'ActivityDataTable',
  props: { activity: Object },
  setup(props) {
    const { computed, ref, watch, onUnmounted } = Vue;
    const columns = computed(() => props.activity?.state?.columns ?? []);
    const rows = computed(() => props.activity?.state?.rows ?? []);
    const strategy = computed(() => props.activity?.state?.strategy ?? '');

    // Track changed cells for flash animation
    const changedCells = ref({});  // key "ri-ci" → true
    let prevRows = [];
    const timers = [];

    watch(rows, (newRows) => {
      for (let ri = 0; ri < newRows.length; ri++) {
        for (let ci = 0; ci < newRows[ri].length; ci++) {
          const oldVal = prevRows[ri]?.[ci];
          const newVal = newRows[ri][ci];
          if (oldVal !== undefined && oldVal !== newVal) {
            const key = `${ri}-${ci}`;
            changedCells.value[key] = true;
            const t = setTimeout(() => { delete changedCells.value[key]; }, 600);
            timers.push(t);
          }
        }
      }
      prevRows = newRows.map(r => [...r]);
    }, { deep: true });

    onUnmounted(() => { timers.forEach(t => clearTimeout(t)); });

    function cellClass(col, value, ri, ci) {
      const classes = [];
      const v = (value || '').toUpperCase();
      if (v === 'CRIT' || v === 'CRITICAL' || v === 'ERROR' || v === 'ALARM' || v === 'CANCELLED')
        classes.push('cell-error');
      else if (v === 'WARN' || v === 'WARNING' || v === 'DELAYED' || v === 'HIGH')
        classes.push('cell-warn');
      else if (v === 'OK' || v === 'NORMAL' || v === 'ON TIME' || v === 'CLEARED' || v === 'SETTLED' || v === 'ACTIVE')
        classes.push('cell-ok');
      else if (v === 'OFFLINE' || v === 'MAINT' || v === 'PENDING' || v === 'HOLD')
        classes.push('cell-dim');
      if (changedCells.value[`${ri}-${ci}`]) classes.push('cell-changed');
      return classes.join(' ');
    }

    function rowClass(ri) {
      return ri % 2 === 1 ? 'dtable-row-alt' : '';
    }

    return { columns, rows, strategy, cellClass, rowClass };
  },
  template: `
    <div class="activity-data-table dtable-scanline">
      <table class="dtable">
        <thead>
          <tr>
            <th v-for="(col, ci) in columns" :key="col">
              {{ col }}<span class="dtable-sort-icon">\u25B4</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, ri) in rows" :key="ri" :class="rowClass(ri)">
            <td
              v-for="(cell, ci) in row"
              :key="ci"
              :class="cellClass(columns[ci], cell, ri, ci)"
            >{{ cell }}</td>
          </tr>
        </tbody>
      </table>
      <div class="dtable-strategy">{{ strategy.toUpperCase().replace(/_/g, ' ') }}</div>
    </div>
  `,
};
