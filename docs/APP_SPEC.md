# Excel Driving School — application spec

Authoritative record of behaviour and visual design, extracted from the original Electron implementation (`app.js`, `index.html`, `style.css`) before those files were removed. The React web app in [`web/`](../web) is built to this spec.

---

## 1. Data model

### Client

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | Generated client-side: `c_<epoch_ms>_<4 random base36>` |
| `createdAt` | ISO string | yes | Set once at creation |
| `updatedAt` | ISO string | yes | Server-maintained; used for conflict detection |
| `name` | string | yes | Trimmed |
| `phone` | string | yes | Trimmed |
| `alternatePhone` | string or null | no | Empty becomes `null` |
| `applicationNumber` | string or null | no | Empty becomes `null`, max 64 chars |
| `guardianName` | string or null | no | Empty becomes `null`, max 120 chars |
| `dob` | `yyyy-mm-dd` | yes | |
| `bloodGroup` | string | yes | One of the blood group list |
| `licenceType` | string | yes | One of the licence list |
| `address` | string | yes | Trimmed, multiline |

### Payment

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | `p_<epoch_ms>_<4 random base36>` |
| `clientId` | string | yes | Cascade-deletes with the client |
| `amount` | number | yes | Greater than 0 |
| `paidAt` | ISO string | yes | Built from a `yyyy-mm-dd` input at local midnight |
| `method` | string or null | no | Cash / UPI / Card / Bank transfer / Cheque |
| `note` | string or null | no | Trimmed |

### Reference lists

Blood groups: `A+`, `A-`, `B+`, `B-`, `AB+`, `AB-`, `O+`, `O-`

Licence types (value — label shown in the form):

- `MCWOG` — MCWOG – Motorcycle Without Gear
- `MCWG` — MCWG – Motorcycle With Gear
- `LMV` — LMV – Light Motor Vehicle
- `LMV + MCWG` — LMV + MCWG – Car + Motorcycle with Gear
- `LMV + MCWOG` — LMV + MCWOG – Car + Motorcycle without Gear
- `LMV-NT` — LMV-NT – Light Motor Vehicle (Non-Transport)
- `LMV-TR` — LMV-TR – Light Motor Vehicle (Transport/Commercial)
- `LMV-TR + MCWG` — LMV-TR + MCWG
- `HMV` — HMV – Heavy Motor Vehicle
- `HGMV` — HGMV – Heavy Goods Motor Vehicle
- `HPMV` — HPMV – Heavy Passenger Motor Vehicle
- `MGV` — MGV – Medium Goods Vehicle
- `MPV` — MPV – Medium Passenger Vehicle
- `TRAILER` — TRAILER – Trailer Vehicle
- `TRANS` — TRANS – Transport Vehicle

`Transport` is a legacy value that must still display and filter correctly, and appears in the Clients filter as "Transport (legacy)".

Chart labels shorten `LMV + MCWG` to `LMV+MCWG`, `LMV + MCWOG` to `LMV+MCWOG`, and `LMV-TR + MCWG` to `LMV-TR+MCWG`. All other values pass through unchanged.

---

## 2. Validation rules

### Client form

- **Name** — required. Message: `Full name is required.`
- **Phone** — required, then pattern `/^\+?\d[\d\s\-]{6,14}$/`. Messages: `Phone number is required.` then `Enter a valid phone number.`
- **Alternate phone** — optional. When filled it must match the same pattern (`Enter a valid alternate number.`) and, after stripping every non-digit from both values, must not equal the primary phone (`Alternate number must differ from primary phone.`)
- **Date of birth** — required (`Date of birth is required.`); computed age must be 14 to 100 inclusive (`Age must be between 14 and 100.`). The input's `max` is today.
- **Blood group** — required. `Please select a blood group.`
- **Licence type** — required. `Please select a licence type.`
- **Address** — required. `Address is required.`
- Guardian name and application number have no validation beyond max length.

