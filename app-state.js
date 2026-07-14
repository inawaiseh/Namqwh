/* ============================================================
   Inventory ERP — global state, persistence, formatting, and
   shared UI-building helpers. Loaded before the page renderers.
   ============================================================ */

const ROLES = ["Admin", "Inventory Manager", "Warehouse", "Purchasing", "Viewer"];
const ROLE_PERMISSIONS = {
  Admin: { canCreatePO: true, canEditSettings: true },
  "Inventory Manager": { canCreatePO: true, canEditSettings: false },
  Warehouse: { canCreatePO: false, canEditSettings: false },
  Purchasing: { canCreatePO: true, canEditSettings: false },
  Viewer: { canCreatePO: false, canEditSettings: false },
};
const PRIORITY_COLORS = {
  Urgent: "bg-red-100 text-red-700",
  High: "bg-amber-100 text-amber-700",
  Medium: "bg-blue-100 text-blue-700",
  Low: "bg-slate-100 text-slate-700",
};
const CATEGORY_LINKS = [
  { slug: "consumables", icon: "sparkles" },
  { slug: "packaging-materials", icon: "box" },
  { slug: "raw-materials", icon: "wheat" },
  { slug: "fixed-assets", icon: "wrench" },
  { slug: "green-beans", icon: "coffee" },
  { slug: "finished-products", icon: "package-check" },
];

/* ---------- Settings ---------- */

const defaultSettings = {
  dashboardTitle: "Inventory ERP",
  companyLogo: "",
  sharePointUrl: "https://company.sharepoint.com/sites/Inventory/Shared Documents/Master.xlsx",
  worksheetName: "Master File July-26",
  proxyUrl: "",
  refreshIntervalSeconds: 60,
  dataSource: "sample",
  locale: "en",
  primaryColor: "#2E6BE6",
  headerColor: "#0B2545",
  fontColor: "#0f172a",
  dashboardSections: { kpis: true, health: true, categoryChart: true, statusChart: true, alerts: true },
};

function loadSettings() {
  try {
    const parsed = JSON.parse(localStorage.getItem("erp-settings") || "{}");
    return {
      ...defaultSettings,
      ...parsed,
      dashboardSections: { ...defaultSettings.dashboardSections, ...(parsed.dashboardSections || {}) },
    };
  } catch {
    return { ...defaultSettings };
  }
}
function saveSettingsToStorage(s) {
  localStorage.setItem("erp-settings", JSON.stringify(s));
}

/* ---------- Users / auth ---------- */

const DEFAULT_USERS = [{ name: "Admin", email: "Admin@namq.com", password: "123456", role: "Admin" }];
function loadUsers() {
  try {
    const u = JSON.parse(localStorage.getItem("erp-users") || "null");
    return u && u.length ? u : DEFAULT_USERS.map((x) => ({ ...x }));
  } catch {
    return DEFAULT_USERS.map((x) => ({ ...x }));
  }
}
function saveUsers() {
  localStorage.setItem("erp-users", JSON.stringify(USERS));
}
function loadCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem("erp-current-user") || "null");
  } catch {
    return null;
  }
}
function saveCurrentUser(u) {
  if (u) localStorage.setItem("erp-current-user", JSON.stringify(u));
  else localStorage.removeItem("erp-current-user");
}

/* ---------- Purchase orders / order cart ---------- */

function loadPOs() {
  try {
    return JSON.parse(localStorage.getItem("erp-pos") || "[]");
  } catch {
    return [];
  }
}
function savePOs() {
  localStorage.setItem("erp-pos", JSON.stringify(PURCHASE_ORDERS));
}
function loadCart() {
  try {
    return JSON.parse(localStorage.getItem("erp-order-cart") || "[]");
  } catch {
    return [];
  }
}
function saveCart() {
  localStorage.setItem("erp-order-cart", JSON.stringify(ORDER_CART));
}

/* ---------- Global state ---------- */

let SETTINGS = loadSettings();
let USERS = loadUsers();
let CURRENT_USER = loadCurrentUser();
let THEME = localStorage.getItem("erp-theme") || "light";
let PURCHASE_ORDERS = loadPOs();
let ORDER_CART = loadCart();
let DATA = buildAppData(42);
let currentGridApi = null;
let autoRefreshTimer = null;
let PP_VIEW = "all";
let PP_SEARCH = "";

