/* ============================================================
   Inventory ERP — Dashboard, Inventory, Product Detail, Category
   ============================================================ */

function renderDashboard() {
  const k = DATA.kpis;
  const app = document.getElementById("app");
  const sec = SETTINGS.dashboardSections;

  const kpiHtml = [
    kpiCard(t("kpi.totalItems"), formatNumber(k.totalItems), "package", "navy", "#/inventory"),
    kpiCard(t("kpi.inventoryValue"), formatCurrency(k.inventoryValue), "dollar-sign", "success", "#/inventory"),
    kpiCard(t("kpi.monthlyStockCost"), formatCurrency(k.totalMonthlyStockCost), "wallet", "accent", "#/analytics"),
    kpiCard(t("kpi.monthlyDemand"), formatNumber(k.totalMonthlyDemand), "trending-up", "accent", "#/analytics"),
    kpiCard(t("kpi.avgCoverage"), `${formatNumber(k.avgCoverage)} ${t("pd.days")}`, "activity", "muted", "#/analytics"),
    kpiCard(t("kpi.avgLeadTime"), `${formatNumber(k.avgLeadTime)} ${t("pd.days")}`, "clock", "muted", "#/suppliers"),
    kpiCard(t("kpi.criticalItems"), formatNumber(k.criticalItems), "alert-triangle", "critical", "#/alerts"),
    kpiCard(t("kpi.itemsToOrder"), formatNumber(k.itemsToOrder), "shopping-cart", "warning", "#/purchase-planning"),
    kpiCard(t("kpi.healthyItems"), formatNumber(k.healthyItems), "check-circle-2", "success", "#/inventory?status=" + encodeURIComponent("In Stock")),
    kpiCard(t("kpi.suppliers"), formatNumber(k.suppliers), "truck", "navy", "#/suppliers"),
    kpiCard(t("kpi.paymentRequired"), formatCurrency(k.paymentRequired), "wallet", "warning", "#/purchase-planning"),
    kpiCard(t("kpi.categories"), formatNumber(k.categories), "layout-grid", "navy", "#/inventory"),
  ].join("");

  app.innerHTML = `
    <div class="space-y-6">
      <div><h1 class="text-xl font-bold">${t("dash.title")}</h1><p class="text-sm text-erp-muted">${t("dash.subtitle")} — ${t("dash.clickHint")}</p></div>
      ${sec.kpis ? `<div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">${kpiHtml}</div>` : ""}
      ${
        sec.health || sec.categoryChart
          ? `<div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
        ${sec.health ? `<div class="card p-4 flex flex-col items-center justify-center"><h3 class="text-sm font-semibold mb-2 self-start">${t("dash.healthScore")}</h3>${gaugeSVG(DATA.healthScore)}</div>` : ""}
        ${sec.categoryChart ? `<div class="${sec.health ? "lg:col-span-2" : "lg:col-span-3"} card p-4"><h3 class="text-sm font-semibold mb-2">${t("dash.valueByCategory")}</h3><div id="chartCategory" style="height:320px"></div></div>` : ""}
      </div>`
          : ""
      }
      ${
        sec.statusChart || sec.alerts
          ? `<div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
        ${sec.statusChart ? `<div class="${sec.alerts ? "lg:col-span-2" : "lg:col-span-3"} card p-4"><h3 class="text-sm font-semibold mb-2">${t("dash.itemsByStatus")}</h3><div id="chartStatus" style="height:320px"></div></div>` : ""}
        ${sec.alerts ? `<div class="card p-4"><h3 class="text-sm font-semibold mb-3">${t("dash.recentAlerts")}</h3><div class="space-y-2 max-h-72 overflow-y-auto pr-1">${DATA.alerts.slice(0, 6).map(alertCardHTML).join("") || `<p class="text-xs text-erp-muted">${t("dash.noAlerts")}</p>`}</div></div>` : ""}
      </div>`
          : ""
      }
    </div>
  `;

  if (sec.categoryChart) {
    const chart = echarts.init(document.getElementById("chartCategory"));
    chart.setOption({
      tooltip: { trigger: "item" },
      legend: { bottom: 0, textStyle: { fontSize: 10 } },
      color: [SETTINGS.primaryColor, "#16A34A", "#D97706", "#7C3AED", "#DC2626", "#0EA5E9"],
      series: [{ type: "pie", radius: ["40%", "70%"], data: Object.entries(DATA.analytics.byCategory).map(([name, v]) => ({ name, value: +v.value.toFixed(0) })) }],
    });
    chart.on("click", (params) => {
      const cat = CATEGORY_LIST.find((c) => c.name === params.name);
      if (cat) location.hash = `#/categories/${cat.slug}`;
    });
  }
  if (sec.statusChart) {
    const statusOrder = ["Order Now", "In Stock", "On Order", "Over Stock", "Critical"];
    const chart = echarts.init(document.getElementById("chartStatus"));
    chart.setOption({
      tooltip: { trigger: "axis" },
      xAxis: { type: "category", data: statusOrder.map((s) => t("status." + s)) },
      yAxis: { type: "value" },
      series: [{ type: "bar", data: statusOrder.map((s) => DATA.items.filter((i) => i.orderStatus === s).length), itemStyle: { color: SETTINGS.primaryColor, borderRadius: [6, 6, 0, 0] } }],
    });
    chart.on("click", (params) => {
      location.hash = `#/inventory?status=${encodeURIComponent(statusOrder[params.dataIndex])}`;
    });
  }
}

