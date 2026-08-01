# `server/` — farm-ingest, the cloud half of the backhaul

The base-station phone (Module ④) sits behind carrier CGNAT on 3G/4G. There is no
public IP, no port to forward, and nothing on the internet can dial *in* to it.

So the phone dials **out**. Node-RED buffers every reading and POSTs it in batches
to this small service, which stores it in SQLite and serves a read-only page you can
open from anywhere.

Choosing push over a tunnel (Tailscale, Cloudflare Tunnel, ngrok) is deliberate:

- It sails through CGNAT with **zero** network configuration.
- It survives dropouts by design — the phone keeps a backlog and retries.
- It exposes **no** attack surface on the farm. Nothing can reach the phone, the
  Node-RED editor, or the valve endpoint from the internet.
- It costs almost nothing on a metered SIM: ~58 requests/day at 50 readings a batch.

A tunnel is still the right tool for *editing flows* remotely. It is the wrong tool
for shipping telemetry.

---

## Layout

| File | What it is |
|---|---|
| `ingest.ts` | The service. bun + `bun:sqlite`, no dependencies. |
| `farm-ingest.service` | systemd **user** unit (no root needed — linger is on). |
| `nginx-farm.conf` | HTTP-only bootstrap vhost; certbot rewrites it in place. |

Deployed at `~/farm-ingest/` on `hetzner-ian`, reachable at
**`https://farm.sunriselabs.io`**.

---

## Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/ingest` | Bearer | One reading, or an array, or `{readings:[…]}` |
| `POST` | `/ingest/batch` | Bearer | Same handler — the name the flow uses |
| `POST` | `/valve/set` | Bearer or cookie | `{state:0\|1, ttl_s?, source?}` — queue a valve command |
| `GET` | `/` | Bearer or `?k=` | Live page, auto-refreshes every 60 s |
| `GET` | `/api/readings?kind=&limit=` | Bearer or cookie | JSON rows, newest first |
| `GET` | `/api/latest` | Bearer or cookie | Newest row **per node** |
| `GET` | `/api/nodes` | Bearer or cookie | Every node seen, with liveness |
| `GET` | `/api/valve` | Bearer or cookie | Commanded state vs what the node last reported |
| `GET` | `/health` | none | Liveness. Says nothing about the data. |

The payload is **exactly what the ESP nodes already POST to Node-RED**, plus two
fields the flow adds: `kind` (`water`/`soil`) and `client_id`.

```bash
curl -X POST https://farm.sunriselabs.io/ingest \
  -H "Authorization: Bearer $FARM_TOKEN" -H 'Content-Type: application/json' \
  -d '{"kind":"water","client_id":"manual-1","node":"water-tank-1","ok":true,"depth_mm":113}'
```

Open the page on a phone with `https://farm.sunriselabs.io/?k=<token>` — the token
is moved into an `HttpOnly; Secure` cookie and the URL redirects to `/`, so the
secret stops living in your address bar and browser history.

---

## The four decisions worth knowing

**1. `client_id` makes delivery idempotent.** Store-and-forward re-sends any batch
whose response was lost. Without a dedupe key that double-counts every reading taken
during a dropout — precisely when the data matters. The column is `UNIQUE` and
inserts are `INSERT OR IGNORE`.

**2. Faults are stored, not rejected.** `{"ok":false,"error":"…"}` rows are rows. A
silent node is indistinguishable from a flat battery; an explicit error says "node
alive, probe isn't." Same invariant as the firmware, carried all the way to the
database. This is also why the flow taps the `http in` nodes directly instead of the
`store …` functions — those `return null` on faults.

**3. The server clock owns time.** The ESP has no RTC and the phone's clock can be
anything. `received_at` is stamped here; the node's `uptime_s` rides along as a
liveness signal, not a timestamp.

**4. A 200 alone does not clear the buffer.** The flow requires the service's own
`{ok:true, accepted:N}` envelope before deleting anything. A misconfigured vhost, a
captive portal, or a proxy error page all return 200 with a body that isn't ours —
and trusting the status code would silently delete readings that were never
delivered. That is the worst failure a store-and-forward queue can have.

---

## Nodes on the dashboard

One card per **node**, not per sensor kind. Nothing is hardcoded to a node name — a
bed appears the first time it reports, so flashing `soil-bed-3` is the whole
install. Cards go green (fresh), amber (quiet), or red (the node reported a fault).

"Quiet" is learned from each node's own history rather than fixed, because the nodes
do not agree on a cadence: `farm-node` reports every 60 s while the deep-sleep
battery-swap node wakes far less often. A single threshold would either cry wolf over
the sleeper or stay green for hours after a live node died. The rule is
`3 × that node's median gap`, floored at 5 minutes.

---

