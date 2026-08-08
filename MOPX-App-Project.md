# 1. Project Name

MOB (Mobile Operated Business)

# 2. Short Project Description (2 Versions)

Version A: Built a local-first mobile POS application that lets small retailers manage inventory, create bills, share receipts, and review sales reports directly from a phone without depending on continuous internet access.

Version B: Developed an Expo and React Native POS app that combines barcode scanning, AsyncStorage-based offline persistence, on-device media handling, PDF generation, and EAS delivery workflows in a single mobile codebase.

# 3. Live Project Placeholder

- Live Link: [ADD_LINK_HERE]
- GitHub Repo: [ADD_REPO_LINK_HERE]

# 4. Complete Tech Stack

Current repository scope: this codebase contains a single Expo mobile client. No backend service, cloud database, authentication provider, CI pipeline, Docker setup, or AI/ML module is implemented in the current repository.

## Frontend

- React 19
- React Native 0.83
- Expo SDK 55
- TypeScript
- React Navigation (`@react-navigation/native`, `@react-navigation/stack`)
- React Native Gesture Handler

## Backend

- No dedicated backend is implemented in this repository
- Business logic runs inside the mobile client

## Database

- AsyncStorage via `@react-native-async-storage/async-storage`
- Device-local JSON persistence for inventory, bills, categories, removed barcodes, and theme preference

## ORM

- None

## Authentication

- None implemented in the current codebase

## DevOps

- Expo CLI
- EAS Build
- EAS Update channels (`development`, `preview`, `production`)
- npm scripts for start, platform runs, doctor, and typecheck

## Cloud

- Expo Application Services (build and OTA distribution workflow)
- No application cloud backend or remote data sync in current implementation

## AI/ML

- None implemented

## State Management

- React hooks (`useState`, `useEffect`, `useMemo`, `useRef`)
- React Context API for theme state
- Screen-local state for billing, inventory, reporting, and scanning flows

## APIs/Integrations

- `expo-camera` for barcode scanning and camera permission handling
- `expo-av` for scan confirmation audio
- `expo-image-picker` for camera and gallery image input
- `expo-image-manipulator` for image compression and resizing
- `expo-file-system/legacy` for local file storage and backup export
- `expo-print` for receipt and report PDF generation
- `expo-sharing` for native share sheet export
- `expo-constants` for app metadata access
- `@react-native-community/datetimepicker` for report date selection
- Native linking (`mailto:`, `tel:`, WhatsApp URL) in the About screen

## Styling/UI

- React Native `StyleSheet`
- `@expo/vector-icons`
- `expo-linear-gradient`
- Custom light and dark theme objects

## Testing

- TypeScript compile validation through `tsc --noEmit`
- `expo-doctor` script is configured for dependency and Expo health checks
- No Jest, Detox, or other automated test suite is configured in the current repository

## Tooling

- Babel (`babel-preset-expo`)
- Metro (`expo/metro-config`)
- Expo TypeScript base config
- `package-lock.json` for deterministic npm installs
- `guid.txt` for setup, debugging, EAS build, and OTA command references

## Infrastructure

- Expo app configuration through `app.json`
- EAS profile configuration through `eas.json`
- Runtime version policy tied to app version
- OTA update strategy with staged channels

# 5. Detailed Resume Project Descriptions

## Description 1 - ATS-optimized corporate tone

Built MOB, a local-first mobile point-of-sale solution for small retailers that consolidates inventory management, barcode-assisted item intake, customer billing, receipt sharing, and date-based sales reporting into a single React Native application. The project uses a modular screen-based architecture with a centralized AsyncStorage service layer so store operations remain usable without backend dependency, while Expo and EAS simplify delivery, preview distribution, and OTA-ready releases.

## Description 2 - Technical engineering-focused tone

Engineered an Expo and TypeScript mobile POS application that integrates barcode scanning, image capture, image compression, local file storage, PDF generation, and native sharing inside a unified offline workflow. I separated the app into feature screens, reusable modal components, a dedicated storage service, and a theme context, which kept UI logic, persistence, and device integrations decoupled while preserving stock accuracy during billing and simplifying future expansion toward synced multi-device retail operations.

## Description 3 - Product/business impact-focused tone

Delivered a practical store-operations app aimed at small vendors who need fast billing and inventory control without investing in a complex back-office platform. By moving persistence, reporting, and document generation onto the device, the app reduces manual bookkeeping, speeds up checkout through barcode flows, highlights low-stock items early, and gives operators shareable receipts and exportable backups from the same handheld interface.

# 6. Resume Bullet Points (3 Sets)

## Set A - Engineering implementation

