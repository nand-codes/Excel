# Deployment runbook

Everything needed to put Excel Driving School on AWS and keep it running: one Lightsail
instance in Mumbai, Caddy terminating HTTPS, the Express API behind it, and SQLite on the
instance disk with nightly snapshots to S3.

The files referenced here all live in `deploy/`.

```
Staff browsers ──HTTPS──▶ Caddy :443 ──▶ /api/*  ──▶ Node :4000 ──▶ /var/lib/excel-ds/clients.sqlite
                            └─────────▶ anything else ──▶ /opt/excel-ds/web/dist (React build)
                                                   nightly cron ──▶ VACUUM INTO ──▶ S3 (versioned)
```

| | |
| --- | --- |
| Region | `ap-south-1` (Mumbai) — lowest latency, and the personal data stays in India |
| Instance | Lightsail, Ubuntu 24.04, 1 GB plan, static IP |
| Runtime | Node 22, held at that major version because `node:sqlite` is still experimental |
| Service user | `excelds` (no login shell) |
| Database | `/var/lib/excel-ds/clients.sqlite` — deliberately outside the deploy directory |
| Backups | nightly `VACUUM INTO` → gzip → S3, plus weekly Lightsail instance snapshots |
| Cost | roughly USD 6–13/month plus about USD 12–15/year for the domain |

---

## 1. Before you touch AWS

Run the test suites locally and make sure they are green. It is much cheaper to find a
problem here than on the server.

```bash
npm test            # API + three-user concurrency
npm run test:ui     # browser walkthrough of every screen
```

## 2. Register the domain

1. Route 53 → **Registered domains** → **Register domains**. A `.in` or `.com` is about
   USD 12–15/year. Registration takes a few minutes to an hour.
2. Route 53 creates a public hosted zone automatically (USD 0.50/month). Leave it; you will
   add the `A` record in step 4 once the instance has an IP.

If you already own a domain elsewhere, skip this and just point an `A` record at the static
IP from step 3.

### No domain? Serve from the IP instead

Since January 2026 Let's Encrypt issues certificates for IP addresses, so you can run real
HTTPS without buying anything — `deploy/Caddyfile.ip` is that configuration and
`provision.sh` picks it automatically when you pass an IP instead of a hostname. Skip steps 2
and 4 entirely; everything else is unchanged.

Two things make this worse than a domain rather than merely different, and both are worth
knowing before you commit to it:

- **IP certificates last 160 hours, about six days**, because Let's Encrypt requires its
  `shortlived` profile for them. Caddy renews well before expiry on its own, but the margin
  for error is days rather than a month: if ports 80 and 443 become unreachable, or the
  instance is stopped over a long weekend, HTTPS breaks rather than merely ages.
- **The address is the certificate.** Change or detach the static IP and every bookmark and
  the certificate go with it. With a domain you can rebuild the instance and repoint DNS.

A free hostname is the middle road if you would rather not pay: a DuckDNS subdomain gives you
ordinary 90-day certificates and survives an IP change, and `provision.sh` treats it as a
normal domain. Avoid `nip.io` and `sslip.io` — they are shared so heavily that Let's Encrypt
rate limits usually reject them.

One Lightsail-specific detail the config already handles: the instance's own network
interface holds a private NAT address, not your public IP, and browsers send no SNI when you
type a bare IP. Caddy would therefore look for a certificate named after the private address
and fail the handshake, which is why `Caddyfile.ip` sets `default_sni` to your public IP.
This also needs Caddy 2.11 or newer; the provisioning script prints the version it installed.

## 3. Create the instance

Lightsail → **Create instance**:

- Region **ap-south-1 (Mumbai)**, any availability zone
- Platform **Linux/Unix**, blueprint **Ubuntu 24.04 LTS** (the plain OS, not a stack image)
- Plan: the **1 GB / 2 vCPU** tier. The app is idle at 3 users, but the Vite build needs
  roughly 700 MB of memory, so the 512 MB tier will fail to build the front end.
- Name it `excel-ds`

Then, still in Lightsail:

- **Networking → Attach static IP.** Do this before DNS. Without it the IP changes on stop
  and start, and the certificate breaks.
- **Networking → IPv4 firewall.** Leave HTTP (80) and HTTPS (443) open to anywhere — port 80
  is needed for the Let's Encrypt challenge and for the redirect to HTTPS. Edit the **SSH
  (22)** rule and restrict the source to your office IP address. If your office IP is
  dynamic, use the Lightsail browser SSH console instead and delete the rule entirely.
- **Snapshots → Enable automatic snapshots**, weekly, early morning. This covers "the whole
  instance died", which the S3 database backup does not.

## 4. Point DNS at it

Skip this step if you are using the IP directly.

Route 53 → your hosted zone → **Create record**:

- Name: `app` (so the app lives at `app.yourdomain.in`), or blank for the root domain
- Type `A`, value = the static IP, TTL 300

Wait until it resolves before running the setup script, because Caddy asks Let's Encrypt for
a certificate immediately and a failed challenge lands you in a retry backoff:

