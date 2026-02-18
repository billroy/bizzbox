/**
 * Scrolling data table / spreadsheet — DOM-based reactive component.
 * Server sends column headers and rows of cell values.
 */
export default {
  name: 'ActivityDataTable',
  props: { activity: Object },
  setup(props) {
    const { computed } = Vue;
    const columns = computed(() => props.activity?.state?.columns ?? []);
    const rows = computed(() => props.activity?.state?.rows ?? []);
    const strategy = computed(() => props.activity?.state?.strategy ?? '');

    function cellClass(col, value) {
      const v = (value || '').toUpperCase();
      if (v === 'CRIT' || v === 'CRITICAL' || v === 'ERROR' || v === 'ALARM' || v === 'CANCELLED')
        return 'cell-error';
      if (v === 'WARN' || v === 'WARNING' || v === 'DELAYED' || v === 'HIGH')
        return 'cell-warn';
      if (v === 'OK' || v === 'NORMAL' || v === 'ON TIME' || v === 'CLEARED' || v === 'SETTLED' || v === 'ACTIVE')
        return 'cell-ok';
      if (v === 'OFFLINE' || v === 'MAINT' || v === 'PENDING' || v === 'HOLD')
        return 'cell-dim';
      return '';
    }

    return { columns, rows, strategy, cellClass };
  },
  template: `
    <div class="activity-data-table">
      <table class="dtable">
        <thead>
          <tr>
            <th v-for="col in columns" :key="col">{{ col }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, ri) in rows" :key="ri">
            <td
              v-for="(cell, ci) in row"
              :key="ci"
              :class="cellClass(columns[ci], cell)"
            >{{ cell }}</td>
          </tr>
        </tbody>
      </table>
      <div class="dtable-strategy">{{ strategy.toUpperCase().replace(/_/g, ' ') }}</div>
    </div>
  `,
};
