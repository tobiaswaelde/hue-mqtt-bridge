---
layout: home

hero:
  name: Hue MQTT Bridge
  text: Bring Philips Hue lights to MQTT
  tagline: Control selected lights on a local Hue Bridge with clear topics, periodic state updates, and Docker deployment.
  image:
    src: /logo.svg
    alt: Hue MQTT Bridge logo
  actions:
    - theme: brand
      text: Get started
      link: /getting-started
    - theme: alt
      text: MQTT contract
      link: /mqtt

features:
  - title: Explicit light selection
    details: Configure only the Hue light IDs that this bridge should publish and control.
  - title: Local control
    details: Connect directly to your Hue Bridge with the application username created during setup.
  - title: Clear MQTT contract
    details: Use one documented command topic and discover published light state beneath each instance topic.
---

Every installation is defined in `config/config.yml`. Continue with [configuration](/configuration), [authentication](/authentication), or the [MQTT contract](/mqtt).

For WLED controllers alongside Hue lights, use the companion [WLED MQTT Bridge documentation](https://tobiaswaelde.github.io/wled-mqtt-bridge/).
