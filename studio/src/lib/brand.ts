import {z} from 'zod';
import noban from '../../../brands/noban.json';

const hex = z.string().regex(/^#[0-9a-f]{6}$/i, 'expected #rrggbb hex color');

export const brandSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  tagline: z.string().min(1),
  url: z.string().min(1),
  colors: z.object({
    bg: hex,
    surface: hex,
    surface2: hex,
    line: hex,
    ink: hex,
    ink2: hex,
    ink3: hex,
    brand: hex,
    profit: hex,
    safe: hex,
    loss: hex,
    info: hex,
    rare: hex,
  }),
  fonts: z.object({
    display: z.string().min(1),
    body: z.string().min(1),
    mono: z.string().min(1),
  }),
  voice: z.string().min(1),
});

export type Brand = z.infer<typeof brandSchema>;

const registry: Record<string, unknown> = {noban};

export const getBrand = (id: string): Brand => {
  const raw = registry[id];
  if (raw === undefined) {
    throw new Error(
      `Unknown brand "${id}". Available: ${Object.keys(registry).join(', ')}`,
    );
  }
  return brandSchema.parse(raw);
};
