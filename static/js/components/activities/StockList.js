/**
 * Stock price list — HTML/CSS table with live-updating tickers.
 */
export default {
  name: 'ActivityStockList',
  props: { activity: Object },
  computed: {
    stocks() {
      return this.activity?.state?.stocks || [];
    },
  },
  template: `
    <div class="stock-list-wrap">
      <table class="stock-table">
        <thead>
          <tr>
            <th class="st-ticker">SYM</th>
            <th class="st-price">PRICE</th>
            <th class="st-change">CHG</th>
            <th class="st-pct">%</th>
            <th class="st-high">HIGH</th>
            <th class="st-low">LOW</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in stocks" :key="s.ticker"
              :class="{ 'stock-gain': s.gaining, 'stock-loss': !s.gaining }">
            <td class="st-ticker">{{ s.ticker }}</td>
            <td class="st-price">{{ s.price.toFixed(2) }}</td>
            <td class="st-change">{{ (s.change >= 0 ? '+' : '') + s.change.toFixed(2) }}</td>
            <td class="st-pct">{{ (s.change_pct >= 0 ? '+' : '') + s.change_pct.toFixed(2) }}%</td>
            <td class="st-high">{{ s.high.toFixed(2) }}</td>
            <td class="st-low">{{ s.low.toFixed(2) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  `,
};