function renderInventory(initialQuery, initialStatus, initialCategory, initialSupplier) {
  const app = document.getElementById("app");
  const categories = ["All", ...new Set(DATA.items.map((i) => i.category))];
  const suppliers = ["All", ...new Set(DATA.items.map((i) => i.supplier).filter(Boolean))];
  const classifications = ["All", ...new Set(DATA.items.map((i) => i.classification).filter(Boolean))];

  app.innerHTML = `
    <div class="space-y-4">
      <div><h1 class="text-xl font-bold">${t("inv.title")}</h1><p class="text-sm text-erp-muted">${t("inv.subtitle")}</p></div>
      <div class="card p-3 flex flex-wrap gap-2 items-center">
        <div class="relative">
          <i data-lucide="search" style="width:14px;height:14px" class="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"></i>
          <input id="invSearch" value="${escapeAttr(initialQuery || "")}" placeholder="${t("inv.searchPlaceholder")}" class="field-input" style="width:16rem;padding-left:2rem" />
        </div>
        <select id="invCategory" class="field-input" style="width:auto">${categories.map((c) => `<option value="${c}" ${c === initialCategory ? "selected" : ""}>${c === "All" ? t("inv.allCategories") : c}</option>`).join("")}</select>
        <select id="invSupplier" class="field-input" style="width:auto">${suppliers.map((c) => `<option value="${c}" ${c === initialSupplier ? "selected" : ""}>${c === "All" ? t("inv.allSuppliers") : c}</option>`).join("")}</select>
        <select id="invClassification" class="field-input" style="width:auto">${classifications.map((c) => `<option value="${c}">${c === "All" ? t("inv.allClassifications") : c}</option>`).join("")}</select>
        <select id="invCriticality" class="field-input" style="width:auto">${["All", "High", "Medium", "Low"].map((c) => `<option value="${c}">${c === "All" ? t("inv.allCriticality") : t("crit." + c)}</option>`).join("")}</select>
        <select id="invOrderStatus" class="field-input" style="width:auto">${["All", "Order Now", "In Stock", "On Order", "Over Stock", "Critical"].map((c) => `<option value="${c}" ${c === initialStatus ? "selected" : ""}>${c === "All" ? t("inv.allOrderStatus") : t("status." + c)}</option>`).join("")}</select>
        <select id="invBrand" class="field-input" style="width:auto"><option value="All">${t("inv.allBrands")}</option>${BRANDS.map((b) => `<option value="${b}">${b}</option>`).join("")}</select>
        <div class="flex gap-2" style="margin-inline-start:auto">
          <button id="btnCSV" class="btn"><i data-lucide="download" style="width:14px;height:14px"></i> ${t("inv.csv")}</button>
          <button id="btnExcel" class="btn"><i data-lucide="file-spreadsheet" style="width:14px;height:14px"></i> ${t("inv.excel")}</button>
          <button id="btnPDF" class="btn"><i data-lucide="file-text" style="width:14px;height:14px"></i> ${t("inv.pdf")}</button>
        </div>
      </div>
      <div id="grid" class="ag-theme-quartz rounded-xl2 overflow-hidden border border-erp-border shadow-card" style="height:640px;width:100%"></div>
      <div id="invCount" class="text-xs text-erp-muted"></div>
    </div>
  `;

  createInventoryGrid("grid", DATA.items);
  currentGridApi.setGridOption("quickFilterText", initialQuery || "");
  if (initialStatus && initialStatus !== "All") document.getElementById("invOrderStatus").value = initialStatus;
  if (initialCategory && initialCategory !== "All") document.getElementById("invCategory").value = initialCategory;
  if (initialSupplier && initialSupplier !== "All") document.getElementById("invSupplier").value = initialSupplier;

  function computeFiltered() {
    const category = document.getElementById("invCategory").value;
    const supplier = document.getElementById("invSupplier").value;
    const classification = document.getElementById("invClassification").value;
    const criticality = document.getElementById("invCriticality").value;
    const orderStatus = document.getElementById("invOrderStatus").value;
    const brand = document.getElementById("invBrand").value;
    return DATA.items.filter((i) => {
      if (category !== "All" && i.category !== category) return false;
      if (supplier !== "All" && i.supplier !== supplier) return false;
      if (classification !== "All" && i.classification !== classification) return false;
      if (criticality !== "All" && i.criticality !== criticality) return false;
      if (orderStatus !== "All" && i.orderStatus !== orderStatus) return false;
      if (brand !== "All" && !i.brands[brand]) return false;
      return true;
    });
  }
  function refresh() {
    const filtered = computeFiltered();
    currentGridApi.setGridOption("rowData", filtered);
    currentGridApi.setGridOption("quickFilterText", document.getElementById("invSearch").value);
    document.getElementById("invCount").textContent = `${filtered.length} ${t("inv.of")} ${DATA.items.length} ${t("inv.itemsShown")}`;
  }
  ["invCategory", "invSupplier", "invClassification", "invCriticality", "invOrderStatus", "invBrand"].forEach((id) => {
    document.getElementById(id).addEventListener("change", refresh);
  });
  document.getElementById("invSearch").addEventListener("input", refresh);

  function exportRows() {
    return computeFiltered().map((i) => ({
      "Item Code": i.itemCode, Description: i.description, Category: i.category, Supplier: i.supplier,
      "Monthly Demand": i.monthlyDemand, "Current Stocks": i.currentStocks, Coverage: i.coverage,
      "Order Status": i.orderStatus, Criticality: i.criticality, "Min Stock": i.minStockLevel, "Max Stock": i.maxStockLevel,
      "Order QTY": i.orderQty, "Lead Time": i.leadTime, Classification: i.classification,
      "Price (excl VAT)": i.price, "Price (incl VAT)": +withVat(i.price).toFixed(2),
      "Inventory Value": i.inventoryValue, "Monthly Stock Cost": i.monthlyStockCost, "Payment Required": i.paymentToReachOptimum,
    }));
  }
  document.getElementById("btnCSV").addEventListener("click", () => exportToCSV(exportRows(), "inventory"));
  document.getElementById("btnExcel").addEventListener("click", () => exportToExcel(exportRows(), "inventory"));
  document.getElementById("btnPDF").addEventListener("click", () => exportToPDF(exportRows(), "inventory", "Inventory Report"));
  refresh();
}

