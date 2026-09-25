# Native Doctor — Project Health Report

> **Health Score**: **78/100 [ HEALTHY ]** | Technical Debt: **HIGH**

## Project Overview

- **Target Path**: `E:\Mavrix Trading\Home-Treding\frontend`
- **Architecture Workflow**: `unknown`
- **Scanner Version**: `v0.8.0`
- **Scan Scope**: 72 relevant files (70 code files, 0 native files)
- **Execution Timing**: file scan 594ms | static analysis 1141ms | rules run: 16

## Summary of Findings

| Severity | Count | Description |
| :--- | :---: | :--- |
| **Errors** | **0** | Action required; potential build failure, crash, or breaking misconfiguration |
| **Warnings** | **35** | Review and fix before release; architecture, performance, or native defect |
| **Suggestions** | **0** | Best-practice recommendations and modernization improvements |
| **Reviews** | **0** | Heuristic observation requiring developer investigation |

## Category Health Scores

| Category | Score | Status |
| :--- | :---: | :--- |
| **ui** | **100/100** | Optimal |
| **accessibility** | **100/100** | Optimal |
| **architecture** | **26/100** | Action Required |
| **code** | **26/100** | Action Required |
| **correctness** | **100/100** | Optimal |
| **performance** | **22/100** | Action Required |
| **native** | **100/100** | Optimal |
| **security** | **100/100** | Optimal |
| **dependencies** | **100/100** | Optimal |
| **config** | **100/100** | Optimal |

## 12-Dimension Mobile Health Scorecard

| Dimension | Score | Status | Focus Area |
| :--- | :---: | :--- | :--- |
| **Performance (Render)** | **10/100** | Action Needed | UI re-renders, unmemoized array transforms |
| **Smoothness / FPS** | **100/100** | Healthy | JS-driven animations, 60fps frame drops |
| **Memory & Leak Safety** | **100/100** | Healthy | Event listener leaks, lingering subscriptions |
| **CPU & Thermal Health** | **100/100** | Healthy | Runaway timers, background workers |
| **Battery & Background** | **100/100** | Healthy | High-frequency progress bridge intervals |
| **Cold Startup / TTI** | **100/100** | Healthy | Synchronous storage reads during launch |
| **Network & Waterfalls** | **100/100** | Healthy | Sequential independent awaits |
| **Native Toolchain** | **100/100** | Healthy | Android 14+ FGS, permissions, CocoaPods |
| **Correctness & Safety** | **100/100** | Healthy | Race conditions, edge-case safety |
| **Code Quality (DRY)** | **10/100** | Action Needed | Dead code, duplicate utilities |
| **Architecture & Layers** | **10/100** | Action Needed | Single responsibility, layer boundaries |
| **Build & Store Health** | **100/100** | Healthy | 16 KB pages, targetSdk 34, privacy manifests |
| **OVERALL MOBILE SCORE** | **78/100** | **HEALTHY** | Holistic weighted mobile index |

---

## Project Behavioral Baseline Audit

> The project behavioral baseline captures the live application structure before any fixes are applied, ensuring zero regression.

| Baseline Dimension | Monitored Count | Status |
| :--- | :---: | :--- |
| **Registered Routes** | **0** | Monitored ✓ |
| **Navigation Screens** | **0** | Monitored ✓ |
| **React Components** | **51** | Monitored ✓ |
| **Native Modules & Bridge** | **0** | Monitored ✓ |
| **API Endpoints** | **0** | Monitored ✓ |
| **Persistent Storage Keys** | **0** | Monitored ✓ |
| **Declared Permissions** | **0** | Monitored ✓ |
| **Expo Config Plugins** | **0** | Monitored ✓ |
| **Android Services** | **0** | Monitored ✓ |
| **iOS Capabilities** | **0** | Monitored ✓ |

---

## Deep Architecture & 5-Pillar Feature Matrix

| Feature Domain | Status | JS Layer | Android Native | iOS Native | Build Config | Docs |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |

---

## Codebase Cleanup & Simplification Intelligence

| Category | Detected Items | Risk Level | Remediation |
| :--- | :---: | :--- | :--- |
| **Dead / Unused Code** | **25** | Low | Verify reachability, safely prune unreachable exports |
| **Unused Dependencies** | **0** | Low | Remove from package.json to trim bundle |
| **Duplicate Logic / Utilities** | **12** | Medium | Consolidate duplicate helper functions |
| **Over-Complex Functions** | **48** | Medium | Decompose into smaller focused pure functions |
| **Unnecessary Abstractions** | **0** | Medium | Simplify pass-through wrappers |
| **Organization / SRP Smells** | **10** | Medium | Separate mixed concerns |

---

## Build & Release Preflight (Store Readiness)

> **Preflight Status**: **PASSED (Safe to trigger build)** | Blockers: **0** | Warnings: **0** | Passed: **0**

| Check | Status | Detail |
| :--- | :---: | :--- |

---

## Safe Existing-Project Preservation & Hard-Locks

> Native Doctor guarantees safe preservation of working applications. Destructive rewrites and blind deletions are blocked by default.

- **Preservation Mode**: `ACTIVE` (Strict change budget: Max 1 file, Max 5 lines per patch)
- **Hard-Locked Findings**: **0** protected critical/native finding(s) (recommendation-only)

---

## Detailed Findings

### [WARNING] REACT-SEQUENTIAL-AWAITS — Sequential independent awaits (Run in parallel with Promise.all)

- **Category**: `performance`
- **Confidence**: `HIGH`
- **Location**: `src/pages/TestLiveTrading.tsx:201`
- **File Classification**: `SAFE_SOURCE`

**What was found:**
> Sequential independent await expression detected.

**Why it matters:**
> This await does not depend on the previous await result. Running independent asynchronous operations sequentially causes unnecessary waterfall latency.

**Official platform guidance:**
> React Doctor Performance Guide: Wrap independent async operations in Promise.all([...]) so they execute concurrently.

**Recommended fix:**
> Wrap the independent awaits in Promise.all([ ... ]) so they run at the same time in parallel.

**Do not add:**
> Do not leave independent network requests or file reads waiting sequentially.

