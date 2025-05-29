import { ModelProvider } from './tts.entity';

export const PROVIDER_FLAGS: Record<ModelProvider, boolean> = {
  [ModelProvider.OPENAI]: true,
  [ModelProvider.ELEVENLABS]: false, // Set to true when ready
  [ModelProvider.AZURE]: false,
  [ModelProvider.GOOGLE]: false,
  [ModelProvider.AWS]: false,
};
