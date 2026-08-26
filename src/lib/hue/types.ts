import { z } from 'zod';

/** A command body accepted on a discovered light's MQTT command topic. */
export const hueLightCommandSchema = z.object({
  state: z
    .record(z.string().min(1), z.union([z.boolean(), z.number().finite(), z.string(), z.array(z.number().finite())]))
    .refine((state) => Object.keys(state).length > 0, 'state must not be empty'),
});

export type HueLightCommand = z.infer<typeof hueLightCommandSchema>;

export type HueLight = Record<string, unknown>;
