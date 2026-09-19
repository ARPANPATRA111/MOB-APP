/* Executes production TS/SQL against actual SQLite; only native boundaries are mocked. */

const fs = require("node:fs");

const path = require("node:path");

const Module = require("node:module");

const assert = require("node:assert/strict");

const { DatabaseSync } = require("node:sqlite");

const ts = require("typescript");

require.extensions[".ts"] = (mod, file) =>
  mod._compile(
    ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText,
    file,
  );

const sqlite = new DatabaseSync(":memory:");

let queryCount = 0;

const transaction = {
  execAsync: async (sql) => sqlite.exec(sql),

  runAsync: async (sql, params = []) => {
    queryCount++;
    const r = sqlite.prepare(sql).run(...params);
    return {
      changes: Number(r.changes),
      lastInsertRowId: Number(r.lastInsertRowid),
    };
  },

  getFirstAsync: async (sql, params = []) => {
    queryCount++;
    return sqlite.prepare(sql).get(...params) ?? null;
  },

  getAllAsync: async (sql, params = []) => {
    queryCount++;
    return sqlite.prepare(sql).all(...params);
  },
};

const db = {
  ...transaction,
  withExclusiveTransactionAsync: async (task) => {
    sqlite.exec("BEGIN IMMEDIATE");

    try {
      await task(transaction);
      sqlite.exec("COMMIT");
    } catch (e) {
      sqlite.exec("ROLLBACK");
      throw e;
    }
  },
};

const originalLoad = Module._load;

Module._load = function (name, parent, isMain) {
  if (name === "expo-sqlite") return { openDatabaseAsync: async () => db };

  if (name === "expo-constants") return { expoConfig: { version: "2.1.0" } };

  if (name === "@react-native-async-storage/async-storage")
    return {
      getItem: async (key) =>
        key === "inventory"
          ? JSON.stringify([
              { barcode: "ZERO", name: "Sold out", quantity: 0, price: 10 },
            ])
          : null,
      setItem: async () => {},
    };

  return originalLoad.call(this, name, parent, isMain);
};

const req = (file) => require(path.resolve(file));