function applyTheme(theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}
function setTheme(theme) {
  THEME = theme;
  localStorage.setItem("erp-theme", theme);
  applyTheme(theme);
}
function applyAppearance() {
  const root = document.documentElement;
  root.style.setProperty("--erp-accent", SETTINGS.primaryColor || defaultSettings.primaryColor);
  root.style.setProperty("--erp-navy", SETTINGS.headerColor || defaultSettings.headerColor);
  root.style.setProperty("--erp-font", SETTINGS.fontColor || defaultSettings.fontColor);
}

/* ---------- Formatting helpers ---------- */

function formatCurrency(n, decimals = 0) {
  if (n === undefined || n === null || isNaN(n)) return "-";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "SAR", maximumFractionDigits: decimals }).format(n);
  } catch (e) {
    return `SAR ${formatNumber(n, decimals)}`;
  }
}
function withVat(n) {
  return n * (1 + VAT_RATE);
}
function formatNumber(n, decimals = 0) {
  if (n === undefined || n === null || isNaN(n)) return "-";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: decimals, minimumFractionDigits: decimals }).format(n);
}
function formatDate(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" });
}
function escapeAttr(s) {
  return String(s ?? "").replace(/"/g, "&quot;");
}

/* ---------- Small UI builders ---------- */

function kpiCard(title, value, icon, tone, href) {
  const toneClasses = {
    navy: "bg-erp-navy/10 text-erp-navy",
    accent: "bg-blue-100 text-erp-accent",
    success: "bg-green-100 text-erp-success",
    warning: "bg-amber-100 text-erp-warning",
    critical: "bg-red-100 text-erp-critical",
    muted: "bg-slate-100 text-erp-muted",
  };
  const inner = `
    <div class="flex items-center justify-between mb-3">
      <div class="h-9 w-9 rounded-lg flex items-center justify-center ${toneClasses[tone] || toneClasses.accent}">
        <i data-lucide="${icon}" style="width:18px;height:18px"></i>
      </div>
    </div>
    <div class="text-2xl font-bold leading-tight">${value}</div>
    <div class="text-xs text-erp-muted mt-1">${title}</div>
  `;
  if (href) return `<a href="${href}" class="card p-4 block hover:shadow-cardHover transition-shadow">${inner}</a>`;
  return `<div class="card p-4">${inner}</div>`;
}

function gaugeSVG(value) {
  const clamped = Math.max(0, Math.min(100, value));
  const angle = (clamped / 100) * 180;
  const color = clamped >= 75 ? "#16A34A" : clamped >= 50 ? "#D97706" : "#DC2626";
  const r = 80, cx = 100, cy = 100;
  const toRad = (d) => (Math.PI * d) / 180;
  const endX = cx - r * Math.cos(toRad(angle));
  const endY = cy - r * Math.sin(toRad(angle));
  const largeArc = angle > 180 ? 1 : 0;
  return `<div class="flex flex-col items-center">
    <svg width="200" height="120" viewBox="0 0 200 120">
      <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#E2E8F0" stroke-width="16" stroke-linecap="round"/>
      <path d="M 20 100 A 80 80 0 ${largeArc} 1 ${endX} ${endY}" fill="none" stroke="${color}" stroke-width="16" stroke-linecap="round"/>
      <text x="100" y="95" text-anchor="middle" font-size="28" font-weight="700" fill="#1e293b">${Math.round(clamped)}</text>
    </svg>
    <div class="text-xs text-erp-muted -mt-1">${t("dash.outOf100")}</div>
  </div>`;
}

function statusBadgeHTML(status) {
  return `<span class="badge ${STATUS_COLORS[status] || "bg-slate-100 text-slate-700 border-slate-300"}">${t("status." + status)}</span>`;
}
function criticalityBadgeHTML(level) {
  return `<span class="badge ${CRITICALITY_COLORS[level] || "bg-slate-100 text-slate-700"}">${t("crit." + level)}</span>`;
}
function alertCardHTML(a) {
  const styles = {
    critical: { border: "border-red-300", bg: "bg-red-50", icon: "alert-octagon", color: "text-erp-critical" },
    warning: { border: "border-amber-300", bg: "bg-amber-50", icon: "alert-triangle", color: "text-erp-warning" },
    info: { border: "border-blue-300", bg: "bg-blue-50", icon: "info", color: "text-erp-info" },
  };
  const s = styles[a.severity];
  return `<div class="rounded-xl2 border ${s.border} ${s.bg} p-3 flex items-start gap-3">
    <i data-lucide="${s.icon}" style="width:18px;height:18px" class="mt-0.5 shrink-0 ${s.color}"></i>
    <div class="min-w-0">
      <div class="text-xs font-semibold uppercase tracking-wide text-slate-500">${a.type}</div>
      <div class="text-sm text-slate-800">${a.message}</div>
      ${a.itemCode ? `<a href="#/inventory/${a.itemCode}" class="text-xs text-erp-accent font-medium hover:underline">View item &rarr;</a>` : ""}
    </div>
  </div>`;
}
function msgBox(text, kind) {
  const styles = {
    info: "bg-blue-50 border-blue-200 text-blue-700",
    success: "bg-green-50 border-green-200 text-green-700",
    warning: "bg-amber-50 border-amber-200 text-amber-800",
    error: "bg-red-50 border-red-200 text-red-700",
  };
  return `<div class="text-sm border rounded-lg px-3 py-2 ${styles[kind] || styles.info}">${text}</div>`;
}
function detailRow(label, value) {
  return `<div class="flex items-center justify-between text-sm"><span class="text-erp-muted">${label}</span><span class="font-medium">${value}</span></div>`;
}
function miniTable(rows, columns) {
  return `<table class="erp-table text-xs">
    <thead><tr>${columns.map((c) => `<th>${c[1]}</th>`).join("")}</tr></thead>
    <tbody>${rows
      .map((r) => `<tr>${columns.map((c) => `<td>${c[2] ? c[2](r[c[0]]) : r[c[0]]}</td>`).join("")}</tr>`)
      .join("")}</tbody>
  </table>`;
}
function chartCardShell(id, title) {
  return `<div class="card p-4"><h3 class="text-sm font-semibold mb-2">${title}</h3><div id="${id}" style="height:320px"></div></div>`;
}

/* ---------- Export helpers ---------- */

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
function exportToCSV(rows, filename) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(ws);
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8;" }), `${filename}.csv`);
}
function exportToExcel(rows, filename) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Export");
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  downloadBlob(new Blob([buf], { type: "application/octet-stream" }), `${filename}.xlsx`);
}
function exportToPDF(rows, filename, title) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(14);
  doc.text(title || "Report", 14, 15);
  if (rows.length > 0) {
    const columns = Object.keys(rows[0]);
    const body = rows.map((r) => columns.map((c) => String(r[c] ?? "")));
    doc.autoTable({ head: [columns], body, startY: 20, styles: { fontSize: 7 }, headStyles: { fillColor: [11, 37, 69] } });
  }
  doc.save(`${filename}.pdf`);
}