**Documentation:**
- [https://react.doctor/docs/rules/react-doctor/server-sequential-independent-await](https://react.doctor/docs/rules/react-doctor/server-sequential-independent-await)


### [WARNING] REACT-SEQUENTIAL-AWAITS — Sequential independent awaits (Run in parallel with Promise.all)

- **Category**: `performance`
- **Confidence**: `HIGH`
- **Location**: `src/pages/TestLiveTrading.tsx:202`
- **File Classification**: `SAFE_SOURCE`

**What was found:**
> Sequential independent await expression detected.

**Why it matters:**
> This await does not depend on the previous await result. Running independent asynchronous operations sequentially causes unnecessary waterfall latency.

**Official platform guidance:**
> React Doctor Performance Guide: Wrap independent async operations in Promise.all([...]) so they execute concurrently.

**Recommended fix:**
> Wrap the independent awaits in Promise.all([ ... ]) so they run at the same time in parallel.

**Do not add:**
> Do not leave independent network requests or file reads waiting sequentially.

**Documentation:**
- [https://react.doctor/docs/rules/react-doctor/server-sequential-independent-await](https://react.doctor/docs/rules/react-doctor/server-sequential-independent-await)


### [WARNING] REACT-SEQUENTIAL-AWAITS — Sequential independent awaits (Run in parallel with Promise.all)

- **Category**: `performance`
- **Confidence**: `HIGH`
- **Location**: `src/pages/TestLiveTrading.tsx:203`
- **File Classification**: `SAFE_SOURCE`

**What was found:**
> Sequential independent await expression detected.

**Why it matters:**
> This await does not depend on the previous await result. Running independent asynchronous operations sequentially causes unnecessary waterfall latency.

**Official platform guidance:**
> React Doctor Performance Guide: Wrap independent async operations in Promise.all([...]) so they execute concurrently.

**Recommended fix:**
> Wrap the independent awaits in Promise.all([ ... ]) so they run at the same time in parallel.

**Do not add:**
> Do not leave independent network requests or file reads waiting sequentially.

**Documentation:**
- [https://react.doctor/docs/rules/react-doctor/server-sequential-independent-await](https://react.doctor/docs/rules/react-doctor/server-sequential-independent-await)


### [WARNING] REACT-SEQUENTIAL-AWAITS — Sequential independent awaits (Run in parallel with Promise.all)

- **Category**: `performance`
- **Confidence**: `HIGH`
- **Location**: `src/pages/TestLiveTrading.tsx:204`
- **File Classification**: `SAFE_SOURCE`

**What was found:**
> Sequential independent await expression detected.

**Why it matters:**
> This await does not depend on the previous await result. Running independent asynchronous operations sequentially causes unnecessary waterfall latency.

**Official platform guidance:**
> React Doctor Performance Guide: Wrap independent async operations in Promise.all([...]) so they execute concurrently.

**Recommended fix:**
> Wrap the independent awaits in Promise.all([ ... ]) so they run at the same time in parallel.

**Do not add:**
> Do not leave independent network requests or file reads waiting sequentially.

**Documentation:**
- [https://react.doctor/docs/rules/react-doctor/server-sequential-independent-await](https://react.doctor/docs/rules/react-doctor/server-sequential-independent-await)


### [WARNING] REACT-SEQUENTIAL-AWAITS — Sequential independent awaits (Run in parallel with Promise.all)

- **Category**: `performance`
- **Confidence**: `HIGH`
- **Location**: `src/pages/TestLiveTrading.tsx:205`
- **File Classification**: `SAFE_SOURCE`

**What was found:**
> Sequential independent await expression detected.

**Why it matters:**
> This await does not depend on the previous await result. Running independent asynchronous operations sequentially causes unnecessary waterfall latency.

**Official platform guidance:**
> React Doctor Performance Guide: Wrap independent async operations in Promise.all([...]) so they execute concurrently.

**Recommended fix:**
> Wrap the independent awaits in Promise.all([ ... ]) so they run at the same time in parallel.

**Do not add:**
> Do not leave independent network requests or file reads waiting sequentially.

**Documentation:**
- [https://react.doctor/docs/rules/react-doctor/server-sequential-independent-await](https://react.doctor/docs/rules/react-doctor/server-sequential-independent-await)


### [WARNING] REACT-SEQUENTIAL-AWAITS — Sequential independent awaits (Run in parallel with Promise.all)

- **Category**: `performance`
- **Confidence**: `HIGH`
- **Location**: `src/pages/TestLiveTrading.tsx:206`
- **File Classification**: `SAFE_SOURCE`

**What was found:**
> Sequential independent await expression detected.

**Why it matters:**
> This await does not depend on the previous await result. Running independent asynchronous operations sequentially causes unnecessary waterfall latency.

**Official platform guidance:**
> React Doctor Performance Guide: Wrap independent async operations in Promise.all([...]) so they execute concurrently.

**Recommended fix:**
> Wrap the independent awaits in Promise.all([ ... ]) so they run at the same time in parallel.

**Do not add:**
> Do not leave independent network requests or file reads waiting sequentially.

**Documentation:**
- [https://react.doctor/docs/rules/react-doctor/server-sequential-independent-await](https://react.doctor/docs/rules/react-doctor/server-sequential-independent-await)


### [WARNING] REACT-SEQUENTIAL-AWAITS — Sequential independent awaits (Run in parallel with Promise.all)

- **Category**: `performance`
- **Confidence**: `HIGH`
- **Location**: `src/pages/TestLiveTrading.tsx:207`
- **File Classification**: `SAFE_SOURCE`

**What was found:**
> Sequential independent await expression detected.

**Why it matters:**
> This await does not depend on the previous await result. Running independent asynchronous operations sequentially causes unnecessary waterfall latency.

**Official platform guidance:**
> React Doctor Performance Guide: Wrap independent async operations in Promise.all([...]) so they execute concurrently.

**Recommended fix:**
> Wrap the independent awaits in Promise.all([ ... ]) so they run at the same time in parallel.

**Do not add:**
> Do not leave independent network requests or file reads waiting sequentially.

**Documentation:**
- [https://react.doctor/docs/rules/react-doctor/server-sequential-independent-await](https://react.doctor/docs/rules/react-doctor/server-sequential-independent-await)


### [WARNING] REACT-SEQUENTIAL-AWAITS — Sequential independent awaits (Run in parallel with Promise.all)

- **Category**: `performance`
- **Confidence**: `HIGH`
- **Location**: `src/pages/TestLiveTrading.tsx:208`
- **File Classification**: `SAFE_SOURCE`

**What was found:**
> Sequential independent await expression detected.

**Why it matters:**
> This await does not depend on the previous await result. Running independent asynchronous operations sequentially causes unnecessary waterfall latency.

**Official platform guidance:**
> React Doctor Performance Guide: Wrap independent async operations in Promise.all([...]) so they execute concurrently.

**Recommended fix:**
> Wrap the independent awaits in Promise.all([ ... ]) so they run at the same time in parallel.

**Do not add:**
> Do not leave independent network requests or file reads waiting sequentially.

**Documentation:**
- [https://react.doctor/docs/rules/react-doctor/server-sequential-independent-await](https://react.doctor/docs/rules/react-doctor/server-sequential-independent-await)


### [WARNING] REACT-SEQUENTIAL-AWAITS — Sequential independent awaits (Run in parallel with Promise.all)

- **Category**: `performance`
- **Confidence**: `HIGH`
- **Location**: `src/pages/TestLiveTrading.tsx:209`
- **File Classification**: `SAFE_SOURCE`

**What was found:**
> Sequential independent await expression detected.

**Why it matters:**
> This await does not depend on the previous await result. Running independent asynchronous operations sequentially causes unnecessary waterfall latency.

**Official platform guidance:**
> React Doctor Performance Guide: Wrap independent async operations in Promise.all([...]) so they execute concurrently.

**Recommended fix:**
> Wrap the independent awaits in Promise.all([ ... ]) so they run at the same time in parallel.

**Do not add:**
> Do not leave independent network requests or file reads waiting sequentially.

**Documentation:**
- [https://react.doctor/docs/rules/react-doctor/server-sequential-independent-await](https://react.doctor/docs/rules/react-doctor/server-sequential-independent-await)


### [WARNING] REACT-SEQUENTIAL-AWAITS — Sequential independent awaits (Run in parallel with Promise.all)

- **Category**: `performance`
- **Confidence**: `HIGH`
- **Location**: `src/pages/TestLiveTrading.tsx:210`
- **File Classification**: `SAFE_SOURCE`

**What was found:**
> Sequential independent await expression detected.

**Why it matters:**
> This await does not depend on the previous await result. Running independent asynchronous operations sequentially causes unnecessary waterfall latency.

**Official platform guidance:**
> React Doctor Performance Guide: Wrap independent async operations in Promise.all([...]) so they execute concurrently.

**Recommended fix:**
> Wrap the independent awaits in Promise.all([ ... ]) so they run at the same time in parallel.

**Do not add:**
> Do not leave independent network requests or file reads waiting sequentially.

**Documentation:**
- [https://react.doctor/docs/rules/react-doctor/server-sequential-independent-await](https://react.doctor/docs/rules/react-doctor/server-sequential-independent-await)


### [WARNING] REACT-UNMEMOIZED-CONTEXT-VALUE — Unmemoized object/array in Context.Provider value (Cascading Re-renders)

- **Category**: `performance`
- **Confidence**: `HIGH`
- **Location**: `src/context/TradingModeContext.tsx:99`
- **File Classification**: `SAFE_SOURCE`

**What was found:**
> Unmemoized inline object/array passed directly to Context.Provider value.

**Why it matters:**
> A new object reference is created on every render. Every component that subscribes to this context will re-render unnecessarily, even if none of the state values changed.

**Official platform guidance:**
> React Docs: Wrap the context value object in useMemo so consumers only re-render when dependencies change.

**Recommended fix:**
> Wrap the context value with useMemo: const value = useMemo(() => ({ ... }), [dependencies]); and pass <Provider value={value}>.

**Do not add:**
> Do not pass inline objects value={{ a, b }} directly into top-level context providers.

**Documentation:**
- [https://react.dev/reference/react/useMemo#memoizing-a-context-value](https://react.dev/reference/react/useMemo#memoizing-a-context-value)


### [WARNING] REACT-LAZY-STATE-INIT — Eager function call in useState initial state (Use Lazy Initial State)

- **Category**: `performance`
- **Confidence**: `HIGH`
- **Location**: `src/hooks/useLiveMarketData.ts:46`
- **File Classification**: `SAFE_SOURCE`

**What was found:**
> Function call "getMarketStatus()" passed directly as useState initial argument.

**Why it matters:**
> When you pass a function call directly to useState, JavaScript executes it on EVERY render of the component, even though React only uses the initial value on the first mount.

**Official platform guidance:**
> React Docs: If you pass a function call to useState, it will run on every render. Pass the function itself (useState(fn)) or an arrow function (useState(() => fn())) for lazy initialization.

**Recommended fix:**
> Convert eager call to lazy initializer: useState(() => getMarketStatus()).

**Do not add:**
> Do not pass expensive calculations, storage reads, or JSON.parse directly into useState.

**Documentation:**
- [https://react.dev/reference/react/useState#avoiding-recreating-the-initial-state](https://react.dev/reference/react/useState#avoiding-recreating-the-initial-state)


### [WARNING] REACT-JS-SET-MAP-LOOKUPS — Linear Array lookup inside loop (Use Set/Map for O(1) lookups)

- **Category**: `performance`
- **Confidence**: `HIGH`
- **Location**: `src/components/OrderManagement.tsx:255`
- **File Classification**: `SAFE_SOURCE`

**What was found:**
> Array .includes() linear lookup inside loop iteration.

**Why it matters:**
> Calling array .includes() inside a loop creates O(N * M) quadratic time complexity. Converting the target collection to a Set gives O(1) constant time lookups.

**Official platform guidance:**
> JavaScript & React Performance Best Practice: Use Set.has() or Map.get() for lookups in loops to achieve O(1) performance.

**Recommended fix:**
> Construct a new Set(array) outside the loop and use set.has(item) instead of array.includes(item).

**Do not add:**
> Do not perform repeated array linear scans inside loops.

**Documentation:**
- [https://react.doctor/docs/rules/react-doctor/js-set-map-lookups](https://react.doctor/docs/rules/react-doctor/js-set-map-lookups)


### [WARNING] REACT-JS-SET-MAP-LOOKUPS — Linear Array lookup inside loop (Use Set/Map for O(1) lookups)

- **Category**: `performance`
- **Confidence**: `HIGH`
- **Location**: `src/hooks/useLiveMarketData.ts:98`
- **File Classification**: `SAFE_SOURCE`

**What was found:**
> Array .includes() linear lookup inside loop iteration.

**Why it matters:**
> Calling array .includes() inside a loop creates O(N * M) quadratic time complexity. Converting the target collection to a Set gives O(1) constant time lookups.

**Official platform guidance:**
> JavaScript & React Performance Best Practice: Use Set.has() or Map.get() for lookups in loops to achieve O(1) performance.

**Recommended fix:**
> Construct a new Set(array) outside the loop and use set.has(item) instead of array.includes(item).

**Do not add:**
> Do not perform repeated array linear scans inside loops.

**Documentation:**
- [https://react.doctor/docs/rules/react-doctor/js-set-map-lookups](https://react.doctor/docs/rules/react-doctor/js-set-map-lookups)


### [WARNING] REACT-JS-SET-MAP-LOOKUPS — Linear Array lookup inside loop (Use Set/Map for O(1) lookups)

- **Category**: `performance`
- **Confidence**: `HIGH`
- **Location**: `src/pages/CreateStrategy.tsx:675`
- **File Classification**: `SAFE_SOURCE`

**What was found:**
> Array .includes() linear lookup inside loop iteration.

**Why it matters:**
> Calling array .includes() inside a loop creates O(N * M) quadratic time complexity. Converting the target collection to a Set gives O(1) constant time lookups.

**Official platform guidance:**
> JavaScript & React Performance Best Practice: Use Set.has() or Map.get() for lookups in loops to achieve O(1) performance.

**Recommended fix:**
> Construct a new Set(array) outside the loop and use set.has(item) instead of array.includes(item).

**Do not add:**
> Do not perform repeated array linear scans inside loops.

**Documentation:**
- [https://react.doctor/docs/rules/react-doctor/js-set-map-lookups](https://react.doctor/docs/rules/react-doctor/js-set-map-lookups)


### [WARNING] REACT-JS-FLATMAP-FILTER — .map().filter() chained iteration (Use flatMap or single loop)

- **Category**: `performance`
- **Confidence**: `HIGH`
- **Location**: `src/pages/TestLiveTrading.tsx:76`
- **File Classification**: `SAFE_SOURCE`

**What was found:**
> .map().filter(Boolean) chained iteration loops over the array twice.

**Why it matters:**
> Chaining .map() followed immediately by .filter() allocates an unnecessary intermediate array and loops twice over all elements.

**Official platform guidance:**
> React Doctor Performance Guide: Use .flatMap() with a conditional return ([] to discard, [item] to keep) or a single for-of loop to avoid intermediate allocations.

**Recommended fix:**
> Replace .map().filter(Boolean) with a single for...of loop, reduce, or .flatMap().

**Do not add:**
> Do not create intermediate array allocations in hot paths.

**Documentation:**
- [https://react.doctor/docs/rules/react-doctor/js-flatmap-filter](https://react.doctor/docs/rules/react-doctor/js-flatmap-filter)


### [WARNING] RNDOCTOR-LAYER-VIOLATION — Architectural Layer Boundary Violation (DOMAIN → UI)

- **Category**: `architecture`
- **Confidence**: `HIGH`
- **Location**: `src/App.tsx`
- **File Classification**: `ENTRY_POINT`

**What was found:**
> src/App.tsx (DOMAIN) imports src/context/TradingModeContext.tsx (UI).

**Why it matters:**
> Lower architectural layers (Services, Data, Domain) must remain decoupled from presentation components to ensure testability and prevent cyclic re-renders.

**Official platform guidance:**
> Software Architecture Guidance: Dependencies must point inwards towards pure domain logic, never backwards to UI components.

**Recommended fix:**
> Pass UI callbacks or handlers via function arguments or use event listeners / reactive hooks.

**Do not add:**
> Do not add a circular barrel export or import Screens directly into services.


### [WARNING] RNDOCTOR-LAYER-VIOLATION — Architectural Layer Boundary Violation (DOMAIN → UI)

- **Category**: `architecture`
- **Confidence**: `HIGH`
- **Location**: `src/App.tsx`
- **File Classification**: `ENTRY_POINT`

**What was found:**
> src/App.tsx (DOMAIN) imports src/pages/Login.tsx (UI).

**Why it matters:**
> Lower architectural layers (Services, Data, Domain) must remain decoupled from presentation components to ensure testability and prevent cyclic re-renders.

**Official platform guidance:**
> Software Architecture Guidance: Dependencies must point inwards towards pure domain logic, never backwards to UI components.

**Recommended fix:**
> Pass UI callbacks or handlers via function arguments or use event listeners / reactive hooks.

**Do not add:**
> Do not add a circular barrel export or import Screens directly into services.


### [WARNING] RNDOCTOR-LAYER-VIOLATION — Architectural Layer Boundary Violation (DOMAIN → UI)

- **Category**: `architecture`
- **Confidence**: `HIGH`
- **Location**: `src/App.tsx`
- **File Classification**: `ENTRY_POINT`

**What was found:**
> src/App.tsx (DOMAIN) imports src/pages/Register.tsx (UI).

**Why it matters:**
> Lower architectural layers (Services, Data, Domain) must remain decoupled from presentation components to ensure testability and prevent cyclic re-renders.

**Official platform guidance:**
> Software Architecture Guidance: Dependencies must point inwards towards pure domain logic, never backwards to UI components.

**Recommended fix:**
> Pass UI callbacks or handlers via function arguments or use event listeners / reactive hooks.

**Do not add:**
> Do not add a circular barrel export or import Screens directly into services.


### [WARNING] RNDOCTOR-LAYER-VIOLATION — Architectural Layer Boundary Violation (DOMAIN → UI)

- **Category**: `architecture`
- **Confidence**: `HIGH`
- **Location**: `src/App.tsx`
- **File Classification**: `ENTRY_POINT`

**What was found:**
> src/App.tsx (DOMAIN) imports src/pages/Dashboard.tsx (UI).

**Why it matters:**
> Lower architectural layers (Services, Data, Domain) must remain decoupled from presentation components to ensure testability and prevent cyclic re-renders.

**Official platform guidance:**
> Software Architecture Guidance: Dependencies must point inwards towards pure domain logic, never backwards to UI components.

**Recommended fix:**
> Pass UI callbacks or handlers via function arguments or use event listeners / reactive hooks.

**Do not add:**
> Do not add a circular barrel export or import Screens directly into services.


### [WARNING] RNDOCTOR-LAYER-VIOLATION — Architectural Layer Boundary Violation (DOMAIN → UI)

- **Category**: `architecture`
- **Confidence**: `HIGH`
- **Location**: `src/App.tsx`
- **File Classification**: `ENTRY_POINT`

**What was found:**
> src/App.tsx (DOMAIN) imports src/pages/Brokers.tsx (UI).

**Why it matters:**
> Lower architectural layers (Services, Data, Domain) must remain decoupled from presentation components to ensure testability and prevent cyclic re-renders.

**Official platform guidance:**
> Software Architecture Guidance: Dependencies must point inwards towards pure domain logic, never backwards to UI components.

**Recommended fix:**
> Pass UI callbacks or handlers via function arguments or use event listeners / reactive hooks.

**Do not add:**
> Do not add a circular barrel export or import Screens directly into services.


### [WARNING] RNDOCTOR-LAYER-VIOLATION — Architectural Layer Boundary Violation (DOMAIN → UI)

- **Category**: `architecture`
- **Confidence**: `HIGH`
- **Location**: `src/App.tsx`
- **File Classification**: `ENTRY_POINT`

**What was found:**
> src/App.tsx (DOMAIN) imports src/pages/DhanCallback.tsx (UI).

**Why it matters:**
> Lower architectural layers (Services, Data, Domain) must remain decoupled from presentation components to ensure testability and prevent cyclic re-renders.

**Official platform guidance:**
> Software Architecture Guidance: Dependencies must point inwards towards pure domain logic, never backwards to UI components.

**Recommended fix:**
> Pass UI callbacks or handlers via function arguments or use event listeners / reactive hooks.

**Do not add:**
> Do not add a circular barrel export or import Screens directly into services.


### [WARNING] RNDOCTOR-LAYER-VIOLATION — Architectural Layer Boundary Violation (DOMAIN → UI)

- **Category**: `architecture`
- **Confidence**: `HIGH`
- **Location**: `src/App.tsx`
- **File Classification**: `ENTRY_POINT`

**What was found:**
> src/App.tsx (DOMAIN) imports src/pages/Strategies.tsx (UI).

**Why it matters:**
> Lower architectural layers (Services, Data, Domain) must remain decoupled from presentation components to ensure testability and prevent cyclic re-renders.

**Official platform guidance:**
> Software Architecture Guidance: Dependencies must point inwards towards pure domain logic, never backwards to UI components.

**Recommended fix:**
> Pass UI callbacks or handlers via function arguments or use event listeners / reactive hooks.

**Do not add:**
> Do not add a circular barrel export or import Screens directly into services.


### [WARNING] RNDOCTOR-LAYER-VIOLATION — Architectural Layer Boundary Violation (DOMAIN → UI)

- **Category**: `architecture`
- **Confidence**: `HIGH`
- **Location**: `src/App.tsx`
- **File Classification**: `ENTRY_POINT`

**What was found:**
> src/App.tsx (DOMAIN) imports src/pages/CreateStrategy.tsx (UI).

**Why it matters:**
> Lower architectural layers (Services, Data, Domain) must remain decoupled from presentation components to ensure testability and prevent cyclic re-renders.

**Official platform guidance:**
> Software Architecture Guidance: Dependencies must point inwards towards pure domain logic, never backwards to UI components.

**Recommended fix:**
> Pass UI callbacks or handlers via function arguments or use event listeners / reactive hooks.

**Do not add:**
> Do not add a circular barrel export or import Screens directly into services.


### [WARNING] RNDOCTOR-LAYER-VIOLATION — Architectural Layer Boundary Violation (DOMAIN → UI)

- **Category**: `architecture`
- **Confidence**: `HIGH`
- **Location**: `src/App.tsx`
- **File Classification**: `ENTRY_POINT`

**What was found:**
> src/App.tsx (DOMAIN) imports src/pages/Portfolio.tsx (UI).

**Why it matters:**
> Lower architectural layers (Services, Data, Domain) must remain decoupled from presentation components to ensure testability and prevent cyclic re-renders.

**Official platform guidance:**
> Software Architecture Guidance: Dependencies must point inwards towards pure domain logic, never backwards to UI components.

**Recommended fix:**
> Pass UI callbacks or handlers via function arguments or use event listeners / reactive hooks.

**Do not add:**
> Do not add a circular barrel export or import Screens directly into services.


### [WARNING] RNDOCTOR-LAYER-VIOLATION — Architectural Layer Boundary Violation (DOMAIN → UI)

- **Category**: `architecture`
- **Confidence**: `HIGH`
- **Location**: `src/App.tsx`
- **File Classification**: `ENTRY_POINT`

**What was found:**
> src/App.tsx (DOMAIN) imports src/pages/Reports.tsx (UI).

**Why it matters:**
> Lower architectural layers (Services, Data, Domain) must remain decoupled from presentation components to ensure testability and prevent cyclic re-renders.

**Official platform guidance:**
> Software Architecture Guidance: Dependencies must point inwards towards pure domain logic, never backwards to UI components.

**Recommended fix:**
> Pass UI callbacks or handlers via function arguments or use event listeners / reactive hooks.

**Do not add:**
> Do not add a circular barrel export or import Screens directly into services.


### [WARNING] RNDOCTOR-LAYER-VIOLATION — Architectural Layer Boundary Violation (DOMAIN → UI)

- **Category**: `architecture`
- **Confidence**: `HIGH`
- **Location**: `src/App.tsx`
- **File Classification**: `ENTRY_POINT`

**What was found:**
> src/App.tsx (DOMAIN) imports src/pages/TradingDashboard.tsx (UI).

**Why it matters:**
> Lower architectural layers (Services, Data, Domain) must remain decoupled from presentation components to ensure testability and prevent cyclic re-renders.

**Official platform guidance:**
> Software Architecture Guidance: Dependencies must point inwards towards pure domain logic, never backwards to UI components.

**Recommended fix:**
> Pass UI callbacks or handlers via function arguments or use event listeners / reactive hooks.

**Do not add:**
> Do not add a circular barrel export or import Screens directly into services.


### [WARNING] RNDOCTOR-LAYER-VIOLATION — Architectural Layer Boundary Violation (DOMAIN → UI)

- **Category**: `architecture`
- **Confidence**: `HIGH`
- **Location**: `src/App.tsx`
- **File Classification**: `ENTRY_POINT`

**What was found:**
> src/App.tsx (DOMAIN) imports src/pages/TestLiveTrading.tsx (UI).

**Why it matters:**
> Lower architectural layers (Services, Data, Domain) must remain decoupled from presentation components to ensure testability and prevent cyclic re-renders.

**Official platform guidance:**
> Software Architecture Guidance: Dependencies must point inwards towards pure domain logic, never backwards to UI components.

**Recommended fix:**
> Pass UI callbacks or handlers via function arguments or use event listeners / reactive hooks.

**Do not add:**
> Do not add a circular barrel export or import Screens directly into services.


### [WARNING] RNDOCTOR-LAYER-VIOLATION — Architectural Layer Boundary Violation (DOMAIN → UI)

- **Category**: `architecture`
- **Confidence**: `HIGH`
- **Location**: `src/App.tsx`
- **File Classification**: `ENTRY_POINT`

**What was found:**
> src/App.tsx (DOMAIN) imports src/pages/OptionChain.tsx (UI).

**Why it matters:**
> Lower architectural layers (Services, Data, Domain) must remain decoupled from presentation components to ensure testability and prevent cyclic re-renders.

**Official platform guidance:**
> Software Architecture Guidance: Dependencies must point inwards towards pure domain logic, never backwards to UI components.

**Recommended fix:**
> Pass UI callbacks or handlers via function arguments or use event listeners / reactive hooks.

**Do not add:**
> Do not add a circular barrel export or import Screens directly into services.


### [WARNING] RNDOCTOR-LAYER-VIOLATION — Architectural Layer Boundary Violation (DOMAIN → UI)

- **Category**: `architecture`
- **Confidence**: `HIGH`
- **Location**: `src/App.tsx`
- **File Classification**: `ENTRY_POINT`

**What was found:**
> src/App.tsx (DOMAIN) imports src/pages/BacktestPage.tsx (UI).

**Why it matters:**
> Lower architectural layers (Services, Data, Domain) must remain decoupled from presentation components to ensure testability and prevent cyclic re-renders.

**Official platform guidance:**
> Software Architecture Guidance: Dependencies must point inwards towards pure domain logic, never backwards to UI components.

**Recommended fix:**
> Pass UI callbacks or handlers via function arguments or use event listeners / reactive hooks.

**Do not add:**
> Do not add a circular barrel export or import Screens directly into services.


### [WARNING] RNDOCTOR-LAYER-VIOLATION — Architectural Layer Boundary Violation (DOMAIN → UI)

- **Category**: `architecture`
- **Confidence**: `HIGH`
- **Location**: `src/App.tsx`
- **File Classification**: `ENTRY_POINT`

**What was found:**
> src/App.tsx (DOMAIN) imports src/pages/LiveChartPage.tsx (UI).

**Why it matters:**
> Lower architectural layers (Services, Data, Domain) must remain decoupled from presentation components to ensure testability and prevent cyclic re-renders.

**Official platform guidance:**
> Software Architecture Guidance: Dependencies must point inwards towards pure domain logic, never backwards to UI components.

**Recommended fix:**
> Pass UI callbacks or handlers via function arguments or use event listeners / reactive hooks.

**Do not add:**
> Do not add a circular barrel export or import Screens directly into services.


### [WARNING] RNDOCTOR-LAYER-VIOLATION — Architectural Layer Boundary Violation (DOMAIN → UI)

- **Category**: `architecture`
- **Confidence**: `HIGH`
- **Location**: `src/App.tsx`
- **File Classification**: `ENTRY_POINT`

**What was found:**
> src/App.tsx (DOMAIN) imports src/pages/Subscription.tsx (UI).

**Why it matters:**
> Lower architectural layers (Services, Data, Domain) must remain decoupled from presentation components to ensure testability and prevent cyclic re-renders.

**Official platform guidance:**
> Software Architecture Guidance: Dependencies must point inwards towards pure domain logic, never backwards to UI components.

**Recommended fix:**
> Pass UI callbacks or handlers via function arguments or use event listeners / reactive hooks.

**Do not add:**
> Do not add a circular barrel export or import Screens directly into services.


### [HIGH] RNDOCTOR-DEADCODE-FILE — Dead / Unused File: build.js

- **Category**: `code`
- **Confidence**: `HIGH`
- **Location**: `build.js`
- **File Classification**: `SAFE_SOURCE`

**Detected Components:**
- [x] Entry points analyzed: src/App.tsx, src/index.tsx
- [x] Zero inbound import edges from active component tree
- [x] Zero dynamic string references

**Problem / Architectural Break:**
> The file is completely disconnected from the active runtime execution graph.

**Expected:**
`All files in src/ should be reachable by the application or routes.`

**Actual:**
`File is completely unreachable.`

**Why it matters:**
> Unused source files increase bundle size, slow down build and IDE indexing times, and create maintenance confusion.

**Official platform guidance:**
> React Native Performance Guidance: Eliminate dead source trees to minimize bundle size and JS parse time.

**Recommended fix:**
> Safely delete this file or register its route in your navigation structure.

**Do not add:**
> Do not keep obsolete files for historical reasons — rely on version control (git).

**Verification Checklist:**
- [ ] 1. Verify no external native bundle references build.js
- [ ] 2. Remove file and run tsc to confirm zero broken imports.


### [HIGH] RNDOCTOR-DEADCODE-FILE — Dead / Unused File: src/react-app-env.d.ts

- **Category**: `code`
- **Confidence**: `HIGH`
- **Location**: `src/react-app-env.d.ts`
- **File Classification**: `SAFE_SOURCE`

**Detected Components:**
- [x] Entry points analyzed: src/App.tsx, src/index.tsx
- [x] Zero inbound import edges from active component tree
- [x] Zero dynamic string references

**Problem / Architectural Break:**
> The file is completely disconnected from the active runtime execution graph.

**Expected:**
`All files in src/ should be reachable by the application or routes.`

**Actual:**
`File is completely unreachable.`

**Why it matters:**
> Unused source files increase bundle size, slow down build and IDE indexing times, and create maintenance confusion.

**Official platform guidance:**
> React Native Performance Guidance: Eliminate dead source trees to minimize bundle size and JS parse time.

**Recommended fix:**
> Safely delete this file or register its route in your navigation structure.

**Do not add:**
> Do not keep obsolete files for historical reasons — rely on version control (git).

**Verification Checklist:**
- [ ] 1. Verify no external native bundle references src/react-app-env.d.ts
- [ ] 2. Remove file and run tsc to confirm zero broken imports.


### [HIGH] RNDOCTOR-DEADCODE-FILE — Dead / Unused File: src/setupTests.ts

- **Category**: `code`
- **Confidence**: `HIGH`
- **Location**: `src/setupTests.ts`
- **File Classification**: `SAFE_SOURCE`

**Detected Components:**
- [x] Entry points analyzed: src/App.tsx, src/index.tsx
- [x] Zero inbound import edges from active component tree
- [x] Zero dynamic string references

**Problem / Architectural Break:**
> The file is completely disconnected from the active runtime execution graph.

**Expected:**
`All files in src/ should be reachable by the application or routes.`

**Actual:**
`File is completely unreachable.`

**Why it matters:**
> Unused source files increase bundle size, slow down build and IDE indexing times, and create maintenance confusion.

**Official platform guidance:**
> React Native Performance Guidance: Eliminate dead source trees to minimize bundle size and JS parse time.

**Recommended fix:**
> Safely delete this file or register its route in your navigation structure.

**Do not add:**
> Do not keep obsolete files for historical reasons — rely on version control (git).

**Verification Checklist:**
- [ ] 1. Verify no external native bundle references src/setupTests.ts
- [ ] 2. Remove file and run tsc to confirm zero broken imports.


### [HIGH] RNDOCTOR-DEADCODE-FILE — Dead / Unused File: src/components/AddBrokerForm.tsx

- **Category**: `code`
- **Confidence**: `HIGH`
- **Location**: `src/components/AddBrokerForm.tsx`
- **File Classification**: `SAFE_SOURCE`

**Detected Components:**
- [x] Entry points analyzed: src/App.tsx, src/index.tsx
- [x] Zero inbound import edges from active component tree
- [x] Zero dynamic string references

**Problem / Architectural Break:**
> The file is completely disconnected from the active runtime execution graph.

**Expected:**
`All files in src/ should be reachable by the application or routes.`

**Actual:**
`File is completely unreachable.`

**Why it matters:**
> Unused source files increase bundle size, slow down build and IDE indexing times, and create maintenance confusion.

**Official platform guidance:**
> React Native Performance Guidance: Eliminate dead source trees to minimize bundle size and JS parse time.

**Recommended fix:**
> Safely delete this file or register its route in your navigation structure.

**Do not add:**
> Do not keep obsolete files for historical reasons — rely on version control (git).

**Verification Checklist:**
- [ ] 1. Verify no external native bundle references src/components/AddBrokerForm.tsx
- [ ] 2. Remove file and run tsc to confirm zero broken imports.


### [HIGH] RNDOCTOR-DEADCODE-FILE — Dead / Unused File: src/components/BrokerageForm.tsx

- **Category**: `code`
- **Confidence**: `HIGH`
- **Location**: `src/components/BrokerageForm.tsx`
- **File Classification**: `SAFE_SOURCE`

**Detected Components:**
- [x] Entry points analyzed: src/App.tsx, src/index.tsx
- [x] Zero inbound import edges from active component tree
- [x] Zero dynamic string references

**Problem / Architectural Break:**
> The file is completely disconnected from the active runtime execution graph.

**Expected:**
`All files in src/ should be reachable by the application or routes.`

**Actual:**
`File is completely unreachable.`

**Why it matters:**
> Unused source files increase bundle size, slow down build and IDE indexing times, and create maintenance confusion.

**Official platform guidance:**
> React Native Performance Guidance: Eliminate dead source trees to minimize bundle size and JS parse time.

**Recommended fix:**
> Safely delete this file or register its route in your navigation structure.

**Do not add:**
> Do not keep obsolete files for historical reasons — rely on version control (git).

**Verification Checklist:**
- [ ] 1. Verify no external native bundle references src/components/BrokerageForm.tsx
- [ ] 2. Remove file and run tsc to confirm zero broken imports.


### [HIGH] RNDOCTOR-DEADCODE-FILE — Dead / Unused File: src/components/BrokerCard.tsx

- **Category**: `code`
- **Confidence**: `HIGH`
- **Location**: `src/components/BrokerCard.tsx`
- **File Classification**: `SAFE_SOURCE`

**Detected Components:**
- [x] Entry points analyzed: src/App.tsx, src/index.tsx
- [x] Zero inbound import edges from active component tree
- [x] Zero dynamic string references

**Problem / Architectural Break:**
> The file is completely disconnected from the active runtime execution graph.

**Expected:**
`All files in src/ should be reachable by the application or routes.`

**Actual:**
`File is completely unreachable.`

**Why it matters:**
> Unused source files increase bundle size, slow down build and IDE indexing times, and create maintenance confusion.

**Official platform guidance:**
> React Native Performance Guidance: Eliminate dead source trees to minimize bundle size and JS parse time.

**Recommended fix:**
> Safely delete this file or register its route in your navigation structure.

**Do not add:**
> Do not keep obsolete files for historical reasons — rely on version control (git).

**Verification Checklist:**
- [ ] 1. Verify no external native bundle references src/components/BrokerCard.tsx
- [ ] 2. Remove file and run tsc to confirm zero broken imports.


### [HIGH] RNDOCTOR-DEADCODE-FILE — Dead / Unused File: src/components/DhanTerminal.tsx

- **Category**: `code`
- **Confidence**: `HIGH`
- **Location**: `src/components/DhanTerminal.tsx`
- **File Classification**: `SAFE_SOURCE`

**Detected Components:**
- [x] Entry points analyzed: src/App.tsx, src/index.tsx
- [x] Zero inbound import edges from active component tree
- [x] Zero dynamic string references

**Problem / Architectural Break:**
> The file is completely disconnected from the active runtime execution graph.

**Expected:**
`All files in src/ should be reachable by the application or routes.`

**Actual:**
`File is completely unreachable.`

**Why it matters:**
> Unused source files increase bundle size, slow down build and IDE indexing times, and create maintenance confusion.

**Official platform guidance:**
> React Native Performance Guidance: Eliminate dead source trees to minimize bundle size and JS parse time.

**Recommended fix:**
> Safely delete this file or register its route in your navigation structure.

**Do not add:**
> Do not keep obsolete files for historical reasons — rely on version control (git).

**Verification Checklist:**
- [ ] 1. Verify no external native bundle references src/components/DhanTerminal.tsx
- [ ] 2. Remove file and run tsc to confirm zero broken imports.


### [HIGH] RNDOCTOR-DEADCODE-FILE — Dead / Unused File: src/components/LiveMarketTicker.tsx

- **Category**: `code`
- **Confidence**: `HIGH`
- **Location**: `src/components/LiveMarketTicker.tsx`
- **File Classification**: `SAFE_SOURCE`

**Detected Components:**
- [x] Entry points analyzed: src/App.tsx, src/index.tsx
- [x] Zero inbound import edges from active component tree
- [x] Zero dynamic string references

**Problem / Architectural Break:**
> The file is completely disconnected from the active runtime execution graph.

**Expected:**
`All files in src/ should be reachable by the application or routes.`

**Actual:**
`File is completely unreachable.`

**Why it matters:**
> Unused source files increase bundle size, slow down build and IDE indexing times, and create maintenance confusion.

**Official platform guidance:**
> React Native Performance Guidance: Eliminate dead source trees to minimize bundle size and JS parse time.

**Recommended fix:**
> Safely delete this file or register its route in your navigation structure.

**Do not add:**
> Do not keep obsolete files for historical reasons — rely on version control (git).

**Verification Checklist:**
- [ ] 1. Verify no external native bundle references src/components/LiveMarketTicker.tsx
- [ ] 2. Remove file and run tsc to confirm zero broken imports.


### [HIGH] RNDOCTOR-DEADCODE-FILE — Dead / Unused File: src/components/MarketDashboard.tsx

- **Category**: `code`
- **Confidence**: `HIGH`
- **Location**: `src/components/MarketDashboard.tsx`
- **File Classification**: `SAFE_SOURCE`

**Detected Components:**
- [x] Entry points analyzed: src/App.tsx, src/index.tsx
- [x] Zero inbound import edges from active component tree
- [x] Zero dynamic string references

**Problem / Architectural Break:**
> The file is completely disconnected from the active runtime execution graph.

**Expected:**
`All files in src/ should be reachable by the application or routes.`

**Actual:**
`File is completely unreachable.`

**Why it matters:**
> Unused source files increase bundle size, slow down build and IDE indexing times, and create maintenance confusion.

**Official platform guidance:**
> React Native Performance Guidance: Eliminate dead source trees to minimize bundle size and JS parse time.

**Recommended fix:**
> Safely delete this file or register its route in your navigation structure.

**Do not add:**
> Do not keep obsolete files for historical reasons — rely on version control (git).

**Verification Checklist:**
- [ ] 1. Verify no external native bundle references src/components/MarketDashboard.tsx
- [ ] 2. Remove file and run tsc to confirm zero broken imports.


### [HIGH] RNDOCTOR-DEADCODE-FILE — Dead / Unused File: src/components/MarketData.tsx

- **Category**: `code`
- **Confidence**: `HIGH`
- **Location**: `src/components/MarketData.tsx`
- **File Classification**: `SAFE_SOURCE`

**Detected Components:**
- [x] Entry points analyzed: src/App.tsx, src/index.tsx
- [x] Zero inbound import edges from active component tree
- [x] Zero dynamic string references

**Problem / Architectural Break:**
> The file is completely disconnected from the active runtime execution graph.

**Expected:**
`All files in src/ should be reachable by the application or routes.`

**Actual:**
`File is completely unreachable.`

**Why it matters:**
> Unused source files increase bundle size, slow down build and IDE indexing times, and create maintenance confusion.

**Official platform guidance:**
> React Native Performance Guidance: Eliminate dead source trees to minimize bundle size and JS parse time.

**Recommended fix:**
> Safely delete this file or register its route in your navigation structure.

**Do not add:**
> Do not keep obsolete files for historical reasons — rely on version control (git).

**Verification Checklist:**
- [ ] 1. Verify no external native bundle references src/components/MarketData.tsx
- [ ] 2. Remove file and run tsc to confirm zero broken imports.


### [HIGH] RNDOCTOR-DEADCODE-FILE — Dead / Unused File: src/components/MarketDataDisplay.tsx

- **Category**: `code`
- **Confidence**: `HIGH`
- **Location**: `src/components/MarketDataDisplay.tsx`
- **File Classification**: `SAFE_SOURCE`

**Detected Components:**
- [x] Entry points analyzed: src/App.tsx, src/index.tsx
- [x] Zero inbound import edges from active component tree
- [x] Zero dynamic string references

**Problem / Architectural Break:**
> The file is completely disconnected from the active runtime execution graph.

**Expected:**
`All files in src/ should be reachable by the application or routes.`

**Actual:**
`File is completely unreachable.`

**Why it matters:**
> Unused source files increase bundle size, slow down build and IDE indexing times, and create maintenance confusion.

**Official platform guidance:**
> React Native Performance Guidance: Eliminate dead source trees to minimize bundle size and JS parse time.

**Recommended fix:**
> Safely delete this file or register its route in your navigation structure.

**Do not add:**
> Do not keep obsolete files for historical reasons — rely on version control (git).

**Verification Checklist:**
- [ ] 1. Verify no external native bundle references src/components/MarketDataDisplay.tsx
- [ ] 2. Remove file and run tsc to confirm zero broken imports.


### [HIGH] RNDOCTOR-DEADCODE-FILE — Dead / Unused File: src/components/StrategyConfigPanel.tsx

- **Category**: `code`
- **Confidence**: `HIGH`
- **Location**: `src/components/StrategyConfigPanel.tsx`
- **File Classification**: `SAFE_SOURCE`

**Detected Components:**
- [x] Entry points analyzed: src/App.tsx, src/index.tsx
- [x] Zero inbound import edges from active component tree
- [x] Zero dynamic string references

**Problem / Architectural Break:**
> The file is completely disconnected from the active runtime execution graph.

**Expected:**
`All files in src/ should be reachable by the application or routes.`

**Actual:**
`File is completely unreachable.`

**Why it matters:**
> Unused source files increase bundle size, slow down build and IDE indexing times, and create maintenance confusion.

**Official platform guidance:**
> React Native Performance Guidance: Eliminate dead source trees to minimize bundle size and JS parse time.

**Recommended fix:**
> Safely delete this file or register its route in your navigation structure.

**Do not add:**
> Do not keep obsolete files for historical reasons — rely on version control (git).

**Verification Checklist:**
- [ ] 1. Verify no external native bundle references src/components/StrategyConfigPanel.tsx
- [ ] 2. Remove file and run tsc to confirm zero broken imports.


### [HIGH] RNDOCTOR-DEADCODE-FILE — Dead / Unused File: src/components/TradingViewChart.tsx

- **Category**: `code`
- **Confidence**: `HIGH`
- **Location**: `src/components/TradingViewChart.tsx`
- **File Classification**: `SAFE_SOURCE`

**Detected Components:**
- [x] Entry points analyzed: src/App.tsx, src/index.tsx
- [x] Zero inbound import edges from active component tree
- [x] Zero dynamic string references

**Problem / Architectural Break:**
> The file is completely disconnected from the active runtime execution graph.

**Expected:**
`All files in src/ should be reachable by the application or routes.`

**Actual:**
`File is completely unreachable.`

**Why it matters:**
> Unused source files increase bundle size, slow down build and IDE indexing times, and create maintenance confusion.

**Official platform guidance:**
> React Native Performance Guidance: Eliminate dead source trees to minimize bundle size and JS parse time.

**Recommended fix:**
> Safely delete this file or register its route in your navigation structure.

**Do not add:**
> Do not keep obsolete files for historical reasons — rely on version control (git).

**Verification Checklist:**
- [ ] 1. Verify no external native bundle references src/components/TradingViewChart.tsx
- [ ] 2. Remove file and run tsc to confirm zero broken imports.


### [HIGH] RNDOCTOR-DEADCODE-FILE — Dead / Unused File: src/hooks/useLiveMarketData.ts

- **Category**: `code`
- **Confidence**: `HIGH`
- **Location**: `src/hooks/useLiveMarketData.ts`
- **File Classification**: `SAFE_SOURCE`

**Detected Components:**
- [x] Entry points analyzed: src/App.tsx, src/index.tsx
- [x] Zero inbound import edges from active component tree
- [x] Zero dynamic string references

**Problem / Architectural Break:**
> The file is completely disconnected from the active runtime execution graph.

**Expected:**
`All files in src/ should be reachable by the application or routes.`

**Actual:**
`File is completely unreachable.`

**Why it matters:**
> Unused source files increase bundle size, slow down build and IDE indexing times, and create maintenance confusion.

**Official platform guidance:**
> React Native Performance Guidance: Eliminate dead source trees to minimize bundle size and JS parse time.

**Recommended fix:**
> Safely delete this file or register its route in your navigation structure.

**Do not add:**
> Do not keep obsolete files for historical reasons — rely on version control (git).

**Verification Checklist:**
- [ ] 1. Verify no external native bundle references src/hooks/useLiveMarketData.ts
- [ ] 2. Remove file and run tsc to confirm zero broken imports.


### [HIGH] RNDOCTOR-DEADCODE-FILE — Dead / Unused File: src/hooks/useStrategyConfig.ts

- **Category**: `code`
- **Confidence**: `HIGH`
- **Location**: `src/hooks/useStrategyConfig.ts`
- **File Classification**: `SAFE_SOURCE`

**Detected Components:**
- [x] Entry points analyzed: src/App.tsx, src/index.tsx
- [x] Zero inbound import edges from active component tree
- [x] Zero dynamic string references

**Problem / Architectural Break:**
> The file is completely disconnected from the active runtime execution graph.

**Expected:**
`All files in src/ should be reachable by the application or routes.`

**Actual:**
`File is completely unreachable.`

**Why it matters:**
> Unused source files increase bundle size, slow down build and IDE indexing times, and create maintenance confusion.

**Official platform guidance:**
> React Native Performance Guidance: Eliminate dead source trees to minimize bundle size and JS parse time.

**Recommended fix:**
> Safely delete this file or register its route in your navigation structure.

**Do not add:**
> Do not keep obsolete files for historical reasons — rely on version control (git).

**Verification Checklist:**
- [ ] 1. Verify no external native bundle references src/hooks/useStrategyConfig.ts
- [ ] 2. Remove file and run tsc to confirm zero broken imports.


### [HIGH] RNDOCTOR-DEADCODE-FILE — Dead / Unused File: src/services/dhanAPI.ts

- **Category**: `code`
- **Confidence**: `HIGH`
- **Location**: `src/services/dhanAPI.ts`
- **File Classification**: `SAFE_SOURCE`

**Detected Components:**
- [x] Entry points analyzed: src/App.tsx, src/index.tsx
- [x] Zero inbound import edges from active component tree
- [x] Zero dynamic string references

**Problem / Architectural Break:**
> The file is completely disconnected from the active runtime execution graph.

**Expected:**
`All files in src/ should be reachable by the application or routes.`

**Actual:**
`File is completely unreachable.`

**Why it matters:**
> Unused source files increase bundle size, slow down build and IDE indexing times, and create maintenance confusion.

**Official platform guidance:**
> React Native Performance Guidance: Eliminate dead source trees to minimize bundle size and JS parse time.

**Recommended fix:**
> Safely delete this file or register its route in your navigation structure.

**Do not add:**
> Do not keep obsolete files for historical reasons — rely on version control (git).

**Verification Checklist:**
- [ ] 1. Verify no external native bundle references src/services/dhanAPI.ts
- [ ] 2. Remove file and run tsc to confirm zero broken imports.


### [HIGH] RNDOCTOR-DEADCODE-FILE — Dead / Unused File: src/services/dhanService.ts

- **Category**: `code`
- **Confidence**: `HIGH`
- **Location**: `src/services/dhanService.ts`
- **File Classification**: `SAFE_SOURCE`

**Detected Components:**
- [x] Entry points analyzed: src/App.tsx, src/index.tsx
- [x] Zero inbound import edges from active component tree
- [x] Zero dynamic string references

**Problem / Architectural Break:**
> The file is completely disconnected from the active runtime execution graph.

**Expected:**
`All files in src/ should be reachable by the application or routes.`

**Actual:**
`File is completely unreachable.`

**Why it matters:**
> Unused source files increase bundle size, slow down build and IDE indexing times, and create maintenance confusion.

**Official platform guidance:**
> React Native Performance Guidance: Eliminate dead source trees to minimize bundle size and JS parse time.

**Recommended fix:**
> Safely delete this file or register its route in your navigation structure.

**Do not add:**
> Do not keep obsolete files for historical reasons — rely on version control (git).

**Verification Checklist:**
- [ ] 1. Verify no external native bundle references src/services/dhanService.ts
- [ ] 2. Remove file and run tsc to confirm zero broken imports.


### [HIGH] RNDOCTOR-DEADCODE-FILE — Dead / Unused File: src/services/liveMarketService.ts

- **Category**: `code`
- **Confidence**: `HIGH`
- **Location**: `src/services/liveMarketService.ts`
- **File Classification**: `SAFE_SOURCE`

**Detected Components:**
- [x] Entry points analyzed: src/App.tsx, src/index.tsx
- [x] Zero inbound import edges from active component tree
- [x] Zero dynamic string references

**Problem / Architectural Break:**
> The file is completely disconnected from the active runtime execution graph.

**Expected:**
`All files in src/ should be reachable by the application or routes.`

**Actual:**
`File is completely unreachable.`

**Why it matters:**
> Unused source files increase bundle size, slow down build and IDE indexing times, and create maintenance confusion.

**Official platform guidance:**
> React Native Performance Guidance: Eliminate dead source trees to minimize bundle size and JS parse time.

**Recommended fix:**
> Safely delete this file or register its route in your navigation structure.

**Do not add:**
> Do not keep obsolete files for historical reasons — rely on version control (git).

**Verification Checklist:**
- [ ] 1. Verify no external native bundle references src/services/liveMarketService.ts
- [ ] 2. Remove file and run tsc to confirm zero broken imports.


### [HIGH] RNDOCTOR-DEADCODE-FILE — Dead / Unused File: src/services/marketDataService.ts

- **Category**: `code`
- **Confidence**: `HIGH`
- **Location**: `src/services/marketDataService.ts`
- **File Classification**: `SAFE_SOURCE`

**Detected Components:**
- [x] Entry points analyzed: src/App.tsx, src/index.tsx
- [x] Zero inbound import edges from active component tree
- [x] Zero dynamic string references

**Problem / Architectural Break:**
> The file is completely disconnected from the active runtime execution graph.

**Expected:**
`All files in src/ should be reachable by the application or routes.`

**Actual:**
`File is completely unreachable.`

**Why it matters:**
> Unused source files increase bundle size, slow down build and IDE indexing times, and create maintenance confusion.

**Official platform guidance:**
> React Native Performance Guidance: Eliminate dead source trees to minimize bundle size and JS parse time.

**Recommended fix:**
> Safely delete this file or register its route in your navigation structure.

**Do not add:**
> Do not keep obsolete files for historical reasons — rely on version control (git).

**Verification Checklist:**
- [ ] 1. Verify no external native bundle references src/services/marketDataService.ts
- [ ] 2. Remove file and run tsc to confirm zero broken imports.


### [HIGH] RNDOCTOR-DEADCODE-FILE — Dead / Unused File: src/services/marketDataStreamService.ts

- **Category**: `code`
- **Confidence**: `HIGH`
- **Location**: `src/services/marketDataStreamService.ts`
- **File Classification**: `SAFE_SOURCE`

**Detected Components:**
- [x] Entry points analyzed: src/App.tsx, src/index.tsx
- [x] Zero inbound import edges from active component tree
- [x] Zero dynamic string references

**Problem / Architectural Break:**
> The file is completely disconnected from the active runtime execution graph.

**Expected:**
`All files in src/ should be reachable by the application or routes.`

**Actual:**
`File is completely unreachable.`

**Why it matters:**
> Unused source files increase bundle size, slow down build and IDE indexing times, and create maintenance confusion.

**Official platform guidance:**
> React Native Performance Guidance: Eliminate dead source trees to minimize bundle size and JS parse time.

**Recommended fix:**
> Safely delete this file or register its route in your navigation structure.

**Do not add:**
> Do not keep obsolete files for historical reasons — rely on version control (git).

**Verification Checklist:**
- [ ] 1. Verify no external native bundle references src/services/marketDataStreamService.ts
- [ ] 2. Remove file and run tsc to confirm zero broken imports.


### [HIGH] RNDOCTOR-DEADCODE-FILE — Dead / Unused File: src/components/brokers/ConnectDhanModal.tsx

- **Category**: `code`
- **Confidence**: `HIGH`
- **Location**: `src/components/brokers/ConnectDhanModal.tsx`
- **File Classification**: `SAFE_SOURCE`

**Detected Components:**
- [x] Entry points analyzed: src/App.tsx, src/index.tsx
- [x] Zero inbound import edges from active component tree
- [x] Zero dynamic string references

**Problem / Architectural Break:**
> The file is completely disconnected from the active runtime execution graph.

**Expected:**
`All files in src/ should be reachable by the application or routes.`

**Actual:**
`File is completely unreachable.`

**Why it matters:**
> Unused source files increase bundle size, slow down build and IDE indexing times, and create maintenance confusion.

**Official platform guidance:**
> React Native Performance Guidance: Eliminate dead source trees to minimize bundle size and JS parse time.

**Recommended fix:**
> Safely delete this file or register its route in your navigation structure.

**Do not add:**
> Do not keep obsolete files for historical reasons — rely on version control (git).

**Verification Checklist:**
- [ ] 1. Verify no external native bundle references src/components/brokers/ConnectDhanModal.tsx
- [ ] 2. Remove file and run tsc to confirm zero broken imports.


### [HIGH] RNDOCTOR-DEADCODE-FILE — Dead / Unused File: src/components/brokers/DhanConnectionCard.tsx

- **Category**: `code`
- **Confidence**: `HIGH`
- **Location**: `src/components/brokers/DhanConnectionCard.tsx`
- **File Classification**: `SAFE_SOURCE`

**Detected Components:**
- [x] Entry points analyzed: src/App.tsx, src/index.tsx
- [x] Zero inbound import edges from active component tree
- [x] Zero dynamic string references

**Problem / Architectural Break:**
> The file is completely disconnected from the active runtime execution graph.

**Expected:**
`All files in src/ should be reachable by the application or routes.`

**Actual:**
`File is completely unreachable.`

**Why it matters:**
> Unused source files increase bundle size, slow down build and IDE indexing times, and create maintenance confusion.

**Official platform guidance:**
> React Native Performance Guidance: Eliminate dead source trees to minimize bundle size and JS parse time.

**Recommended fix:**
> Safely delete this file or register its route in your navigation structure.

**Do not add:**
> Do not keep obsolete files for historical reasons — rely on version control (git).

**Verification Checklist:**
- [ ] 1. Verify no external native bundle references src/components/brokers/DhanConnectionCard.tsx
- [ ] 2. Remove file and run tsc to confirm zero broken imports.


### [HIGH] RNDOCTOR-DEADCODE-FILE — Dead / Unused File: src/components/common/EmergencyStopButton.tsx

- **Category**: `code`
- **Confidence**: `HIGH`
- **Location**: `src/components/common/EmergencyStopButton.tsx`
- **File Classification**: `SAFE_SOURCE`

**Detected Components:**
- [x] Entry points analyzed: src/App.tsx, src/index.tsx
- [x] Zero inbound import edges from active component tree
- [x] Zero dynamic string references

**Problem / Architectural Break:**
> The file is completely disconnected from the active runtime execution graph.

**Expected:**
`All files in src/ should be reachable by the application or routes.`

**Actual:**
`File is completely unreachable.`

**Why it matters:**
> Unused source files increase bundle size, slow down build and IDE indexing times, and create maintenance confusion.

**Official platform guidance:**
> React Native Performance Guidance: Eliminate dead source trees to minimize bundle size and JS parse time.

**Recommended fix:**
> Safely delete this file or register its route in your navigation structure.

**Do not add:**
> Do not keep obsolete files for historical reasons — rely on version control (git).

**Verification Checklist:**
- [ ] 1. Verify no external native bundle references src/components/common/EmergencyStopButton.tsx
- [ ] 2. Remove file and run tsc to confirm zero broken imports.


### [HIGH] RNDOCTOR-DEADCODE-FILE — Dead / Unused File: src/components/common/GlobalTradingModeSwitch.tsx

- **Category**: `code`
- **Confidence**: `HIGH`
- **Location**: `src/components/common/GlobalTradingModeSwitch.tsx`
- **File Classification**: `SAFE_SOURCE`

**Detected Components:**
- [x] Entry points analyzed: src/App.tsx, src/index.tsx
- [x] Zero inbound import edges from active component tree
- [x] Zero dynamic string references

**Problem / Architectural Break:**
> The file is completely disconnected from the active runtime execution graph.

**Expected:**
`All files in src/ should be reachable by the application or routes.`

**Actual:**
`File is completely unreachable.`

**Why it matters:**
> Unused source files increase bundle size, slow down build and IDE indexing times, and create maintenance confusion.

**Official platform guidance:**
> React Native Performance Guidance: Eliminate dead source trees to minimize bundle size and JS parse time.

**Recommended fix:**
> Safely delete this file or register its route in your navigation structure.

**Do not add:**
> Do not keep obsolete files for historical reasons — rely on version control (git).

**Verification Checklist:**
- [ ] 1. Verify no external native bundle references src/components/common/GlobalTradingModeSwitch.tsx
- [ ] 2. Remove file and run tsc to confirm zero broken imports.


### [HIGH] RNDOCTOR-DEADCODE-FILE — Dead / Unused File: src/components/common/ModeBadge.tsx

- **Category**: `code`
- **Confidence**: `HIGH`
- **Location**: `src/components/common/ModeBadge.tsx`
- **File Classification**: `SAFE_SOURCE`

**Detected Components:**
- [x] Entry points analyzed: src/App.tsx, src/index.tsx
- [x] Zero inbound import edges from active component tree
- [x] Zero dynamic string references

**Problem / Architectural Break:**
> The file is completely disconnected from the active runtime execution graph.

**Expected:**
`All files in src/ should be reachable by the application or routes.`

**Actual:**
`File is completely unreachable.`

**Why it matters:**
> Unused source files increase bundle size, slow down build and IDE indexing times, and create maintenance confusion.

**Official platform guidance:**
> React Native Performance Guidance: Eliminate dead source trees to minimize bundle size and JS parse time.

**Recommended fix:**
> Safely delete this file or register its route in your navigation structure.

**Do not add:**
> Do not keep obsolete files for historical reasons — rely on version control (git).

**Verification Checklist:**
- [ ] 1. Verify no external native bundle references src/components/common/ModeBadge.tsx
- [ ] 2. Remove file and run tsc to confirm zero broken imports.


### [MEDIUM] RNDOCTOR-SIMPLIFY-ARRAY-PIPELINE — Chained .map().filter() Array Iteration

- **Category**: `performance`
- **Confidence**: `HIGH`
- **Location**: `src/pages/TestLiveTrading.tsx:76`
- **File Classification**: `SAFE_SOURCE`

**What was found:**
> Detected array.map(...).filter(...) iterating twice over the same list.

**Why it matters:**
> Chaining .map().filter() creates unnecessary intermediate array allocations in memory and traverses the collection multiple times.

**Recommended fix:**
> Combine into a single .flatMap(), .reduce(), or iterative for-of loop.


### [MEDIUM] RNDOCTOR-DUP-EXACT — Exact Duplicate Function Declaration: "handleSubmit"

- **Category**: `code`
- **Confidence**: `HIGH`
- **Location**: `src/components/AddBrokerForm.tsx:61`
- **File Classification**: `SAFE_SOURCE`

**What was found:**
> Identical function symbol exists across multiple modules.

**Why it matters:**
> Duplicated functions cause maintenance drift when bug fixes are applied to one copy but forgotten in the other.

**Recommended fix:**
> Consolidate "handleSubmit" into a shared module and import it.


### [MEDIUM] RNDOCTOR-DUP-EXACT — Exact Duplicate Function Declaration: "handleClose"

- **Category**: `code`
- **Confidence**: `HIGH`
- **Location**: `src/components/AddBrokerForm.tsx:133`
- **File Classification**: `SAFE_SOURCE`

**What was found:**
> Identical function symbol exists across multiple modules.

**Why it matters:**
> Duplicated functions cause maintenance drift when bug fixes are applied to one copy but forgotten in the other.

**Recommended fix:**
> Consolidate "handleClose" into a shared module and import it.


### [MEDIUM] RNDOCTOR-DUP-EXACT — Exact Duplicate Function Declaration: "handleChange"

- **Category**: `code`
- **Confidence**: `HIGH`
- **Location**: `src/components/BrokerageForm.tsx:36`
- **File Classification**: `SAFE_SOURCE`

**What was found:**
> Identical function symbol exists across multiple modules.

**Why it matters:**
> Duplicated functions cause maintenance drift when bug fixes are applied to one copy but forgotten in the other.

**Recommended fix:**
> Consolidate "handleChange" into a shared module and import it.


### [MEDIUM] RNDOCTOR-DUP-EXACT — Exact Duplicate Function Declaration: "handleToggleTerminal"

- **Category**: `code`
- **Confidence**: `HIGH`
- **Location**: `src/components/BrokerCard.tsx:81`
- **File Classification**: `SAFE_SOURCE`

**What was found:**
> Identical function symbol exists across multiple modules.

**Why it matters:**
> Duplicated functions cause maintenance drift when bug fixes are applied to one copy but forgotten in the other.

**Recommended fix:**
> Consolidate "handleToggleTerminal" into a shared module and import it.


### [MEDIUM] RNDOCTOR-DUP-EXACT — Exact Duplicate Function Declaration: "handleMessage"

- **Category**: `code`
- **Confidence**: `HIGH`
- **Location**: `src/components/BrokerCard.tsx:161`
- **File Classification**: `SAFE_SOURCE`

**What was found:**
> Identical function symbol exists across multiple modules.

**Why it matters:**
> Duplicated functions cause maintenance drift when bug fixes are applied to one copy but forgotten in the other.

**Recommended fix:**
> Consolidate "handleMessage" into a shared module and import it.


### [MEDIUM] RNDOCTOR-DUP-EXACT — Exact Duplicate Function Declaration: "handleToggleTradingEngine"

- **Category**: `code`
- **Confidence**: `HIGH`
- **Location**: `src/components/BrokerCard.tsx:245`
- **File Classification**: `SAFE_SOURCE`

**What was found:**
> Identical function symbol exists across multiple modules.

**Why it matters:**
> Duplicated functions cause maintenance drift when bug fixes are applied to one copy but forgotten in the other.

**Recommended fix:**
> Consolidate "handleToggleTradingEngine" into a shared module and import it.


### [MEDIUM] RNDOCTOR-DUP-EXACT — Exact Duplicate Function Declaration: "formatPrice"

- **Category**: `code`
- **Confidence**: `HIGH`
- **Location**: `src/components/NiftyIndependentBreakoutMonitor.tsx:133`
- **File Classification**: `SAFE_SOURCE`

**What was found:**
> Identical function symbol exists across multiple modules.

**Why it matters:**
> Duplicated functions cause maintenance drift when bug fixes are applied to one copy but forgotten in the other.

**Recommended fix:**
> Consolidate "formatPrice" into a shared module and import it.


### [MEDIUM] RNDOCTOR-DUP-EXACT — Exact Duplicate Function Declaration: "handleSquareOff"

- **Category**: `code`
- **Confidence**: `HIGH`
- **Location**: `src/components/PortfolioDashboard.tsx:64`
- **File Classification**: `SAFE_SOURCE`

**What was found:**
> Identical function symbol exists across multiple modules.

**Why it matters:**
> Duplicated functions cause maintenance drift when bug fixes are applied to one copy but forgotten in the other.

**Recommended fix:**
> Consolidate "handleSquareOff" into a shared module and import it.


### [MEDIUM] RNDOCTOR-DUP-EXACT — Exact Duplicate Function Declaration: "handleCopyRedirect"

- **Category**: `code`
- **Confidence**: `HIGH`
- **Location**: `src/pages/Brokers.tsx:207`
- **File Classification**: `SAFE_SOURCE`

**What was found:**
> Identical function symbol exists across multiple modules.

**Why it matters:**
> Duplicated functions cause maintenance drift when bug fixes are applied to one copy but forgotten in the other.

**Recommended fix:**
> Consolidate "handleCopyRedirect" into a shared module and import it.


### [MEDIUM] RNDOCTOR-DUP-EXACT — Exact Duplicate Function Declaration: "handleDisconnect"

- **Category**: `code`
- **Confidence**: `HIGH`
- **Location**: `src/pages/Brokers.tsx:336`
- **File Classification**: `SAFE_SOURCE`

**What was found:**
> Identical function symbol exists across multiple modules.

**Why it matters:**
> Duplicated functions cause maintenance drift when bug fixes are applied to one copy but forgotten in the other.

**Recommended fix:**
> Consolidate "handleDisconnect" into a shared module and import it.


### [MEDIUM] RNDOCTOR-DUP-EXACT — Exact Duplicate Function Declaration: "fetchStatus"

- **Category**: `code`
- **Confidence**: `HIGH`
- **Location**: `src/pages/LiveChartPage.tsx:34`
- **File Classification**: `SAFE_SOURCE`

**What was found:**
> Identical function symbol exists across multiple modules.

**Why it matters:**
> Duplicated functions cause maintenance drift when bug fixes are applied to one copy but forgotten in the other.

**Recommended fix:**
> Consolidate "fetchStatus" into a shared module and import it.


### [MEDIUM] RNDOCTOR-DUP-EXACT — Exact Duplicate Function Declaration: "handleGoogleSignIn"

- **Category**: `code`
- **Confidence**: `HIGH`
- **Location**: `src/pages/Login.tsx:61`
- **File Classification**: `SAFE_SOURCE`

**What was found:**
> Identical function symbol exists across multiple modules.

**Why it matters:**
> Duplicated functions cause maintenance drift when bug fixes are applied to one copy but forgotten in the other.

**Recommended fix:**
> Consolidate "handleGoogleSignIn" into a shared module and import it.


### [HIGH] RNDOCTOR-ORG-MULTI-RESPONSIBILITY — Multi-Responsibility Smells: OrderManagement.tsx (3 responsibilities)

- **Category**: `architecture`
- **Confidence**: `HIGH`
- **Location**: `src/components/OrderManagement.tsx`
- **File Classification**: `SAFE_SOURCE`

**What was found:**
> Detected mixed responsibilities in src/components/OrderManagement.tsx (379 LOC): UI Presentation & Styling, Network / Remote Data Fetching, Application State Management.

**Why it matters:**
> Mixing presentation, network fetching, hardware audio lifecycles, and persistent storage in one module causes massive re-render waterfalls, prevents unit testing, and makes bugs difficult to isolate.

**Official platform guidance:**
> Clean Architecture Guidance: Single Responsibility Principle (SRP) — a module should have one, and only one, reason to change.

**Recommended fix:**
> Decompose into focused modules:
  • OrderManagementView (UI components & presentation)
  • OrderManagementService (network calls & lifecycle)
  • OrderManagementStore (reactive state only)


### [MEDIUM] RNDOCTOR-ORG-GIANT-FILE — Overly Large Source Module: TradingViewLiveChart.tsx (758 LOC)

- **Category**: `complexity`
- **Confidence**: `HIGH`
- **Location**: `src/components/TradingViewLiveChart.tsx`
- **File Classification**: `SAFE_SOURCE`

**What was found:**
> src/components/TradingViewLiveChart.tsx has 758 lines of code.

**Why it matters:**
> Monolithic source files degrade IDE responsiveness, make code reviews cumbersome, and conceal subtle side-effect dependencies.

**Recommended fix:**
> Split hooks, helper utilities, and sub-components into dedicated submodules.


### [HIGH] RNDOCTOR-ORG-MULTI-RESPONSIBILITY — Multi-Responsibility Smells: Brokers.tsx (4 responsibilities)

- **Category**: `architecture`
- **Confidence**: `HIGH`
- **Location**: `src/pages/Brokers.tsx`
- **File Classification**: `SAFE_SOURCE`

**What was found:**
> Detected mixed responsibilities in src/pages/Brokers.tsx (1031 LOC): UI Presentation & Styling, Network / Remote Data Fetching, Local Storage & Persistence, Application State Management.

**Why it matters:**
> Mixing presentation, network fetching, hardware audio lifecycles, and persistent storage in one module causes massive re-render waterfalls, prevents unit testing, and makes bugs difficult to isolate.

**Official platform guidance:**
> Clean Architecture Guidance: Single Responsibility Principle (SRP) — a module should have one, and only one, reason to change.

**Recommended fix:**
> Decompose into focused modules:
  • BrokersView (UI components & presentation)
  • BrokersService (network calls & lifecycle)
  • BrokersStore (reactive state only)


### [MEDIUM] RNDOCTOR-ORG-GIANT-FILE — Overly Large Source Module: Brokers.tsx (1031 LOC)

- **Category**: `complexity`
- **Confidence**: `HIGH`
- **Location**: `src/pages/Brokers.tsx`
- **File Classification**: `SAFE_SOURCE`

**What was found:**
> src/pages/Brokers.tsx has 1031 lines of code.

**Why it matters:**
> Monolithic source files degrade IDE responsiveness, make code reviews cumbersome, and conceal subtle side-effect dependencies.

**Recommended fix:**
> Split hooks, helper utilities, and sub-components into dedicated submodules.


### [HIGH] RNDOCTOR-ORG-MULTI-RESPONSIBILITY — Multi-Responsibility Smells: CreateStrategy.tsx (3 responsibilities)

- **Category**: `architecture`
- **Confidence**: `HIGH`
- **Location**: `src/pages/CreateStrategy.tsx`
- **File Classification**: `SAFE_SOURCE`

**What was found:**
> Detected mixed responsibilities in src/pages/CreateStrategy.tsx (1183 LOC): UI Presentation & Styling, Network / Remote Data Fetching, Application State Management.

**Why it matters:**
> Mixing presentation, network fetching, hardware audio lifecycles, and persistent storage in one module causes massive re-render waterfalls, prevents unit testing, and makes bugs difficult to isolate.

**Official platform guidance:**
> Clean Architecture Guidance: Single Responsibility Principle (SRP) — a module should have one, and only one, reason to change.

**Recommended fix:**
> Decompose into focused modules:
  • CreateStrategyView (UI components & presentation)
  • CreateStrategyService (network calls & lifecycle)
  • CreateStrategyStore (reactive state only)


### [MEDIUM] RNDOCTOR-ORG-GIANT-FILE — Overly Large Source Module: CreateStrategy.tsx (1183 LOC)

- **Category**: `complexity`
- **Confidence**: `HIGH`
- **Location**: `src/pages/CreateStrategy.tsx`
- **File Classification**: `SAFE_SOURCE`

**What was found:**
> src/pages/CreateStrategy.tsx has 1183 lines of code.

**Why it matters:**
> Monolithic source files degrade IDE responsiveness, make code reviews cumbersome, and conceal subtle side-effect dependencies.

**Recommended fix:**
> Split hooks, helper utilities, and sub-components into dedicated submodules.


### [MEDIUM] RNDOCTOR-ORG-GIANT-FILE — Overly Large Source Module: Dashboard.tsx (940 LOC)

- **Category**: `complexity`
- **Confidence**: `HIGH`
- **Location**: `src/pages/Dashboard.tsx`
- **File Classification**: `SAFE_SOURCE`

**What was found:**
> src/pages/Dashboard.tsx has 940 lines of code.

**Why it matters:**
> Monolithic source files degrade IDE responsiveness, make code reviews cumbersome, and conceal subtle side-effect dependencies.

**Recommended fix:**
> Split hooks, helper utilities, and sub-components into dedicated submodules.


### [HIGH] RNDOCTOR-ORG-MULTI-RESPONSIBILITY — Multi-Responsibility Smells: Strategies.tsx (3 responsibilities)

- **Category**: `architecture`
- **Confidence**: `HIGH`
- **Location**: `src/pages/Strategies.tsx`
- **File Classification**: `SAFE_SOURCE`

**What was found:**
> Detected mixed responsibilities in src/pages/Strategies.tsx (1489 LOC): UI Presentation & Styling, Network / Remote Data Fetching, Application State Management.

**Why it matters:**
> Mixing presentation, network fetching, hardware audio lifecycles, and persistent storage in one module causes massive re-render waterfalls, prevents unit testing, and makes bugs difficult to isolate.

**Official platform guidance:**
> Clean Architecture Guidance: Single Responsibility Principle (SRP) — a module should have one, and only one, reason to change.

**Recommended fix:**
> Decompose into focused modules:
  • StrategiesView (UI components & presentation)
  • StrategiesService (network calls & lifecycle)
  • StrategiesStore (reactive state only)


### [MEDIUM] RNDOCTOR-ORG-GIANT-FILE — Overly Large Source Module: Strategies.tsx (1489 LOC)

- **Category**: `complexity`
- **Confidence**: `HIGH`
- **Location**: `src/pages/Strategies.tsx`
- **File Classification**: `SAFE_SOURCE`

**What was found:**
> src/pages/Strategies.tsx has 1489 lines of code.

**Why it matters:**
> Monolithic source files degrade IDE responsiveness, make code reviews cumbersome, and conceal subtle side-effect dependencies.

**Recommended fix:**
> Split hooks, helper utilities, and sub-components into dedicated submodules.


### [HIGH] RNDOCTOR-ORG-MULTI-RESPONSIBILITY — Multi-Responsibility Smells: ConnectDhanModal.tsx (3 responsibilities)

- **Category**: `architecture`
- **Confidence**: `HIGH`
- **Location**: `src/components/brokers/ConnectDhanModal.tsx`
- **File Classification**: `SAFE_SOURCE`

**What was found:**
> Detected mixed responsibilities in src/components/brokers/ConnectDhanModal.tsx (645 LOC): UI Presentation & Styling, Local Storage & Persistence, Application State Management.

**Why it matters:**
> Mixing presentation, network fetching, hardware audio lifecycles, and persistent storage in one module causes massive re-render waterfalls, prevents unit testing, and makes bugs difficult to isolate.

**Official platform guidance:**
> Clean Architecture Guidance: Single Responsibility Principle (SRP) — a module should have one, and only one, reason to change.

**Recommended fix:**
> Decompose into focused modules:
  • ConnectDhanModalView (UI components & presentation)
  • ConnectDhanModalService (network calls & lifecycle)
  • ConnectDhanModalStore (reactive state only)


### [WARNING] RNDOCTOR-PERF-RENDER-CALC — Expensive chained array calculation in Dashboard render body

- **Category**: `performance`
- **Confidence**: `HIGH`
- **Location**: `src/pages/Dashboard.tsx:261`
- **File Classification**: `SAFE_SOURCE`
- **Performance Domain**: `RENDERING`
- **Runtime Impact**: Increases component render time on the JS thread; causes UI input latency during typing or scrolling.
- **Optimization**: Cache the derived array using useMemo with explicit dependency array.

**What was found:**
> Chained array transformation (.filter/.map/.sort) executed directly on every render without useMemo.

**Why it matters:**
> Calculations inside component bodies execute on every single state update or parent re-render. For non-trivial arrays, this stalls the JavaScript thread and degrades frame rates.

**Official platform guidance:**
> React documentation recommends: 'Wrap an expensive calculation in useMemo to cache its result between re-renders.'

**Recommended fix:**
> Wrap the chained calculation in useMemo(() => ..., [dependencies]) or move it to a selector/state slice.

**Documentation:**
- [https://react.dev/reference/react/useMemo](https://react.dev/reference/react/useMemo)


### [WARNING] RNDOCTOR-PERF-RENDER-CALC — Expensive chained array calculation in Dashboard render body

- **Category**: `performance`
- **Confidence**: `HIGH`
- **Location**: `src/pages/Dashboard.tsx:262`
- **File Classification**: `SAFE_SOURCE`
- **Performance Domain**: `RENDERING`
- **Runtime Impact**: Increases component render time on the JS thread; causes UI input latency during typing or scrolling.
- **Optimization**: Cache the derived array using useMemo with explicit dependency array.

**What was found:**
> Chained array transformation (.filter/.map/.sort) executed directly on every render without useMemo.

**Why it matters:**
> Calculations inside component bodies execute on every single state update or parent re-render. For non-trivial arrays, this stalls the JavaScript thread and degrades frame rates.

**Official platform guidance:**
> React documentation recommends: 'Wrap an expensive calculation in useMemo to cache its result between re-renders.'

**Recommended fix:**
> Wrap the chained calculation in useMemo(() => ..., [dependencies]) or move it to a selector/state slice.

**Documentation:**
- [https://react.dev/reference/react/useMemo](https://react.dev/reference/react/useMemo)


### [WARNING] RNDOCTOR-PERF-RENDER-CALC — Expensive chained array calculation in TestLiveTrading render body

- **Category**: `performance`
- **Confidence**: `HIGH`
- **Location**: `src/pages/TestLiveTrading.tsx:55`
- **File Classification**: `SAFE_SOURCE`
- **Performance Domain**: `RENDERING`
- **Runtime Impact**: Increases component render time on the JS thread; causes UI input latency during typing or scrolling.
- **Optimization**: Cache the derived array using useMemo with explicit dependency array.

**What was found:**
> Chained array transformation (.filter/.map/.sort) executed directly on every render without useMemo.

**Why it matters:**
> Calculations inside component bodies execute on every single state update or parent re-render. For non-trivial arrays, this stalls the JavaScript thread and degrades frame rates.

**Official platform guidance:**
> React documentation recommends: 'Wrap an expensive calculation in useMemo to cache its result between re-renders.'

**Recommended fix:**
> Wrap the chained calculation in useMemo(() => ..., [dependencies]) or move it to a selector/state slice.

**Documentation:**
- [https://react.dev/reference/react/useMemo](https://react.dev/reference/react/useMemo)


---

## Remediation & Next Steps

```bash
# 1. Apply safe automatic AST fixes (unused imports & legacy permissions)
npx native-doctor --fix

# 2. Safely preview a targeted patch within change budget
npx native-doctor patch <findingId> --dry-run

# 3. Run full scan and 12-dimension health audit
npx native-doctor --full-scan

# 4. Run performance and runtime audit
npx native-doctor performance
```

---
*Generated by native-doctor v0.8.0 — Developed by Mavrix Technologies*