```bash
dig +short app.yourdomain.in     # must print your static IP
```

## 5. Provision the server

SSH in, then:

```bash
sudo apt-get update && sudo apt-get install -y git
git clone https://github.com/nand-codes/Excel.git /tmp/excel

# With a domain:
sudo bash /tmp/excel/deploy/provision.sh app.yourdomain.in you@example.com
# Or straight from the static IP:
sudo bash /tmp/excel/deploy/provision.sh 203.0.113.10 you@example.com
```

`deploy/provision.sh` is idempotent — re-running it is safe. It installs Node 22, Caddy and
the AWS CLI, creates the `excelds` user and the data directories, clones the app to
`/opt/excel-ds`, writes `/etc/excel-ds.env`, installs the systemd unit and the matching
Caddyfile with your address substituted in, builds the front end, starts everything, and
installs the nightly backup job.

When it finishes, `https://app.yourdomain.in` (or `https://203.0.113.10`) should show the
login screen. There are no accounts yet, so nothing can get in — that is the correct state to
be in for one more step.

## 6. Create the three staff accounts

There is no self-signup by design. Each account is created on the server:

```bash
cd /opt/excel-ds
sudo -u excelds EXCEL_DB_PATH=/var/lib/excel-ds/clients.sqlite \
  node scripts/user-cli.js add --username asha --name "Asha" --role admin
```

The tool prompts for the password without echoing it and requires at least 10 characters.
Repeat with `--role staff` for the other two. Give each person their own account: the audit
trail and the 409-conflict messages are only meaningful if sessions map to people.

```bash
sudo -u excelds EXCEL_DB_PATH=/var/lib/excel-ds/clients.sqlite node scripts/user-cli.js list
```

Sign in from a browser and confirm you can add a client. The app is now live.

## 7. Set up the S3 backups

The nightly job already runs and keeps 14 local snapshots. Sending them off the instance
takes three more steps.

**Create the bucket** (S3 → Create bucket, region `ap-south-1`):

- Block all public access: **on**
- Bucket versioning: **enabled** — this is what protects you from a bad snapshot overwriting
  a good one
- Default encryption: **SSE-S3 (AES256)**
- Optionally apply `deploy/s3-lifecycle.json` (Management → Lifecycle rules) to expire
  snapshots after 180 days so storage does not creep up

**Create the credentials.** Lightsail instances have no IAM role, so create an IAM user with
`deploy/iam-backup-policy.json` attached, with the bucket name filled in. The policy allows
`PutObject` on the `snapshots/` prefix and nothing else — the instance cannot list, read or
delete backups, so someone who breaks into the server cannot quietly destroy the history or
download every client record from the bucket. That also means restores are done with *your*
credentials, not the server's.

```bash
# -H so the credentials land in the excelds home, where the backup job looks for them.
sudo -H -u excelds aws configure   # the access key for that IAM user, region ap-south-1
```

**Point the job at the bucket.** Edit `/etc/excel-ds.env`:

```
EXCEL_S3_TARGET=s3://excel-ds-backups-yourname/snapshots
```

Then set the clock to local time and test the job by hand:

```bash
sudo timedatectl set-timezone Asia/Kolkata
sudo excel-ds-backup
aws s3 ls s3://excel-ds-backups-yourname/snapshots/
```

It runs at 02:17 every night from `/etc/cron.d/excel-ds-backup` and logs to
`/var/log/excel-ds-backup.log`. `VACUUM INTO` takes a consistent copy while the app is
running, so there is no downtime and no risk of catching a half-written file — the
concurrency test asserts exactly that by taking a snapshot mid-write and running
`PRAGMA integrity_check` on the result.

## 8. Verify with three real users

Have all three people sign in at once, on their own machines, and walk through this. Every
case here is covered automatically by `npm run test:concurrency`, but do it once by hand so
you have seen what the conflict message looks like before a member of staff phones you about
it.

| Check | Expected |
| --- | --- |
| One person adds a client | The others see it when their window regains focus, or on **Refresh** |
| Two people edit the same client and both save | The second gets "Someone else edited this client" with **Load their version** and **Keep mine and overwrite** — never a silent overwrite |
| One deletes a client another is editing | The editor gets "Someone else deleted this client" and can restore it with their changes or discard |
| One deletes a client another has open in the detail sheet | The sheet closes by itself |
| Three payments recorded at the same time | All three appear, and the total adds up |
| Add a client with an application number and an alternate number | Both save and appear in the table |
| Send the WhatsApp welcome, a payment receipt and a practice reminder | A `wa.me` tab opens with the message pre-filled, not blocked by the popup blocker |
| Reports, CSV export, print register, print client card | All work in the browser |
| Sign out on one machine | The other two stay signed in |

## Day-to-day operations

