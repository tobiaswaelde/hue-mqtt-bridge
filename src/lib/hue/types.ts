export enum HueCommand {
  GetInstance = 'get-instance',
  SetLightState = 'set-light-state',
}

export type HueCommandPayload =
  | { cmd: HueCommand.GetInstance }
  | {
      cmd: HueCommand.SetLightState;
      light: string;
      state: Record<string, unknown>;
    };
