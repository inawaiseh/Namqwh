/* ============================================================
   Inventory ERP — sample data generator + analytics
   Pure vanilla JS, no build step. Produces a deterministic set
   of fully-enriched inventory items plus derived KPIs, alerts,
   purchase recommendations, and analytics aggregates.
   ============================================================ */

const BRANDS = ["Namq", "Breehant", "Roastery", "Tando", "Avola", "Laundah"];
const VAT_RATE = 0.15;

const CATEGORY_MAP = {
  CO: { name: "Consumables", slug: "consumables" },
  PM: { name: "Packaging Materials", slug: "packaging-materials" },
  RM: { name: "Raw Materials", slug: "raw-materials" },
  FA: { name: "Fixed Assets", slug: "fixed-assets" },
  GB: { name: "Green Beans", slug: "green-beans" },
  FPB: { name: "Finished Products", slug: "finished-products" },
};
const CATEGORY_LIST = Object.entries(CATEGORY_MAP).map(([code, v]) => ({ code, ...v }));
const CATEGORY_BY_SLUG = Object.fromEntries(CATEGORY_LIST.map((c) => [c.slug, c]));

const SUPPLIERS = [
  "Al Rawda Trading Co.",
  "Gulf Packaging Solutions",
  "Highland Coffee Exporters",
  "Metro Industrial Supplies",
  "Nordic Roasting Equipment",
  "Prime Consumables LLC",
  "Sahara Raw Materials",
  "Star Logistics & Supply",
  "Union Fixed Assets Ltd.",
  "Zenith Packaging Group",
];

const STATUS_COLORS = {
  "Order Now": "bg-amber-100 text-amber-800 border-amber-300",
  "In Stock": "bg-green-100 text-green-800 border-green-300",
  "On Order": "bg-blue-100 text-blue-800 border-blue-300",
  "Over Stock": "bg-purple-100 text-purple-800 border-purple-300",
  Critical: "bg-red-100 text-red-800 border-red-300",
};
const CRITICALITY_COLORS = {
  High: "bg-red-100 text-red-700",
  Medium: "bg-amber-100 text-amber-700",
  Low: "bg-slate-100 text-slate-700",
};

const NAME_POOL = {
  CO: ["Cleaning Detergent", "Filter Papers", "Lubricant Oil", "Hand Gloves", "Safety Masks", "Cleaning Cloths", "Machine Grease", "Sanitizer Solution", "Paper Towels", "Trash Bags"],
  PM: ["Kraft Paper Bags", "Valve Bags 1kg", "Valve Bags 250g", "Poly Liners", "Corrugated Boxes", "Shrink Wrap Film", "Label Rolls", "Tin Ties", "Zip Pouches 500g", "Carton Tape"],
  RM: ["Sugar (Bulk)", "Milk Powder", "Cocoa Powder", "Vanilla Extract", "Cinnamon Sticks", "Flavoring Syrup Base", "Caramel Base", "Powdered Creamer", "Chocolate Chips", "Honey (Bulk)"],
  FA: ["Espresso Machine", "Coffee Roaster Drum", "Industrial Grinder", "Packing Line Conveyor", "Forklift", "Cold Storage Unit", "Industrial Weighing Scale", "Nitrogen Flushing Unit", "Vacuum Sealer", "Delivery Van"],
  GB: ["Ethiopia Yirgacheffe", "Colombia Supremo", "Brazil Santos", "Guatemala Antigua", "Kenya AA", "Vietnam Robusta", "Honduras HG", "Costa Rica Tarrazu", "Sumatra Mandheling", "Panama Geisha"],
  FPB: ["Roasted Blend 250g", "Roasted Blend 1kg", "Single Origin 250g", "Espresso Blend 1kg", "Drip Bags Box", "Instant Coffee Sachets", "Cold Brew Concentrate", "Coffee Capsules Box", "Decaf Blend 250g", "Specialty Reserve 250g"],
};

