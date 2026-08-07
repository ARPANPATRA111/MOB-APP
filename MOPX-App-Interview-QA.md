# MOB Interview Preparation Q&A

This document is tailored to the current repository implementation. The project is a single Expo mobile application with local persistence, device integrations, and no backend or cloud sync in the current codebase.

# 1. Basic Project Questions

## Q1. What is this project?

Answer: MOB is a mobile point-of-sale application for small retailers. It helps a shop owner add products, manage inventory, create bills, share receipts, and review sales reports directly from a phone.

## Q2. Why did you build it?

Answer: I built it to solve a practical retail problem. Many small stores need something faster than manual notebooks but do not want the cost and complexity of a full enterprise POS system, especially when internet access is unreliable.

## Q3. What problem does it solve?

Answer: It reduces manual billing and stock tracking errors by combining inventory, checkout, and reporting in one mobile workflow. The app also keeps those workflows available offline, which is important for local vendors working in low-connectivity environments.

## Q4. Who are the target users?

Answer: The main users are small shop owners, kiosk operators, and local vendors who want a simple handheld system for day-to-day sales and stock management.

## Q5. What makes this project different from a generic POS demo?

Answer: It is not just a UI prototype. The app includes actual local persistence, barcode scanning, media handling for product images, stock-aware billing, receipt sharing, period-based sales reporting, theme persistence, and backup export.

# 2. Technical Architecture Questions

## Q1. Why did you choose a client-only architecture for this version?

Answer: I chose a client-only architecture because the goal was fast offline usability and low operational overhead. For a first practical version, keeping everything on-device removes backend hosting, sync complexity, and network dependency.

## Q2. How is the app structured internally?

Answer: The app is organized around feature screens such as Dashboard, Add Item, Inventory, Billing, Reports, and Settings. Shared logic lives in a small `src` layer that contains reusable components, a theme context, a storage service, and common TypeScript types.

## Q3. How does state management work?

Answer: Most state is local to each screen because the workflows are feature-specific. The only cross-app state in context is the theme, while persistent business data is read from and written to AsyncStorage through the shared storage service.

## Q4. Why did you choose React Native with Expo?

Answer: Expo gave me a fast mobile development workflow and easy access to device features like camera, file handling, sharing, and printing. React Native was a good fit because the product is UI-heavy and mobile-first.

## Q5. How do different screens stay coordinated without a complex global store?

Answer: Coordination happens through persistence and navigation. A screen writes to the shared storage service, and other screens reload or recompute their views from the latest saved inventory and bill data when they gain focus or when dependencies change.

# 3. Database Questions

## Q1. What are you using as the database?

Answer: There is no server-side database in this repository. The app uses AsyncStorage as device-local persistence for inventory, bills, categories, removed barcodes, and theme preference.

## Q2. Why did you choose AsyncStorage?

Answer: AsyncStorage is simple, reliable for moderate local data, and fits the offline-first goal. It was a practical choice because the current app scope is single-device retail usage rather than shared multi-user operations.

## Q3. How is the data organized?

Answer: Inventory items and bills are stored as JSON arrays under separate keys. Each bill contains item-level details, totals, payment method, customer name, and timestamp, which makes it easy to reconstruct receipts and generate reports later.

## Q4. How do you handle relationships between inventory and billing?

Answer: The billing flow uses the product barcode as the stable reference. When a bill is confirmed, the app matches billed items against inventory records and deducts the sold quantity from the stored stock.

## Q5. What are the limitations of this storage approach?

Answer: AsyncStorage works well for this scope, but it is not ideal for large-scale analytics, multi-device sync, or conflict resolution. If the app needs multi-user retail operations, the next step should be a backend API with a real database and sync strategy.

# 4. Frontend Questions

## Q1. How is navigation implemented?

Answer: Navigation is built with React Navigation stack navigation. The app defines a typed root parameter list in the main app file and uses stack transitions for the major screens.

## Q2. How did you implement theming?

Answer: I created a ThemeContext with light and dark theme objects. The context loads a stored preference from AsyncStorage, exposes toggle and direct set actions, and applies the active theme across all screen styles.

## Q3. How did you design the barcode flow from a UX point of view?

Answer: I wanted scanning to be the fastest path, but I also added a manual barcode modal as a fallback. That way the workflow still works if the camera permission is denied, the code is damaged, or the device camera is unavailable.

## Q4. How do you handle form validation?

Answer: Validation is done in the screen logic before writing data. For example, Add Item checks product name, quantity, and price, while Billing checks that items exist in the current bill and that requested quantities do not exceed inventory.

## Q5. How do you keep the UI responsive while handling local data?

Answer: The app avoids network waits because all core reads and writes are local. I also use memoized filtering for item search, compress images before storage, and batch some reads with `Promise.all` to reduce unnecessary overhead.

# 5. Backend Questions

## Q1. Is there a backend in this project?

Answer: No, not in the current repository. All business logic runs in the mobile app, and all persistence is local.

## Q2. Why did you keep business logic on the client?

