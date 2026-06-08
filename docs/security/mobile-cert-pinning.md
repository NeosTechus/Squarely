# Mobile certificate pinning

Operator runbook for the TLS certificate pinning shipped with Squarely's
production Android builds.

## Why we pin

Cashiers run Squarely on tablets and phones over whatever Wi-Fi the venue
gives them — coffee-shop hotspots, conference networks, mall infrastructure.
A bad actor on the same network with a forged certificate (e.g. via a
malicious captive portal, a rogue CA installed on the device, or a corporate
TLS-inspecting middlebox) can otherwise transparently MITM the app's traffic
to Supabase and the admin host, reading auth tokens and inventory data.

Pinning the server's SPKI (Subject Public Key Info) SHA-256 hash means the
app only trusts a cert chain whose key matches a known-good fingerprint
baked into the binary — even if the device trusts an attacker's CA, the
TLS handshake to Supabase will fail.

## Scope

| Platform | Pinned? | Mechanism                                                                                                  |
|----------|---------|------------------------------------------------------------------------------------------------------------|
| Android  | Yes     | Custom Expo config plugin (`apps/mobile/plugins/with-network-security-config.js`) — copies the XML into `android/app/src/main/res/xml/` and patches the `<application>` tag in `AndroidManifest.xml` with `android:networkSecurityConfig=@xml/network_security_config`. |
| iOS      | **No**  | Gap — ATS does not support SPKI pinning. TrustKit follow-up below.                                         |

Preview channel iOS does not pin. Production iOS does not pin yet.

### How the plugin works

The plugin runs two Expo config mods at prebuild time:

1. **`withDangerousMod` (android)** — copies
   `apps/mobile/cert-pinning/network_security_config.xml` into
   `android/app/src/main/res/xml/network_security_config.xml`. This overwrites
   any local edits on each `expo prebuild` — the canonical source of truth is
   the file under `apps/mobile/cert-pinning/`. Before copying, the plugin
   scans the XML for `REPLACE_WITH_LIVE_HASH` placeholder tokens and emits a
   loud `console.warn` if any are still present (see "Placeholder guard"
   below).
2. **`withAndroidManifest` (android)** — sets
   `android:networkSecurityConfig=@xml/network_security_config` on the
   `<application>` element. If another plugin has already written a different
   value to that attribute, the plugin throws rather than silently clobbering
   it.

Both mods are android-scoped by Expo's design (`withAndroidManifest`
registers under `config.mods.android.manifest`, `withDangerousMod` takes an
explicit `['android', action]` tuple), so the plugin is a clean no-op on iOS
prebuilds — no platform guard is needed in our code.

### Placeholder guard

The plugin **does not throw** on placeholder pins; it emits a warning
(prefixed `[with-network-security-config] WARNING:`) so dev builds, CI smoke
tests, and contributors without access to extract live pins can still run
`expo prebuild`. Production operators are expected to extract live hashes
before shipping (see "Rotation procedure" below), at which point the warning
goes away naturally. If a production build deliberately needs to ship with
placeholders (uncommon — usually only for staging a kill-switch build), set
`EXPO_BUILD_ALLOW_PLACEHOLDER_PINS=1` in the EAS build env to acknowledge
the warning. The warning still fires; the env var only documents intent in
the build log.

### Dev/Metro and LAN-printer cleartext

`<base-config cleartextTrafficPermitted="false">` blocks plain HTTP from the
app entirely, with two exceptions encoded in the XML:

- **RFC1918 private IPv4 ranges** — `10.0.0.0/8`, `172.16.0.0/12`, and
  `192.168.0.0/16` are allowed to use cleartext via dedicated
  `<domain-config cleartextTrafficPermitted="true">` blocks. This is required
  because the LAN-printing feature reaches receipt printers at IP literals on
  the venue's local Wi-Fi over plain HTTP. The mobile app does not directly
  connect to printer IPs in the standard receipt flow (`sendReceiptPrint.ts`
  POSTs to the admin host over HTTPS, and `@squarely/lan-printer-agent` does
  the cleartext printer hop from a separate Node process), but the exception
  is documented in the NSC so any future direct-print path on Android works
  without re-opening this audit. The MITM threat that motivates global
  cleartext blocking does not apply to non-routable LAN ranges.
