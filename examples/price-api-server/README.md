# Demo price API

Simple HTTP server used with the ZebraLabel app's barcode price lookup.

## Start

```sh
cd examples/price-api-server
npm start
```

Default URL: `http://localhost:3456`

All requests are logged to the console (timestamp, client IP, method, path, status, barcode, and PUT body).

## API

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| `GET` | `/prices/{barcode}` | — | `{"price":"4.99"}` or `404` with `{"price":null}` |
| `PUT` | `/prices/{barcode}` | `{"price":"4.99"}` | Saved entry with `updatedAt` |

Every `PUT` writes the full database to `prices.json`.

## App setup

1. Open the app settings (gear icon, top right).
2. Set **API base URL** to your machine's LAN address, e.g. `http://192.168.1.10:3456`.
3. Scan a barcode:
   - Known barcode → price fills automatically.
   - Unknown barcode → enter price on the keypad, then print; the price is saved via `PUT`.

### Android emulator

Use `http://10.0.2.2:3456` to reach the host machine from the emulator.

### Physical device

Use your PC's Wi‑Fi IP (same network as the phone/tablet).

## Try it

```sh
# Lookup (unknown barcode)
curl http://localhost:3456/prices/4006381333931

# Save a price
curl -X PUT http://localhost:3456/prices/4006381333931 \
  -H "Content-Type: application/json" \
  -d '{"price":"4.99"}'

# Lookup again
curl http://localhost:3456/prices/4006381333931
```