Answer: For this version, the biggest product requirement was offline usability. Keeping logic on the client made it possible to support billing, inventory changes, and reporting without needing a network round trip.

## Q3. What business logic currently lives inside the app?

Answer: Inventory creation and updates, stock validation during billing, bill persistence, dashboard metric aggregation, date-based reporting, backup creation, and theme persistence all live inside the app.

## Q4. If you added a backend later, what would move first?

Answer: I would move identity, inventory persistence, bill persistence, centralized reporting, and backup sync first. That would allow multi-device access, better auditability, and conflict handling.

## Q5. What is the main tradeoff of not having a backend?

Answer: The benefit is simplicity and offline speed. The downside is that data is isolated to one device, there is no central reporting, and there is no built-in way to support multiple operators or remote recovery.

# 6. API Questions

## Q1. Does the app call any external business APIs?

Answer: No external business API is used in the current implementation. The app relies on local persistence and native device capabilities instead of server communication.

## Q2. What platform or device APIs does the app integrate with?

Answer: It integrates with camera access for barcode scanning, audio playback for scan feedback, media library and camera access for product images, local file storage, PDF generation, native sharing, date picker controls, and external linking for contact actions.

## Q3. How does receipt export work?

Answer: The receipt screen rebuilds the selected bill from stored data, converts it into an HTML template, renders it into a PDF with `expo-print`, and opens the native share flow using `expo-sharing` or the platform share sheet.

## Q4. How does report export work?

Answer: The reports screen first filters stored bills by date period, aggregates total sales and item counts, converts the result into an HTML report, generates a PDF locally, and then shares it through the device's native sharing flow.

## Q5. If you had to design a backend API later, what endpoints would you add first?

Answer: I would start with `/inventory`, `/bills`, `/reports`, `/auth`, and `/backups` or `/sync`. Those endpoints would cover the core business entities and make multi-device operations practical.

# 7. Security Questions

## Q1. How is data protected in the current version?

Answer: The main protection is that data stays local to the device and is not automatically sent to any external service. Access to camera and media features is permission-based, and file sharing is triggered only by explicit user action.

## Q2. Does the app implement authentication or authorization?

Answer: No. There is no login flow, user role model, or authorization layer in the current repository.

## Q3. Is the data encrypted?

Answer: Not in the current codebase. The README mentions encryption, but the actual implementation in this repository uses plain AsyncStorage and local file operations, so I would be careful not to claim encryption unless I add it.

## Q4. What security improvements would you make for a production rollout?

Answer: I would add user authentication, role-based access, encrypted local storage for sensitive data, secure remote backup, audit logging, and stronger validation around export and restore flows.

## Q5. How do you think about permission security here?

Answer: I keep permissions focused on features that really need them. Camera permission is required for scanning, media permission is required for images, and the user still has manual input fallback if those permissions are denied.

# 8. Performance Optimization Questions

## Q1. What performance optimizations are already present?

Answer: The app keeps core operations local, which removes network latency. It also compresses images before storing them, uses memoized filtering for search-heavy screens, and batches some storage reads when calculating summaries.

## Q2. Why is local-first useful for performance?

Answer: Because reads and writes happen on the device, common workflows like product lookup, billing, and report generation feel immediate. There is no dependency on API response time during checkout.

## Q3. How do you prevent product images from becoming too heavy?

Answer: I resize them before saving and store them as local files rather than embedding large payloads directly in the inventory records. That reduces storage size and helps image rendering stay manageable.

## Q4. How would you optimize the app for a much larger inventory?

Answer: I would move to a more structured local database like SQLite, add pagination or virtualization around heavy lists, index searchable fields, and avoid reloading full datasets when only one item changes.

## Q5. What is one current performance limitation?

Answer: Since the app stores arrays in AsyncStorage, large datasets would eventually make full reads and writes more expensive. That is acceptable for small-store scope but not ideal for enterprise-scale catalogs.

# 9. Deployment and DevOps Questions

## Q1. How do you run the app locally?

Answer: The repository uses Expo CLI commands such as `npm start`, `expo start`, and platform-specific run commands. There are also helper instructions in `guid.txt` for setup, debugging, and cache cleanup.

## Q2. How is mobile delivery configured?

Answer: Delivery is set up through EAS. The repository defines `development`, `preview`, and `production` build profiles in `eas.json`, and OTA updates are aligned with those channels.

## Q3. What is the role of `app.json` here?

Answer: `app.json` defines the app metadata, package identifiers, plugin configuration, permissions text, update behavior, and runtime version policy. It is the main Expo configuration source for the app build.

## Q4. Is CI/CD configured in this repository?

Answer: No CI/CD pipeline is present in the repository right now. Build and validation commands exist, but they are intended to be run manually or through local tooling.

## Q5. If you added CI/CD, what would your first pipeline include?

Answer: I would start with dependency install, TypeScript typecheck, Expo doctor, linting, and preview build validation. After that, I would add release tagging and controlled EAS build or update automation.

# 10. Scalability Questions

