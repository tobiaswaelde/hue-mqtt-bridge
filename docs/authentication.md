# Authentication

Hue local API access requires physical confirmation:

1. Open `https://<bridge-ip>/debug/clip.html` (accept the local certificate warning if necessary).
2. POST `{"devicetype":"hue-mqtt-bridge#home"}` to `/api`.
3. Press the bridge link button, then repeat the POST within 30 seconds.
4. Copy the returned username to `instances[].username`.

The username is a secret and must not be committed. See the [official Hue local API setup](https://developers.meethue.com/develop/get-started-2/).
