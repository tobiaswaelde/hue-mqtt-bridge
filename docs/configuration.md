# Configuration

All bridges use the same top-level shape:

```yaml
mqtt:
  host: mqtt.example.net
  clientId: hue-mqtt-bridge
http:
  host: 0.0.0.0
  port: 3000
logging:
  level: log
instances:
  - id: unique-instance-name
    enabled: true
    topic: home/example
    # device-specific fields
```

- `mqtt` configures the single shared broker connection.
- `mqtt.clientId` may be empty; the bridge generates a UUID for the running process.
- `http` controls the health endpoint and, where required, browser OAuth callbacks.
- `logging.level` accepts `error`, `warn`, `log`, `debug`, or `verbose`.
- Every `instances[].id` and `instances[].topic` must be unique.

## Hue MQTT Bridge example

```yaml
mqtt:
  host: mqtt.example.net
  clientId: hue-mqtt-bridge
  username: mqtt-user
  password: change-me
http:
  port: 3000
logging:
  level: log
instances:
  - id: living-room
    topic: home/hue/living-room
    host: 192.168.1.10
    username: hue-api-username
    interval: 10000
    lights:
      - id: '1'
      - id: '2'
```

Do not commit passwords, API usernames, or generated `*.auth.json` files.