function renderProductDetail(itemCode) {
  const app = document.getElementById("app");
  const item = DATA.items.find((i) => i.itemCode === itemCode);
  if (!item) {
    app.innerHTML = `<div class="space-y-4"><a href="#/inventory" class="inline-flex items-center gap-1 text-sm text-erp-accent"><i data-lucide="arrow-left" style="width:14px;height:14px"></i> ${t("pd.back")}</a><p class="text-sm text-erp-muted">"${itemCode}" ${t("pd.notFound")}</p></div>`;
    return;
  }
  const stockPct = item.maxStockLevel > 0 ? Math.min(100, Math.round((item.currentStocks / item.maxStockLevel) * 100)) : 0;
  const brandsUsed = BRANDS.filter((b) => item.brands[b]);
  const orderHistory = getOrderedByMap()[item.itemCode] || [];

  app.innerHTML = `
    <div class="space-y-6">
      <a href="#/inventory" class="inline-flex items-center gap-1 text-sm text-erp-accent"><i data-lucide="arrow-left" style="width:14px;height:14px"></i> ${t("pd.back")}</a>

      <div class="flex flex-wrap items-start justify-between gap-3">
        <div><h1 class="text-xl font-bold">${item.description}</h1><p class="text-sm text-erp-muted">${item.itemCode} &middot; ${item.category}</p></div>
        <div class="flex gap-2">${statusBadgeHTML(item.orderStatus)}${criticalityBadgeHTML(item.criticality)}</div>
      </div>

      <p class="text-sm text-slate-600 dark:text-slate-300 card p-4">${item.itemDescription}</p>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="card p-4 space-y-2">
          <h3 class="text-sm font-semibold mb-1">${t("pd.stockCoverage")}</h3>
          ${detailRow(t("pd.currentStock"), formatNumber(item.currentStocks))}
          ${detailRow(t("pd.minimumStock"), formatNumber(item.minStockLevel))}
          ${detailRow(t("pd.maximumStock"), formatNumber(item.maxStockLevel))}
          <div class="mt-2"><div class="h-2 rounded-full bg-slate-100 overflow-hidden"><div class="h-full bg-erp-accent" style="width:${stockPct}%"></div></div><p class="text-[11px] text-erp-muted mt-1">${stockPct}${t("pd.maxLevelPct")}</p></div>
          ${detailRow(t("pd.monthlyDemand"), formatNumber(item.monthlyDemand))}
          ${detailRow(t("pd.coverage"), `${formatNumber(item.coverage)} ${t("pd.days")}`)}
          ${detailRow(t("pd.orderQty"), formatNumber(item.orderQty))}
          ${detailRow(t("pd.leadTime"), `${formatNumber(item.leadTime)} ${t("pd.days")}`)}
        </div>

        <div class="card p-4 space-y-2">
          <h3 class="text-sm font-semibold mb-1">${t("pd.financials")}</h3>
          ${detailRow(t("pd.unitPriceExcl"), formatCurrency(item.price))}
          ${detailRow(t("pd.unitPriceIncl"), formatCurrency(withVat(item.price)))}
          ${detailRow(t("pd.inventoryValue"), formatCurrency(item.inventoryValue))}
          ${detailRow(t("pd.monthlyStockCost"), formatCurrency(item.monthlyStockCost))}
          ${detailRow(t("pd.paymentRequired"), formatCurrency(item.paymentToReachOptimum))}
          ${detailRow(t("pd.classification"), item.classification)}
          ${detailRow(t("pd.abcClass"), item.abcClass)}
          ${detailRow(t("pd.xyzClass"), item.xyzClass)}
          ${detailRow(t("pd.fsnClass"), item.fsnClass)}
        </div>

        <div class="card p-4 space-y-2">
          <h3 class="text-sm font-semibold mb-1">${t("pd.supplierBrands")}</h3>
          ${detailRow(t("pd.supplier"), item.supplier || t("pd.notAssigned"))}
          ${detailRow(t("pd.usedByBrands"), formatNumber(item.usedByBrands))}
          <div class="flex flex-wrap gap-1.5 mt-2">
            ${brandsUsed.map((b) => `<span class="text-[11px] font-medium bg-erp-navy/10 text-erp-navy px-2 py-1 rounded-full">${b}</span>`).join("") || `<span class="text-xs text-erp-muted">${t("pd.noBrandsAssigned")}</span>`}
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="card p-4 space-y-3">
          <h3 class="text-sm font-semibold">${t("pd.orderThisItem")}</h3>
          <label class="block"><span class="block text-xs text-erp-muted mb-1">${t("pd.qtyOptional")}</span>
            <input id="orderQtyInput" type="number" min="1" class="field-input" placeholder="${item.orderQty || ""}" />
          </label>
          <button id="addToOrderBtn" class="btn btn-primary"><i data-lucide="shopping-cart" style="width:14px;height:14px"></i> ${t("pd.addToOrderList")}</button>
          <div id="orderAddMsg"></div>
        </div>
        <div class="card p-4">
          <h3 class="text-sm font-semibold mb-2">${t("pd.orderHistory")}</h3>
          ${orderHistory.length ? miniTable(orderHistory, [["poNumber", t("pd.poNumberCol")], ["orderedBy", t("pd.orderedByCol")], ["orderedAt", t("pd.dateCol"), formatDate], ["qty", t("pd.qtyCol"), formatNumber]]) : `<p class="text-xs text-erp-muted">${t("pd.noOrderHistory")}</p>`}
        </div>
      </div>
    </div>
  `;

  document.getElementById("addToOrderBtn").addEventListener("click", () => {
    const val = Number(document.getElementById("orderQtyInput").value);
    addToOrderCart(item, val);
    document.getElementById("orderAddMsg").innerHTML = `<div class="text-sm bg-green-50 border border-green-200 text-green-700 rounded-lg px-3 py-2 mt-2">${t("pd.addedToOrderList")}</div>`;
    renderShell(parseHash());
  });
}

