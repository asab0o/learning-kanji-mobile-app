/**
 * オンボーディングの公開API。`src/app/` からはここだけを import する。
 *
 * **`@/db` にも `expo-router` にも到達しない。** 遷移とフラグの保存は
 * `src/app/onboarding.tsx` が持つ(docs/architecture.md)。
 */

export { OnboardingView } from './components/onboarding-view';
export { ONBOARDING_STEPS } from './steps';
export type { OnboardingSample, OnboardingStep, OnboardingStepId } from './steps';
