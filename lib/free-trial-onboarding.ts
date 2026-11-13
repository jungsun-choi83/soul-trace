export const FREE_TRIAL_SAVE_AUTH_PATH = "/auth?mode=signup&returnTo=%2Ftry%2Fsave";

export function freeTrialSaveDestination(isAuthenticated: boolean): string {
  return isAuthenticated ? "/dashboard" : FREE_TRIAL_SAVE_AUTH_PATH;
}
