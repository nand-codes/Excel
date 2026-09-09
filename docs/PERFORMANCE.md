# Performance testing

The app has three places worth measuring: **SQLite** (`db/clientStore.js`), **the API** (Express,
one process), and **the browser** (tables, charts, search). With three staff and a few thousand
clients none of these is close to a limit, so this document is mostly about spotting regressions.

## 1. Database benchmark

Measures bulk insert, full-table read (the same call that loads the clients list), repeated single
updates, and payment reads and writes. It uses a **temporary** database file, so
`data/clients.sqlite` is never touched.

```bash
npm run perf
```

Larger runs:

```bash
node scripts/perf-benchmark.js --clients=20000
node scripts/perf-benchmark.js --clients=10000 --json   # machine readable
```

| Variable | Meaning |
|----------|---------|
| `PERF_CLIENTS` | Default client count when `--clients` is omitted |

**What good looks like:** on a typical laptop, `getAllClients` for 5k-10k rows should stay in the
low tens of milliseconds, and bulk insert should be tens of thousands of rows per second. If
`getAllClients` climbs into whole seconds at a few thousand clients, the fix is pagination or a
virtualised table rather than more SQLite tuning.

## 2. API timing

The clients list is the only endpoint that returns a large payload. Measure it end to end,
including JSON serialisation, with a signed-in session cookie:

```bash
curl -s -b cookies.txt -o NUL -w "%{time_total}s  %{size_download} bytes\n" \
  https://your-domain/api/clients
```

To get `cookies.txt`:

```bash
curl -s -c cookies.txt -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"..."}' https://your-domain/api/auth/login
```

On the server, `journalctl -u excel-ds -f` shows request errors and restarts. Node's own profiler
is available if a slow endpoint ever needs attention:

```bash
node --cpu-prof --cpu-prof-dir=./profiles server/index.js
```

Load the resulting `.cpuprofile` into Chrome DevTools → Performance → Load profile.

## 3. Browser profiling

1. Open the app, then DevTools (**F12**) → **Performance**.
2. Record while opening **Clients**, typing in search, sorting columns and opening **Reports**.
3. Look for long tasks. Sorting and filtering run over the whole in-memory list on every
   keystroke, which is the first thing to memoise if the register grows very large.

The **Network** tab is the quicker check for perceived slowness: the initial JavaScript bundle is
around 135 kB gzipped and is cached with a content hash, so after the first visit only
`/api/clients` should be on the critical path.

## 4. Full-stack smoke tests

These are correctness checks rather than benchmarks, but they are the fastest way to confirm a
change did not break anything, and both print their own timings via the browser and API:

```bash
npm run test:api
npm run test:ui
```

## 5. Where the ceilings actually are

| Concern | Current headroom | First thing to change |
|---------|------------------|-----------------------|
| Concurrent users | WAL handles a handful comfortably | Move to Postgres if writers grow past ~10 |
| Clients list payload | Whole table sent as JSON | Server-side paging and search |
| Reports | Computed in the browser on every visit | Aggregate in SQL |
| Single instance | No redundancy | Second instance plus a load balancer, and Postgres |
