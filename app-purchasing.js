/* ============================================================
   Inventory ERP — Purchase Planning (All / By Category / By
   Supplier views, filters, item-code search, manual order cart +
   auto recommendations, AG-Grid-style main list, PO generation,
   PO registry with cancel + PDF export/auto-download)
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

/* ---------- PO registry ---------- */

function poStatusBadge(status) {
  const cls = status === "Cancelled" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700";
  const label = status === "Cancelled" ? t("po.cancelled") : t("po.draft");
  return `<span class="badge ${cls}">${label}</span>`;
}

function renderPORows() {
  return PURCHASE_ORDERS.map(
    (po) => `
    <tr>
      <td class="font-semibold">${po.poNumber}</td>
      <td>${escapeHtml(po.supplier)}</td>
      <td>${po.lines.length}</td>
      <td>${formatCurrency(po.totalCost)}</td>
      <td>${formatDate(po.expectedDeliveryDate)}</td>
      <td>${po.leadTime}d</td>
      <td>${poStatusBadge(po.status)}</td>
      <td>${escapeHtml(po.createdBy || "-")}</td>
      <td style="white-space:nowrap">
        <button class="poExportBtn text-xs text-erp-accent hover:underline" data-po="${escapeAttr(po.poNumber)}">${t("po.export")}</button>
        ${po.status !== "Cancelled" ? ` &middot; <button class="poCancelBtn text-xs text-red-600 hover:underline" data-po="${escapeAttr(po.poNumber)}">${t("po.cancel")}</button>` : ""}
      </td>
    </tr>`
  ).join("");
}

function wirePOActions() {
  document.querySelectorAll(".poExportBtn").forEach((btn) =>
    btn.addEventListener("click", () => {
      const po = PURCHASE_ORDERS.find((p) => p.poNumber === btn.dataset.po);
      if (po) exportPOToPDF(po);
    })
  );
  document.querySelectorAll(".poCancelBtn").forEach((btn) =>
    btn.addEventListener("click", () => {
      if (!confirm(t("po.cancelConfirm"))) return;
      const po = PURCHASE_ORDERS.find((p) => p.poNumber === btn.dataset.po);
      if (po) {
        po.status = "Cancelled";
        savePOs();
        render();
      }
    })
  );
}

function poStatusBadgeHtmlInline(status) {
  const style = status === "Cancelled" ? "background:#FEE2E2;color:#B91C1C;" : "background:#DBEAFE;color:#1D4ED8;";
  const label = status === "Cancelled" ? t("po.cancelled") : t("po.draft");
  return `<span style="${style}padding:3px 10px;border-radius:9999px;font-size:11px;font-weight:600;display:inline-block;">${escapeHtml(label)}</span>`;
}

