# Connect Nodi to Home Assistant

Nodi’s **custom integration** (`custom_components/nodi`) is the recommended path. Home Assistant talks **directly** to the Mediola Eva a.i.o. gateway — you do not need the Node `serve` bridge for this.

Goal: copy the integration into HA’s config directory → restart → add **Nodi** in the UI → learn up + down → use cover entities.

---

## 1. Find your Home Assistant config directory

In HA: **Settings → System → Repairs → ⋮ → System information → Configuration Directory**.

That value is often `/config` (path **inside** the HA environment). You must copy files to the matching path on the **host** (or via Samba / Studio Code Server / SSH add-on), so they appear as:

```text
<config>/custom_components/nodi/
```

| Setup | Typical host path for `<config>` |
|---|---|
| Home Assistant OS / Supervised | `/usr/share/hassio/homeassistant` or via Samba share `config` |
| Docker / Compose | Host directory mounted to `/config` (see below) |
| Core (venv) on Linux | The directory you pass as config (often `~/.homeassistant`) |

---

## 2. Install the integration

Clone the repo on a machine that can reach the HA host (or work directly on the HA host):

```bash
git clone https://github.com/Ole2669/nodi.git
cd nodi
```

Pick the method that matches your install.

### A. Home Assistant OS (Raspberry Pi, ODROID, etc.)

Common options:

1. **Samba / Windows share** — share the `config` folder, then copy `custom_components/nodi` into `config/custom_components/`.
2. **Studio Code Server** or **File editor** add-on — create `custom_components/nodi` and upload/paste the files from this repo.
3. **SSH / Terminal** add-on — from a machine with the repo:

   ```bash
   scp -r custom_components/nodi root@ha-host:/config/custom_components/
   ```

   (User/host depend on your SSH add-on settings.)

After copy: **Settings → System → Restart**.

### B. Home Assistant in Docker

System information may show only `/config` — that is inside the container. Find the host mount:

```bash
ssh user@ha-host
docker ps --format '{{.Names}}'          # often homeassistant
docker inspect homeassistant --format \
  '{{range .Mounts}}{{println .Source "->" .Destination}}{{end}}'
```

Look for `-> /config`. The **left** path is `HOST_CONFIG`, e.g.:

```text
/home/user/homeassistant -> /config
```

With Compose, check volumes (`./config:/config`, etc.).

From your machine (repo root):

```bash
./scripts/install-ha.sh user@ha-host /path/to/HOST_CONFIG
```

Example:

```bash
./scripts/install-ha.sh user@ha-host /home/user/homeassistant
```

Or manually:

```bash
scp -r custom_components/nodi user@ha-host:/path/to/HOST_CONFIG/custom_components/
```

Restart:

```bash
ssh user@ha-host 'docker restart homeassistant'
```

(or **Settings → System → Restart** in the UI).

### C. Home Assistant Supervised / generic Linux

Same idea as Docker or OS: put files under the real config directory’s `custom_components/nodi`, then restart the HA service or container you use.

```bash
./scripts/install-ha.sh user@ha-host /usr/share/hassio/homeassistant
```

(Adjust path to your install.)

### D. Manual copy (any setup)

Wherever `<config>` lives:

```bash
mkdir -p <config>/custom_components
cp -R custom_components/nodi <config>/custom_components/
```

Restart Home Assistant.

---

## 3. Add the integration in the UI

1. **Settings → Devices & services → Add integration**
2. Search: **Nodi**
3. Host: Mediola IP or hostname (e.g. `mediola.local`), port `80`
4. Optional username/password if the gateway has auth enabled
5. Save

If Nodi does not appear: confirm `manifest.json` exists under `custom_components/nodi/` and that you restarted after copying.

---

## 4. Learn a shutter

1. **Developer tools → Actions**
2. Action: `nodi.learn`
3. Fields, e.g.:
   - `shutter_id`: `living`
   - `direction`: `up`
   - `name`: `Living room`
4. Optionally enable **Return response**
5. **Perform action** → notification “Learn mode active” → press the remote near the gateway (~30 cm, within ~90 s)
6. Repeat with `direction: down`
7. When both exist, a cover entity appears (e.g. `cover.living`)

| Feedback | Where |
|---|---|
| Immediate message | Bell icon (notifications) |
| Action response | Below Perform (if “Return response” is on) |
| Overview | Sensor **Nodi Mediola Status** (attributes) |
| Full list | Action `nodi.list_codes` |

Remove codes: action `nodi.remove` with `shutter_id` and optional `direction`.

Dashboard: edit dashboard → **Cover** card → entity e.g. `cover.living`.

---

## 5. Updating Nodi

Copy the integration again (same method as install), then restart Home Assistant.

```bash
./scripts/install-ha.sh user@ha-host /path/to/ha/config
```

---

## 6. Alternative: Node CLI + HTTP bridge (no custom component)

If you cannot install custom components, run the Node bridge on a LAN host and paste generated YAML into HA. See [`cli.md`](cli.md). Prefer the custom integration when possible — fewer moving parts and no always-on Mac/Linux process.
