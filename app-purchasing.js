/* ============================================================
   Inventory ERP — Purchase Planning (All / By Category / By
   Supplier views, item-code search, manual order cart + auto
   recommendations, AG-Grid-style main list, PO generation)
   ============================================================ */

function getRecommendationRows() {
  return DATA.recommendations.map((r) => ({
    source: "Recommended",
    itemCode: r.itemCode,
    description: r.description,
    supplier: r.supplier,
    category: r.category,
    priority: r.priority,
    currentStocks: r.currentStocks,
    coverage: r.coverage,
    leadTime: r.leadTime,
    qty: r.recommendedOrderQty,
    price: r.price,
    orderDate: r.recommendedOrderDate,
    stockOutDate: r.estimatedStockOutDate,
    arrivalDate: r.estimatedArrivalDate,
    payment: r.estimatedPayment,
  }));
}
function getManualRows() {
  return ORDER_CART.map((c) => {
    const item = DATA.items.find((i) => i.itemCode === c.itemCode);
    return {
      source: "Manual",
      itemCode: c.itemCode,
      description: c.description,
      supplier: c.supplier,
      category: c.category || (item ? item.category : ""),
      priority: "Medium",
      currentStocks: item ? item.currentStocks : 0,
      coverage: item ? item.coverage : 0,
      leadTime: item ? item.leadTime : 0,
      qty: c.qty,
      price: c.price,
      orderDate: new Date().toISOString().slice(0, 10),
      stockOutDate: "-",
      arrivalDate: "-",
      payment: +(c.qty * c.price).toFixed(2),
    };
  });
}
function getAllPlanningRows() {
  return [...getRecommendationRows(), ...getManualRows()];
}
function exportPlanningRows(rows) {
  return rows.map((r) => ({
    "Item Code": r.itemCode, Description: r.description, Source: r.source, Supplier: r.supplier, Category: r.category,
    Priority: r.priority, "Current Stock": r.currentStocks, "Coverage (d)": r.coverage, "Lead Time (d)": r.leadTime,
    "Order Qty": r.qty, "Order Date": r.orderDate, "Stock-out Date": r.stockOutDate, "Arrival Date": r.arrivalDate,
    "Est. Payment (excl VAT)": r.payment, "Est. Payment (incl VAT)": +withVat(r.payment).toFixed(2),
  }));
}

function renderPORows() {
  return PURCHASE_ORDERS.map(
    (po) =>
      `<tr><td class="font-semibold">${po.poNumber}</td><td>${po.supplier}</td><td>${po.lines.length}</td><td>${formatCurrency(po.totalCost)}</td><td>${formatDate(po.expectedDeliveryDate)}</td><td>${po.leadTime}d</td><td>${po.status}</td><td>${po.createdBy || "-"}</td></tr>`
  ).join("");
}

function generatePOFromRows(rows) {
  if (!rows || rows.length === 0) return;
  const supplier = rows[0].supplier || "Unassigned Supplier";
  const lines = rows.map((r) => ({ itemCode: r.itemCode, description: r.description, qty: r.qty, unitPrice: r.price, totalCost: +(r.qty * r.price).toFixed(2) }));
  const maxLeadTime = Math.max(...rows.map((r) => (typeof r.leadTime === "number" ? r.leadTime : 0)), 0);
  const expected = new Date();
  expected.setDate(expected.getDate() + maxLeadTime);
  const year = new Date().getFullYear();
  const seq = PURCHASE_ORDERS.filter((p) => p.poNumber.includes(String(year))).length + 1;
  const po = {
    poNumber: `PO-${year}-${String(seq).padStart(4, "0")}`,
    supplier,
    createdAt: new Date().toISOString(),
    createdBy: (CURRENT_USER && (CURRENT_USER.name || CURRENT_USER.email)) || "-",
    expectedDeliveryDate: expected.toISOString().slice(0, 10),
    leadTime: maxLeadTime,
    status: "Draft",
    lines,
    totalCost: +lines.reduce((s, l) => s + l.totalCost, 0).toFixed(2),
  };
  PURCHASE_ORDERS.unshift(po);
  savePOs();
  const orderedCodes = new Set(rows.map((r) => r.itemCode));
  ORDER_CART = ORDER_CART.filter((c) => !orderedCodes.has(c.itemCode));
  saveCart();
  render();
}

