import { HttpMqttBridge } from '~/lib/http-mqtt-bridge';
import { hueLightCommandSchema, type HueLight } from '~/lib/hue/types';
import type { MqttBridgeClient } from '~/modules/mqtt/mqtt.service';
import type { HueConfig } from '~/types/config/hue';

/** Synchronizes every light exposed by one Philips Hue Bridge with MQTT. */
export class Hue extends HttpMqttBridge<HueConfig> {
  private readonly discoveredLightIds = new Set<string>();

  private commandsSubscribed = false;

  constructor(cfg: HueConfig, mqtt: MqttBridgeClient) {
    super(cfg, mqtt, `HUE@${cfg.host}`, `http://${cfg.host}/api/${cfg.username}`);
  }

  public setup() {
    this.logger.debug(`Setting up Hue instance for host: ${this.cfg.host}`);
    this.mqtt.publish(this.bridgeTopic('connected'), false);
    this.subscribeCommands();

    void this.refreshLights();
    this.poll('lights', this.cfg.interval, () => this.refreshLights());
  }

  public override destroy() {
    this.mqtt.publish(this.bridgeTopic('connected'), false);
    super.destroy();
  }

  private bridgeTopic(name: string) {
    return `${this.cfg.topic}/bridge/${name}`;
  }

  private lightTopic(id: string, section: 'info' | 'state', name?: string) {
    const topic = `${this.cfg.topic}/lights/${id}/${section}`;
    return name ? `${topic}/${name}` : topic;
  }

  private subscribeCommands() {
    if (this.commandsSubscribed) return;

    const refreshTopic = this.bridgeTopic('command/refresh');
    const lightCommandTopic = `${this.cfg.topic}/lights/+/command/json`;
    this.logger.debug(`Subscribing to command topics: ${refreshTopic}, ${lightCommandTopic}`);

    this.subscribe(refreshTopic, (topic, payload) => {
      if (payload === '') return;

      this.mqtt.publish(topic, null);
      void this.refreshLights();
    });

    this.subscribe(lightCommandTopic, (topic, payload) => this.handleLightCommand(topic, payload));
    this.commandsSubscribed = true;
  }

  private handleLightCommand(topic: string, payload: string) {
    if (payload === '') return;

    const lightId = this.lightIdFromCommandTopic(topic);
    if (!lightId || !this.discoveredLightIds.has(lightId)) {
      this.logger.warn(`Ignoring command for unknown light topic: ${topic}`);
      return;
    }

    try {
      const command = hueLightCommandSchema.safeParse(JSON.parse(payload));
      if (!command.success) {
        this.logger.warn(`Ignoring invalid command for light ${lightId}: ${command.error.message}`);
        return;
      }

      this.mqtt.publish(topic, null);
      void this.setLightState(lightId, command.data.state);
    } catch {
      this.logger.warn(`Ignoring invalid JSON command for light ${lightId}`);
    }
  }

  private lightIdFromCommandTopic(topic: string) {
    const prefix = `${this.cfg.topic}/lights/`;
    const suffix = '/command/json';
    if (!topic.startsWith(prefix) || !topic.endsWith(suffix)) return undefined;

    const id = topic.slice(prefix.length, -suffix.length);
    return id && !id.includes('/') ? id : undefined;
  }

  private async refreshLights() {
    const controller = this.startRequest('lights');

    try {
      const response = await this.api.get('/lights', { signal: controller.signal });
      if (controller.signal.aborted) return;

      const lights = asRecord(response.data);
      if (!lights) throw new Error('Hue API returned an invalid light collection');

      this.discoveredLightIds.clear();
      for (const [id, light] of Object.entries(lights)) {
        const lightData = asRecord(light);
        if (!isTopicSegment(id) || !lightData) continue;

        this.discoveredLightIds.add(id);
        this.publishLight(id, lightData);
      }

      this.mqtt.publish(this.bridgeTopic('connected'), true);
    } catch (error) {
      if (controller.signal.aborted) return;

      this.mqtt.publish(this.bridgeTopic('connected'), false);
      this.logger.error(`Failed to refresh lights for host ${this.cfg.host}`, error);
    } finally {
      this.finishRequest('lights', controller);
    }
  }

  private publishLight(id: string, light: HueLight) {
    const { state, ...info } = light;
    this.publishSection(id, 'info', info);
    this.publishSection(id, 'state', asRecord(state) ?? {});
  }

  private publishSection(id: string, section: 'info' | 'state', data: HueLight) {
    this.mqtt.publish(this.lightTopic(id, section, 'json'), JSON.stringify(data));

    for (const [key, value] of Object.entries(data))
      if (isTopicSegment(key) && isMqttScalar(value)) this.mqtt.publish(this.lightTopic(id, section, key), value);
  }

  private async setLightState(lightId: string, state: Record<string, boolean | number | string | number[]>) {
    const controller = this.startRequest(`set-light:${lightId}`);

    try {
      await this.api.put(`/lights/${lightId}/state`, state, { signal: controller.signal });
      if (!controller.signal.aborted) void this.refreshLights();
    } catch (error) {
      if (!controller.signal.aborted) this.logger.error(`Failed to set state for light ${lightId}`, error);
    } finally {
      this.finishRequest(`set-light:${lightId}`, controller);
    }
  }
}

function asRecord(value: unknown): HueLight | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as HueLight) : undefined;
}

function isTopicSegment(value: string) {
  return value.length > 0 && !value.includes('/');
}

function isMqttScalar(value: unknown): value is string | number | boolean {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}
