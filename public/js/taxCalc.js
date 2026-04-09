// Crypto Tax Calculator - Vanilla JS
// FIFO Method Implementation

let taxState = {
  trades: [],
  taxYear: new Date().getFullYear(),
};

const STORAGE_KEY = 'tp_tax_trades';

function initTaxCalc() {
  loadTaxState();
  renderTaxCalc();
  attachTaxEventListeners();
}

function loadTaxState() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    taxState.trades = JSON.parse(stored);
  }
}

function saveTaxState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(taxState.trades));
}

function renderTaxCalc() {
  const container = document.getElementById('tax-calc');
  container.innerHTML = `
    <div class="tax-container">
      <h2>Crypto Tax Calculator (FIFO Method)</h2>

      <div class="tax-form">
        <div class="tax-form-group">
          <label for="taxYear">Tax Year:</label>
          <select id="taxYear" class="tax-select">
            ${generateYearOptions()}
          </select>
        </div>

        <h3>Add Trade</h3>
        <div class="tax-form-group">
          <label for="tradeDate">Date:</label>
          <input type="date" id="tradeDate" class="tax-input" />
        </div>

        <div class="tax-form-group">
          <label for="tradeCoin">Coin (e.g., BTC, ETH):</label>
          <input type="text" id="tradeCoin" class="tax-input" placeholder="BTC" />
        </div>

        <div class="tax-form-group">
          <label for="tradeType">Type:</label>
          <select id="tradeType" class="tax-select">
            <option value="Buy">Buy</option>
            <option value="Sell">Sell</option>
          </select>
        </div>

        <div class="tax-form-group">
          <label for="tradeQty">Quantity:</label>
          <input type="number" id="tradeQty" class="tax-input" step="0.00000001" />
        </div>

        <div class="tax-form-group">
          <label for="tradePrice">Price Per Coin (USD):</label>
          <input type="number" id="tradePrice" class="tax-input" step="0.01" />
        </div>

        <div class="tax-form-group">
          <label for="tradeFee">Fee (USD, optional):</label>
          <input type="number" id="tradeFee" class="tax-input" step="0.01" placeholder="0" />
        </div>

        <button id="addTradeBtn" class="tax-add-btn">Add Trade</button>
        <button id="sampleDataBtn" class="tax-add-btn" style="margin-left: 10px; background: #666;">Load Sample Data</button>
      </div>

      <h3>Trades</h3>
      <div id="tradesContainer"></div>

      <div style="margin: 20px 0;">
        <button id="calculateTaxBtn" class="tax-add-btn" style="background: #28a745;">Calculate Tax</button>
      </div>

      <div id="taxResults"></div>
    </div>
  `;
}

function generateYearOptions() {
  const currentYear = new Date().getFullYear();
  let options = '';
  for (let i = currentYear - 3; i <= currentYear + 3; i++) {
    const selected = i === currentYear ? 'selected' : '';
    options += `<option value="${i}" ${selected}>${i}</option>`;
  }
  return options;
}