- Built a mobile POS application with React Native, Expo, and TypeScript, covering dashboard, inventory, billing, receipt, reporting, settings, and about flows inside a single stack-navigated client.
- Implemented barcode-driven product intake and checkout using `expo-camera`, with manual barcode entry fallback to keep workflows usable when camera access is unavailable.
- Added product image capture, gallery import, compression, and local file persistence using `expo-image-picker`, `expo-image-manipulator`, and `expo-file-system/legacy`.
- Centralized inventory, billing history, theme preference, and backup snapshot logic behind a shared AsyncStorage service layer to keep the app fully offline-capable.
- Generated shareable PDF receipts and period-based sales reports with `expo-print` and `expo-sharing`, avoiding any server-side document generation dependency.

## Set B - Scalability and architecture

- Structured the app around feature-specific screens plus a thin shared layer for storage, theming, and reusable modals, reducing cross-screen duplication and keeping the codebase maintainable.
- Designed billing logic to validate requested quantities against live inventory before payment, preventing overselling in the app's single-device retail model.
- Derived dashboard metrics and daily, weekly, monthly, and yearly sales summaries directly from stored bill records, enabling analytics without introducing backend infrastructure.
- Optimized local media handling by resizing product images before persistence and storing file URIs instead of large inline payloads, which reduced storage pressure and improved render efficiency.
- Configured EAS build profiles and OTA channels for development, preview, and production, creating a cleaner release workflow for testing and staged mobile distribution.

## Set C - Business impact and optimization

- Delivered an offline-first checkout and stock management workflow tailored for small shops and vendors operating in unreliable network environments.
- Reduced billing friction through barcode scanning, quick quantity controls, item search, and one-tap payment method selection across common in-person payment types.
- Improved operational visibility with a dashboard that surfaces revenue, items sold, product count, and low-stock alerts from live transactional data.
- Enabled lightweight back-office reporting through date-filtered sales summaries and PDF export, making it easier to review performance without external analytics tooling.
- Added JSON backup export and theme customization to improve day-to-day usability and reduce operator risk around device-local data management.

# 7. Key Features

## Core Features

- Offline inventory creation, editing, search, and deletion
- Barcode-assisted item intake and billing workflows
- Customer billing with stock deduction and receipt generation
- Dashboard summary for products, low stock, items sold, and daily revenue
- Date-based sales reporting with PDF export

## User Features

- Barcode scanning with manual entry fallback
- Product image upload from camera or gallery
- Searchable inventory and quick billing item browser
- Multiple payment method selection (`Cash`, `Credit Card`, `Debit Card`, `UPI`)
- Light and dark theme switching

## Admin Features

- Inventory edit modal for product name, price, and quantity updates
- Bulk selection and deletion in inventory
- Backup export as a shareable JSON snapshot
- App version and release-readiness visibility through the settings screen

## AI/Automation Features

- No AI or ML integration is implemented in the current repository
- Automatic product lookup and field prefill when an existing barcode is scanned
- Automatic inventory deduction when a bill is finalized
- Automatic aggregation of dashboard metrics and sales reports from stored bill data

## Security Features

- Camera and media access are gated by platform permission requests
- Operational data remains on the device through AsyncStorage and local file storage
- Backup export is user-initiated rather than automatic background transmission
- Error boundary prevents the entire app from crashing on a screen-level runtime failure
- Limitation: no authentication, encryption, or role-based authorization is implemented in the current codebase

## Integrations

- Barcode scanner and camera access through Expo Camera
- Image picker and image manipulation for product media workflows
- Native share sheet and PDF export for receipts and reports
- Date picker integration for report-period filtering
- External links for email, phone, portfolio, and WhatsApp contact from the About screen

## Performance Features

- Local-first architecture removes runtime network latency from core store operations
- `useMemo` is used for inventory and billing search/filtering to avoid unnecessary recalculation on every render
- Product images are resized before storage to reduce file size and rendering cost
- Dashboard summary uses batched async reads with `Promise.all` for faster startup aggregation

# 8. Architecture Summary

## Architecture overview

MOB is a single-package Expo mobile application with a screen-oriented structure. The main entrypoint composes a gesture handler root, theme provider, error boundary, navigation container, and stack navigator. Feature logic lives primarily in screen files, while cross-cutting concerns are kept in a small shared layer under `src/` for storage, theme state, reusable components, and common types.

## Frontend/backend interaction

There is no backend service in the current repository. Every major workflow reads from or writes to the `storageService`, which wraps AsyncStorage with typed helper methods. Native mobile capabilities such as barcode scanning, audio feedback, image capture, PDF generation, and sharing are accessed through Expo modules instead of remote APIs.

## Data flow