/* ---------- Order attribution ---------- */

function getOrderedByMap() {
  const map = {};
  PURCHASE_ORDERS.forEach((po) => {
    po.lines.forEach((line) => {
      if (!map[line.itemCode]) map[line.itemCode] = [];
      map[line.itemCode].push({ poNumber: po.poNumber, orderedBy: po.createdBy || "-", orderedAt: po.createdAt, qty: line.qty });
    });
  });
  Object.keys(map).forEach((k) => map[k].sort((a, b) => new Date(b.orderedAt) - new Date(a.orderedAt)));
  return map;
}
function addToOrderCart(item, qty) {
  const finalQty = qty && qty > 0 ? qty : item.orderQty || Math.ceil(item.monthlyDemand * 1.5) || 1;
  const existing = ORDER_CART.find((c) => c.itemCode === item.itemCode);
  if (existing) existing.qty = finalQty;
  else
    ORDER_CART.push({
      itemCode: item.itemCode,
      description: item.description,
      supplier: item.supplier,
      category: item.category,
      price: item.price,
      qty: finalQty,
      addedAt: new Date().toISOString(),
    });
  saveCart();
}

/* ---------- AG Grid helpers ---------- */

function destroyGrid() {
  if (currentGridApi) {
    try {
      currentGridApi.destroy();
    } catch (e) {}
    currentGridApi = null;
  }
}
function createGridGeneric(containerId, items, columnDefs, extra) {
  destroyGrid();
  currentGridApi = agGrid.createGrid(document.getElementById(containerId), {
    rowData: items,
    columnDefs,
    defaultColDef: { sortable: true, filter: true, resizable: true },
    pagination: true,
    paginationPageSize: 50,
    paginationPageSizeSelector: [25, 50, 100, 200],
    animateRows: true,
    rowHeight: 40,
    headerHeight: 42,
    ...(extra || {}),
  });
  return currentGridApi;
}
function inventoryColumnDefs(orderedByMap) {
  orderedByMap = orderedByMap || {};
  return [
    { headerName: t("col.itemCode"), field: "itemCode", pinned: "left", width: 130, cellRenderer: (p) => `<a href="#/inventory/${p.value}" class="text-erp-accent font-semibold hover:underline">${p.value}</a>` },
    { headerName: t("col.description"), field: "description", width: 200 },
    { headerName: t("col.category"), field: "category", width: 150 },
    { headerName: t("col.supplier"), field: "supplier", width: 170 },
    { headerName: t("col.monthlyDemand"), field: "monthlyDemand", width: 130, valueFormatter: (p) => formatNumber(p.value) },
    { headerName: t("col.currentStocks"), field: "currentStocks", width: 130, valueFormatter: (p) => formatNumber(p.value) },
    { headerName: t("col.coverage"), field: "coverage", width: 120, valueFormatter: (p) => formatNumber(p.value) },
    {
      headerName: t("col.orderStatus"),
      field: "orderStatus",
      width: 160,
      cellRenderer: (p) => {
        const badge = statusBadgeHTML(p.value);
        const orders = orderedByMap[p.data.itemCode];
        if (orders && orders.length) return `${badge} <span class="badge bg-indigo-100 text-indigo-700" title="${escapeAttr(orders[0].orderedBy)}">PO</span>`;
        return badge;
      },
    },
    { headerName: t("col.criticality"), field: "criticality", width: 110, cellRenderer: (p) => criticalityBadgeHTML(p.value) },
    { headerName: t("col.minStock"), field: "minStockLevel", width: 100, valueFormatter: (p) => formatNumber(p.value) },
    { headerName: t("col.maxStock"), field: "maxStockLevel", width: 100, valueFormatter: (p) => formatNumber(p.value) },
    { headerName: t("col.orderQty"), field: "orderQty", width: 100, valueFormatter: (p) => formatNumber(p.value) },
    { headerName: t("col.leadTime"), field: "leadTime", width: 110, valueFormatter: (p) => formatNumber(p.value) },
    { headerName: t("col.classification"), field: "classification", width: 130 },
    { headerName: t("col.abc"), field: "abcClass", width: 70 },
    { headerName: t("col.xyz"), field: "xyzClass", width: 70 },
    { headerName: t("col.priceExclVat"), field: "price", colId: "priceExcl", width: 140, valueFormatter: (p) => formatCurrency(p.value) },
    { headerName: t("col.priceInclVat"), field: "price", colId: "priceIncl", width: 150, valueFormatter: (p) => formatCurrency(withVat(p.value)) },
    { headerName: t("col.inventoryValue"), field: "inventoryValue", width: 140, valueFormatter: (p) => formatCurrency(p.value) },
    { headerName: t("col.monthlyStockCost"), field: "monthlyStockCost", width: 150, valueFormatter: (p) => formatCurrency(p.value) },
    { headerName: t("col.paymentRequired"), field: "paymentToReachOptimum", width: 150, valueFormatter: (p) => formatCurrency(p.value) },
    { headerName: t("col.orderedBy"), field: "itemCode", colId: "orderedBy", width: 150, valueGetter: (p) => (orderedByMap[p.data.itemCode] ? orderedByMap[p.data.itemCode][0].orderedBy : "-") },
  ];
}
function createInventoryGrid(containerId, items) {
  return createGridGeneric(containerId, items, inventoryColumnDefs(getOrderedByMap()));
}