function renderTradesTable() {
  const container = document.getElementById('tradesContainer');

  if (taxState.trades.length === 0) {
    container.innerHTML = '<p>No trades recorded.</p>';
    return;
  }

  const rows = taxState.trades.map(trade => `
    <tr>
      <td>${new Date(trade.date).toLocaleDateString()}</td>
      <td>${trade.coin}</td>
      <td>${trade.type}</td>
      <td>${parseFloat(trade.qty).toFixed(8)}</td>
      <td>$${parseFloat(trade.price).toFixed(2)}</td>
      <td>$${parseFloat(trade.fee || 0).toFixed(2)}</td>
      <td>$${parseFloat(trade.total).toFixed(2)}</td>
      <td><button class="tax-delete-btn" data-id="${trade.id}">Delete</button></td>
    </tr>
  `).join('');

  container.innerHTML = `
    <table class="tax-trades-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Coin</th>
          <th>Type</th>
          <th>Quantity</th>
          <th>Price/Coin</th>
          <th>Fee</th>
          <th>Total</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function attachTaxEventListeners() {
  const addBtn = document.getElementById('addTradeBtn');
  const calculateBtn = document.getElementById('calculateTaxBtn');
  const sampleBtn = document.getElementById('sampleDataBtn');
  const yearSelect = document.getElementById('taxYear');

  addBtn.addEventListener('click', addTrade);
  calculateBtn.addEventListener('click', onCalculateTax);
  sampleBtn.addEventListener('click', loadSampleData);
  yearSelect.addEventListener('change', (e) => {
    taxState.taxYear = parseInt(e.target.value);
  });

  // Event delegation for delete buttons
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('tax-delete-btn')) {
      const id = e.target.dataset.id;
      taxState.trades = taxState.trades.filter(t => t.id !== id);
      saveTaxState();
      renderTradesTable();
    }
  });

  renderTradesTable();
}

function addTrade() {
  const dateEl = document.getElementById('tradeDate');
  const coinEl = document.getElementById('tradeCoin');
  const typeEl = document.getElementById('tradeType');
  const qtyEl = document.getElementById('tradeQty');
  const priceEl = document.getElementById('tradePrice');
  const feeEl = document.getElementById('tradeFee');

  if (!dateEl.value || !coinEl.value || !qtyEl.value || !priceEl.value) {
    alert('Please fill in all required fields');
    return;
  }

  const qty = parseFloat(qtyEl.value);
  const price = parseFloat(priceEl.value);
  const fee = parseFloat(feeEl.value) || 0;
  const total = (qty * price) + fee;

  const trade = {
    id: Date.now().toString(),
    date: dateEl.value,
    coin: coinEl.value.toUpperCase(),
    type: typeEl.value,
    qty: qty,
    price: price,
    fee: fee,
    total: total,
  };

  taxState.trades.push(trade);
  saveTaxState();

  // Clear form
  dateEl.value = '';
  coinEl.value = '';
  typeEl.value = 'Buy';
  qtyEl.value = '';
  priceEl.value = '';
  feeEl.value = '';

  renderTradesTable();
}

function loadSampleData() {
  const sampleTrades = [
    {
      id: '1',
      date: '2024-01-15',
      coin: 'BTC',
      type: 'Buy',
      qty: 0.5,
      price: 42000,
      fee: 50,
      total: 21050,
    },
    {
      id: '2',
      date: '2024-03-20',
      coin: 'ETH',
      type: 'Buy',
      qty: 2,
      price: 2500,
      fee: 30,
      total: 5030,
    },
    {
      id: '3',
      date: '2024-06-10',
      coin: 'BTC',
      type: 'Sell',
      qty: 0.5,
      price: 62000,
      fee: 100,
      total: 30900,
    },
    {
      id: '4',
      date: '2024-11-05',
      coin: 'ETH',
      type: 'Buy',
      qty: 1,
      price: 2800,
      fee: 20,
      total: 2820,
    },
    {
      id: '5',
      date: '2024-12-15',
      coin: 'ETH',
      type: 'Sell',
      qty: 2,
      price: 3200,
      fee: 50,
      total: 6350,
    },
  ];

  taxState.trades = sampleTrades;
  saveTaxState();
  renderTradesTable();
  alert('Sample data loaded! You can now calculate tax.');
}

function onCalculateTax() {
  const results = calculateTax(taxState.taxYear);
  renderTaxResults(results, taxState.taxYear);
}

function calculateTax(year) {
  const results = {
    year: year,
    coins: {},
    totalProceeds: 0,
    totalCostBasis: 0,
    totalGainLoss: 0,
    shortTermGains: 0,
    longTermGains: 0,
    totalFees: 0,
    transactions: [],
  };

  // Track held coins (buys only, indexed by coin)
  const coinInventory = {};

  // Process trades chronologically
  const sortedTrades = [...taxState.trades].sort((a, b) =>
    new Date(a.date) - new Date(b.date)
  );

  sortedTrades.forEach(trade => {
    if (trade.type === 'Buy') {
      if (!coinInventory[trade.coin]) {
        coinInventory[trade.coin] = [];
      }
      coinInventory[trade.coin].push({
        date: trade.date,
        qty: trade.qty,
        price: trade.price,
        fee: trade.fee,
        remaining: trade.qty,
      });
    }
  });

  // Process sells for the given year
  sortedTrades.forEach(trade => {
    if (trade.type === 'Sell' && new Date(trade.date).getFullYear() === year) {
      const coin = trade.coin;

      if (!results.coins[coin]) {
        results.coins[coin] = {
          coin: coin,
          totalBought: 0,
          totalSold: 0,
          costBasis: 0,
          proceeds: 0,
          gainLoss: 0,
          transactions: [],
        };
      }

      let sellRemaining = trade.qty;
      const sellDate = new Date(trade.date);
      const costBasisForSale = [];

      // FIFO: match against earliest buys
      if (coinInventory[coin]) {
        for (let i = 0; i < coinInventory[coin].length && sellRemaining > 0; i++) {
          const lot = coinInventory[coin][i];
          if (lot.remaining <= 0) continue;

          const matchQty = Math.min(sellRemaining, lot.remaining);
          const matchCost = matchQty * lot.price;
          const lotFeeAllocation = (matchQty / lot.qty) * lot.fee;
          const matchCostWithFee = matchCost + lotFeeAllocation;
          const matchProceeds = matchQty * trade.price;
          const matchGainLoss = matchProceeds - matchCostWithFee;

          const buyDate = new Date(lot.date);
          const holdingDays = (sellDate - buyDate) / (1000 * 60 * 60 * 24);
          const isLongTerm = holdingDays >= 365;

          costBasisForSale.push({
            buyDate: lot.date,
            qty: matchQty,
            costBasis: matchCostWithFee,
            proceeds: matchProceeds,
            gainLoss: matchGainLoss,
            isLongTerm: isLongTerm,
          });

          lot.remaining -= matchQty;
          sellRemaining -= matchQty;

          results.coins[coin].costBasis += matchCostWithFee;
          results.coins[coin].proceeds += matchProceeds;
          results.coins[coin].gainLoss += matchGainLoss;

          if (isLongTerm) {
            results.longTermGains += matchGainLoss;
          } else {
            results.shortTermGains += matchGainLoss;
          }
        }
      }

      results.totalProceeds += trade.qty * trade.price;
      results.totalCostBasis += results.coins[coin].costBasis;
      results.totalFees += trade.fee;

      costBasisForSale.forEach(cb => {
        results.transactions.push({
          coin: coin,
          buyDate: cb.buyDate,
          sellDate: trade.date,
          qty: cb.qty,
          costBasis: cb.costBasis,
          proceeds: cb.proceeds,
          gainLoss: cb.gainLoss,
          term: cb.isLongTerm ? 'Long-term' : 'Short-term',
        });
      });
    }
  });

  results.totalGainLoss = results.longTermGains + results.shortTermGains;

  return results;
}

function renderTaxResults(results, year) {
  const container = document.getElementById('taxResults');

  if (Object.keys(results.coins).length === 0) {
    container.innerHTML = '<p style="color: #ff6b6b;">No sales recorded for ' + year + '.</p>';
    return;
  }

  const summaryHTML = `
    <div class="tax-results">
      <h3>Tax Summary for ${year}</h3>

      <div class="tax-summary-grid">
        <div class="tax-summary-card">
          <h4>Total Proceeds</h4>
          <p class="tax-summary-value">$${results.totalProceeds.toFixed(2)}</p>
        </div>
        <div class="tax-summary-card">
          <h4>Total Cost Basis</h4>
          <p class="tax-summary-value">$${results.totalCostBasis.toFixed(2)}</p>
        </div>
        <div class="tax-summary-card">
          <h4>Total Gain/Loss</h4>
          <p class="tax-summary-value ${results.totalGainLoss >= 0 ? 'gain-positive' : 'gain-negative'}">
            $${results.totalGainLoss.toFixed(2)}
          </p>
        </div>
        <div class="tax-summary-card">
          <h4>Total Fees</h4>
          <p class="tax-summary-value">$${results.totalFees.toFixed(2)}</p>
        </div>
      </div>

      <div class="tax-term-section">
        <h4>Short-term Gains (Taxed as Income)</h4>
        <p class="tax-summary-value ${results.shortTermGains >= 0 ? 'gain-positive' : 'gain-negative'}">
          $${results.shortTermGains.toFixed(2)}
        </p>
      </div>

      <div class="tax-term-section">
        <h4>Long-term Gains (Lower Tax Rate)</h4>
        <p class="tax-summary-value ${results.longTermGains >= 0 ? 'gain-positive' : 'gain-negative'}">
          $${results.longTermGains.toFixed(2)}
        </p>
      </div>

      <h3>Breakdown by Coin</h3>
      <table class="tax-breakdown-table">
        <thead>
          <tr>
            <th>Coin</th>
            <th>Bought</th>
            <th>Sold</th>
            <th>Cost Basis</th>
            <th>Proceeds</th>
            <th>Gain/Loss</th>
          </tr>
        </thead>
        <tbody>
          ${Object.values(results.coins).map(coin => `
            <tr>
              <td>${coin.coin}</td>
              <td>${coin.totalBought.toFixed(8)}</td>
              <td>${coin.totalSold.toFixed(8)}</td>
              <td>$${coin.costBasis.toFixed(2)}</td>
              <td>$${coin.proceeds.toFixed(2)}</td>
              <td class="${coin.gainLoss >= 0 ? 'gain-positive' : 'gain-negative'}">
                $${coin.gainLoss.toFixed(2)}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <h3>Detailed Transactions</h3>
      <table class="tax-breakdown-table">
        <thead>
          <tr>
            <th>Coin</th>
            <th>Buy Date</th>
            <th>Sell Date</th>
            <th>Qty</th>
            <th>Cost Basis</th>
            <th>Proceeds</th>
            <th>Gain/Loss</th>
            <th>Hold Period</th>
          </tr>
        </thead>
        <tbody>
          ${results.transactions.map(tx => `
            <tr>
              <td>${tx.coin}</td>
              <td>${new Date(tx.buyDate).toLocaleDateString()}</td>
              <td>${new Date(tx.sellDate).toLocaleDateString()}</td>
              <td>${tx.qty.toFixed(8)}</td>
              <td>$${tx.costBasis.toFixed(2)}</td>
              <td>$${tx.proceeds.toFixed(2)}</td>
              <td class="${tx.gainLoss >= 0 ? 'gain-positive' : 'gain-negative'}">
                $${tx.gainLoss.toFixed(2)}
              </td>
              <td>${tx.term}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <p class="tax-disclaimer">
        <strong>Disclaimer:</strong> This is an estimate. Consult a tax professional for filing.
        This calculator assumes FIFO accounting method.
      </p>

      <button id="exportBtn" class="tax-add-btn" style="background: #007bff; margin-top: 20px;">Export CSV</button>
    </div>
  `;

  container.innerHTML = summaryHTML;

  document.getElementById('exportBtn').addEventListener('click', () => {
    exportTaxCSV(results);
  });
}

function exportTaxCSV(results) {
  let csv = 'Crypto Tax Report - FIFO Method\n';
  csv += `Tax Year: ${results.year}\n`;
  csv += `Generated: ${new Date().toLocaleDateString()}\n\n`;

  csv += 'SUMMARY\n';
  csv += `Total Proceeds,$${results.totalProceeds.toFixed(2)}\n`;
  csv += `Total Cost Basis,$${results.totalCostBasis.toFixed(2)}\n`;
  csv += `Total Gain/Loss,$${results.totalGainLoss.toFixed(2)}\n`;
  csv += `Short-term Gains,$${results.shortTermGains.toFixed(2)}\n`;
  csv += `Long-term Gains,$${results.longTermGains.toFixed(2)}\n`;
  csv += `Total Fees,$${results.totalFees.toFixed(2)}\n\n`;

  csv += 'TRANSACTIONS\n';
  csv += 'Coin,Buy Date,Sell Date,Quantity,Cost Basis,Proceeds,Gain/Loss,Hold Period\n';
  results.transactions.forEach(tx => {
    csv += `${tx.coin},${tx.buyDate},${tx.sellDate},${tx.qty.toFixed(8)},$${tx.costBasis.toFixed(2)},$${tx.proceeds.toFixed(2)},$${tx.gainLoss.toFixed(2)},${tx.term}\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `crypto-tax-report-${results.year}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