const CATEGORY_CONFIG = {
  CO: { count: 20, price: [5, 80], demand: [50, 800], lead: [7, 20] },
  PM: { count: 20, price: [2, 60], demand: [100, 2000], lead: [10, 30] },
  RM: { count: 20, price: [10, 200], demand: [200, 3000], lead: [20, 60] },
  FA: { count: 15, price: [500, 15000], demand: [1, 10], lead: [30, 120] },
  GB: { count: 15, price: [15, 40], demand: [500, 5000], lead: [30, 90] },
  FPB: { count: 20, price: [20, 150], demand: [100, 1500], lead: [5, 15] },
};

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashCode(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function pick(arr, rng) {
  return arr[Math.floor(rng() * arr.length)];
}
function randInt(min, max, rng) {
  return Math.floor(min + rng() * (max - min + 1));
}
function randFloat(min, max, rng) {
  return +(min + rng() * (max - min)).toFixed(2);
}
function shuffle(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function statusFromCoverage(coverage, leadTime, currentStocks) {
  if (currentStocks <= 0) return "Critical";
  if (coverage < leadTime) return "Critical";
  if (coverage < leadTime * 1.5) return "Order Now";
  if (coverage <= 150) return "In Stock";
  return "Over Stock";
}

function categoryFromItemCode(code) {
  const upper = (code || "").toUpperCase();
  const prefix = Object.keys(CATEGORY_MAP)
    .sort((a, b) => b.length - a.length)
    .find((p) => upper.startsWith(p));
  if (!prefix) return { code: "OTHER", name: "Uncategorized", slug: "uncategorized" };
  return { code: prefix, ...CATEGORY_MAP[prefix] };
}

function generateRawItems(seed) {
  const rng = mulberry32(seed);
  const items = [];

  CATEGORY_LIST.forEach(({ code }) => {
    const cfg = CATEGORY_CONFIG[code];
    const names = NAME_POOL[code];
    for (let i = 0; i < cfg.count; i++) {
      const itemCode = `${code}-${String(i + 1).padStart(3, "0")}`;
      const baseName = names[i % names.length];
      const lot = Math.floor(i / names.length);
      const description = lot > 0 ? `${baseName} (Lot ${lot + 1})` : baseName;

      const price = randFloat(cfg.price[0], cfg.price[1], rng);
      const monthlyDemand = randInt(cfg.demand[0], cfg.demand[1], rng);
      const leadTime = randInt(cfg.lead[0], cfg.lead[1], rng);

      const coverageDays = randInt(2, 160, rng);
      const currentStocks = Math.round((monthlyDemand / 30) * coverageDays);
      const coverage = monthlyDemand > 0 ? +((currentStocks / (monthlyDemand / 30)) || 0).toFixed(1) : 0;

      let orderStatus = statusFromCoverage(coverage, leadTime, currentStocks);
      if (orderStatus !== "Critical" && i % 7 === 3) orderStatus = "On Order";

      const criticality =
        orderStatus === "Critical"
          ? "High"
          : orderStatus === "Order Now"
          ? (rng() < 0.6 ? "High" : "Medium")
          : orderStatus === "Over Stock"
          ? (rng() < 0.7 ? "Low" : "Medium")
          : (rng() < 0.5 ? "Medium" : "Low");

      const minStockLevel = Math.round(monthlyDemand * 0.5);
      const maxStockLevel = Math.round(monthlyDemand * randFloat(2, 3, rng));
      const orderQty = Math.max(0, maxStockLevel - currentStocks);
      const classification = pick(["Fast Moving", "Strategic", "Bulk Item", "Standard", "Seasonal"], rng);
      const supplier = pick(SUPPLIERS, rng);

      const usedByCount = code === "RM" || code === "GB" || code === "PM" || code === "CO" ? randInt(2, 6, rng) : randInt(1, 3, rng);
      const shuffledBrands = shuffle(BRANDS, rng).slice(0, usedByCount);
      const brands = {};
      BRANDS.forEach((b) => (brands[b] = shuffledBrands.includes(b)));

      const paymentToReachOptimum = +(price * Math.max(0, maxStockLevel - currentStocks)).toFixed(2);
      const monthlyStockCost = +(price * monthlyDemand).toFixed(2);
      const cat = categoryFromItemCode(itemCode);

      items.push({
        itemCode,
        description,
        itemDescription: `${description} used across ${usedByCount} brand${usedByCount > 1 ? "s" : ""} for production and packaging operations.`,
        brands,
        usedByBrands: shuffledBrands.length,
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
      });
    }
  });

  return items;
}

function enrichItems(rawItems) {
  const withValue = rawItems.map((it) => ({ ...it, inventoryValue: +(it.currentStocks * it.price).toFixed(2) }));

  const annualValue = (it) => it.price * it.monthlyDemand * 12;
  const totalAnnualValue = withValue.reduce((s, it) => s + annualValue(it), 0) || 1;
  const sorted = [...withValue].sort((a, b) => annualValue(b) - annualValue(a));
  let cumulative = 0;
  const abcByCode = new Map();
  sorted.forEach((it) => {
    cumulative += annualValue(it);
    const pct = cumulative / totalAnnualValue;
    abcByCode.set(it.itemCode, pct <= 0.8 ? "A" : pct <= 0.95 ? "B" : "C");
  });

  return withValue.map((it) => {
    const cv = 0.05 + (hashCode(it.itemCode) % 61) / 100;
    const xyzClass = cv < 0.2 ? "X" : cv < 0.4 ? "Y" : "Z";
    const fsnClass = it.monthlyDemand <= 0 ? "Non Moving" : it.coverage <= 30 ? "Fast Moving" : it.coverage <= 90 ? "Slow Moving" : "Non Moving";
    const daysWithoutUsage = hashCode(it.itemCode + "d") % 220;
    const isDeadStock = it.monthlyDemand <= 0 || (daysWithoutUsage > 120 && it.coverage > 100);

    return {
      ...it,
      abcClass: abcByCode.get(it.itemCode) || "C",
      xyzClass,
      fsnClass,
      isDeadStock,
      daysWithoutUsage,
    };
  });
}

function computeKPIs(items) {
  const totalItems = items.length;
  const inventoryValue = items.reduce((s, i) => s + i.inventoryValue, 0);
  const totalMonthlyStockCost = items.reduce((s, i) => s + i.monthlyStockCost, 0);
  const totalMonthlyDemand = items.reduce((s, i) => s + i.monthlyDemand, 0);
  const avgCoverage = totalItems ? items.reduce((s, i) => s + i.coverage, 0) / totalItems : 0;
  const avgLeadTime = totalItems ? items.reduce((s, i) => s + i.leadTime, 0) / totalItems : 0;
  const criticalItems = items.filter((i) => i.orderStatus === "Critical").length;
  const itemsToOrder = items.filter((i) => i.orderStatus === "Order Now" || i.orderStatus === "Critical").length;
  const healthyItems = items.filter((i) => i.orderStatus === "In Stock").length;
  const suppliers = new Set(items.map((i) => i.supplier).filter(Boolean)).size;
  const paymentRequired = items.reduce((s, i) => s + (i.paymentToReachOptimum || 0), 0);
  const categories = new Set(items.map((i) => i.category)).size;
  return { totalItems, inventoryValue, totalMonthlyStockCost, totalMonthlyDemand, avgCoverage, avgLeadTime, criticalItems, itemsToOrder, healthyItems, suppliers, paymentRequired, categories };
}

function computeHealthScore(items) {
  const total = items.length || 1;
  const healthyRatio = items.filter((i) => i.orderStatus === "In Stock").length / total;
  const criticalRatio = items.filter((i) => i.orderStatus === "Critical").length / total;
  const orderNowRatio = items.filter((i) => i.orderStatus === "Order Now").length / total;
  const overStockRatio = items.filter((i) => i.orderStatus === "Over Stock").length / total;
  const missingDataRatio = items.filter((i) => !i.supplier || !i.price || i.price <= 0).length / total;
  const score = 30 * healthyRatio + 25 * (1 - criticalRatio) + 15 * (1 - orderNowRatio) + 15 * (1 - missingDataRatio) + 15 * (1 - overStockRatio);
  return Math.max(0, Math.min(100, Math.round(score)));
}

function generateAlerts(items) {
  const alerts = [];
  const now = new Date().toISOString();
  let id = 0;
  items.forEach((it) => {
    if (it.currentStocks <= 0) {
      alerts.push({ id: String(id++), type: "Out of Stock", severity: "critical", itemCode: it.itemCode, description: it.description, message: `${it.itemCode} - ${it.description} is out of stock.`, createdAt: now });
    } else if (it.orderStatus === "Critical") {
      alerts.push({ id: String(id++), type: "Critical Stock", severity: "critical", itemCode: it.itemCode, description: it.description, message: `${it.itemCode} - ${it.description} is at critical stock level. Order immediately.`, createdAt: now });
    } else if (it.orderStatus === "Order Now") {
      alerts.push({ id: String(id++), type: "Order Required", severity: "warning", itemCode: it.itemCode, description: it.description, message: `${it.itemCode} - ${it.description} should be reordered now (coverage ${it.coverage.toFixed(0)} days).`, createdAt: now });
    } else if (it.orderStatus === "Over Stock") {
      alerts.push({ id: String(id++), type: "Over Stock", severity: "info", itemCode: it.itemCode, description: it.description, message: `${it.itemCode} - ${it.description} is over stocked (coverage ${it.coverage.toFixed(0)} days).`, createdAt: now });
    }
    if (it.coverage > 0 && it.coverage < 14 && it.orderStatus !== "Critical") {
      alerts.push({ id: String(id++), type: "Coverage Below Target", severity: "warning", itemCode: it.itemCode, description: it.description, message: `${it.itemCode} coverage (${it.coverage.toFixed(0)}d) is below the 14-day target.`, createdAt: now });
    }
    if (!it.supplier) {
      alerts.push({ id: String(id++), type: "Missing Supplier", severity: "warning", itemCode: it.itemCode, description: it.description, message: `${it.itemCode} - ${it.description} has no supplier assigned.`, createdAt: now });
    }
    if (!it.price || it.price <= 0) {
      alerts.push({ id: String(id++), type: "Missing Price", severity: "warning", itemCode: it.itemCode, description: it.description, message: `${it.itemCode} - ${it.description} has no unit price.`, createdAt: now });
    }
    if (it.leadTime > 60) {
      alerts.push({ id: String(id++), type: "Long Lead Time", severity: "info", itemCode: it.itemCode, description: it.description, message: `${it.itemCode} has a long supplier lead time of ${it.leadTime} days.`, createdAt: now });
    }
  });
  const weight = { critical: 0, warning: 1, info: 2 };
  return alerts.sort((a, b) => weight[a.severity] - weight[b.severity]);
}

function generatePurchaseRecommendations(items) {
  const today = new Date();
  const addDays = (d, days) => {
    const nd = new Date(d);
    nd.setDate(nd.getDate() + Math.round(days));
    return nd.toISOString().slice(0, 10);
  };
  return items
    .filter((it) => it.orderStatus === "Critical" || it.orderStatus === "Order Now" || it.coverage < it.leadTime + 7)
    .map((it) => {
      const recommendedOrderQty = Math.max(it.maxStockLevel - it.currentStocks, it.orderQty || Math.ceil(it.monthlyDemand * 1.5), 0);
      const priority = it.currentStocks <= 0 || it.coverage < it.leadTime || it.orderStatus === "Critical" ? "Urgent" : it.criticality === "High" ? "High" : it.orderStatus === "Order Now" ? "Medium" : "Low";
      return {
        itemCode: it.itemCode,
        description: it.description,
        supplier: it.supplier,
        category: it.category,
        criticality: it.criticality,
        currentStocks: it.currentStocks,
        monthlyDemand: it.monthlyDemand,
        coverage: it.coverage,
        leadTime: it.leadTime,
        price: it.price,
        recommendedOrderQty,
        recommendedOrderDate: today.toISOString().slice(0, 10),
        estimatedStockOutDate: addDays(today, it.coverage),
        estimatedArrivalDate: addDays(today, it.leadTime),
        estimatedPayment: +(recommendedOrderQty * it.price).toFixed(2),
        priority,
      };
    })
    .sort((a, b) => {
      const order = { Urgent: 0, High: 1, Medium: 2, Low: 3 };
      return order[a.priority] - order[b.priority] || a.coverage - b.coverage;
    });
}

function deadStockList(items) {
  return items
    .filter((i) => i.isDeadStock)
    .map((i) => ({
      itemCode: i.itemCode,
      description: i.description,
      category: i.category,
      supplier: i.supplier,
      daysWithoutUsage: i.daysWithoutUsage,
      inventoryValue: i.inventoryValue,
      recommendedAction: i.daysWithoutUsage > 150 ? "Liquidate / write off" : "Review demand, consider discount or reallocation",
    }))
    .sort((a, b) => b.daysWithoutUsage - a.daysWithoutUsage);
}

function generateAIInsights(items) {
  const kpis = computeKPIs(items);
  const insights = [];
  const byCategory = new Map();
  items.forEach((i) => byCategory.set(i.category, (byCategory.get(i.category) || 0) + i.inventoryValue));
  const topCategory = [...byCategory.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topCategory && kpis.inventoryValue > 0) {
    const pct = Math.round((topCategory[1] / kpis.inventoryValue) * 100);
    insights.push(`${topCategory[0]} represents ${pct}% of total inventory value.`);
  }
  const bySupplierLead = new Map();
  items.forEach((i) => {
    if (!i.supplier) return;
    const arr = bySupplierLead.get(i.supplier) || [];
    arr.push(i.leadTime);
    bySupplierLead.set(i.supplier, arr);
  });
  let slowestSupplier = "", slowestAvg = 0;
  bySupplierLead.forEach((arr, supplier) => {
    const avg = arr.reduce((s, v) => s + v, 0) / arr.length;
    if (avg > slowestAvg) { slowestAvg = avg; slowestSupplier = supplier; }
  });
  if (slowestSupplier) insights.push(`${slowestSupplier} has the highest average lead time (${slowestAvg.toFixed(0)} days).`);

  const lowestCoverageCategory = [...byCategory.keys()]
    .map((cat) => {
      const catItems = items.filter((i) => i.category === cat);
      const avg = catItems.reduce((s, i) => s + i.coverage, 0) / (catItems.length || 1);
      return { cat, avg };
    })
    .sort((a, b) => a.avg - b.avg)[0];
  if (lowestCoverageCategory) insights.push(`${lowestCoverageCategory.cat} has the lowest average coverage (${lowestCoverageCategory.avg.toFixed(0)} days) across the portfolio.`);
  if (kpis.criticalItems > 0) insights.push(`${kpis.criticalItems} item(s) are at critical stock and require immediate purchasing action.`);
  const overStockCount = items.filter((i) => i.orderStatus === "Over Stock").length;
  if (overStockCount > 0) insights.push(`${overStockCount} item(s) are over-stocked, tying up working capital unnecessarily.`);
  return insights;
}

function buildAnalyticsAggregates(items) {
  const byCategory = {};
  items.forEach((i) => {
    byCategory[i.category] ??= { value: 0, count: 0, demand: 0, cost: 0, stock: 0 };
    byCategory[i.category].value += i.inventoryValue;
    byCategory[i.category].count += 1;
    byCategory[i.category].demand += i.monthlyDemand;
    byCategory[i.category].cost += i.monthlyStockCost;
    byCategory[i.category].stock += i.currentStocks;
  });
  const bySupplier = {};
  items.forEach((i) => {
    if (!i.supplier) return;
    bySupplier[i.supplier] ??= { value: 0, count: 0 };
    bySupplier[i.supplier].value += i.inventoryValue;
    bySupplier[i.supplier].count += 1;
  });
  const coverageBuckets = { "0-7": 0, "8-14": 0, "15-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
  items.forEach((i) => {
    const c = i.coverage;
    if (c <= 7) coverageBuckets["0-7"]++;
    else if (c <= 14) coverageBuckets["8-14"]++;
    else if (c <= 30) coverageBuckets["15-30"]++;
    else if (c <= 60) coverageBuckets["31-60"]++;
    else if (c <= 90) coverageBuckets["61-90"]++;
    else coverageBuckets["90+"]++;
  });
  const leadTimeBuckets = { "0-15": 0, "16-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
  items.forEach((i) => {
    const l = i.leadTime;
    if (l <= 15) leadTimeBuckets["0-15"]++;
    else if (l <= 30) leadTimeBuckets["16-30"]++;
    else if (l <= 60) leadTimeBuckets["31-60"]++;
    else if (l <= 90) leadTimeBuckets["61-90"]++;
    else leadTimeBuckets["90+"]++;
  });
  const criticalityBuckets = { High: 0, Medium: 0, Low: 0 };
  items.forEach((i) => (criticalityBuckets[i.criticality] += 1));
  const abcBuckets = { A: 0, B: 0, C: 0 };
  const xyzBuckets = { X: 0, Y: 0, Z: 0 };
  const fsnBuckets = { "Fast Moving": 0, "Slow Moving": 0, "Non Moving": 0 };
  items.forEach((i) => {
    abcBuckets[i.abcClass] += 1;
    xyzBuckets[i.xyzClass] += 1;
    fsnBuckets[i.fsnClass] += 1;
  });
  const topValueItems = [...items].sort((a, b) => b.inventoryValue - a.inventoryValue).slice(0, 20);
  const topLowCoverage = [...items].filter((i) => i.monthlyDemand > 0).sort((a, b) => a.coverage - b.coverage).slice(0, 20);
  const topDemand = [...items].sort((a, b) => b.monthlyDemand - a.monthlyDemand).slice(0, 20);

  return { byCategory, bySupplier, coverageBuckets, leadTimeBuckets, criticalityBuckets, abcBuckets, xyzBuckets, fsnBuckets, topValueItems, topLowCoverage, topDemand };
}

function buildAppData(seed = 42) {
  const items = enrichItems(generateRawItems(seed));
  return {
    items,
    kpis: computeKPIs(items),
    healthScore: computeHealthScore(items),
    alerts: generateAlerts(items),
    recommendations: generatePurchaseRecommendations(items),
    deadStock: deadStockList(items),
    insights: generateAIInsights(items),
    analytics: buildAnalyticsAggregates(items),
  };
}