## Q1. How does the current version scale well?

Answer: It scales well for a single-store, single-device use case because the app is simple to deploy, fast to use offline, and does not require any server operations. For small vendors, that is a practical form of scalability.

## Q2. What are the main scalability limits?

Answer: The current design does not support multi-user access, remote reporting, cloud backup, or device synchronization. It also depends on one device as the operational source of truth.

## Q3. How would you scale it to multiple stores or staff members?

Answer: I would introduce user accounts, store-level data isolation, a backend API, a central database, and a sync mechanism for inventory and billing records. I would also add conflict resolution and audit trails for stock changes.

## Q4. How would reporting change at larger scale?

Answer: At larger scale, reporting should move to a backend or analytics pipeline instead of being generated entirely on-device. That would support historical aggregation across stores, better filtering, and faster reporting over larger datasets.

## Q5. Would you keep anything from the current architecture if the app scaled up?

Answer: Yes. I would keep the screen-level modularity, the shared storage or data-access abstraction, and the offline-first mindset. Those patterns still help even when the persistence layer moves to a synced or remote model.

# 11. AI/ML Questions

## Q1. Does this project currently use AI or machine learning?

Answer: No. The current repository has no AI or ML integration.

## Q2. If you were asked to add AI later, what would you add first?

Answer: I would start with practical retail features like low-stock forecasting, smart product suggestions, or OCR-based item entry from labels or invoices. I would only add those after the core inventory and sync architecture was stable.

## Q3. Why did you not add AI in the current version?

Answer: The immediate business problem was reliable offline billing and inventory control. AI would add complexity, but it would not solve the first-order operational need as directly as stable transaction and stock workflows.

# 12. Real Engineering Challenges

## Q1. What was a real challenge in this project?

Answer: One real challenge was keeping billing and stock updates consistent without a backend. In an offline app, I had to be careful that quantity checks, bill creation, and inventory deduction all stayed aligned.

## Q2. What made barcode scanning tricky?

Answer: Scanning is easy in a happy path, but a real app needs permission handling, multiple barcode types, feedback after scan success, and a manual fallback when scanning is not possible.

## Q3. What was a key architectural tradeoff?

Answer: The key tradeoff was choosing local simplicity over centralized scalability. That made the first version faster to build and easier to use offline, but it also means no multi-device sync or shared admin view yet.

## Q4. What debugging issues are common in this kind of app?

Answer: Camera permissions, file path issues, image persistence, stock mismatch edge cases, and incorrect date filtering in reports are all common areas that need careful debugging in a mobile POS workflow.

## Q5. Why did you generate PDFs on the device instead of using a server?

Answer: Device-side PDF generation matched the offline-first requirement. It also reduced infrastructure needs and kept the receipt and report export flow immediate for the user.

# 13. "What Would You Improve?" Questions

## Q1. What would you improve first if you continued this project?

Answer: I would add a backend with authentication and cloud sync first. That would unlock multi-device use, remote backup, shared reporting, and stronger operational reliability.

## Q2. What would you improve in the data layer?

Answer: I would move from AsyncStorage arrays to a more structured persistence layer, likely SQLite locally and a synced backend remotely. That would make larger datasets and partial updates much more efficient.

## Q3. What would you improve in code quality or delivery?

Answer: I would add automated testing, especially unit tests around the storage logic and billing calculations, plus E2E tests for barcode, billing, and receipt flows. I would also add CI around typecheck and Expo validation.

## Q4. What would you improve in product features?

Answer: Category management, restore-from-backup, discount and tax support, customer history, and cloud-based analytics would be good next features. Those would make the app more useful for real store operations.

## Q5. Is there anything in the repository you would align or clean up?

Answer: Yes. I would align the README and product claims with the actual implementation, and I would either finish or remove partially scaffolded data paths like category management and removed barcode tracking so the codebase tells a clearer story.

# 14. Behavioral and Ownership Questions

## Q1. What was the biggest challenge you handled personally?

Answer: The biggest challenge was turning a simple billing idea into a reliable end-to-end offline workflow. I had to think beyond screens and make sure inventory, receipts, reports, and exports all worked together consistently.

## Q2. What did you learn from building this project?

Answer: I learned that mobile product quality depends a lot on workflow design, not just UI design. Permission handling, local persistence, file management, and error recovery matter just as much as the visible interface.

## Q3. What would you do differently if you started again?

Answer: I would define the long-term data model and sync path earlier, even if I still shipped an offline-first version first. That would make it easier to grow from single-device operation to multi-user retail use.

## Q4. What was the most difficult bug or edge case to think about?

Answer: Stock consistency is the hardest area because a small mistake can affect billing, inventory, dashboard metrics, and reports at the same time. I always treat inventory mutation as a high-risk path in this kind of app.

## Q5. What part of the project are you most proud of?

Answer: I am most proud of making the app useful without a backend. The combination of scanning, billing, reporting, receipt sharing, theming, and backup export creates a complete workflow for a small retailer from one mobile codebase.