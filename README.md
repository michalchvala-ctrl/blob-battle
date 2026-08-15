# Blob Battle

3D želé bitka v prehliadači. Žiadna inštalácia pre hráčov — otvoríš link a ste v aréne.

## Ako hrať

1. Niekto vytvorí izbu a pošle **4-miestny kód**
2. Kamoši sa pridajú
3. Hosť vyberie mód a dá **Štart**
4. Zhoď ostatných z ostrova

**Ovládanie:** WASD pohyb · myš rozhliadni sa · medzerník skok · ľavý klik úder · Shift dash

### Módy

- **Zhodiť** — posledný na ostrove vyhral
- **Bomba** — dotyk odovzdá bombu, kto ju drží keď vybuchne, letí dole
- **Kráľ kopca** — ostrov sa zmenšuje

## Spustenie u seba

Treba [Node.js 18+](https://nodejs.org/).

```bash
npm install
npm start
```

Otvor http://localhost:3000

### Kamoš po sieti (najrýchlejšie)

Nechaj hru bežať a v druhom termináli:

```bash
npx ngrok http 3000
```

Pošli mu `https://....ngrok-free.app` odkaz.

Alebo zisti svoju lokálnu IP (`ipconfig`) a kamoš na Wi-Fi otvorí `http://TVOJA-IP:3000`.

## Nasadenie na internet

WebSocket server, nie statický hosting. Funguje na **Render**, **Railway** alebo **Fly.io**.

### Render

1. Pushni tento priečinok na GitHub
2. New → Web Service → ten repo
3. Build: `npm install`
4. Start: `npm start`
5. Hotovo — pošleš kamošovi URL

## Stack

Node + Express + Socket.io, fyzika `cannon-es`, grafika Three.js.

## Unraid Docker (port 5111)

Hru môžeš spustiť na Unraid ako Docker kontajner. Port hry je **5111**.

### 1. Postavenie image (Unraid terminál)

```bash
cd /mnt/user/appdata
git clone https://github.com/michalchvala-ctrl/blob-battle.git blob-battle
cd blob-battle
docker build -t blob-battle:latest .
```

(Ak už máš súbory stiahnuté, stačí `cd` do priečinka s `Dockerfile` a `docker build -t blob-battle:latest .`.)

### 2. Pridanie kontajnera cez web UI

1. Otvor **Docker** → **Add Container** (pridať kontajner).
2. Nastav:
   - **Name:** `blob-battle`
   - **Repository:** `blob-battle:latest` (lokálny image z kroku vyššie)
   - **Network Type:** Bridge
   - **Restart policy:** Unless stopped (`unless-stopped`)
3. **Port Mappings:** Host port **5111** → Container port **5111** (TCP).
4. **Environment Variables:** pridaj `PORT` = `5111` (voliteľné — v image je už predvolené).
5. Apply / Done.

### 3. Otvorenie hry

V prehliadači: `http://IP-TVOJHO-UNRAIDU:5111`
(napr. `http://192.168.1.50:5111`). Pošli ten istý odkaz kamošom v LAN, alebo nastav port forward / VPN podľa potreby.

> **Poznámka:** Na Docker Hub image nepublikujeme — builduješ z GitHubu/`Dockerfile` lokálne na Unraid.