Inventory data is created or updated in Add Item, then persisted through the storage service. Billing loads current inventory, validates stock before incrementing quantities, writes a bill record, and decrements product stock when payment is confirmed. The dashboard and reports screens derive operational analytics from stored inventory and bill history, while the receipt screen reconstructs a completed transaction from the saved bill record. Settings reads the same storage layer to export a full JSON backup and persist theme preference.

## Deployment strategy

Local development runs through Expo CLI, while production-oriented mobile delivery is prepared through EAS build profiles defined in `eas.json`. OTA channels are mapped to `development`, `preview`, and `production`, and the runtime version is tied to the app version so updates can be rolled out in a staged and controlled way.

## Scaling considerations

The current design scales well for single-device, offline retail usage because it avoids server infrastructure and keeps reads and writes local. The main constraints are also clear: there is no multi-user access, no central reporting service, no device-to-device synchronization, no conflict resolution, and no remote backup. If the app were expanded for chains or multiple operators, the next architectural step would be a backend API, user identity, remote persistence, and a sync strategy for inventory and billing records.

## Important design patterns used

- Shared service abstraction for storage and backup logic
- Context-based global theming
- Screen-level feature composition with reusable modal components
- Derived analytics computed from persisted transactional records
- Defensive user-input validation with alerts before persistence or billing actions

# 9. Recruiter-Friendly Summary

## Recruiter summary

MOB is a mobile POS solution for small retailers that combines inventory, billing, receipts, and sales reporting in one offline-capable app. It is designed for operators who need reliable store workflows without depending on internet connectivity or a separate back-office system.

## Technical recruiter summary

This project is an Expo and React Native application built with TypeScript, React Navigation, Context-based theming, and an AsyncStorage service layer for local persistence. It integrates camera scanning, image/file handling, PDF generation, and EAS-based release workflows without a backend dependency.

# 10. Suggested Resume Titles

1. Offline Mobile POS and Inventory Manager
2. Barcode-Enabled Retail Billing Application
3. Local-First Point of Sale and Reporting Platform
4. Expo-Based Store Operations Mobile App
5. Mobile Billing, Inventory, and Receipt System

# 11. Professional Interview Explanation Speeches

## Speech 1 - concise HR-style explanation

The purpose of this project was to build a simple point-of-sale app for small retailers who need to manage stock and billing from a phone. The problem I wanted to solve was that many small shops still depend on manual notebooks or unstable internet-based tools, which slows down checkout and makes inventory tracking inconsistent. I built the app with React Native, Expo, TypeScript, AsyncStorage, barcode scanning, and PDF sharing so the full workflow could run directly on the device. My role covered the overall mobile architecture, inventory and billing flows, receipt generation, reporting, and theme management. One of the main challenges was keeping stock updates and billing accurate without a backend. In the end, the app gave store operators a local-first workflow for faster billing, better stock visibility, and easy receipt and report sharing.

## Speech 2 - technical interviewer explanation

The purpose of this project was to create a local-first POS system that could work even when internet access was unreliable. The problem was not just billing customers; it was making sure inventory updates, barcode-based lookup, receipt generation, and reporting all stayed consistent in a single mobile app. I used React Native with Expo, TypeScript, React Navigation, a Context-based theme system, AsyncStorage for persistence, Expo Camera for barcode scanning, Expo Image Picker and File System for product images, and Expo Print and Sharing for receipts and reports. I designed the app around feature screens and a shared storage service so UI logic stayed separate from persistence concerns. The biggest challenge was maintaining stock integrity in a client-only app and handling media and file workflows cleanly across devices. The result was a practical retail operations app that remains usable offline and is ready for staged distribution through EAS build and OTA channels.

## Speech 3 - detailed project walkthrough

The main purpose of this project was to build a handheld store operations app for small vendors, especially for cases where a full cloud POS setup would be too expensive or unreliable. The problem being solved was that billing, stock entry, and reporting often happen in separate tools or on paper, which creates delays and stock mistakes. I built the project using React Native and Expo, with TypeScript for maintainability, React Navigation for screen flow, AsyncStorage for local persistence, Expo Camera for barcode scanning, Expo AV for scan feedback, Expo Image Picker and Image Manipulator for product photos, and Expo Print and Sharing for receipts and reports. My engineering work included creating the navigation shell, building the inventory and billing modules, adding stock validation before checkout, generating derived dashboard and report data from saved bills, implementing theming and backup export, and preparing EAS profiles for release workflows. A real challenge in this project was that everything had to stay consistent without a server, so I had to keep the data model simple and centralize read and write logic in one storage layer. The impact was a focused offline-first POS app that supports faster checkout, better stock control, and on-device reporting for small retail use cases.