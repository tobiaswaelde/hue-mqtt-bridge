# Configuration

All bridges use the same top-level shape:

```yaml
mqtt:
  host: mqtt.example.net
  clientId: hue-mqtt-bridge
instances:
  - id: unique-instance-name
    enabled: true
    topic: home/example
    # device-specific fields
```

- `mqtt` configures the single shared broker connection.
- `mqtt.clientId` may be empty; the bridge generates a UUID for the running process.
- HTTP settings are environment variables: `HOST` defaults to `0.0.0.0`, `PORT` defaults to `3000`, and `CORS_ORIGIN` defaults to `*`. Dotenv loads `.env` from the working directory; Docker Compose environment values take precedence.
- Every `instances[].id` and `instances[].topic` must be unique.

## Hue MQTT Bridge example

```yaml
mqtt:
  host: mqtt.example.net
  clientId: hue-mqtt-bridge
  username: mqtt-user
  password: change-me
instances:
  - id: living-room
    topic: home/hue/living-room
    host: 192.168.1.10
    username: hue-api-username
    interval: 10000
```

The bridge discovers every lamp available to the Hue API user automatically. `lights` must not be configured.

Do not commit passwords, API usernames, or generated `*.auth.json` files.
