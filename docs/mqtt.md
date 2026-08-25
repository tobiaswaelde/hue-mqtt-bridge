# MQTT contract

Availability is published at `<topic>/connected`. The full bridge response and selected lights are flattened below `<topic>/...` and `<topic>/lights/<id>/...`.

Publish JSON to `<topic>/cmd`:

```json
{ "cmd": "set-light-state", "light": "1", "state": { "on": true, "bri": 180 } }
```

Use `{ "cmd": "get-instance" }` to refresh bridge metadata.

All command publications must be non-retained. The bridge clears a successfully received command topic with an empty payload.
