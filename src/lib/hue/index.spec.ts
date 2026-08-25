const mockAxiosGet = jest.fn();
const mockAxiosCreate = jest.fn(() => ({ get: mockAxiosGet }));
const mockMqttPublish = jest.fn();
const mockMqttSubscribe = jest.fn(() => jest.fn());

jest.mock('axios', () => ({
  __esModule: true,
  default: { create: mockAxiosCreate },
}));

import type { MqttBridgeClient } from '~/modules/mqtt/mqtt.service';
import { Hue } from './index';

describe('Hue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('publishes each flattened light value below the configured topic', async () => {
    mockAxiosGet.mockResolvedValue({
      data: {
        name: 'Living room light',
        state: { bri: '42', on: true },
      },
    });
    const hue = new Hue(
      {
        enabled: true,
        id: 'test',
        host: 'hue.local',
        interval: 1_000,
        lights: [{ id: '1' }],
        topic: 'dev/hue/home',
        username: 'test-user',
      },
      { publish: mockMqttPublish, subscribe: mockMqttSubscribe } as MqttBridgeClient,
    );

    await (hue as unknown as { getLightState: (id: string) => Promise<void> }).getLightState('1');

    expect(mockMqttPublish).toHaveBeenCalledWith('dev/hue/home/lights/1/name', 'Living room light');
    expect(mockMqttPublish).toHaveBeenCalledWith('dev/hue/home/lights/1/state/bri', 42);
    expect(mockMqttPublish).toHaveBeenCalledWith('dev/hue/home/lights/1/state/on', true);
  });

  it('aborts the previous request for a light and all active requests during shutdown', () => {
    mockAxiosGet.mockImplementation(() => new Promise(() => undefined));
    const hue = new Hue(
      {
        enabled: true,
        id: 'test',
        host: 'hue.local',
        interval: 1_000,
        lights: [{ id: '1' }],
        topic: 'dev/hue/home',
        username: 'test-user',
      },
      { publish: mockMqttPublish, subscribe: mockMqttSubscribe } as MqttBridgeClient,
    );
    const getLightState = hue as unknown as { getLightState: (id: string) => Promise<void> };

    void getLightState.getLightState('1');
    void getLightState.getLightState('1');

    const firstSignal = mockAxiosGet.mock.calls[0][1].signal as AbortSignal;
    const secondSignal = mockAxiosGet.mock.calls[1][1].signal as AbortSignal;
    expect(firstSignal.aborted).toBe(true);
    expect(secondSignal.aborted).toBe(false);

    hue.destroy();

    expect(secondSignal.aborted).toBe(true);
  });

  it('removes command subscriptions during shutdown', () => {
    const unsubscribeCommands = jest.fn();
    mockMqttSubscribe.mockReturnValue(unsubscribeCommands);
    mockAxiosGet.mockResolvedValue({ data: {} });
    const hue = new Hue(
      {
        enabled: true,
        id: 'test',
        host: 'hue.local',
        interval: 1_000,
        lights: [],
        topic: 'dev/hue/home',
        username: 'test-user',
      },
      { publish: mockMqttPublish, subscribe: mockMqttSubscribe } as MqttBridgeClient,
    );

    hue.setup();
    hue.destroy();

    expect(unsubscribeCommands).toHaveBeenCalledTimes(1);
  });

  it('runs the registered light poll only after its configured interval', () => {
    mockAxiosGet.mockResolvedValue({ data: {} });
    const hue = new Hue(
      {
        enabled: true,
        id: 'test',
        host: 'hue.local',
        interval: 1_000,
        lights: [{ id: '1' }],
        topic: 'dev/hue/home',
        username: 'test-user',
      },
      { publish: mockMqttPublish, subscribe: mockMqttSubscribe } as MqttBridgeClient,
    );

    hue.setup();
    mockAxiosGet.mockClear();

    hue.loop(1_000);
    expect(mockAxiosGet).toHaveBeenCalledTimes(1);
    expect(mockAxiosGet).toHaveBeenCalledWith(
      '/lights/1',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );

    mockAxiosGet.mockClear();
    hue.loop(1_999);
    expect(mockAxiosGet).not.toHaveBeenCalled();

    hue.loop(2_000);
    expect(mockAxiosGet).toHaveBeenCalledTimes(1);
  });
});