## Valve control from the dashboard

The phone cannot be dialled into, so a command has to be something it *collects*. It
already POSTs batches, so **every batch is answered with the desired valve state** —
no extra requests, no extra data, and still nothing exposed on the farm.

```
you press Open  →  server records state + bumps seq
                →  node's next reading POST comes in
                →  response carries {valve:{state,seq}}
                →  Node-RED sets flow.valveCmd
                →  ESP's 1 s poll of GET /valve sees "1"
                →  relay closes
```

Expect **up to a minute or two** end to end — one reporting interval plus one ESP
poll. The dashboard says so, and shows commanded state against what the node last
actually reported, so a command that hasn't landed yet is visible rather than
mysterious.

Three rules make this safe to leave running:

**Commands are applied on the edge of `seq`, never re-asserted.** The local Node-RED
page has its own Open/Close buttons and must keep working with no internet at all. If
the cloud re-applied its state on every push, a button pressed at the tank would be
silently undone a minute later.

**First contact adopts the sequence without acting.** Node-RED's context is in
memory, so a restart forgets `valveCmd` and the valve falls shut — and it should stay
shut until a human asks again, rather than a stale cloud "open" re-opening it
unattended. The practical effect is that the very first command after a Node-RED
restart is absorbed as a baseline; in normal running the phone pushes constantly, so
the baseline is adopted long before anyone presses anything.

**An open command expires.** `FARM_VALVE_TTL_S` (default 1800 s) auto-closes the
valve with a bumped `seq`, so the phone sees a real edge and shuts it.

> ### ⚠️ The expiry is a backstop, not a guarantee
> If the phone cannot reach the server at all, no expiry computed here will ever
> arrive. The only thing that closes a valve when *the link itself* is what failed is
> **`VALVE_MAX_OPEN_S` in the firmware**, and it currently ships as `0` — disabled.
> Set it before leaving remote valve control switched on unattended: an open valve on
> a 6000 L tank is a bad thing to discover a day late.

---

## Operating it

```bash
systemctl --user status farm-ingest
systemctl --user restart farm-ingest
journalctl --user -u farm-ingest -f
```

The token lives in `~/farm-ingest/.env` (chmod 600) and is loaded by the unit's
`EnvironmentFile`. `ingest.ts` **refuses to start** without one — an unauthenticated
ingest endpoint on the public internet is worse than no endpoint at all.

Query the data directly:

```bash
cd ~/farm-ingest && bun -e '
import { Database } from "bun:sqlite";
const db = new Database("data/readings.db");
console.table(db.query("SELECT received_at,kind,node,ok,depth_mm,moisture_pct FROM readings ORDER BY id DESC LIMIT 20").all());
'
```

Retention defaults to 400 days (`FARM_RETENTION_DAYS`). At two sensors on a 60 s
interval that is ~1 M rows, well under 200 MB — but the VPS root filesystem was 91 %
full when this was installed, so it is worth a glance now and then.

---

## First-time install

Everything below runs as `ian`, except the one nginx step.

```bash
mkdir -p ~/farm-ingest/data
scp server/ingest.ts            hetzner-ian:~/farm-ingest/
scp server/farm-ingest.service  hetzner-ian:~/.config/systemd/user/
scp server/nginx-farm.conf      hetzner-ian:~/farm-ingest/

# token — generate once, never commit
printf 'FARM_TOKEN=%s\nFARM_PORT=8790\nFARM_HOST=127.0.0.1\n' "$(openssl rand -hex 32)" > ~/farm-ingest/.env
chmod 600 ~/farm-ingest/.env

systemctl --user daemon-reload
systemctl --user enable --now farm-ingest.service
```

Then, **as root, once** (the only step that needs a password):

```bash
sudo cp ~/farm-ingest/nginx-farm.conf /etc/nginx/sites-available/farm.sunriselabs.io
sudo ln -sf /etc/nginx/sites-available/farm.sunriselabs.io /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d farm.sunriselabs.io --agree-tos -m waipuna@gmail.com --redirect
```

`*.sunriselabs.io` already resolves to the box, so no DNS work is needed. Without
this vhost, `farm.sunriselabs.io` falls through to whichever site nginx loads first
and serves a certificate for the wrong name.

---

## The phone side

See `flows/push-to-cloud-flow.json` — importable, core nodes only, no installs. The
URL and token live at the top of the **`drain outbox`** function and nowhere else.

⚠️ **The outbox lives in memory.** Node-RED's default context store is `memory`, so
restarting Node-RED (or the phone) drops whatever is queued. It survives 4G outages,
not reboots. To survive both, add a filesystem context store in `settings.js` —
worth doing, but it is a change to a file that can stop Node-RED starting, so do it
at a desk and not in a field.
