export const DEFAULT_MAPPING_OPTION_COLOR = "#d8d8d8";

export const MAPPING_OPTION_COLORS = [
  "#e6b0b0",
  "#e6cab0",
  "#e1e6b0",
  "#b0e6bf",
  "#9cdacd",
  "#96c9e1",
  "#a7adc6",
  "#b4a9ed",
  "#e2a9ed",
  "#e89dba",
  "#c69696",
] as const;

export const getRandomMappingOptionColor = () =>
  MAPPING_OPTION_COLORS[Math.floor(Math.random() * MAPPING_OPTION_COLORS.length)] ?? DEFAULT_MAPPING_OPTION_COLOR;

export const normalizeMappingColor = (color: string | null | undefined) => {
  if (!color) {
    return DEFAULT_MAPPING_OPTION_COLOR;
  }

  const trimmed = color.trim();
  return /^#[0-9a-fA-F]{3,8}$/.test(trimmed) ? trimmed : DEFAULT_MAPPING_OPTION_COLOR;
};