function renderCategory(slug) {
  const app = document.getElementById("app");
  const meta = CATEGORY_BY_SLUG[slug];
  if (!meta) {
    app.innerHTML = '<p class="text-sm text-erp-muted">Unknown category.</p>';
    return;
  }
  const items = DATA.items.filter((i) => i.categorySlug === slug);
  const itemsCount = items.length;
  const inventoryValue = items.reduce((s, i) => s + i.inventoryValue, 0);
  const monthlyDemand = items.reduce((s, i) => s + i.monthlyDemand, 0);
  const currentStock = items.reduce((s, i) => s + i.currentStocks, 0);
  const avgCoverage = items.length ? items.reduce((s, i) => s + i.coverage, 0) / items.length : 0;
  const criticalItems = items.filter((i) => i.orderStatus === "Critical").length;
  const itemsToOrder = items.filter((i) => i.orderStatus === "Order Now" || i.orderStatus === "Critical").length;
  const supplierMap = {};
  items.forEach((i) => {
    if (!i.supplier) return;
    supplierMap[i.supplier] = (supplierMap[i.supplier] || 0) + i.inventoryValue;
  });

  const suppliers = ["All", ...new Set(items.map((i) => i.supplier).filter(Boolean))];

  app.innerHTML = `
    <div class="space-y-6">
      <div><h1 class="text-xl font-bold">${t("nav." + slug)}</h1><p class="text-sm text-erp-muted">${t("cat.subtitle")}</p></div>
      <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        ${kpiCard(t("kpi.itemsCount"), formatNumber(itemsCount), "package", "navy")}
        ${kpiCard(t("kpi.inventoryValue"), formatCurrency(inventoryValue), "dollar-sign", "success")}
        ${kpiCard(t("kpi.monthlyDemand"), formatNumber(monthlyDemand), "trending-up", "accent")}
        ${kpiCard(t("kpi.currentStock"), formatNumber(currentStock), "boxes", "muted")}
        ${kpiCard(t("kpi.avgCoverage"), `${formatNumber(avgCoverage)} ${t("pd.days")}`, "activity", "muted")}
        ${kpiCard(t("kpi.criticalItems"), formatNumber(criticalItems), "alert-triangle", "critical")}
        ${kpiCard(t("kpi.itemsToOrder"), formatNumber(itemsToOrder), "shopping-cart", "warning")}
      </div>
      <div class="card p-4"><h3 class="text-sm font-semibold mb-2">${t("cat.valueBySupplier")}</h3><div id="chartCatSupplier" style="height:320px"></div></div>

      <div class="card p-3 flex flex-wrap gap-2 items-center">
        <div class="relative">
          <i data-lucide="search" style="width:14px;height:14px" class="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"></i>
          <input id="catSearch" placeholder="${t("inv.searchPlaceholder")}" class="field-input" style="width:16rem;padding-left:2rem" />
        </div>
        <select id="catSupplier" class="field-input" style="width:auto">${suppliers.map((c) => `<option value="${escapeAttr(c)}">${c === "All" ? t("inv.allSuppliers") : c}</option>`).join("")}</select>
        <select id="catCriticality" class="field-input" style="width:auto">${["All", "High", "Medium", "Low"].map((c) => `<option value="${c}">${c === "All" ? t("inv.allCriticality") : t("crit." + c)}</option>`).join("")}</select>
        <select id="catOrderStatus" class="field-input" style="width:auto">${["All", "Order Now", "In Stock", "On Order", "Over Stock", "Critical"].map((c) => `<option value="${c}">${c === "All" ? t("inv.allOrderStatus") : t("status." + c)}</option>`).join("")}</select>
        <select id="catBrand" class="field-input" style="width:auto"><option value="All">${t("inv.allBrands")}</option>${BRANDS.map((b) => `<option value="${b}">${b}</option>`).join("")}</select>
      </div>
      <div id="grid" class="ag-theme-quartz rounded-xl2 overflow-hidden border border-erp-border shadow-card" style="height:560px;width:100%"></div>
      <div id="catCount" class="text-xs text-erp-muted"></div>
    </div>
  `;
  echarts.init(document.getElementById("chartCatSupplier")).setOption({
    tooltip: { trigger: "item" },
    legend: { bottom: 0, textStyle: { fontSize: 10 } },
    series: [{ type: "pie", radius: ["40%", "70%"], data: Object.entries(supplierMap).map(([name, value]) => ({ name, value: +value.toFixed(0) })) }],
  });

  createInventoryGrid("grid", items);

  function computeFiltered() {
    const supplier = document.getElementById("catSupplier").value;
    const criticality = document.getElementById("catCriticality").value;
    const orderStatus = document.getElementById("catOrderStatus").value;
    const brand = document.getElementById("catBrand").value;
    return items.filter((i) => {
      if (supplier !== "All" && i.supplier !== supplier) return false;
      if (criticality !== "All" && i.criticality !== criticality) return false;
      if (orderStatus !== "All" && i.orderStatus !== orderStatus) return false;
      if (brand !== "All" && !i.brands[brand]) return false;
      return true;
    });
  }
  function refresh() {
    const filtered = computeFiltered();
    currentGridApi.setGridOption("rowData", filtered);
    currentGridApi.setGridOption("quickFilterText", document.getElementById("catSearch").value);
    document.getElementById("catCount").textContent = `${filtered.length} ${t("inv.of")} ${items.length} ${t("inv.itemsShown")}`;
  }
  ["catSupplier", "catCriticality", "catOrderStatus", "catBrand"].forEach((id) => {
    document.getElementById(id).addEventListener("change", refresh);
  });
  document.getElementById("catSearch").addEventListener("input", refresh);
  refresh();
}
