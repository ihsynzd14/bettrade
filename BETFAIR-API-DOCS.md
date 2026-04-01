# Betfair Exchange API — Comprehensive Developer Reference

> **Account:** Ersen  
> **Live Application Key Status:** ACTIVATED  
> **Activation Fee:** £499 (debited from Betfair account)  
> **Official Docs Root:** https://betfair-developer-docs.atlassian.net/wiki/spaces/1smk3cen4v3lu3yomq5qye0ni/overview

---

## Table of Contents

1. [Application Keys](#1-application-keys)
2. [Authentication & Session Management](#2-authentication--session-management)
   - 2a. [Interactive Login — API Endpoint](#2a-interactive-login--api-endpoint)
   - 2b. [Non-Interactive (Bot) Login](#2b-non-interactive-bot-login)
   - 2c. [Keep Alive & Logout](#2c-keep-alive--logout)
3. [Exchange Stream API (Real-Time)](#3-exchange-stream-api-real-time)
4. [REST Betting API](#4-rest-betting-api)
5. [Market Data Request Limits](#5-market-data-request-limits)
6. [Transaction Charges](#6-transaction-charges)
7. [Historical Data](#7-historical-data)
8. [Best Practices](#8-best-practices)
9. [Sample Code & Client Libraries](#9-sample-code--client-libraries)
10. [API Status & Monitoring](#10-api-status--monitoring)
11. [Developer Support & Notifications](#11-developer-support--notifications)
12. [All Endpoints Quick Reference](#12-all-endpoints-quick-reference)
13. [All Documentation Links](#13-all-documentation-links)

---

## 1. Application Keys

**Docs:** https://betfair-developer-docs.atlassian.net/wiki/spaces/1smk3cen4v3lu3yomq5qye0ni/pages/2687105/Application+Keys

### What is an Application Key?
Every API request requires an `X-Application` header set to your App Key. Two keys are assigned per Betfair account:

| Key Type | Purpose | Price Data | Bet Placement | Stream API | Price Levels |
|----------|---------|-----------|--------------|-----------|-------------|
| **Delayed** | Development & testing | Delayed (1–180s) | Yes | Yes (limited: 2 connections, 200 markets) | 3 levels |
| **Live** | Production betting apps | Real-time | Yes | Yes | All levels |

**Important rules:**
- Upon creation, the **Live key is inactive** — must be activated (£499 one-off fee)
- The **Delayed key runs against live production**, not a sandbox
- Delayed key does **NOT** return `totalMatched` or `EX_ALL_OFFERS`
- App keys are for **personal betting only** — commercial use requires Betfair approval
- Read-only / commercial usage of Live data is **NOT permitted**
- Restrictions will be applied to 'read-only' Live Application Keys

### Creating an Application Key

1. Go to the **Accounts API Demo Tool:** https://apps.betfair.com/visualisers/api-ng-account-operations/
2. Select `createDeveloperAppKeys`
3. Enter your `sessionToken` and a unique `Application Name`
4. Press **Execute** — two keys (live + delayed) are created

**Rules:**
- Application Name must be **unique** across all Betfair
- Application Name cannot contain your username
- Only one set of keys per account

### Retrieving Existing Keys

Use `getDeveloperAppKeys` on the Accounts API Demo Tool with your session token. The key value is 16 characters — expand the column to see it in full.

### Activating the Live Key

Apply at: https://developer.betfair.com/get-started/  
Select: **Exchange API > For My Personal Betting**

**Prerequisites before applying:**
- Complete all testing with your Delayed key
- Account must be fully KYC-verified
- Account funded to cover the £499 non-refundable activation fee
- Note: Applications NOT accepted from India, Bangladesh, Sri Lanka or UAE

---

## 2. Authentication & Session Management

**Docs:** https://betfair-developer-docs.atlassian.net/wiki/spaces/1smk3cen4v3lu3yomq5qye0ni/pages/2687869/Login+Session+Management

All API requests must be sent as **POST**. There are three login methods:

| Method | Best For | Complexity |
|--------|----------|-----------|
| Non-Interactive (cert) | Bots & automated apps | Medium |
| Interactive — API Endpoint | Quick integrations | Low |
| Interactive — Desktop App | Multi-user 3rd party apps | High |

**Login Rate Limit:** Max **100 successful requests per minute**. Breach triggers a 20-minute ban (`TEMPORARY_BAN_TOO_MANY_REQUESTS`). Existing sessions remain valid.

---

### 2a. Interactive Login — API Endpoint

**Docs:** https://betfair-developer-docs.atlassian.net/wiki/spaces/1smk3cen4v3lu3yomq5qye0ni/pages/2687772/Interactive+Login+-+API+Endpoint

**Endpoint (Global):**
```
POST https://identitysso.betfair.com/api/login
```

**Regional Endpoints:**

| Jurisdiction | Endpoint |
|-------------|----------|
| Australia & NZ | `https://identitysso.betfair.com.au/api/login` |
| Italy | `https://identitysso.betfair.it/api/login` |
| Spain | `https://identitysso.betfair.es/api/login` |
| Romania | `https://identitysso.betfair.ro/api/login` |

**Required Headers:**
```
Accept: application/json
X-Application: <YOUR_APP_KEY>
Content-Type: application/x-www-form-urlencoded
```

**POST Body:**
```
username=<username>&password=<password>
```

**Curl Example:**
```bash
curl -k -i \
  -H "Accept: application/json" \
  -H "X-Application: <AppKey>" \
  -X POST \
  -d 'username=<username>&password=<password>' \
  https://identitysso.betfair.com/api/login
```

**Success Response:**
```json
{
  "token": "SESSION_TOKEN",
  "product": "APP_KEY",
  "status": "SUCCESS",
  "error": ""
}
```

**Status Values:** `SUCCESS` | `LIMITED_ACCESS` | `LOGIN_RESTRICTED` | `FAIL`

**Common Error Codes:**

| Error | Description |
|-------|-------------|
| `INVALID_USERNAME_OR_PASSWORD` | Wrong credentials |
| `ACCOUNT_NOW_LOCKED` | Account just locked |
| `SUSPENDED` | Account suspended |
| `CLOSED` | Account closed |
| `KYC_SUSPEND` | KYC suspended |
| `TEMPORARY_BAN_TOO_MANY_REQUESTS` | Login rate limit exceeded (20-min ban) |
| `CHANGE_PASSWORD_REQUIRED` | Must change password |
| `SECURITY_RESTRICTED_LOCATION` | Location restricted |

---

### 2b. Non-Interactive (Bot) Login

**Docs:** https://betfair-developer-docs.atlassian.net/wiki/spaces/1smk3cen4v3lu3yomq5qye0ni/pages/2687915/Non-Interactive+bot+login

**Recommended for:** Automated bots and scheduled tasks. Uses SSL client certificates instead of interactive login.

**Endpoint (Global):**
```
POST https://identitysso-cert.betfair.com/api/certlogin
```

**Regional Endpoints:**

| Jurisdiction | Endpoint |
|-------------|----------|
| Australia & NZ | `https://identitysso-cert.betfair.com.au/api/certlogin` |
| Italy | `https://identitysso-cert.betfair.it/api/certlogin` |
| Spain | `https://identitysso-cert.betfair.es/api/certlogin` |
| Romania | `https://identitysso-cert.betfair.ro/api/certlogin` |

**Note:** Danish residents CANNOT use non-interactive login (NEMID requirement).

#### Step 1 — Generate SSL Certificate (2048-bit RSA)

```bash
# Generate private key
openssl genrsa -out client-2048.key 2048

# Create certificate signing request
openssl req -new -config openssl.cnf -key client-2048.key -out client-2048.csr

# Self-sign the certificate
openssl x509 -req -days 365 -in client-2048.csr -signkey client-2048.key \
  -out client-2048.crt -extfile openssl.cnf -extensions ssl_client

# Create PEM (Linux)
cat client-2048.crt client-2048.key > client-2048.pem

# Create PKCS#12 (needed for .NET)
openssl pkcs12 -export -in client-2048.crt -inkey client-2048.key -out client-2048.p12
```

**openssl.cnf additions:**
```ini
[ ssl_client ]
basicConstraints = CA:FALSE
nsCertType = client
keyUsage = digitalSignature, keyEncipherment
extendedKeyUsage = clientAuth
```

#### Step 2 — Link Certificate to Betfair Account

1. Navigate to: https://myaccount.betfair.com/accountdetails/mysecurity?showAPI=1
2. Scroll to **"Automated Betting Program Access"**
3. Upload `client-2048.crt`

#### Step 3 — Make Login Request

```bash
curl -v -q -k \
  --cert client-2048.crt \
  --key client-2048.key \
  'https://identitysso-cert.betfair.com/api/certlogin' \
  -H 'X-Application: <AppKey>' \
  --data-urlencode 'username=<username>' \
  --data-urlencode 'password=<password>'
```

**Success Response:**
```json
{"sessionToken": "Zx8i4oigut5nc+l4L8qFb0DSxG+mwLn2t0AMGFxjrMJI=", "loginStatus": "SUCCESS"}
```

**Python Sample:**
```python
import requests

payload = 'username=myusername&password=mypassword'
headers = {
    'X-Application': 'SomeKey',
    'Content-Type': 'application/x-www-form-urlencoded'
}

resp = requests.post(
    'https://identitysso-cert.betfair.com/api/certlogin',
    data=payload,
    cert=('client-2048.crt', 'client-2048.key'),
    headers=headers
)

if resp.status_code == 200:
    data = resp.json()
    print(data['loginStatus'])
    print(data['sessionToken'])
```

**Key Error Codes:**

| Error | Description |
|-------|-------------|
| `CERT_AUTH_REQUIRED` | Certificate missing or auth failed |
| `INVALID_USERNAME_OR_PASSWORD` | Wrong credentials (ensure URL-encoding) |
| `ACCOUNT_NOW_LOCKED` | Account locked |
| `TEMPORARY_BAN_TOO_MANY_REQUESTS` | Rate limit exceeded |

---

### 2c. Keep Alive & Logout

#### Keep Alive

**Session timeouts:**
- International (.com): **12 hours** (non-UK/Ireland), **24 hours** (UK/Ireland)
- Italian & Spanish Exchange: **20 minutes**

**Endpoint:**
```
GET https://identitysso.betfair.com/api/keepAlive
```

**Headers:**
```
Accept: application/json
X-Authentication: <SESSION_TOKEN>
X-Application: <APP_KEY>   (optional)
```

**Curl Example:**
```bash
curl -k -i \
  -H "Accept: application/json" \
  -H "X-Application: AppKey" \
  -H "X-Authentication: <token>" \
  https://identitysso.betfair.com/api/keepAlive
```

**Response:**
```json
{
  "token": "<session_token>",
  "product": "<app_key>",
  "status": "SUCCESS",
  "error": ""
}
```

#### Logout

**Endpoint:**
```
GET https://identitysso.betfair.com/api/logout
```
Same headers as Keep Alive. Returns same response structure.

**Best Practice:** A single session can and should be used across multiple API calls/threads. Do NOT create a new login per API call.

---

## 3. Exchange Stream API (Real-Time)

**Docs:** https://betfair-developer-docs.atlassian.net/wiki/spaces/1smk3cen4v3lu3yomq5qye0ni/pages/2687396/Exchange+Stream+API

**GitHub Sample Code:** https://github.com/betfair/stream-api-sample-code  
**Swagger Schema:** https://github.com/betfair/stream-api-sample-code/blob/master/ESASwaggerSchema.json

### Overview

The Exchange Stream API provides **low-latency real-time** access to market, price, and order data via persistent SSL socket connections. Protocol: SSL socket + CRLF-delimited JSON messages.

### Connection

**Production Endpoint:**
```
stream-api.betfair.com:443  (SSL)
```

**Integration/Testing Endpoint:**
```
stream-api-integration.betfair.com
```

**Important:** Send a message within **15 seconds** of connecting or receive a `TIMEOUT` error.

### Message Protocol

Every message is JSON terminated with CRLF (`\r\n`). Two base classes:
- **RequestMessage** — sent from client (`op` field identifies type)
- **ResponseMessage** — received from server

**Request op types:**
| op | Description |
|----|-------------|
| `authentication` | Authenticate the connection |
| `marketSubscription` | Subscribe to market price changes |
| `orderSubscription` | Subscribe to order changes |
| `heartbeat` | Keep firewall open / test connectivity |

**Response op types:**
| op | Description |
|----|-------------|
| `connection` | Sent on successful connection (contains `connectionId`) |
| `status` | Response to every request (success/failure) |
| `mcm` | MarketChangeMessage — market/price updates |
| `ocm` | OrderChangeMessage — order updates |

### Authentication Message

First message after connecting:
```json
{
  "op": "authentication",
  "id": 1,
  "appKey": "YOUR_APP_KEY",
  "session": "YOUR_SESSION_TOKEN"
}
```

**Common auth errors (all close connection):**
- `NO_APP_KEY` / `INVALID_APP_KEY`
- `NO_SESSION` / `INVALID_SESSION_INFORMATION`
- `NOT_AUTHORIZED`
- `MAX_CONNECTION_LIMIT_EXCEEDED`
- `TOO_MANY_REQUESTS`

### Market Subscription

```json
{
  "op": "marketSubscription",
  "id": 2,
  "marketFilter": {
    "marketIds": ["1.120684740"],
    "eventTypeIds": ["1"],
    "marketTypes": ["MATCH_ODDS"],
    "countryCodes": ["GB"],
    "turnInPlayEnabled": true,
    "bspMarket": false
  },
  "marketDataFilter": {
    "fields": [
      "EX_BEST_OFFERS",
      "EX_BEST_OFFERS_DISP",
      "EX_ALL_OFFERS",
      "EX_TRADED",
      "EX_TRADED_VOL",
      "EX_LTP",
      "EX_MARKET_DEF",
      "SP_TRADED",
      "SP_PROJECTED"
    ],
    "ladderLevels": 3
  },
  "segmentationEnabled": true,
  "heartbeatMs": 5000
}
```

### Market Data Filter Fields

| Filter | Fields Returned | Description |
|--------|----------------|-------------|
| `EX_BEST_OFFERS_DISP` | `bdatb`, `bdatl` | Best prices including Virtual Bets |
| `EX_BEST_OFFERS` | `batb`, `batl` | Best prices (non-virtual), depth by ladderLevels |
| `EX_ALL_OFFERS` | `atb`, `atl` | Full available back/lay ladder |
| `EX_TRADED` | `trd` | Full traded ladder |
| `EX_TRADED_VOL` | `tv` | Total traded volume (market & runner) |
| `EX_LTP` | `ltp` | Last Price Matched |
| `EX_MARKET_DEF` | `marketDefinition` | Full market definition |
| `SP_TRADED` | `spb`, `spl` | Starting price ladder |
| `SP_PROJECTED` | `spn`, `spf` | Betfair SP Near/Far projection |

### Market Filters

| Filter | Type | Description |
|--------|------|-------------|
| `marketIds` | Set\<String\> | Specific market IDs (wildcard if omitted) |
| `eventTypeIds` | Set\<String\> | e.g., "1"=Football, "7"=Horse Racing |
| `eventIds` | Set\<String\> | Specific event IDs |
| `marketTypes` | Set\<String\> | e.g., MATCH_ODDS, HALF_TIME_SCORE |
| `countryCodes` | Set\<String\> | ISO country codes |
| `bspMarket` | Boolean | BSP markets only |
| `turnInPlayEnabled` | Boolean | In-play markets only |
| `venues` | Set\<String\> | Horse racing venues only |
| `raceTypes` | Set\<String\> | Flat, Harness, Hurdle, Chase, Bumper, etc. |

### Order Subscription

```json
{
  "op": "orderSubscription",
  "id": 3,
  "orderFilter": {
    "includeOverallPosition": true,
    "customerStrategyRefs": ["strategy1"],
    "partitionMatchedByStrategyRef": false
  },
  "segmentationEnabled": true
}
```

### Key Streaming Concepts

**ChangeType (ct field):**
- `SUB_IMAGE` — Full initial snapshot (replace cache)
- `RESUB_DELTA` — Patch after reconnection
- `HEARTBEAT` — Empty message (connection health check)
- `null` — Delta update

**SegmentType:**
- `SEG_START` — Start of segmented message
- `SEG` — Middle segment
- `SEG_END` — End of segmented message
- `null` — Non-segmented

**conflateMs:** Set to 180000ms if using Delayed App Key or account delay.

### Error Codes

| Category | ErrorCode | Description |
|----------|-----------|-------------|
| Protocol | `INVALID_INPUT` | Cannot deserialize message |
| Protocol | `TIMEOUT` | Client too slow sending data |
| Auth | `NO_APP_KEY` | Missing app key |
| Auth | `INVALID_APP_KEY` | Invalid app key |
| Auth | `NO_SESSION` | Missing session token |
| Auth | `INVALID_SESSION_INFORMATION` | Invalid session |
| Auth | `NOT_AUTHORIZED` | Not authorized |
| Auth | `MAX_CONNECTION_LIMIT_EXCEEDED` | Too many connections |
| Subscription | `SUBSCRIPTION_LIMIT_EXCEEDED` | >200 markets subscribed (only error that does NOT close connection) |
| Subscription | `INVALID_CLOCK` | Invalid initialClk/clk on re-subscribe |
| General | `UNEXPECTED_ERROR` | Internal server error |
| General | `CONNECTION_FAILED` | Connection terminated |

### Re-connection Logic

Always implement reconnection logic. On reconnect:
1. Store `initialClk` and `clk` from every change message
2. Reconnect and authenticate
3. Re-subscribe with same criteria + stored `initialClk` and `clk`
4. Receive `ct=RESUB_DELTA` to patch your cache (instead of full image)

### Performance

- Use `segmentationEnabled: true` — reduces latency and time-to-first-byte
- Use `heartbeatMs` (500–5000ms) to detect dead connections
- Keep-alive connections to Stream API are strongly encouraged
- Prefer coarse-grain subscriptions (subscribe to super-sets) over fine-grain frequent re-subscriptions
- Stream API subscriptions: **200 markets max** (Delayed), unlimited (Live)

---

## 4. REST Betting API

**Reference Guide:** https://betfair-developer-docs.atlassian.net/wiki/spaces/1smk3cen4v3lu3yomq5qye0ni/pages/2687473/Reference+Guide

**Base API Endpoint:**
```
https://api.betfair.com/exchange/betting/rest/v1.0/
```

**Required Headers for every REST call:**
```
X-Application: <APP_KEY>
X-Authentication: <SESSION_TOKEN>
Content-Type: application/json
Accept: application/json
Accept-Encoding: gzip, deflate
Connection: keep-alive
```

### Core Operations

| Operation | Description |
|-----------|-------------|
| `listMarketCatalogue` | Get market metadata (name, event, runners) |
| `listMarketBook` | Get current prices for markets |
| `listRunnerBook` | Get prices for a specific runner |
| `placeOrders` | Place bets |
| `cancelOrders` | Cancel unmatched bets |
| `updateOrders` | Update persistence type |
| `replaceOrders` | Cancel + re-place in one atomic operation |
| `listCurrentOrders` | Get active/unmatched orders |
| `listClearedOrders` | Get settled orders |
| `listMarketProfitAndLoss` | Get P&L per market |
| `listEvents` | Get events |
| `listEventTypes` | Get event types (Football, Racing, etc.) |
| `listCompetitions` | Get competitions |
| `listCountries` | Get countries |
| `listVenues` | Get venues |

### Accounts API

**Endpoint:**
```
https://api.betfair.com/exchange/account/rest/v1.0/
```

| Operation | Description |
|-----------|-------------|
| `getAccountFunds` | Get account balance |
| `getAccountDetails` | Get account info |
| `createDeveloperAppKeys` | Create App Keys |
| `getDeveloperAppKeys` | Retrieve existing App Keys |

**Demo Tool:** https://apps.betfair.com/visualisers/api-ng-account-operations/

---

## 5. Market Data Request Limits

**Docs:** https://betfair-developer-docs.atlassian.net/wiki/spaces/1smk3cen4v3lu3yomq5qye0ni/pages/2687478/Market+Data+Request+Limits

Formula: `sum(Weight) * numberOfMarketIds <= 200 points per request`

Exceeding 200 points returns a `TOO_MUCH_DATA` error.

### listMarketCatalogue Weights

| MarketProjection | Weight |
|-----------------|--------|
| `MARKET_DESCRIPTION` | 1 |
| `RUNNER_DESCRIPTION` | 0 |
| `EVENT` | 0 |
| `EVENT_TYPE` | 0 |
| `COMPETITION` | 0 |
| `RUNNER_METADATA` | 1 |
| `MARKET_START_TIME` | 0 |

### listMarketBook / listRunnerBook Weights

| PriceProjection | Weight |
|----------------|--------|
| null (no projection) | 2 |
| `SP_AVAILABLE` | 3 |
| `SP_TRADED` | 7 |
| `EX_BEST_OFFERS` | 5 |
| `EX_ALL_OFFERS` | 17 |
| `EX_TRADED` | 17 |
| `EX_BEST_OFFERS + EX_TRADED` (combined) | 20 |
| `EX_ALL_OFFERS + EX_TRADED` (combined) | 32 |

**Note:** If `exBestOffersOverrides` is used: `weight * (requestedDepth / 3)`

### listMarketProfitAndLoss

| Projection | Weight |
|-----------|--------|
| Any | 4 |

---

## 6. Transaction Charges

**Docs:** https://www.betfair.com/aboutUs/Betfair.Charges/#TranCharges2

- **Free threshold:** 5,000 placed/failed transactions per hour
- Exceeding this threshold may incur additional transaction charges
- Applies to **both** Delayed and Live App Keys
- API bots may be **prone to exploitation** by other customers — monitor accordingly
- Always prefer leaving an order in place rather than cancel/re-place (stay at front of matching queue)

---

## 7. Historical Data

**Portal:** http://historicdata.betfair.com/#/home

Available for **testing and analysis purposes** only. Provides:
- Full tick-by-tick historical market data
- JSON stream format (same as Stream API)
- Useful for backtesting betting strategies

**Data Processor Tools:**

| Tool | URL | Language |
|------|-----|---------|
| Web App (CSV converter) | https://www.betfairhistoricdata.co.uk/ | Web |
| Parse/backtest | https://github.com/betcode-org/betfair | Python |
| Visualisations | https://github.com/mberk/betfairviz | Python |
| Excel workbook | https://github.com/betfair/historic-data-workbook | Excel/VBA |

**Competition & Event Mapping Data (2018–2023):**  
Available via Additional Information page in the docs.

---

## 8. Best Practices

**Docs:** https://betfair-developer-docs.atlassian.net/wiki/spaces/1smk3cen4v3lu3yomq5qye0ni/pages/2687730/Best+Practice

### Development & Testing
- Use **Delayed App Key** for all development and functional testing
- Use **Historical Data** for strategy modelling and backtesting
- Only apply for Live App Key when ready to transact on the Exchange

### Session Management
- One session per application — reuse across all API calls and threads
- Do NOT create a new login per request
- Use Keep Alive to extend sessions
- Handle `INVALID_SESSION_TOKEN` errors by creating a new session

### Performance
- **Use Stream API** instead of polling for real-time data (especially high-frequency apps)
- Send `Accept-Encoding: gzip, deflate` on all REST requests
- Set `Connection: keep-alive` on all requests (idle connections close after 3 minutes)
- Minimize transactions — stay at front of queue rather than cancel/re-place
- Observe [Market Data Limits](#5-market-data-request-limits)

### .NET Specific
Disable `Expect: 100-Continue` header to avoid 417 errors:
```csharp
System.Net.ServicePointManager.Expect100Continue = false;
```

### Logging
- Log as much as possible, especially the `connectionId` from the Stream API
- Always supply `connectionId` when contacting Developer Support

### API Status
Check before reporting issues: http://status.developer.betfair.com/

---

## 9. Sample Code & Client Libraries

**Docs:** https://betfair-developer-docs.atlassian.net/wiki/spaces/1smk3cen4v3lu3yomq5qye0ni/pages/2687537/Sample+Code

### Official Betfair Sample Code (API-NG)

https://github.com/betfair/API-NG-sample-code

| Language | GitHub |
|----------|--------|
| Java | https://github.com/betfair/API-NG-sample-code/tree/master/java |
| JavaScript (Node.js) | https://github.com/betfair/API-NG-sample-code/tree/master/javascript |
| Python | https://github.com/betfair/API-NG-sample-code/tree/master/python |
| PHP | https://github.com/betfair/API-NG-sample-code/tree/master/php |
| C# | https://github.com/betfair/API-NG-sample-code/tree/master/cSharp |
| Excel/VBA | https://github.com/betfair/API-NG-sample-code/tree/master/vba |
| Curl | https://github.com/betfair/API-NG-sample-code/tree/master/curl |
| Perl | https://github.com/betfair/API-NG-sample-code/tree/master/perl |

### Stream API Sample Code

https://github.com/betfair/stream-api-sample-code

| Language | GitHub |
|----------|--------|
| C# | https://github.com/betfair/stream-api-sample-code/tree/master/csharp |
| Java | https://github.com/betfair/stream-api-sample-code/tree/master/java |
| Node.js | https://github.com/betfair/stream-api-sample-code/tree/master/node.js |

### Community Client Libraries

| Language | Library | Description |
|----------|---------|-------------|
| Python | https://github.com/betcode-org/betfair | Lightweight Python wrapper (with streaming) |
| Python | https://github.com/betcode-org/flumine | Betting Trading Framework |
| JavaScript | https://github.com/AlgoTrader/betfair | Node.js API-NG client |
| C# | https://github.com/joelpob/betfairng | API-NG C# client library |
| Java | https://github.com/joelpob/jbetfairng | Java client library |
| Ruby | https://github.com/mikecmpbll/betfair | Ruby API-NG wrapper |
| R | https://github.com/phillc73/abettor | R sample code |
| Rust | https://docs.rs/botfair/0.3.0/botfair/ | Rust bindings |
| C++ | https://github.com/captain-igloo/greentop | C++ Betfair API client |
| Perl | https://github.com/MyrddinWyllt/WWW-BetfairNG | Perl API-NG library |

### Tutorials

| Language | Tutorial | Source |
|----------|---------|--------|
| Python | API Python Tutorial | https://betfair-datascientists.github.io/tutorials/apiPythontutorial/ |
| Python | How to Automate I (Flumine) | https://betfair-datascientists.github.io/tutorials/How_to_Automate_1/ |
| Python | How to Automate II (Lay/Back favourite) | https://betfair-datascientists.github.io/tutorials/How_to_Automate_2/ |
| Python | Backtesting with JSON stream data | https://betfair-datascientists.github.io/historicData/backtestingRatingsTutorial/ |
| Python | Historical JSON to CSV | https://betfair-datascientists.github.io/tutorials/jsonToCsvRevisited/ |
| R | API R Tutorial | https://betfair-datascientists.github.io/tutorials/apiRtutorial/ |

---

## 10. API Status & Monitoring

**API Status Page:** http://status.developer.betfair.com/

- Measures response latency and error rate every second
- Automatically toggles status if thresholds are breached
- Check this before contacting Developer Support

---

## 11. Developer Support & Notifications

### Support
- **FAQ / Help Center:** https://support.developer.betfair.com/
- **Developer Forum:** https://forum.developer.betfair.com/

### API Release Notifications
- **Announcements:** https://forum.developer.betfair.com/forum/developer-program/announcements
- **Subscribe to notifications:** https://forum.developer.betfair.com/help?q=subscribe&btnSearch=&titleandtext=1&match=any#content_overview/content_subscriptions
- **Email notification settings:** https://forum.developer.betfair.com/settings/notifications

> You must be logged into the Developer Forum to manage notification settings.

### Contact
**From:** Betfair Developer Program  
**Organization:** Paddy Power Betfair plc  
**Address:** Winslow Road, Hammersmith Embankment, London, W6 9HP  
**Registered:** Ireland — Company No. 16956

---

## 12. All Endpoints Quick Reference

### Identity / SSO Endpoints

| Action | Endpoint |
|--------|----------|
| Interactive Login (Global) | `POST https://identitysso.betfair.com/api/login` |
| Interactive Login (AUS) | `POST https://identitysso.betfair.com.au/api/login` |
| Bot/Cert Login (Global) | `POST https://identitysso-cert.betfair.com/api/certlogin` |
| Bot/Cert Login (AUS) | `POST https://identitysso-cert.betfair.com.au/api/certlogin` |
| Keep Alive (Global) | `GET https://identitysso.betfair.com/api/keepAlive` |
| Keep Alive (AUS) | `GET https://identitysso.betfair.au/api/keepAlive` |
| Keep Alive (Italy) | `GET https://identitysso.betfair.it/api/keepAlive` |
| Keep Alive (Spain) | `GET https://identitysso.betfair.es/api/keepAlive` |
| Logout (Global) | `GET https://identitysso.betfair.com/api/logout` |

### Exchange / Betting API

| API | Base URL |
|-----|---------|
| Betting API (REST) | `https://api.betfair.com/exchange/betting/rest/v1.0/` |
| Accounts API (REST) | `https://api.betfair.com/exchange/account/rest/v1.0/` |
| Stream API (SSL Socket) | `stream-api.betfair.com:443` |
| Stream API Integration | `stream-api-integration.betfair.com` |

### Tools

| Tool | URL |
|------|-----|
| Accounts API Demo Tool | https://apps.betfair.com/visualisers/api-ng-account-operations/ |
| API Status Monitor | http://status.developer.betfair.com/ |
| Cert Upload | https://myaccount.betfair.com/accountdetails/mysecurity?showAPI=1 |
| Live Key Application | https://developer.betfair.com/get-started/ |

---

## 13. All Documentation Links

| Section | URL |
|---------|-----|
| Docs Root / Overview | https://betfair-developer-docs.atlassian.net/wiki/spaces/1smk3cen4v3lu3yomq5qye0ni/overview |
| Getting Started | https://betfair-developer-docs.atlassian.net/wiki/spaces/1smk3cen4v3lu3yomq5qye0ni/pages/2687786/Getting+Started |
| Application Keys | https://betfair-developer-docs.atlassian.net/wiki/spaces/1smk3cen4v3lu3yomq5qye0ni/pages/2687105/Application+Keys |
| API Demo Tools | https://betfair-developer-docs.atlassian.net/wiki/spaces/1smk3cen4v3lu3yomq5qye0ni/pages/2687096/API+Demo+Tools |
| Best Practice | https://betfair-developer-docs.atlassian.net/wiki/spaces/1smk3cen4v3lu3yomq5qye0ni/pages/2687730/Best+Practice |
| Market Data Request Limits | https://betfair-developer-docs.atlassian.net/wiki/spaces/1smk3cen4v3lu3yomq5qye0ni/pages/2687478/Market+Data+Request+Limits |
| Login & Session Management | https://betfair-developer-docs.atlassian.net/wiki/spaces/1smk3cen4v3lu3yomq5qye0ni/pages/2687869/Login+Session+Management |
| Non-Interactive (Bot) Login | https://betfair-developer-docs.atlassian.net/wiki/spaces/1smk3cen4v3lu3yomq5qye0ni/pages/2687915/Non-Interactive+bot+login |
| Interactive Login — API Endpoint | https://betfair-developer-docs.atlassian.net/wiki/spaces/1smk3cen4v3lu3yomq5qye0ni/pages/2687772/Interactive+Login+-+API+Endpoint |
| Interactive Login — Desktop App | https://betfair-developer-docs.atlassian.net/wiki/spaces/1smk3cen4v3lu3yomq5qye0ni/pages/2687926/Interactive+Login+-+Desktop+Application |
| Certificate Generation With XCA | https://betfair-developer-docs.atlassian.net/wiki/spaces/1smk3cen4v3lu3yomq5qye0ni/pages/2687673/Certificate+Generation+With+XCA |
| Reference Guide | https://betfair-developer-docs.atlassian.net/wiki/spaces/1smk3cen4v3lu3yomq5qye0ni/pages/2687473/Reference+Guide |
| Exchange Stream API | https://betfair-developer-docs.atlassian.net/wiki/spaces/1smk3cen4v3lu3yomq5qye0ni/pages/2687396/Exchange+Stream+API |
| Sample Code | https://betfair-developer-docs.atlassian.net/wiki/spaces/1smk3cen4v3lu3yomq5qye0ni/pages/2687537/Sample+Code |
| Optimizing API Performance | https://betfair-developer-docs.atlassian.net/wiki/spaces/1smk3cen4v3lu3yomq5qye0ni/pages/2699882/Optimizing+API+Application+Performance |
| Developer Support | https://betfair-developer-docs.atlassian.net/wiki/spaces/1smk3cen4v3lu3yomq5qye0ni/pages/2687682/Developer+Support |
| API Release Notifications | https://betfair-developer-docs.atlassian.net/wiki/spaces/1smk3cen4v3lu3yomq5qye0ni/pages/2687645/New+API+Release+Notifications |
| Interface Definition Documents | https://betfair-developer-docs.atlassian.net/wiki/spaces/1smk3cen4v3lu3yomq5qye0ni/pages/2687841/Interface+Definition+Documents |
| Release Notes | https://betfair-developer-docs.atlassian.net/wiki/spaces/1smk3cen4v3lu3yomq5qye0ni/pages/2687366/Release+Notes |
| Transaction Charges | https://www.betfair.com/aboutUs/Betfair.Charges/#TranCharges2 |
| Historical Data Portal | http://historicdata.betfair.com/#/home |
| Developer Forum Announcements | https://forum.developer.betfair.com/forum/developer-program/announcements |
| Forum Subscribe | https://forum.developer.betfair.com/help?q=subscribe |
| Forum Email Notifications | https://forum.developer.betfair.com/settings/notifications |
| Developer FAQ / Support | https://support.developer.betfair.com/ |
| Developer Forum | https://forum.developer.betfair.com/ |
| API Status Page | http://status.developer.betfair.com/ |
| API-NG Sample Code (GitHub) | https://github.com/betfair/API-NG-sample-code |
| Stream API Sample Code (GitHub) | https://github.com/betfair/stream-api-sample-code |
| Stream API Swagger Schema | https://github.com/betfair/stream-api-sample-code/blob/master/ESASwaggerSchema.json |