function renderPurchasePlanning() {
  const app = document.getElementById("app");
  const canCreatePO = ROLE_PERMISSIONS[CURRENT_USER.role].canCreatePO;

  app.innerHTML = `
    <div class="space-y-6">
      <div><h1 class="text-xl font-bold">${t("pp.title")}</h1><p class="text-sm text-erp-muted">${t("pp.subtitle")}</p></div>

      <div class="card p-3 flex flex-wrap gap-2 items-center">
        <div class="flex gap-2" id="ppViewTabs">
          <button data-view="all" class="btn btn-primary">${t("pp.viewAll")}</button>
          <button data-view="category" class="btn">${t("pp.viewByCategory")}</button>
          <button data-view="supplier" class="btn">${t("pp.viewBySupplier")}</button>
        </div>
        <div class="relative" style="margin-inline-start:auto">
          <i data-lucide="search" style="width:14px;height:14px" class="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"></i>
          <input id="ppSearch" placeholder="${t("pp.searchPlaceholder")}" class="field-input" style="width:14rem;padding-left:2rem" value="${escapeAttr(PP_SEARCH)}" />
        </div>
      </div>

      <div id="ppBody"></div>

      <div>
        <h2 class="text-sm font-semibold mb-2">${t("pp.purchaseOrders")}</h2>
        <div class="card overflow-x-auto">
          <table class="erp-table">
            <thead><tr><th>${t("pp.poNumber")}</th><th>${t("col.supplier")}</th><th>${t("sup.items")}</th><th>${t("pp.totalCost")}</th><th>${t("pp.expectedDelivery")}</th><th>${t("col.leadTime")}</th><th>${t("pp.status")}</th><th>${t("pp.createdBy")}</th></tr></thead>
            <tbody id="poTableBody">${renderPORows()}</tbody>
          </table>
          <p id="poEmpty" class="text-xs text-erp-muted p-4 ${PURCHASE_ORDERS.length ? "hidden" : ""}">${t("pp.noPOs")}</p>
        </div>
      </div>
    </div>
  `;

  document.querySelectorAll("#ppViewTabs button").forEach((b) =>
    b.addEventListener("click", () => {
      PP_VIEW = b.dataset.view;
      document.querySelectorAll("#ppViewTabs button").forEach((x) => x.classList.toggle("btn-primary", x === b));
      renderPPBody(canCreatePO);
    })
  );
  document.getElementById("ppSearch").addEventListener("input", (e) => {
    PP_SEARCH = e.target.value;
    renderPPBody(canCreatePO);
  });

  renderPPBody(canCreatePO);
}

