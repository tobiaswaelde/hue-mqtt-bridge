# MQTT contract

The bridge discovers every lamp visible to its Hue API user and publishes it below the configured instance topic. It does not publish the raw Hue Bridge response at the topic root.

## Availability

`<topic>/bridge/connected` is `true` after a successful light discovery and `false` while the Hue Bridge is unreachable or during shutdown.

## Light state

For each discovered lamp ID, the bridge publishes this structure:

```text
<topic>/lights/<id>/info/json
<topic>/lights/<id>/info/<scalar-field>
<topic>/lights/<id>/state/json
<topic>/lights/<id>/state/<scalar-field>
```

`info/json` contains the complete Hue light object without `state`; `state/json` contains the complete Hue state object. Direct subtopics are published only for top-level scalar fields such as `name`, `on`, `bri`, and `colormode`. Nested values remain in the respective JSON topic, so topic names never contain array indexes or recursively flattened API paths.

## Commands

Send a non-retained JSON payload to a discovered lamp's command topic:

```text
<topic>/lights/<id>/command/json
```

```json
{ "state": { "on": true, "bri": 180 } }
```

The bridge accepts commands only for lamp IDs discovered during the last successful refresh. It validates the payload, clears an accepted command with an empty payload, sends the requested Hue state update, and then refreshes the lamps.

Publish any non-empty payload to `<topic>/bridge/command/refresh` to request an immediate rediscovery. The bridge clears that command topic after accepting it.