Age is calculated from `dob` at local midnight, decrementing when the birthday has not yet occurred this year.

### Payment form

- **Amount** — required, numeric, greater than zero. `Enter a valid amount.`
- **Date** — required, `max` is today. `Select a date.`

### Practice scheduling

- **Date** — required (`Select a practice date.`), and not before today (`Pick today or a future date.`). Input `min` is today.
- **Time** — hour `1`-`12`, minute `00`-`59`, and `AM`/`PM`. Invalid combination gives `Select a valid practice time.`
- The combined local date-time must not already be in the past: `That time has already passed. Choose a later time or a future date.`
- Defaults when the dialog opens: today, `9`, `00`, `AM`.

---

## 3. WhatsApp messages

Phone normalisation: strip non-digits; drop a leading `0` from an 11-digit number; prefix `91` when 10 digits remain; reject anything shorter than 11 digits with `Client phone number looks invalid.` The link is `https://wa.me/<digits>?text=<url-encoded message>`.

Registration (sent when "Send registration welcome on WhatsApp" is checked on create):

```
Dear {name}, congratulations! You have been successfully registered with Excel Driving School. We look forward to helping you with your training. — Excel Driving School
```

Payment received (sent when the payment dialog's WhatsApp option is checked):

```
Dear {name}, payment of {amount} received. Total paid so far: {total}. - Excel Driving School
```

Practice reminder:

```
Dear {name}, please be available at Excel Driving School on {longDate} at {time12} for driving practice. Thank you. — Excel Driving School
```

`{longDate}` is `en-IN` with weekday, numeric day, long month and numeric year (built from the date at noon to avoid timezone drift). `{time12}` is `h:mm AM/PM`. Amounts use the money format below.

In the browser the tab must be opened **synchronously** on the click and its URL assigned afterwards, otherwise popup blockers discard it.

---

## 4. Formatting

- **Dates in tables** — `en-IN`, `dd Mon yyyy`, from `dob` at local midnight. Empty renders as `—`.
- **Long dates** — `en-IN` weekday, numeric day, long month, numeric year.
- **Registered On** — `en-IN` `dd Mon yyyy` in Reports, plain `en-IN` date in CSV.
- **Money** — `₹` plus `en-IN` grouping, 0 to 2 decimals.
- **Avatar initial** — first character of the name uppercased, `?` when missing.
- **Address in the clients table** — truncated to 30 characters with a trailing `…`, full value in the `title` attribute.
- **Topbar date** — `en-IN` short weekday, 2-digit day, short month, numeric year; refreshed every 60 seconds.

---

## 5. Screens

### Dashboard

- Hero banner with the logo, "Welcome back", the school name and "Client Management System".
- Three stat cards: **Total Clients** (count), **Added This Month** (created in the current calendar month and year), **Licence Types** (distinct non-empty licence types, `—` when zero).
- **Recent Clients** table, the last 5 clients in reverse creation order, numbered descending from the total. Columns: `#`, Name, App. no., Phone, Alt. phone, Licence Type, Blood Group, Action (view only). Empty state: `No clients yet. Add your first client!`

### Clients

- Toolbar: Licence Type filter, Blood Group filter, Add Client, Export CSV.
- Search box in the topbar (visible only on this page) matching, case-insensitively, name, phone, alternate phone, address, guardian name and application number.
- Table columns: `#`, Name (avatar, name, age in years), App. no., Phone, Alt. phone, DOB, Blood Group, Licence Type, Address, Actions (view, edit, delete).
- Clicking a header sorts by that column, toggling ascending/descending with a `▲`/`▼` indicator; comparison is `localeCompare` with base sensitivity. Changing a filter resets the sort. Sortable columns are Name, App. no., Phone, Alt. phone, DOB, Blood Group, Licence Type and Address.
- Header shows the filtered count as a badge. Empty state: `No clients found.`

### Add / Edit Client

- Field order: Full Name (full width), Guardian name (full width), Application number (full width), Phone Number, Alternate number, Date of Birth, Blood Group, Licence Type, Address (full width).
- Create mode: title `Add New Client`, submit `Save Client`, and the WhatsApp welcome checkbox is shown and checked by default.
- Edit mode: title `Edit Client`, submit `Update Client`, and the WhatsApp welcome row is hidden.
- On success, toast then navigate to Clients after roughly 400 ms. Toasts: `🎉 Client added successfully!` and `✅ Client updated successfully!`

### Client detail

- Header: avatar initial, name, licence badge.
- Detail grid: Phone, Alternate number, Date of Birth with age, Blood Group, Licence Type, Application number (full width), Guardian (full width), Address (full width). Missing optional values render `—`.
- Payments block: total paid, Add Payment, Practice day, Print card, Edit, and the payment history list. Each history row shows the amount and `date · method · note` (empty parts omitted) with a delete button. Empty state: `No payments recorded yet.`
- Deleting a payment asks for confirmation first.

### Reports

- **Clients by Licence Type** and **Blood Group Distribution** — horizontal bars sorted by count descending, width proportional to the largest count, cycling through five bar colours.
- **Monthly Registrations** — vertical bars for the last 6 calendar months including the current one, short month labels, minimum bar height 4 px scaled against the busiest month.
- **Complete Client Register** — every client in creation order. Columns: `#`, Name, App. no., Guardian, Phone, Alt. phone, DOB, Blood Group, Licence, Address, Registered.
- Empty state for all four: `No data yet.`
- Print Register opens a printable table with the header `Excel Driving School — Client Register`, the print date and total client count, and columns `#`, Name, App. no., Guardian, Phone, Alt. phone, DOB, Blood Group, Licence, Address.

### Settings

- **Data Management** — Export CSV, Backup to JSON, Restore from Backup (JSON import), Clear All Data (destructive, confirm first).
- **Keyboard Shortcuts** — `Ctrl+N` add client, `Ctrl+F` search clients, `Esc` close dialog, click a header to sort.
- **About** — storage description, fields tracked (Name, Guardian, Application number, Phone, Alternate phone, DOB, Blood Group, Licence, Address), and version.

---

## 6. Import / export

**CSV** (`ExcelDS_Clients_<yyyy-mm-dd>.csv`) columns in order: `#`, `Name`, `Application number`, `Guardian`, `Phone`, `Alternate phone`, `Date of Birth`, `Blood Group`, `Licence Type`, `Address`, `Registered On`. Name, application number, guardian, alternate phone and address are quoted with internal quotes doubled.

**JSON backup** (`ExcelDS_Backup_<yyyy-mm-dd>.json`): `{ "version": 1, "exportedAt": ISO, "clients": [...] }`, pretty-printed with 2 spaces.

**JSON import** merges by `id`, skipping clients whose id already exists, after a confirmation showing the incoming count. Invalid files toast `❌ Invalid backup file.`

**Print client card** — a 380 px card, dark navy gradient background, avatar initial, school name, "Client Identity Card", the client name, then Phone, Date of Birth with age, Alternate phone (only when present), Blood Group pill, Licence Type pill, Application number (only when present), Guardian and Address, with a footer showing a truncated id and the issue date.

---

## 7. Interaction details

- Toasts appear for 3200 ms with variants `success`, `error` and `info`.
- `Esc` closes any open dialog.
- `Ctrl+N` opens Add Client; `Ctrl+F` opens Clients and focuses search.
- The sidebar collapses on desktop and slides over on screens 640 px and narrower, closing on an outside click.
- Theme preference persists in `localStorage` under `excelDS_theme` with values `light` or `dark`; the legacy key `exelDS_theme` is also read for backwards compatibility.
- Intro animations are disabled after roughly 380 ms, or 32 ms when the user prefers reduced motion.

### Several people at once

The desktop app had one user, so none of this existed; it is the behaviour the web app adds.

- Lists refetch when the window regains focus and when the connection returns, so a tab left open does not show yesterday's data.
- Saving an edit sends the `updatedAt` the form was loaded from. If someone else saved first the server answers **409** with their version, and the form shows *Someone else edited this client* with **Load their version** and **Keep mine and overwrite**. Nothing is overwritten silently.
- If the client was deleted while being edited, the save is also refused with **409** rather than recreating the row behind the deleter's back. The form offers **Restore with my changes** or **Discard**.
- Open dialogs close by themselves if the record they are showing is deleted elsewhere.
- A payment against a client that no longer exists is refused with **404**.

---

## 8. Design tokens

Ported verbatim from the original stylesheet, which was already built on Apple system colours.

### Light

- Accent: `#007AFF`; secondary `#004AAD`; hover `#0051D5`; light `rgba(0,122,255,0.12)`; subtle `rgba(0,122,255,0.06)`; ring `rgba(0,122,255,0.18)`
- Hero gradient: `#007AFF` to `#5AC8FA` to `#34C7FF`
- Backgrounds: page `#F2F2F7`; elevated `#FFFFFF`; card `#FFFFFF`; sidebar `rgba(248,248,250,0.88)`; input `rgba(118,118,128,0.10)`; hover `rgba(0,0,0,0.04)`
- Borders: `rgba(0,0,0,0.08)`; strong `rgba(0,0,0,0.16)`; divider `rgba(0,0,0,0.06)`
- Text: primary `#1C1C1E`; secondary `#3A3A3C`; muted `#8E8E93`; placeholder `#AEAEB2`
- System colours: green `#34C759`; red `#FF3B30`; blue `#007AFF`; purple `#AF52DE`; teal `#32ADE6`
- Shadows: `0 2px 8px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)`; large `0 8px 32px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.05)`; modal `0 24px 72px rgba(0,0,0,0.15), 0 4px 16px rgba(0,0,0,0.08)`

### Dark

- Accent: `#0A84FF`; secondary `#B0DEFF`; hover `#2488FF`; light `rgba(10,132,255,0.20)`; subtle `rgba(10,132,255,0.10)`; ring `rgba(10,132,255,0.24)`
- Hero gradient: `#0A84FF` to `#5AC8FA` to `#30B9C4`
- Backgrounds: page `#000000`; elevated `#0D0D0D`; card `#0D0D0D`; sidebar `rgba(13,13,13,0.95)`; input `rgba(118,118,128,0.18)`; hover `rgba(255,255,255,0.08)`
- Borders: `rgba(255,255,255,0.12)`; strong `rgba(255,255,255,0.20)`; divider `rgba(255,255,255,0.10)`
- Text: primary `#FFFFFF`; secondary `#F0F0F0`; muted `#8E8E93`; placeholder `#5A5A5C`
- System colours: green `#30B14B`; red `#FF453A`; blue `#0A84FF`; purple `#BF5AF2`; teal `#30B9C4`
- Shadows: `0 2px 8px rgba(0,0,0,0.5), 0 1px 2px rgba(0,0,0,0.32)`; large `0 8px 32px rgba(0,0,0,0.56), 0 2px 8px rgba(0,0,0,0.32)`; modal `0 24px 72px rgba(0,0,0,0.72), 0 4px 16px rgba(0,0,0,0.40)`

### Shape, type and motion

- Radii: `10px` small, `14px` default, `18px` large, `22px` extra large; pills `99px`
- Layout: sidebar `232px`, topbar `58px`
- Body font stack: `-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', 'Inter', system-ui, sans-serif`
- Display font for brand, headings and avatars: `Outfit`, weights 600-800
- Easing `cubic-bezier(0.4,0,0.2,1)`, spring `cubic-bezier(0.34,1.56,0.64,1)`, duration `200ms`
- Scrollbars are 7 px with a `99px` thumb radius