function renderPPBody(canCreatePO) {
  destroyGrid();
  const container = document.getElementById("ppBody");
  const search = PP_SEARCH.trim().toLowerCase();
  let rows = getAllPlanningRows();
  if (search) rows = rows.filter((r) => r.itemCode.toLowerCase().includes(search));

  if (PP_VIEW === "all") {
    container.innerHTML = `
      <div class="card p-3 flex flex-wrap gap-2 items-center justify-end">
        ${canCreatePO ? `<button id="ppGeneratePO" class="btn btn-primary" disabled><i data-lucide="shopping-cart" style="width:14px;height:14px"></i> ${t("pp.generatePO")} (<span id="ppCount">0</span>)</button>` : `<span class="text-xs text-erp-muted">${t("pp.selectHint")}</span>`}
        <button id="ppCSV" class="btn"><i data-lucide="download" style="width:14px;height:14px"></i> ${t("inv.csv")}</button>
        <button id="ppExcel" class="btn"><i data-lucide="file-spreadsheet" style="width:14px;height:14px"></i> ${t("inv.excel")}</button>
        <button id="ppPDF" class="btn"><i data-lucide="file-text" style="width:14px;height:14px"></i> ${t("inv.pdf")}</button>
      </div>
      <div id="ppGrid" class="ag-theme-quartz rounded-xl2 overflow-hidden border border-erp-border shadow-card mt-3" style="height:560px;width:100%"></div>
      <p class="text-xs text-erp-muted mt-2">${rows.length === 0 ? t("pp.noItems") : ""}</p>
    `;
    if (window.lucide) lucide.createIcons();

    const colDefs = [
      { headerName: t("col.itemCode"), field: "itemCode", pinned: "left", width: 130, checkboxSelection: canCreatePO, headerCheckboxSelection: canCreatePO },
      { headerName: t("col.description"), field: "description", width: 200 },
      { headerName: t("col.source"), field: "source", width: 110, cellRenderer: (p) => `<span class="badge ${p.value === "Recommended" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}">${p.value === "Recommended" ? t("pp.recommended") : t("pp.manual")}</span>` },
      { headerName: t("col.supplier"), field: "supplier", width: 170 },
      { headerName: t("col.category"), field: "category", width: 150 },
      { headerName: t("col.priority"), field: "priority", width: 110, cellRenderer: (p) => `<span class="badge ${PRIORITY_COLORS[p.value] || "bg-slate-100 text-slate-700"}">${t("priority." + p.value)}</span>` },
      { headerName: t("kpi.currentStock"), field: "currentStocks", width: 120, valueFormatter: (p) => formatNumber(p.value) },
      { headerName: t("col.coverage"), field: "coverage", width: 110, valueFormatter: (p) => (typeof p.value === "number" ? formatNumber(p.value) : p.value) },
      { headerName: t("col.leadTime"), field: "leadTime", width: 110, valueFormatter: (p) => (typeof p.value === "number" ? formatNumber(p.value) : p.value) },
      { headerName: t("col.recommendedQty"), field: "qty", width: 110, valueFormatter: (p) => formatNumber(p.value) },
      { headerName: t("col.orderDate"), field: "orderDate", width: 120 },
      { headerName: t("col.stockOutDate"), field: "stockOutDate", width: 130 },
      { headerName: t("col.arrivalDate"), field: "arrivalDate", width: 120 },
      { headerName: t("col.estPayment"), field: "payment", colId: "paymentExcl", width: 170, valueFormatter: (p) => formatCurrency(p.value) },
      { headerName: t("col.estPaymentVat"), field: "payment", colId: "paymentVat", width: 180, valueFormatter: (p) => formatCurrency(withVat(p.value)) },
    ];

    createGridGeneric("ppGrid", rows, colDefs, canCreatePO ? { rowSelection: "multiple", suppressRowClickSelection: true } : {});

    if (canCreatePO) {
      currentGridApi.addEventListener("selectionChanged", () => {
        const count = currentGridApi.getSelectedRows().length;
        const countEl = document.getElementById("ppCount");
        const genBtn = document.getElementById("ppGeneratePO");
        if (countEl) countEl.textContent = String(count);
        if (genBtn) genBtn.disabled = count === 0;
      });
      document.getElementById("ppGeneratePO").addEventListener("click", () => generatePOFromRows(currentGridApi.getSelectedRows()));
    }

    document.getElementById("ppCSV").addEventListener("click", () => exportToCSV(exportPlanningRows(rows), "purchase-planning"));
    document.getElementById("ppExcel").addEventListener("click", () => exportToExcel(exportPlanningRows(rows), "purchase-planning"));
    document.getElementById("ppPDF").addEventListener("click", () => exportToPDF(exportPlanningRows(rows), "purchase-planning", "Purchase Planning"));
  } else {
    const groupField = PP_VIEW === "category" ? "category" : "supplier";
    const groups = {};
    rows.forEach((r) => {
      const key = r[groupField] || "-";
      groups[key] ??= [];
      groups[key].push(r);
    });
    const entries = Object.entries(groups);
    container.innerHTML =
      entries
        .map(([name, groupRows]) => {
          const totalPayment = groupRows.reduce((s, r) => s + (r.payment || 0), 0);
          return `
        <div class="card p-4 mb-3">
          <div class="flex items-center justify-between mb-2">
            <h3 class="text-sm font-semibold">${name}</h3>
            <span class="text-xs text-erp-muted">${groupRows.length} ${t("inv.itemsShown")} &middot; ${formatCurrency(totalPayment)}</span>
          </div>
          ${miniTable(groupRows, [
            ["itemCode", t("col.itemCode")],
            ["description", t("col.description")],
            ["source", t("col.source"), (v) => (v === "Recommended" ? t("pp.recommended") : t("pp.manual"))],
            ["qty", t("col.recommendedQty"), formatNumber],
            ["payment", t("col.estPayment"), formatCurrency],
          ])}
        </div>`;
        })
        .join("") || `<p class="text-xs text-erp-muted">${t("pp.noItems")}</p>`;
  }
}