(async () => {
  const { storageService: service } = req("src/services/storage.ts");

  const p = req("src/repositories/productRepository.ts");

  const s = req("src/repositories/saleRepository.ts");

  const { runMigrations } = req("src/db/migrate.ts");

  await service.ensureDataLayerReady();

  assert.equal(
    (await p.getProductByBarcode("ZERO", db)).stockQuantity,
    0,
    "zero-stock legacy migration",
  );

  assert.equal(
    (await runMigrations(db)).applied.length,
    0,
    "migration idempotency",
  );

  await p.createProduct(
    { barcode: "A", name: "A", quantity: 10, price: 10, costPrice: 6 },
    db,
  );

  await p.createProduct(
    { barcode: "B", name: "B", quantity: 5, price: 20, costPrice: 10 },
    db,
  );

  const sale = await s.createSaleTransaction(
    {
      id: "sale-1",
      customerName: "Customer",
      customerPhone: "1234567890",
      items: [
        { barcode: "A", quantity: 2 },
        { barcode: "B", quantity: 1 },
      ],
      payments: [{ method: "Cash", amountCents: 5000 }],
    },
    db,
  );

  assert.equal(sale.totalCents, 4000);

  assert.equal(sale.changeCents, 1000);

  assert.equal(sale.customerPhone, "1234567890");

  assert.equal((await p.getProductByBarcode("A", db)).stockQuantity, 8);

  await s.createSaleTransaction(
    {
      id: "sale-1",
      items: [{ barcode: "A", quantity: 2 }],
      paymentMethod: "Cash",
    },
    db,
  );

  assert.equal(
    (await p.getProductByBarcode("A", db)).stockQuantity,
    8,
    "idempotent checkout",
  );

  assert.equal(
    (await s.getSalesSummary(undefined, undefined, db)).totalSalesCents,
    4000,
    "no join multiplication",
  );

  queryCount = 0;
  await s.listSalesByDateRange(undefined, undefined, db);
  assert.ok(queryCount <= 4, "bounded detail query count");

  const before = sqlite.prepare("SELECT COUNT(*) n FROM sales").get().n;

  await assert.rejects(
    s.createSaleTransaction(
      {
        id: "bad-payment",
        items: [{ barcode: "A", quantity: 1 }],
        payments: [{ method: "Card", amountCents: 1 }],
      },
      db,
    ),
  );

  assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM sales").get().n, before);

  const a = await p.getProductByBarcode("A", db);

  await p.softDeleteProduct(a.id, db);

  await p.restoreProduct(a.id, db);

  assert.equal((await p.getProductByBarcode("A", db)).stockQuantity, 8);

  await p.createProduct(
    { barcode: "ABC_123", name: "Custom one", quantity: 0, price: 1 },
    db,
  );

  await p.createProduct(
    { barcode: "ABC-123", name: "Custom two", quantity: 0, price: 1 },
    db,
  );

  const { createPurchase, saveSupplier } = req(
    "src/repositories/purchaseRepository.ts",
  );

  const { recordInstallment, listCreditBills } = req(
    "src/repositories/creditRepository.ts",
  );

  const { getReport } = req("src/repositories/reportRepository.ts");

  const { saveDraft, listDrafts } = req("src/repositories/draftRepository.ts");

  const { applyCsvImport } = req("src/repositories/importRepository.ts");

  const supplierId = await saveSupplier(
    { name: "Audit supplier", phone: "123" },
    db,
  );

  const productA = await p.getProductByBarcode("A", db);

  await createPurchase(
    {
      id: "purchase-1",
      supplierId,
      date: Date.now(),
      items: [{ productId: productA.id, quantity: 8, unitCostCents: 1000 }],
    },
    db,
  );

  assert.equal(
    (await p.getProductByBarcode("A", db)).costCents,
    800,
    "weighted average cost",
  );

  assert.equal((await p.getProductByBarcode("A", db)).stockQuantity, 16);

  await createPurchase({ id: "purchase-1", date: Date.now(), items: [] }, db);

  assert.equal(
    (await p.getProductByBarcode("A", db)).stockQuantity,
    16,
    "purchase idempotency",
  );

  const creditSale = await s.createSaleTransaction(
    {
      id: "credit-1",
      customerName: "Credit customer",
      customerPhone: "999",
      allowCredit: true,
      items: [{ barcode: "A", quantity: 1 }],
      payments: [{ method: "Cash", amountCents: 200 }],
    },
    db,
  );

  assert.equal(creditSale.dueCents, 800);

  await recordInstallment(
    {
      id: "installment-1",
      saleId: "credit-1",
      method: "UPI",
      amountCents: 300,
    },
    db,
  );

  await recordInstallment(
    {
      id: "installment-1",
      saleId: "credit-1",
      method: "UPI",
      amountCents: 300,
    },
    db,
  );

  assert.equal(
    (await s.getSaleById("credit-1", db)).dueCents,
    500,
    "installment idempotency",
  );

  await assert.rejects(
    recordInstallment(
      { id: "too-much", saleId: "credit-1", method: "Cash", amountCents: 501 },
      db,
    ),
  );

  await recordInstallment(
    {
      id: "installment-2",
      saleId: "credit-1",
      method: "Cash",
      amountCents: 500,
    },
    db,
  );

  assert.equal(
    (await listCreditBills("", db)).length,
    0,
    "credit closes after final installment",
  );

  assert.equal(
    (await p.getProductByBarcode("A", db)).stockQuantity,
    15,
    "payments do not alter stock",
  );

  const report = await getReport(0, Date.now() + 1000, "all", db);

  assert.equal(report.totalSales, 50);
  assert.equal(report.knownProfit, 20);
  assert.equal(report.outstanding, 0);

  assert.equal(
    report.collections,
    50,
    "collections reconcile including installments",
  );

  await saveDraft(
    {
      id: "draft-a",
      cart: [{ id: "A", name: "A", quantity: 1, price: 10, total: 10 }],
      customerName: "",
      customerPhone: "",
      discount: "0",
      taxPercent: "0",
      allowCredit: false,
      cash: "",
      upi: "",
      card: "",
      label: "Parked",
    },
    "parked",
    db,
  );

  assert.equal((await listDrafts(db)).length, 1);

  const beforeImport = await p.getProductByBarcode("A", db);

  await assert.rejects(
    applyCsvImport(
      {
        id: "bad-import",
        csv: "barcode,name,quantity,price\nA,A,2,10",
        mode: "count",
        versions: { A: beforeImport.version - 1 },
      },
      db,
    ),
  );

  assert.equal(
    (await p.getProductByBarcode("A", db)).stockQuantity,
    15,
    "stale CSV cannot overwrite stock",
  );

  sqlite.exec(
    "CREATE TRIGGER audit_fail_movement BEFORE INSERT ON inventory_movements WHEN NEW.reason='Injected failure' BEGIN SELECT RAISE(ABORT,'Injected failure'); END;",
  );

  const { createStockMovement } = req(
    "src/repositories/inventoryRepository.ts",
  );

  await assert.rejects(
    createStockMovement(
      {
        productId: productA.id,
        quantityDelta: 3,
        movementType: "restock",
        reason: "Injected failure",
      },
      db,
    ),
  );

  assert.equal(
    (await p.getProductByBarcode("A", db)).stockQuantity,
    15,
    "failed movement rolls stock back",
  );

  const settings = req("src/repositories/settingsRepository.ts");

  await assert.rejects(
    settings.updateBusinessProfile({ currencyCode: "USD" }, db),
    /currency/i,
  );

  await s.importLegacySale(
    {
      id: "imported-receipt",
      customerName: "Old customer",
      timestamp: 1,
      total: 3,
      paymentMethod: "Cash",
      items: [{ id: "A", name: "A", quantity: 1, price: 3, total: 3 }],
    },
    db,
  );

  assert.equal(
    (await s.getSaleById("imported-receipt", db)).payments[0].paid_at,
    1,
    "legacy collection date",
  );

  sqlite.exec("DROP TRIGGER audit_fail_movement");

  const clone = new DatabaseSync(":memory:");

  for (const row of sqlite
    .prepare(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
    )
    .all())
    clone.exec(row.sql);

  for (const { name } of sqlite
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
    )
    .all()) {
    for (const row of sqlite.prepare(`SELECT * FROM ${name}`).all()) {
      const columns = Object.keys(row);
      clone
        .prepare(
          `INSERT INTO ${name}(${columns.join(",")}) VALUES(${columns.map(() => "?").join(",")})`,
        )
        .run(...Object.values(row));
    }
  }

  const source = {
    execAsync: async (sql) => clone.exec(sql),
    getFirstAsync: async (sql, params = []) =>
      clone.prepare(sql).get(...params) ?? null,
    getAllAsync: async (sql, params = []) => clone.prepare(sql).all(...params),
    runAsync: async (sql, params = []) => clone.prepare(sql).run(...params),
  };

  const { BACKUP_TABLES } = req("src/domain/fullBackupManifest.ts");

  const manifest = {
    format: 1,
    schemaVersion: 4,
    createdAt: new Date().toISOString(),
    databaseSha256: "a".repeat(64),
    images: [],
    theme: "system",
    counts: Object.fromEntries(
      BACKUP_TABLES.map((t) => [
        t,
        clone.prepare(`SELECT COUNT(*) n FROM ${t}`).get().n,
      ]),
    ),
  };

  const { restoreRecords } = req("src/repositories/restoreRepository.ts");

  await p.createProduct(
    { barcode: "AFTER-BACKUP", name: "After backup", price: 1, quantity: 1 },
    db,
  );

  await assert.rejects(
    restoreRecords(source, db, manifest, new Map(), () => {
      throw new Error("Restore interruption");
    }),
  );

  assert.ok(
    await p.getProductByBarcode("AFTER-BACKUP", db),
    "failed restore preserves live data",
  );

  await restoreRecords(source, db, manifest, new Map());

  assert.equal(
    await p.getProductByBarcode("AFTER-BACKUP", db),
    null,
    "restore replaces records",
  );

  assert.equal(
    (await s.getSaleById("credit-1", db)).payments.length,
    3,
    "restore keeps installments",
  );

  assert.equal((await listDrafts(db)).length, 1, "restore keeps parked bills");

  for (const table of BACKUP_TABLES)
    assert.equal(
      sqlite.prepare(`SELECT COUNT(*) n FROM ${table}`).get().n,
      manifest.counts[table],
      `${table} fully restored`,
    );

  const valueBefore = (await getReport(0, Date.now(), "Rounding", db))
    .inventoryValue;
  await p.createProduct(
    {
      barcode: "ROUND-COST",
      name: "Fractional valuation",
      quantity: 1.005,
      unit: "kg",
      price: 1,
      costPrice: 1,
    },
    db,
  );
  const valueAfter = (await getReport(0, Date.now(), "Rounding", db))
    .inventoryValue;
  assert.equal(
    Math.round((valueAfter - valueBefore) * 100),
    101,
    "inventory valuation rounds half cents consistently with sales",
  );
  await p.createProduct(
    {
      barcode: "SEARCH-SOAP",
      name: "Search hand soap",
      category: "Personal care",
      quantity: 10,
      price: 62,
    },
    db,
  );
  for (const query of ["hand", "personal", "62", "$62.00", "sopa"]) {
    assert.ok(
      (await p.listProductPage({ query }, db)).some(
        (item) => item.barcode === "SEARCH-SOAP",
      ),
      `catalog search: ${query}`,
    );
  }
  await p.createProduct(
    { barcode: "SEARCH-PERCENT", name: "50% sugar", quantity: 5, price: 13 },
    db,
  );
  assert.equal(
    (await p.listProductPage({ query: "50%" }, db)).length,
    1,
    "search treats wildcard input literally",
  );
  for (let n = 0; n < 65; n++)
    await p.createProduct(
      {
        barcode: `PAGED-SOAP-${n}`,
        name: `Soap bottle ${String(n).padStart(2, "0")}`,
        quantity: 1,
        price: 15,
      },
      db,
    );
  const firstPage = await p.listProductPage({ query: "sopa" }, db);
  const last = firstPage.at(-1);
  const secondPage = await p.listProductPage(
    { query: "sopa", after: { id: last.id, value: last.name } },
    db,
  );
  assert.equal(firstPage.length, 40, "fuzzy search is paginated");
  assert.equal(
    new Set([...firstPage, ...secondPage].map((item) => item.id)).size,
    firstPage.length + secondPage.length,
    "fuzzy pages do not repeat products",
  );
  console.log(
    "PASS catalog name/category/price/typo search and stable pagination",
  );
  if (process.argv.includes("--benchmark")) {
    // Synthetic in-memory fixture only; never touches an installed shop database.
    const insertClone = (table, row) => {
      const keys = Object.keys(row);
      const statement = sqlite.prepare(
        `INSERT INTO ${table} (${keys.join(",")}) VALUES (${keys.map(() => "?").join(",")})`,
      );
      return (changes) => {
        const next = { ...row, ...changes };
        statement.run(...keys.map((key) => next[key]));
      };
    };
    const product = sqlite
      .prepare("SELECT * FROM products WHERE deleted_at IS NULL LIMIT 1")
      .get();
    const sale = sqlite
      .prepare("SELECT * FROM sales WHERE deleted_at IS NULL LIMIT 1")
      .get();
    const item = sqlite
      .prepare("SELECT * FROM sale_items WHERE sale_id=? LIMIT 1")
      .get(sale.id);
    const payment = sqlite
      .prepare("SELECT * FROM payments WHERE sale_id=? LIMIT 1")
      .get(sale.id);
    const addProduct = insertClone("products", product),
      addSale = insertClone("sales", sale);
    const addItem = insertClone("sale_items", item),
      addPayment = insertClone("payments", payment);
    sqlite.exec("BEGIN");
    for (let n = 0; n < 50000; n++)
      addProduct({
        id: `bench-p-${n}`,
        barcode: `BENCH-${n}`,
        name: `Benchmark soap ${String(n).padStart(5, "0")}`,
      });
    for (let n = 0; n < 20000; n++) {
      const id = `bench-s-${n}`;
      addSale({ id, sale_number: id });
      addItem({ id: `bench-i-${n}`, sale_id: id });
      addPayment({ id: `bench-pay-${n}`, sale_id: id });
    }
    sqlite.exec("COMMIT");
    const timings = {};
    for (const query of ["", "soap", "sopa", "unmatchedword", "62"]) {
      const started = performance.now();
      const result = await p.listProductPage({ query }, db);
      assert.ok(result.length <= 40, "large catalog remains bounded");
      timings[query || "first page"] = Math.round(performance.now() - started);
    }
    const started = performance.now();
    const report = await getReport(0, Date.now(), "Benchmark", db);
    assert.ok(
      report.totalBills >= 20000,
      "report includes the large sales fixture",
    );
    timings.report = Math.round(performance.now() - started);
    // Customer credit at scale: 8,000 of the 20,000 benchmark bills are left partly unpaid.
    const { getCreditSummary, listCreditBills, searchCustomers } = req(
      "src/repositories/creditRepository.ts",
    );
    sqlite.exec("BEGIN");
    sqlite
      .prepare(
        "UPDATE sales SET customer_name='Bench customer ' || substr(id, 9), customer_phone='9' || substr('000000000' || substr(id, 9), -9), due_date=? WHERE id LIKE 'bench-s-%' AND CAST(substr(id, 9) AS INTEGER) % 5 < 2",
      )
      .run(Date.now() + 86400000);
    sqlite
      .prepare(
        "UPDATE payments SET amount_cents = amount_cents / 2 WHERE sale_id IN (SELECT id FROM sales WHERE id LIKE 'bench-s-%' AND CAST(substr(id, 9) AS INTEGER) % 5 < 2)",
      )
      .run();
    sqlite.exec("COMMIT");
    let t = performance.now();
    const credit = await getCreditSummary(db);
    timings.creditSummary = Math.round(performance.now() - t);
    assert.ok(credit.count >= 8000, "credit summary sees the unpaid fixture");
    t = performance.now();
    const openBills = await listCreditBills("", db);
    timings.creditList = Math.round(performance.now() - t);
    assert.ok(openBills.length === 100, "credit list stays paged at 100");
    t = performance.now();
    await listCreditBills("Bench customer 0012", db);
    timings.creditSearch = Math.round(performance.now() - t);
    t = performance.now();
    await searchCustomers("Bench", db);
    timings.customerSearch = Math.round(performance.now() - t);
    console.log(
      "BENCHMARK desktop SQLite milliseconds (50k added products, 20k added sales/items/payments, 8k unpaid):",
      JSON.stringify(timings),
    );
  }
  clone.close();

  console.log(
    "PASS real SQLite: migrations, zero legacy stock, sales, change, idempotency, rollback, aggregates, product identity/restoration, purchases/costs, credit installments, profit/collections, drafts, stale imports, failed movements and complete transactional restore",
  );

  sqlite.close();
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