// Builds a proper PO document (letterhead, line items, totals, and the
// supplier's credit/advance-payment terms if any are on file) and
// rasterizes it to PDF — used both for the auto-download on creation and
// for re-exporting any past PO from the registry.
async function exportPOToPDF(po) {
  const rtl = SETTINGS.locale === "ar";
  const headerColor = SETTINGS.headerColor || "#0B2545";
  const accentColor = SETTINGS.primaryColor || "#2E6BE6";
  const align = rtl ? "right" : "left";
  const subtotal = po.totalCost;
  const vat = +(subtotal * VAT_RATE).toFixed(2);
  const total = +(subtotal + vat).toFixed(2);
  const terms = getSupplierTerms(po.supplier);

  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-99999px";
  container.style.top = "0";
  container.style.background = "#ffffff";
  container.style.padding = "36px";
  container.style.width = "1000px";
  container.style.fontFamily = "'Segoe UI', Tahoma, Arial, sans-serif";
  container.dir = rtl ? "rtl" : "ltr";

  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:4px solid ${accentColor};padding-bottom:18px;margin-bottom:20px;">
      <div>
        <div style="font-size:22px;font-weight:800;color:${headerColor};">${escapeHtml(SETTINGS.dashboardTitle || "Inventory ERP")}</div>
        <div style="font-size:12px;color:#64748B;margin-top:4px;">${escapeHtml(t("po.documentTitle"))}</div>
      </div>
      <div style="text-align:${rtl ? "left" : "right"};">
        <div style="font-size:18px;font-weight:700;color:${accentColor};">${escapeHtml(po.poNumber)}</div>
        <div style="margin-top:6px;">${poStatusBadgeHtmlInline(po.status)}</div>
      </div>
    </div>
    <div style="display:flex;gap:28px;margin-bottom:22px;font-size:12px;">
      <div style="flex:1;">
        <div style="font-weight:700;color:${headerColor};margin-bottom:6px;">${escapeHtml(t("col.supplier"))}</div>
        <div>${escapeHtml(po.supplier)}</div>
      </div>
      <div style="flex:1;">
        <div style="font-weight:700;color:${headerColor};margin-bottom:6px;">${escapeHtml(t("po.orderDate"))}</div>
        <div>${escapeHtml(formatDate(po.createdAt))}</div>
      </div>
      <div style="flex:1;">
        <div style="font-weight:700;color:${headerColor};margin-bottom:6px;">${escapeHtml(t("pp.expectedDelivery"))}</div>
        <div>${escapeHtml(formatDate(po.expectedDeliveryDate))}</div>
      </div>
      <div style="flex:1;">
        <div style="font-weight:700;color:${headerColor};margin-bottom:6px;">${escapeHtml(t("pp.createdBy"))}</div>
        <div>${escapeHtml(po.createdBy || "-")}</div>
      </div>
      ${
        terms.creditRequired
          ? `<div style="flex:1;">
        <div style="font-weight:700;color:${headerColor};margin-bottom:6px;">${escapeHtml(t("sup.creditTerms"))}</div>
        <div>${terms.paymentType === "percentage" ? `${escapeHtml(String(terms.paymentValue))}%` : escapeHtml(formatCurrency(terms.paymentValue))} ${escapeHtml(t("sup.creditRequired"))}</div>
      </div>`
          : ""
      }
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:18px;">
      <thead>
        <tr style="background:${headerColor};color:#ffffff;">
          <th style="padding:8px 10px;text-align:${align};border:1px solid ${headerColor};">${escapeHtml(t("col.itemCode"))}</th>
          <th style="padding:8px 10px;text-align:${align};border:1px solid ${headerColor};">${escapeHtml(t("col.description"))}</th>
          <th style="padding:8px 10px;text-align:${align};border:1px solid ${headerColor};">${escapeHtml(t("po.qty"))}</th>
          <th style="padding:8px 10px;text-align:${align};border:1px solid ${headerColor};">${escapeHtml(t("po.unitPrice"))}</th>
          <th style="padding:8px 10px;text-align:${align};border:1px solid ${headerColor};">${escapeHtml(t("po.lineTotal"))}</th>
        </tr>
      </thead>
      <tbody>
        ${po.lines
          .map(
            (l, idx) => `
          <tr style="background:${idx % 2 === 0 ? "#ffffff" : "#F4F6FA"};">
            <td style="padding:6px 10px;border:1px solid #E3E8F0;text-align:${align};">${escapeHtml(l.itemCode)}</td>
            <td style="padding:6px 10px;border:1px solid #E3E8F0;text-align:${align};">${escapeHtml(l.description)}</td>
            <td style="padding:6px 10px;border:1px solid #E3E8F0;text-align:${align};">${formatNumber(l.qty)}</td>
            <td style="padding:6px 10px;border:1px solid #E3E8F0;text-align:${align};">${escapeHtml(formatCurrency(l.unitPrice))}</td>
            <td style="padding:6px 10px;border:1px solid #E3E8F0;text-align:${align};">${escapeHtml(formatCurrency(l.totalCost))}</td>
          </tr>`
          )
          .join("")}
      </tbody>
    </table>
    <div style="display:flex;justify-content:flex-end;">
      <div style="width:280px;font-size:12px;">
        <div style="display:flex;justify-content:space-between;padding:4px 0;"><span style="color:#64748B;">${escapeHtml(t("po.subtotal"))}</span><span>${escapeHtml(formatCurrency(subtotal))}</span></div>
        <div style="display:flex;justify-content:space-between;padding:4px 0;"><span style="color:#64748B;">${escapeHtml(t("po.vat"))}</span><span>${escapeHtml(formatCurrency(vat))}</span></div>
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-top:2px solid ${headerColor};font-weight:700;font-size:14px;"><span>${escapeHtml(t("po.total"))}</span><span>${escapeHtml(formatCurrency(total))}</span></div>
      </div>
    </div>
  `;

  return renderContainerToPDF(container, po.poNumber, "portrait");
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
  exportPOToPDF(po);
  render();
}

/* ---------- Page ---------- */

function renderPurchasePlanning(initialSource) {
  const app = document.getElementById("app");
  const canCreatePO = ROLE_PERMISSIONS[CURRENT_USER.role].canCreatePO;

  if (initialSource) {
    PP_FILTERS.source = initialSource.toLowerCase() === "manual" ? "Manual" : initialSource.toLowerCase() === "recommended" ? "Recommended" : "All";
  }

  const allRows = getAllPlanningRows();
  const categories = ["All", ...new Set(allRows.map((r) => r.category).filter(Boolean))];
  const suppliers = ["All", ...new Set(allRows.map((r) => r.supplier).filter(Boolean))];
  if (!categories.includes(PP_FILTERS.category)) PP_FILTERS.category = "All";
  if (!suppliers.includes(PP_FILTERS.supplier)) PP_FILTERS.supplier = "All";

  app.innerHTML = `
    <div class="space-y-6">
      <div><h1 class="text-xl font-bold">${t("pp.title")}</h1><p class="text-sm text-erp-muted">${t("pp.subtitle")}</p></div>

      <div class="card p-3 flex flex-wrap gap-2 items-center">
        <div class="flex gap-2" id="ppViewTabs">
          <button data-view="all" class="btn ${PP_VIEW === "all" ? "btn-primary" : ""}">${t("pp.viewAll")}</button>
          <button data-view="category" class="btn ${PP_VIEW === "category" ? "btn-primary" : ""}">${t("pp.viewByCategory")}</button>
          <button data-view="supplier" class="btn ${PP_VIEW === "supplier" ? "btn-primary" : ""}">${t("pp.viewBySupplier")}</button>
        </div>
        <select id="ppFilterSource" class="field-input" style="width:auto">
          <option value="All">${t("pp.filters.allSources")}</option>
          <option value="Recommended">${t("pp.recommended")}</option>
          <option value="Manual">${t("pp.manual")}</option>
        </select>
        <select id="ppFilterCategory" class="field-input" style="width:auto">${categories.map((c) => `<option value="${escapeAttr(c)}">${c === "All" ? t("pp.filters.allCategories") : c}</option>`).join("")}</select>
        <select id="ppFilterSupplier" class="field-input" style="width:auto">${suppliers.map((c) => `<option value="${escapeAttr(c)}">${c === "All" ? t("pp.filters.allSuppliers") : c}</option>`).join("")}</select>
        <select id="ppFilterPriority" class="field-input" style="width:auto">
          <option value="All">${t("pp.filters.allPriorities")}</option>
          ${["Urgent", "High", "Medium", "Low"].map((p) => `<option value="${p}">${t("priority." + p)}</option>`).join("")}
        </select>
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
            <thead><tr><th>${t("pp.poNumber")}</th><th>${t("col.supplier")}</th><th>${t("sup.items")}</th><th>${t("pp.totalCost")}</th><th>${t("pp.expectedDelivery")}</th><th>${t("col.leadTime")}</th><th>${t("pp.status")}</th><th>${t("pp.createdBy")}</th><th>${t("po.actions")}</th></tr></thead>
            <tbody id="poTableBody">${renderPORows()}</tbody>
          </table>
          <p id="poEmpty" class="text-xs text-erp-muted p-4 ${PURCHASE_ORDERS.length ? "hidden" : ""}">${t("pp.noPOs")}</p>
        </div>
      </div>
    </div>
  `;

  document.getElementById("ppFilterSource").value = PP_FILTERS.source;
  document.getElementById("ppFilterCategory").value = PP_FILTERS.category;
  document.getElementById("ppFilterSupplier").value = PP_FILTERS.supplier;
  document.getElementById("ppFilterPriority").value = PP_FILTERS.priority;

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
  ["ppFilterSource", "ppFilterCategory", "ppFilterSupplier", "ppFilterPriority"].forEach((id) => {
    document.getElementById(id).addEventListener("change", (e) => {
      const key = id.replace("ppFilter", "").toLowerCase();
      PP_FILTERS[key] = e.target.value;
      renderPPBody(canCreatePO);
    });
  });

  wirePOActions();
  renderPPBody(canCreatePO);
}

function renderPPBody(canCreatePO) {
  destroyGrid();
  const container = document.getElementById("ppBody");
  const search = PP_SEARCH.trim().toLowerCase();
  let rows = getAllPlanningRows();
  if (PP_FILTERS.source !== "All") rows = rows.filter((r) => r.source === PP_FILTERS.source);
  if (PP_FILTERS.category !== "All") rows = rows.filter((r) => r.category === PP_FILTERS.category);
  if (PP_FILTERS.supplier !== "All") rows = rows.filter((r) => r.supplier === PP_FILTERS.supplier);
  if (PP_FILTERS.priority !== "All") rows = rows.filter((r) => r.priority === PP_FILTERS.priority);
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
      // Generate PO always operates on the checked/selected rows only —
      // never the full filtered list — so partial selections work as expected.
      document.getElementById("ppGeneratePO").addEventListener("click", () => generatePOFromRows(currentGridApi.getSelectedRows()));
    }

    document.getElementById("ppCSV").addEventListener("click", () => exportToCSV(exportPlanningRows(rows), "purchase-planning"));
    document.getElementById("ppExcel").addEventListener("click", () => exportToExcel(exportPlanningRows(rows), "purchase-planning"));
    document.getElementById("ppPDF").addEventListener("click", () => exportToPDF(exportPlanningRows(rows), "purchase-planning", t("pp.title")));
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
            <h3 class="text-sm font-semibold">${escapeHtml(name)}</h3>
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
