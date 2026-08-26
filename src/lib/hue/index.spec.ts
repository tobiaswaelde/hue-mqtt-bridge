const mockAxiosGet = jest.fn();
const mockAxiosPut = jest.fn();
const mockAxiosCreate = jest.fn(() => ({ get: mockAxiosGet, put: mockAxiosPut }));
const mockMqttPublish = jest.fn();
const mockMqttSubscribe = jest.fn(() => jest.fn());

jest.mock('axios', () => ({
  __esModule: true,
  default: { create: mockAxiosCreate },
}));

import type { MqttBridgeClient, MqttMessageHandler } from '~/modules/mqtt/mqtt.service';
import { Hue } from './index';

const config = {
  enabled: true,
  host: 'hue.local',
  id: 'test',
  interval: 1_000,
  topic: 'dev/hue/home',
  username: 'test-user',
};

function createHue() {
  return new Hue(config, { publish: mockMqttPublish, subscribe: mockMqttSubscribe } as MqttBridgeClient);
}

describe('Hue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('discovers all lights and publishes a stable topic tree', async () => {
    mockAxiosGet.mockResolvedValue({
      data: {
        '1': {
          config: { reachable: true },
          name: 'Living room light',
          state: { bri: 42, on: true },
          type: 'Extended color light',
        },
      },
    });
    const hue = createHue();

    await (hue as unknown as { refreshLights: () => Promise<void> }).refreshLights();

    expect(mockAxiosGet).toHaveBeenCalledWith('/lights', expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(mockMqttPublish).toHaveBeenCalledWith(
      'dev/hue/home/lights/1/info/json',
      JSON.stringify({ config: { reachable: true }, name: 'Living room light', type: 'Extended color light' }),
    );
    expect(mockMqttPublish).toHaveBeenCalledWith('dev/hue/home/lights/1/info/name', 'Living room light');
    expect(mockMqttPublish).toHaveBeenCalledWith(
      'dev/hue/home/lights/1/state/json',
      JSON.stringify({ bri: 42, on: true }),
    );
    expect(mockMqttPublish).toHaveBeenCalledWith('dev/hue/home/lights/1/state/bri', 42);
    expect(mockMqttPublish).toHaveBeenCalledWith('dev/hue/home/lights/1/state/on', true);
    expect(mockMqttPublish).toHaveBeenCalledWith('dev/hue/home/bridge/connected', true);
    expect(mockMqttPublish.mock.calls.some(([topic]) => topic.includes('/0/'))).toBe(false);
  });

  it('only accepts valid commands for discovered lights', async () => {
    mockAxiosGet.mockResolvedValue({ data: { '1': { name: 'Desk', state: { on: false } } } });
    mockAxiosPut.mockResolvedValue({ data: [] });
    const hue = createHue();
    await (hue as unknown as { refreshLights: () => Promise<void> }).refreshLights();

    hue.setup();
    const [, lightCommandHandler] = mockMqttSubscribe.mock.calls[1] as unknown as [string, MqttMessageHandler];
    lightCommandHandler('dev/hue/home/lights/1/command/json', '{"state":{"on":true,"bri":180}}');
    await Promise.resolve();

    expect(mockAxiosPut).toHaveBeenCalledWith(
      '/lights/1/state',
      { on: true, bri: 180 },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(mockMqttPublish).toHaveBeenCalledWith('dev/hue/home/lights/1/command/json', null);

    mockAxiosPut.mockClear();
    lightCommandHandler('dev/hue/home/lights/2/command/json', '{"state":{"on":true}}');
    lightCommandHandler('dev/hue/home/lights/1/command/json', 'not-json');
    expect(mockAxiosPut).not.toHaveBeenCalled();
  });

  it('aborts the previous discovery request and active requests during shutdown', () => {
    mockAxiosGet.mockImplementation(() => new Promise(() => undefined));
    const hue = createHue();
    const refreshLights = hue as unknown as { refreshLights: () => Promise<void> };

    void refreshLights.refreshLights();
    void refreshLights.refreshLights();

    const firstSignal = mockAxiosGet.mock.calls[0][1].signal as AbortSignal;
    const secondSignal = mockAxiosGet.mock.calls[1][1].signal as AbortSignal;
    expect(firstSignal.aborted).toBe(true);
    expect(secondSignal.aborted).toBe(false);

    hue.destroy();

    expect(secondSignal.aborted).toBe(true);
  });

  it('removes command subscriptions during shutdown', () => {
    const unsubscribeRefresh = jest.fn();
    const unsubscribeLights = jest.fn();
    mockMqttSubscribe.mockReturnValueOnce(unsubscribeRefresh).mockReturnValueOnce(unsubscribeLights);
    mockAxiosGet.mockResolvedValue({ data: {} });
    const hue = createHue();

    hue.setup();
    hue.destroy();

    expect(unsubscribeRefresh).toHaveBeenCalledTimes(1);
    expect(unsubscribeLights).toHaveBeenCalledTimes(1);
  });

  it('runs the discovery poll only after its configured interval', () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000);
    mockAxiosGet.mockResolvedValue({ data: {} });
    const hue = createHue();

    hue.setup();
    mockAxiosGet.mockClear();

    hue.loop(1_999);
    expect(mockAxiosGet).not.toHaveBeenCalled();

    hue.loop(2_000);
    expect(mockAxiosGet).toHaveBeenCalledWith('/lights', expect.objectContaining({ signal: expect.any(AbortSignal) }));
    now.mockRestore();
  });
});
