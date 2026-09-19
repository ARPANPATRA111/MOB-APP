# Is barcode-first billing viable for real shops? — market research note

Written September 16, 2026 for the MOPX product decision "can a small shop or an industrial counter run its billing on camera barcode scanning?"

## Short answer

Yes, for the large majority of packaged goods sold anywhere in the world, and with two well-understood exceptions that MOPX already covers (products without a barcode, and items sold loose by weight or count). Details and sources below.

## How retail barcodes actually work

- Retail products carry a **GTIN** (Global Trade Item Number) issued through GS1, printed as **EAN-13** (worldwide), **UPC-A** (North America), or **EAN-8 / UPC-E** on very small packs. India's GS1 prefix is 890, so most Indian FMCG codes start with `890`. These are exactly the symbologies MOPX reads (`ean13`, `ean8`, `upc_a`, `upc_e`, plus `code128`/`code39`/`itf14` for cartons and internal labels). QR codes are ignored on purpose; they are not product identifiers at the till.
- **Every variant is a different number.** GS1's allocation rules require a separate GTIN for each size, each colour and each combination of the two — a one-size T-shirt in three colours is three GTINs ([GS1 support: how many GTINs for sizes and colours](https://support.gs1.org/support/solutions/articles/43000734083-how-many-gs1-gtins-do-i-need-when-i-have-a-product-with-many-sizes-and-colours-), [GS1 GTIN Allocation Rules](https://www.gs1.org/1/docs/GS1_GTIN_Allocation_Rules_Print_Version.pdf)). So a branded pencil box in red and in blue scans as two different products, and a 6-pack has a different GTIN from the single unit. The only case where a brand may keep one GTIN is when a change is cosmetic and it can distinguish old from new by batch/lot; that never affects billing.
- **Small items still get codes.** GS1 issues **GTIN-8 (EAN-8)** when the printable area is under 80 cm², the largest label is under 40 cm², or the pack is a cylinder under 30 mm — the classic examples are chewing gum, pencils and cigarettes ([GS1 Greece: GTIN-8 for small products](https://www.gs1greece.org/en/gs1-standards/gs1-identification-numbers-for-products-gtin/gtin-rule-for-the-non-reuse-of-gtin/gtin-8-for-small-products), [EAN-8](https://en.wikipedia.org/wiki/EAN-8)). MOPX scans EAN-8.

## What does not come with a barcode

1. **Loose and local goods** — produce, grains sold from sacks, bakery items, unbranded hardware, locally made goods, single sweets. Sold by weight or count.
2. **Very small unbranded items** — a single pen refill, a screw, a button — usually sold as a strip, pack or count.
3. **Damaged or missing labels.**

Two standard industry answers exist and MOPX implements both:

- **In-store barcodes.** GS1 reserves EAN-13 numbers starting `02` and `20`–`29` as *Restricted Circulation Numbers* for use inside one company or store; they can never clash with a real product ([GS1: prefixes 20–29](https://www.gs1.org/docs/barcodes/SummaryOfGS1MOPrefixes20-29.pdf), [GS1 Australia: variable measure retail](https://assets.ctfassets.net/9uypwcnuzbqi/PlyyuvpxJtvubTH7KoIJO/96be9181fda515d6d39b525cb0d5d3e2/GS1au-fact-sheet-variable-measure-retail.pdf)). When a product is saved without a barcode, MOPX now generates a valid **in-store EAN-13 starting `20`** with a correct check digit (`src/domain/barcode.ts`). The shopkeeper can print that number as a sticker with any label printer or online generator, and it will scan in MOPX or any other scanner.
- **Grouped or counted sale.** Items with no label are added from the **Find** picker by name/category/price and sold by quantity, weight (`kg`, `g`), volume or length — the units MOPX already supports.

## Known limitation: variable-measure labels

Supermarket weighing scales print labels in the same `2x` range with the **weight or price embedded in the number**, so every label is a different code. MOPX treats those as unknown products. Shops with in-house scales would need a "price-embedded barcode" parser (a future feature: read the 5-digit weight/price field and pair it with a PLU product). Small shops that weigh at the counter simply add the product from Find and type the quantity.

## Camera versus dedicated scanner

- Phone cameras read EAN/UPC reliably in normal shop lighting; dark counters need the torch (MOPX remembers the torch state between scans). Glossy or curved packs read best at 10–20 cm with the code filling the viewfinder.
- Speed: MOPX's continuous mode accepts a code after 1 s of stable reading, shows a 1.4 s "Added" chip, and ignores a code that is still under the camera, so a basket of ten items takes roughly 25–30 s of scanning. A USB/Bluetooth laser scanner is faster (~0.3 s per item) and is the right upgrade for very busy counters; a "keyboard-wedge" scanner would work with MOPX with a small change (listening for typed codes in the bill screen) if needed later.

## Verdict

Barcode-first billing is the norm for packaged retail everywhere and is safe to build on. The realistic gaps — unlabelled goods and weighed goods — are handled by in-store EAN-13 stickers and the Find picker, and the only notable gap (scale labels with embedded weight) is a contained, optional feature for later.