```bash
sudo systemctl status excel-ds          # is it running
sudo journalctl -u excel-ds -f          # live application log
sudo journalctl -u excel-ds -n 200      # recent history
sudo systemctl restart excel-ds         # restart the API
sudo tail -f /var/log/caddy/excel-ds.log        # HTTP requests
sudo tail -20 /var/log/excel-ds-backup.log      # last backup runs
curl -fsS http://127.0.0.1:4000/api/health      # API health from the instance
```

`systemd` restarts the process on a crash and on reboot, with a limit of 5 restarts per
minute so a broken deploy cannot spin forever. The database survives a crash: SQLite is in
WAL mode with a 5-second busy timeout.

### Deploying a change

```bash
sudo bash /opt/excel-ds/deploy/deploy.sh
```

It snapshots the database first, pulls, installs, rebuilds the front end, restarts, and hits
the health endpoint. If the health check fails it resets to the previous commit, rebuilds and
restarts, so a bad push does not leave the app down. `git pull --ff-only` means local edits
on the server will stop the deploy rather than being silently discarded — don't edit files in
place on the instance.

### Restoring the database

```bash
# From a local snapshot on the instance:
ls -lh /var/backups/excel-ds/
sudo bash /opt/excel-ds/deploy/restore-snapshot.sh \
  /var/backups/excel-ds/clients-2026-09-09T02-17-00Z.sqlite.gz

# From S3 — with your own credentials, since the instance cannot read the bucket:
aws s3 ls s3://excel-ds-backups-yourname/snapshots/
aws s3 cp s3://excel-ds-backups-yourname/snapshots/clients-....sqlite.gz /tmp/
sudo bash /opt/excel-ds/deploy/restore-snapshot.sh /tmp/clients-....sqlite.gz
```

The script stops the service, moves the current database aside as
`clients.sqlite.replaced-<timestamp>` rather than deleting it, writes the snapshot, runs
`PRAGMA integrity_check` and reports the row counts, then starts the service again. A restore
is therefore reversible: if the snapshot turns out to be the wrong one, stop the service and
move the `.replaced-` files back.

Everyone will need to sign in again if the snapshot predates their session. Accounts are in
the same file, so a restore also rolls back password changes.

### Recovering the whole instance

If the instance itself is gone, restore the newest weekly snapshot (Lightsail → Snapshots →
**Create new instance**), attach the static IP to the new instance, and then restore the most
recent S3 database snapshot on top so you lose at most one day of data instead of a week.
Budget about 15 minutes. This is the accepted downside of running a single instance.

### Routine maintenance

- **Security updates:** `sudo apt-get update && sudo apt-get upgrade` monthly. `nodejs` is
  held on purpose; to move to a new Node major, `sudo apt-mark unhold nodejs`, upgrade, run
  `npm test` on the instance, then hold it again.
- **Certificates:** Caddy renews them by itself. Nothing to do.
- **Passwords:** `node scripts/user-cli.js passwd --username asha` (same `sudo -u excelds`
  and `EXCEL_DB_PATH` prefix as above). Removing someone with
  `scripts/user-cli.js remove` also deletes their sessions, so access ends immediately.
- **Disk:** `df -h`. The database and its backups are tiny; the usual culprit is logs.

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| Browser shows a certificate error | DNS was not resolving when Caddy first started. Fix the `A` record, then `sudo systemctl restart caddy` and check `journalctl -u caddy -n 50`. |
| On the IP setup: `no certificate available for 172.26.x.x` | Caddy is matching the private NAT address. `/etc/caddy/Caddyfile` needs `default_sni <your public IP>` in the global block — check the substitution worked. |
| On the IP setup: `cannot have public IP certificate` | Caddy is too old to request IP certificates. `caddy version`, then `sudo caddy upgrade && sudo systemctl restart caddy`. |
| 502 from Caddy | The API is down. `journalctl -u excel-ds -n 100` — usually a syntax error in a bad deploy or a missing `/etc/excel-ds.env`. |
| Login always fails | Wrong database. Confirm `EXCEL_DB_PATH` in `/etc/excel-ds.env` matches the file you created the accounts in, then `node scripts/user-cli.js list`. |
| "Too many sign-in attempts" | The rate limiter, 10 per IP per 15 minutes. All three staff behind one office IP share that budget. Wait, or raise `EXCEL_LOGIN_ATTEMPTS`. |
| Signed out immediately after signing in | `EXCEL_SECURE_COOKIES=1` while being served over plain HTTP. Use HTTPS. |
| Front-end build killed during deploy | Out of memory on the 512 MB plan. Resize the instance, or add a swap file. |
| Backup log shows "EXCEL_S3_TARGET is not set" | Step 7 is incomplete; snapshots are staying on the instance only. |
| `database is locked` in the log | A writer held the lock past 5 seconds. Should not happen at this size — check for a stray `node` process or a hung backup. |

## If you outgrow this

The parts that would change first, in order: move SQLite to RDS Postgres (`db/clientStore.js`
is the only file that speaks SQL), then put the API behind a load balancer with two
instances. Neither is worth doing for three users — the benchmark in `docs/PERFORMANCE.md`
reads 5,000 clients in about 10 ms.
