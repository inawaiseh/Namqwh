/* ============================================================
   Inventory ERP — Live Excel data source
   Fetches a real Excel file (SharePoint / OneDrive shareable
   link) directly in the browser, parses it with SheetJS, and
   maps rows onto the same item shape the sample generator uses,
   so every downstream page (dashboard, grid, analytics, etc.)
   works unchanged regardless of where the data came from.
   ============================================================ */

const EXCEL_HEADER_ALIASES = {
  itemcode: "itemCode", item_code: "itemCode", code: "itemCode", sku: "itemCode",
  description: "description", itemdescription: "description", name: "description", itemname: "description",
  category: "category",
  supplier: "supplier", vendor: "supplier", supplierName: "supplier",
  monthlydemand: "monthlyDemand", demand: "monthlyDemand", monthlyusage: "monthlyDemand", avgmonthlydemand: "monthlyDemand",
  currentstock: "currentStocks", currentstocks: "currentStocks", stock: "currentStocks", onhand: "currentStocks", qtyonhand: "currentStocks", stockonhand: "currentStocks",
  minstock: "minStockLevel", minstocklevel: "minStockLevel", minimumstock: "minStockLevel", minlevel: "minStockLevel",
  maxstock: "maxStockLevel", maxstocklevel: "maxStockLevel", maximumstock: "maxStockLevel", maxlevel: "maxStockLevel",
  orderqty: "orderQty", reorderqty: "orderQty", orderquantity: "orderQty",
  leadtime: "leadTime", leadtimedays: "leadTime", supplierleadtime: "leadTime",
  price: "price", unitprice: "price", cost: "price", unitcost: "price",
  classification: "classification", itemclassification: "classification",
  brands: "brandsRaw", usedby: "brandsRaw", usedbybrands: "brandsRaw",
};

function normalizeHeader(h) {
  return String(h || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isCheckmarkValue(v) {
  if (v === null || v === undefined) return false;
  const s = String(v).trim().toLowerCase();
  return ["✓", "✔", "√", "yes", "y", "true", "1"].includes(s);
}

function mapExcelRowToRawItem(row) {
  const mapped = {};
  Object.keys(row).forEach((key) => {
    const canon = EXCEL_HEADER_ALIASES[normalizeHeader(key)];
    if (canon) mapped[canon] = row[key];
  });

  const itemCode = String(mapped.itemCode || "").trim();
  if (!itemCode) return null;

  const description = String(mapped.description || itemCode).trim();
  const monthlyDemand = Number(mapped.monthlyDemand) || 0;
  const currentStocks = Number(mapped.currentStocks) || 0;
  const leadTime = Number(mapped.leadTime) || 14;
  const price = Number(mapped.price) || 0;
  const minStockLevel = mapped.minStockLevel !== undefined && mapped.minStockLevel !== "" ? Number(mapped.minStockLevel) : Math.round(monthlyDemand * 0.5);
  const maxStockLevel = mapped.maxStockLevel !== undefined && mapped.maxStockLevel !== "" ? Number(mapped.maxStockLevel) : Math.round(monthlyDemand * 2.5);
  const orderQty = mapped.orderQty !== undefined && mapped.orderQty !== "" ? Number(mapped.orderQty) : Math.max(0, maxStockLevel - currentStocks);
  const supplier = String(mapped.supplier || "").trim();
  const classification = String(mapped.classification || "Standard").trim();

  const coverage = monthlyDemand > 0 ? +((currentStocks / (monthlyDemand / 30)) || 0).toFixed(1) : 0;
  const orderStatus = statusFromCoverage(coverage, leadTime, currentStocks);
  const criticality = orderStatus === "Critical" ? "High" : orderStatus === "Order Now" ? "Medium" : orderStatus === "Over Stock" ? "Low" : "Medium";

  const derivedCat = categoryFromItemCode(itemCode);
  const cat = mapped.category
    ? { name: String(mapped.category).trim(), code: derivedCat.code, slug: String(mapped.category).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || derivedCat.slug }
    : derivedCat;

  const paymentToReachOptimum = +(price * Math.max(0, maxStockLevel - currentStocks)).toFixed(2);
  const monthlyStockCost = +(price * monthlyDemand).toFixed(2);

  const brands = {};
  BRANDS.forEach((b) => (brands[b] = false));
  // Preferred format: one column per brand (header = brand name), marked
  // with a checkmark (✓, or ✔/√/yes/y/true/1) for items used by that brand.
  Object.keys(row).forEach((key) => {
    const matchedBrand = BRANDS.find((b) => b.toLowerCase() === String(key).trim().toLowerCase());
    if (matchedBrand && isCheckmarkValue(row[key])) brands[matchedBrand] = true;
  });
  // Fallback: a single combined "Brands"/"Used By" column, comma-separated.
  if (mapped.brandsRaw) {
    String(mapped.brandsRaw)
      .split(/[,;/]/)
      .map((s) => s.trim())
      .forEach((b) => {
        const found = BRANDS.find((x) => x.toLowerCase() === b.toLowerCase());
        if (found) brands[found] = true;
      });
  }
  const usedByBrands = Object.values(brands).filter(Boolean).length;

  return {
    itemCode,
    description,
    itemDescription: description,
    brands,
    usedByBrands,
    monthlyDemand,
    currentStocks,
    coverage,
    orderStatus,
    criticality,
    minStockLevel,
    maxStockLevel,
    orderQty,
    leadTime,
    classification,
    price,
    supplier,
    paymentToReachOptimum,
    monthlyStockCost,
    category: cat.name,
    categoryCode: cat.code,
    categorySlug: cat.slug,
  };
}

function mapExcelRowsToRawItems(rows) {
  return rows.map(mapExcelRowToRawItem).filter(Boolean);
}

/* ---------- URL handling ---------- */

function toDirectDownloadUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    const host = u.hostname.toLowerCase();
    if (host.includes("sharepoint.com") || host.includes("onedrive.live.com") || host.includes("1drv.ms")) {
      if (!u.searchParams.has("download")) u.searchParams.set("download", "1");
      return u.toString();
    }
    // Generic hosts (e.g. raw.githubusercontent.com): add a cache-busting
    // param so updates to the file are picked up immediately instead of
    // being served stale from a CDN/browser cache for several minutes.
    u.searchParams.set("_cb", Date.now().toString());
    return u.toString();
  } catch {
    return rawUrl;
  }
}