- **Metro dev-client connection** — the NSC is applied to **all** Android
  build variants (debug, dev-client, preview, production) because Expo
  config plugins do not natively branch on `EAS_BUILD_PROFILE` at mod time
  without dangerous-mod gymnastics. In practice this is OK because Metro
  servers run on developers' machines, which sit inside the RFC1918 ranges
  carved out above — `expo start --tunnel` and direct LAN connections to
  `http://192.168.x.y:8081` both succeed under this NSC. If a developer runs
  Metro on a public-IP host (rare), they need to temporarily remove the
  `android:networkSecurityConfig` attribute from the merged manifest.

## Extracting the live SPKI SHA-256 hash

Run this one-liner per pinned domain. The base64 output is what goes inside
the `<pin digest="SHA-256">...</pin>` element.

```bash
# Repeat for each: squarely-admin.vercel.app, sdrvbavgematnhzsvhjd.supabase.co
HOST=squarely-admin.vercel.app
openssl s_client -servername "$HOST" -connect "$HOST:443" </dev/null 2>/dev/null \
  | openssl x509 -pubkey -noout \
  | openssl pkey -pubin -outform der \
  | openssl dgst -sha256 -binary \
  | openssl enc -base64
```

Drop each value into one of the `REPLACE_WITH_LIVE_HASH` placeholders in
`apps/mobile/cert-pinning/network_security_config.xml`. Each `<pin-set>`
needs TWO pins — Android refuses to enforce a single-pin set.

## Generating the backup pin (REQUIRED)

If we only pin the current leaf key and that key is ever lost, compromised,
or rotated unexpectedly by Vercel/Supabase, every installed app stops
working with no path to recover. The backup pin prevents that.

Two ways to produce one:

1. **Intermediate CA pin** — re-run the openssl pipeline above against the
   second cert in the chain (the intermediate). Most practical option for
   third-party-hosted services because we don't control their key rotation
   schedule. Slight trust expansion: anyone the intermediate signs is
   trusted, not just our exact leaf key.
2. **Staged next-key pin** — only viable if we control the key. Not
   applicable to Vercel or Supabase.

Use option 1 for both pinned hosts.

## Rotation procedure

`network_security_config.xml` is baked into the APK, so rotation requires a
native build (`eas build`), not an OTA. The flow is staged to avoid
bricking the installed base:

1. **N-7 days before old pin retires.** Extract the *new* SPKI hash and add
   it as an additional `<pin>` in the relevant `<pin-set>`. Leave the old
   pin in place. The set now contains old + new + backup (yes, 3 pins; the
   parser is fine with that).
2. **Ship a production build via `eas build`.** Distribute through Play
   Store. Wait until adoption of the new build is >=95% (Play Console
   release dashboard).
3. **Remove the old pin.** Ship another production build.
4. **Update `expiration`** on the `<pin-set>` to push the safety net out
   another ~12 months.

Note: subsequent JS-only fixes in between can still ride OTA — the pin
config only ships in native builds, JS bundles never break it.

## iOS gap (follow-up)

ATS in `Info.plist` controls TLS minimums (version, cipher suites) but does
not expose SPKI pinning. Closing the gap requires a native library; the
recommended path is:

1. Add `react-native-trustkit` (or wrap TrustKit directly via a small
   custom Expo config plugin under `apps/mobile/plugins/`).
2. Configure the same two hosts and the same SPKI hashes from the XML in
   TrustKit's plist block.
3. Update the scope table in this doc to flip iOS to "Yes".

Until then, iOS production traffic is protected only by standard CA trust
and ATS minimums.

## Files

- `apps/mobile/cert-pinning/network_security_config.xml` — the pin set
  (canonical source of truth; copied into `android/app/src/main/res/xml/`
  on each prebuild).
- `apps/mobile/plugins/with-network-security-config.js` — the custom Expo
  config plugin (`withDangerousMod` copy + `withAndroidManifest` patch) that
  installs the XML and wires the `<application>` attribute. Also contains
  the placeholder-pin warning and the
  `android:networkSecurityConfig`-overwrite guard described above.
- `apps/mobile/app.config.ts` — registers
  `./plugins/with-network-security-config` in the `plugins` array so the
  mods run during prebuild.
- `docs/security/mobile-cert-pinning.md` — this runbook.
