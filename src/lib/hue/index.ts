import { HttpMqttBridge } from '~/lib/http-mqtt-bridge';
import { HueCommand, HueCommandPayload } from '~/lib/hue/types';
import type { MqttBridgeClient } from '~/modules/mqtt/mqtt.service';
import { HueConfig } from '~/types/config/hue';
import { objectToMap, parseObject } from '~/util/object';

/**
 * Executes `Hue`.
 */
export class Hue extends HttpMqttBridge<HueConfig> {
  private commandsSubscribed = false;

  /**
   * Creates the class instance.
   * @param cfg - Value of type `{ id: string; enabled: boolean; topic: string; host: string; username: string; interval: number; lights: { id: string; }[]; }`.
   * @param mqtt - Value of type `MqttBridgeClient`.
   */
  constructor(cfg: HueConfig, mqtt: MqttBridgeClient) {
    super(cfg, mqtt, `HUE@${cfg.host}`, `http://${cfg.host}/api/${cfg.username}`);
  }
  //#region instance lifecycle
  /**
   * Executes `setup`.
   * @returns Result of type `void`.
   */
  public setup() {
    this.logger.debug(`Setting up Hue instance for host: ${this.cfg.host}`);
    this.mqtt.publish(`${this.cfg.topic}/connected`, false);
    this.subscribeCommands();

    void this.getInstanceState();
    this.poll('lights', this.cfg.interval, () => {
      this.logger.debug(`Polling Hue light states`);
      this.getLightsState();
    });
  }

  /**
   * Executes `destroy`.
   * @returns Result of type `void`.
   */
  public override destroy() {
    this.mqtt.publish(`${this.cfg.topic}/connected`, false);
    super.destroy();
  }
  //#endregion

  //#region state
  /**
   * Executes `getInstanceState`.
   * @returns Result of type `Promise<void>`.
   */
  private async getInstanceState() {
    const controller = this.startRequest('instance');

    try {
      const res = await this.api.get('', { signal: controller.signal });
      if (controller.signal.aborted) return;
      this.mqtt.publish(`${this.cfg.topic}/connected`, true);

      const data = parseObject(res.data);
      const dataMap = objectToMap(data);

      for (const [key, value] of dataMap) {
        const topic = `${this.cfg.topic}/${key}`;
        this.mqtt.publish(topic, value);
      }
    } catch (err) {
      if (controller.signal.aborted) return;

      this.mqtt.publish(`${this.cfg.topic}/connected`, false);
      this.logger.error(`Failed to get instance state for host ${this.cfg.host}`, err);
    } finally {
      this.finishRequest('instance', controller);
    }
  }

  /**
   * Executes `getLightsState`.
   * @returns Result of type `void`.
   */
  private getLightsState() {
    for (const light of this.cfg.lights) {
      void this.getLightState(light.id);
    }
  }

  /**
   * Executes `getLightState`.
   * @param id - Value of type `string`.
   * @returns Result of type `Promise<void>`.
   */
  private async getLightState(id: string) {
    this.logger.debug(`Getting state for light ${id}`);
    const key = `light:${id}`;
    const controller = this.startRequest(key);

    try {
      const res = await this.api.get(`/lights/${id}`, { signal: controller.signal });
      if (controller.signal.aborted) return;

      const data = parseObject(res.data);
      const dataMap = objectToMap(data);

      for (const [key, value] of dataMap) {
        const topic = `${this.cfg.topic}/lights/${id}/${key}`;
        this.mqtt.publish(topic, value);
      }
    } catch (err) {
      if (controller.signal.aborted) return;

      this.logger.error(`Failed to get state for light ${id}: ${err}`);
    } finally {
      this.finishRequest(key, controller);
    }
  }
  //#endregion

  //#region commands
  /**
   * Executes `subscribeCommands`.
   * @returns Result of type `void`.
   */
  private subscribeCommands() {
    if (this.commandsSubscribed) return;

    const cmdTopic = `${this.cfg.topic}/cmd`;
    this.logger.debug(`Subscribing to command topic: ${cmdTopic}`);

    this.subscribe(cmdTopic, (_, payload) => {
      if (payload === '') return;

      const cmd = JSON.parse(payload) as HueCommandPayload;
      this.handleCommand(cmd);

      this.mqtt.publish(cmdTopic, null);
    });
    this.commandsSubscribed = true;
  }

  /**
   * Executes `handleCommand`.
   * @param cmd - Value of type `HueCommandPayload`.
   * @returns Result of type `void`.
   */
  private handleCommand(cmd: HueCommandPayload) {
    switch (cmd.cmd) {
      case HueCommand.GetInstance:
        void this.getInstanceState();
        break;
      case HueCommand.SetLightState:
        void this.setLightState(cmd.light, cmd.state);
        break;
    }
  }

  /**
   * Executes `setLightState`.
   * @param light - Value of type `string`.
   * @param state - Value of type `Record<string, unknown>`.
   * @returns Result of type `Promise<void>`.
   */
  private async setLightState(light: string, state: Record<string, unknown>) {
    const key = `set-light:${light}`;
    const controller = this.startRequest(key);

    try {
      await this.api.put(`/lights/${light}/state`, state, { signal: controller.signal });
      if (controller.signal.aborted) return;

      void this.getLightState(light);
    } catch (err) {
      if (controller.signal.aborted) return;

      this.logger.error(`Failed to set state for light ${light}: ${err}`);
    } finally {
      this.finishRequest(key, controller);
    }
  }
  //#endregion
}