/* ---------- Fetch + parse ---------- */

function buildFetchTarget(rawUrl) {
  const proxy = (SETTINGS.proxyUrl || "").trim();
  if (proxy) {
    // The Graph-based proxy resolves the file via Microsoft Graph's
    // /shares endpoint, which needs the original, untransformed share
    // URL — not the "?download=1" variant used for direct fetch mode.
    return `${proxy.replace(/\/+$/, "")}?url=${encodeURIComponent(rawUrl.trim())}`;
  }
  return toDirectDownloadUrl(rawUrl);
}

async function fetchWorkbookFromUrl(rawUrl) {
  const target = buildFetchTarget(rawUrl);
  const res = await fetch(target, { mode: "cors" });
  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.text()).slice(0, 300);
    } catch {}
    const err = new Error(`HTTP ${res.status}${detail ? ` — ${detail}` : ""}`);
    err.code = "HTTP_ERROR";
    throw err;
  }
  const contentType = res.headers.get("Content-Type") || "";
  const buf = await res.arrayBuffer();
  if (contentType.includes("text/html") || contentType.includes("application/json")) {
    const err = new Error(`Response wasn't an Excel file (got "${contentType}"). This usually means the link led to a sign-in page instead of the raw file.`);
    err.code = "NOT_A_FILE";
    throw err;
  }
  return XLSX.read(buf, { type: "array" });
}

function pickSheet(workbook, worksheetName) {
  const names = workbook.SheetNames;
  if (worksheetName) {
    const match = names.find((n) => n.toLowerCase() === worksheetName.trim().toLowerCase());
    if (match) return { name: match, sheet: workbook.Sheets[match] };
  }
  return { name: names[0], sheet: workbook.Sheets[names[0]] };
}

async function loadDataFromExcelUrl(rawUrl, worksheetName) {
  if (!rawUrl || !rawUrl.trim()) {
    const e = new Error("No URL configured");
    e.code = "NO_URL";
    throw e;
  }
  const wb = await fetchWorkbookFromUrl(rawUrl);
  const { name, sheet } = pickSheet(wb, worksheetName);
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  const rawItems = mapExcelRowsToRawItems(rows);
  if (!rawItems.length) {
    const e = new Error("No valid item rows");
    e.code = "NO_ROWS";
    throw e;
  }
  return { data: buildAppDataFromItems(rawItems), sheetName: name, rowCount: rawItems.length };
}

/* ---------- Sync orchestration ---------- */

function getLastSyncedAt() {
  return localStorage.getItem("erp-last-synced");
}
function setLastSyncedAt(iso) {
  localStorage.setItem("erp-last-synced", iso);
}

function buildSyncErrorMessage(e) {
  if (e && e.code === "NO_ROWS") return t("settings.testFailedNoRows");
  if (e instanceof TypeError) return t("settings.testFailedCors");
  return t("settings.testFailedGeneric").replace("{error}", (e && e.message) || String(e));
}

async function syncLiveData(showMsg) {
  if (!SETTINGS.sharePointUrl) return;
  if (showMsg) showToast(t("settings.syncing"), "info");
  try {
    const result = await loadDataFromExcelUrl(SETTINGS.sharePointUrl, SETTINGS.worksheetName);
    DATA = result.data;
    setLastSyncedAt(new Date().toISOString());
    render();
    if (showMsg) showToast(t("settings.syncSuccess").replace("{count}", result.rowCount), "success");
  } catch (e) {
    console.error("Live sync failed:", e);
    if (showMsg) showToast(buildSyncErrorMessage(e), "error");
  }
}

function performRefresh() {
  if (SETTINGS.dataSource === "live" && SETTINGS.sharePointUrl) {
    syncLiveData(true);
  } else {
    manualRefresh();
  }
}
