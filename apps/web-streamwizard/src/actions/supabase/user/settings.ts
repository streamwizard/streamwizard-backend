"use server";
import { createClient } from "@repo/supabase/next/server";
import { getUserPreferences as _getUserPreferences, updateUserPreferences as _updateUserPreferences } from "@repo/supabase/queries/user";
import { userPreferencesSchema } from "@/schemas/user-preferences";
import { z } from "zod";
import { reportError } from "@repo/sentry";

export async function updateUserPreferences(user_id: string, formData: z.infer<typeof userPreferencesSchema>) {
  const supabase = await createClient();
  try {
    await _updateUserPreferences(supabase, user_id, formData);
    return true;
  } catch (error) {
    reportError(error, "actions/user/settings");
    return false;
  }
}

export async function GetUserPreferences() {
  const supabase = await createClient();
  return _getUserPreferences(supabase);
}

// Persists in-progress onboarding values without marking onboarding as
// complete — used before navigating away for the Discord OAuth round trip,
// since the wizard's step/values otherwise only live in client state and
// would be lost when the browser leaves the page.
export async function saveOnboardingProgress(preferences: Partial<z.infer<typeof userPreferencesSchema>>) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return false;
  try {
    await _updateUserPreferences(supabase, user.id, preferences);
    return true;
  } catch (error) {
    reportError(error, "actions/user/settings");
    return false;
  }
}

export async function completeOnboarding(preferences: z.infer<typeof userPreferencesSchema>) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return false;
  try {
    await _updateUserPreferences(supabase, user.id, { ...preferences, onboarding_completed: true });
    return true;
  } catch (error) {
    reportError(error, "actions/user/settings");
    return false;
  }
}
